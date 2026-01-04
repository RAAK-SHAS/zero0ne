import { createContext, useContext, useState, useCallback, useRef, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const CHUNK_SIZE = 2 * 1024 * 1024; // 2MB chunks
const MAX_RETRIES = 3;
const DB_NAME = 'CloudStoreUploads';
const STORE_NAME = 'uploads';

export interface UploadItem {
  id: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  storagePath: string;
  uploadedChunks: number[];
  totalChunks: number;
  status: 'pending' | 'queued' | 'uploading' | 'paused' | 'completed' | 'error';
  error?: string;
  progress: number;
  bytesUploaded: number;
  speed: number;
  eta: number;
  createdAt: number;
  priority: number;
  folderPath?: string;
  file?: File;
}

export interface UploadDiagnostics {
  id: string;
  fileName: string;
  fileSize: number;
  storagePath: string;
  totalChunks: number;
  uploadedChunks: number[];
  lastUploadedChunk: number | null;
  failedAt: string | null;
  error: string | null;
  createdAt: number;
  status: string;
}

interface UploadContextType {
  uploads: Record<string, UploadItem>;
  isUploading: boolean;
  addFiles: (files: File[], userId: string, folderPath?: string) => void;
  pauseUpload: (id: string) => void;
  resumeUpload: (id: string, file: File) => void;
  cancelUpload: (id: string) => void;
  clearCompleted: () => void;
  reorderUpload: (id: string, direction: 'up' | 'down') => void;
  getActiveCount: () => number;
  getPendingCount: () => number;
  getTotalProgress: () => number;
  pauseAll: () => void;
  resumeAll: () => void;
  moveToFront: (id: string) => void;
  getUploadDiagnostics: (id: string) => UploadDiagnostics | null;
  retryUpload: (id: string) => void;
  getPausedUploadsNeedingFile: () => UploadItem[];
  throttleRate: number; // bytes per second, 0 = unlimited
  setThrottleRate: (rate: number) => void;
}

const UploadContext = createContext<UploadContextType | null>(null);

export const useUploadManager = () => {
  const context = useContext(UploadContext);
  if (!context) {
    throw new Error('useUploadManager must be used within UploadProvider');
  }
  return context;
};

export const UploadProvider = ({ children }: { children: ReactNode }) => {
  const [uploads, setUploads] = useState<Record<string, UploadItem>>({});
  const uploadsRef = useRef<Record<string, UploadItem>>({});
  const [isUploading, setIsUploading] = useState(false);
  const [throttleRate, setThrottleRate] = useState(0); // 0 = unlimited
  const throttleRateRef = useRef(0);
  const abortControllers = useRef<Record<string, AbortController>>({});
  const pausedUploads = useRef<Set<string>>(new Set());
  const speedTracking = useRef<Record<string, { bytes: number; timestamp: number }[]>>({});
  const fileRefs = useRef<Record<string, File>>({});
  const uploadQueue = useRef<string[]>([]);
  const currentUserId = useRef<string>('');
  useEffect(() => {
    uploadsRef.current = uploads;
  }, [uploads]);

  useEffect(() => {
    throttleRateRef.current = throttleRate;
  }, [throttleRate]);

  const openDB = useCallback((): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
    });
  }, []);

  const saveUploadState = useCallback(async (state: UploadItem) => {
    try {
      const db = await openDB();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const { file, ...stateWithoutFile } = state;
      store.put({ ...stateWithoutFile, userId: currentUserId.current });
      await new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    } catch (error) {
      console.error('Failed to save upload state:', error);
    }
  }, [openDB]);

  const deleteUploadState = useCallback(async (id: string) => {
    try {
      const db = await openDB();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.delete(id);
      await new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    } catch (error) {
      console.error('Failed to delete upload state:', error);
    }
  }, [openDB]);

  const sanitizeFileName = (name: string): string => {
    return name
      .replace(/[^\w\s.-]/g, '_')
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_')
      .slice(0, 100);
  };

  const generateUploadId = (file: File, userId: string): string => {
    return `${userId}_${file.name}_${file.size}_${file.lastModified}`;
  };

  const calculateSpeed = (uploadId: string, newBytes: number): number => {
    const now = Date.now();
    if (!speedTracking.current[uploadId]) {
      speedTracking.current[uploadId] = [];
    }
    
    speedTracking.current[uploadId].push({ bytes: newBytes, timestamp: now });
    speedTracking.current[uploadId] = speedTracking.current[uploadId].filter(
      d => now - d.timestamp < 10000
    );
    
    const data = speedTracking.current[uploadId];
    if (data.length < 2) return 0;
    
    const timeDiff = (data[data.length - 1].timestamp - data[0].timestamp) / 1000;
    const bytesDiff = data[data.length - 1].bytes - data[0].bytes;
    
    return timeDiff > 0 ? bytesDiff / timeDiff : 0;
  };

  const uploadChunkWithRetry = async (
    chunk: Blob,
    path: string,
    signal: AbortSignal,
    retries = 0
  ): Promise<boolean> => {
    try {
      const { error } = await supabase.storage
        .from('user-files')
        .upload(path, chunk, {
          cacheControl: '3600',
          upsert: true,
        });

      if (error) throw error;
      return true;
    } catch (error) {
      if (retries < MAX_RETRIES && !signal.aborted) {
        await new Promise(r => setTimeout(r, 1000 * (retries + 1)));
        return uploadChunkWithRetry(chunk, path, signal, retries + 1);
      }
      throw error;
    }
  };

  const combineChunks = async (
    storagePath: string,
    totalChunks: number,
    fileType: string
  ): Promise<boolean> => {
    try {
      const chunks: Blob[] = [];
      
      for (let i = 0; i < totalChunks; i++) {
        const chunkPath = `${storagePath}.chunk_${i}`;
        const { data, error } = await supabase.storage
          .from('user-files')
          .download(chunkPath);
        
        if (error) throw error;
        chunks.push(data);
      }
      
      const combinedBlob = new Blob(chunks, { type: fileType });
      
      const { error: uploadError } = await supabase.storage
        .from('user-files')
        .upload(storagePath, combinedBlob, {
          cacheControl: '3600',
          upsert: true,
        });
      
      if (uploadError) throw uploadError;
      
      // Clean up chunks
      const chunkPaths = Array.from({ length: totalChunks }, (_, i) => `${storagePath}.chunk_${i}`);
      await supabase.storage.from('user-files').remove(chunkPaths);
      
      return true;
    } catch (error) {
      console.error('Failed to combine chunks:', error);
      throw error;
    }
  };

  const processNextInQueue = useCallback(async () => {
    if (uploadQueue.current.length === 0) {
      setIsUploading(false);
      return;
    }

    const uploadId = uploadQueue.current[0];
    const upload = uploadsRef.current[uploadId];
    if (!upload || !fileRefs.current[uploadId]) {
      uploadQueue.current.shift();
      processNextInQueue();
      return;
    }

    const file = fileRefs.current[uploadId];
    setIsUploading(true);

    abortControllers.current[uploadId] = new AbortController();
    const signal = abortControllers.current[uploadId].signal;
    pausedUploads.current.delete(uploadId);

    let state: UploadItem = { ...upload, status: 'uploading' };
    setUploads(prev => ({ ...prev, [uploadId]: state }));
    await saveUploadState(state);

    try {
      const useChunked = file.size > 50 * 1024 * 1024;

      if (!useChunked) {
        // Direct upload
        const { error } = await supabase.storage
          .from('user-files')
          .upload(state.storagePath, file, {
            cacheControl: '3600',
            upsert: false,
          });

        if (error) throw error;

        state.progress = 100;
        state.status = 'completed';
        state.bytesUploaded = file.size;
      } else {
        // Chunked upload
        for (let i = 0; i < state.totalChunks; i++) {
          if (pausedUploads.current.has(uploadId) || signal.aborted) {
            state.status = 'paused';
            setUploads(prev => ({ ...prev, [uploadId]: state }));
            await saveUploadState(state);
            uploadQueue.current.shift();
            processNextInQueue();
            return;
          }

          if (state.uploadedChunks.includes(i)) continue;

          const start = i * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, file.size);
          const chunk = file.slice(start, end);
          const chunkPath = `${state.storagePath}.chunk_${i}`;

          // Apply throttling delay if set
          const currentThrottle = throttleRateRef.current;
          if (currentThrottle > 0) {
            const chunkSize = end - start;
            const expectedTime = (chunkSize / currentThrottle) * 1000; // ms
            const startTime = Date.now();
            await uploadChunkWithRetry(chunk, chunkPath, signal);
            const elapsed = Date.now() - startTime;
            if (elapsed < expectedTime) {
              await new Promise(r => setTimeout(r, expectedTime - elapsed));
            }
          } else {
            await uploadChunkWithRetry(chunk, chunkPath, signal);
          }

          state.uploadedChunks.push(i);
          state.bytesUploaded = Math.min(state.uploadedChunks.length * CHUNK_SIZE, file.size);
          state.progress = Math.round((state.uploadedChunks.length / state.totalChunks) * 95);
          state.speed = calculateSpeed(uploadId, state.bytesUploaded);
          state.eta = state.speed > 0 ? (file.size - state.bytesUploaded) / state.speed : 0;

          setUploads(prev => ({ ...prev, [uploadId]: { ...state } }));
          await saveUploadState(state);
        }

        if (state.uploadedChunks.length === state.totalChunks) {
          state.progress = 97;
          setUploads(prev => ({ ...prev, [uploadId]: { ...state } }));
          
          await combineChunks(state.storagePath, state.totalChunks, state.fileType);
          state.progress = 100;
          state.status = 'completed';
        }
      }

      // Create database record - check if already exists first
      const fileName = state.folderPath ? `${state.folderPath}/${state.fileName}` : state.fileName;
      
      // Check if a record with this storage_path already exists
      const { data: existingFile } = await supabase
        .from('files')
        .select('id')
        .eq('storage_path', state.storagePath)
        .maybeSingle();
      
      if (!existingFile) {
        const { error: dbError } = await supabase
          .from('files')
          .insert({
            user_id: currentUserId.current,
            name: fileName,
            size_bytes: file.size,
            mime_type: state.fileType,
            storage_path: state.storagePath
          });

        if (dbError) throw dbError;
      }

      setUploads(prev => ({ ...prev, [uploadId]: state }));
      await deleteUploadState(uploadId);
      toast.success(`${state.fileName} uploaded successfully!`);

    } catch (error: any) {
      if (!pausedUploads.current.has(uploadId)) {
        state.status = 'error';
        state.error = error.message || 'Upload failed';
        setUploads(prev => ({ ...prev, [uploadId]: state }));
        await saveUploadState(state);
        toast.error(`Failed to upload ${state.fileName}`);
      }
    } finally {
      delete abortControllers.current[uploadId];
      delete speedTracking.current[uploadId];
      uploadQueue.current.shift();
      processNextInQueue();
    }
  }, [uploads, saveUploadState, deleteUploadState]);

  const addFiles = useCallback((files: File[], userId: string, folderPath?: string) => {
    currentUserId.current = userId;
    const newUploads: Record<string, UploadItem> = {};
    const newQueueItems: string[] = [];

    files.forEach((file, index) => {
      const uploadId = generateUploadId(file, userId);
      const sanitizedName = sanitizeFileName(file.name);
      const storagePath = folderPath 
        ? `${userId}/${folderPath}/${Date.now()}-${sanitizedName}`
        : `${userId}/${Date.now()}-${sanitizedName}`;
      const totalChunks = file.size > 50 * 1024 * 1024 
        ? Math.ceil(file.size / CHUNK_SIZE) 
        : 1;

      fileRefs.current[uploadId] = file;

      newUploads[uploadId] = {
        id: uploadId,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        storagePath,
        uploadedChunks: [],
        totalChunks,
        status: 'queued',
        progress: 0,
        bytesUploaded: 0,
        speed: 0,
        eta: 0,
        createdAt: Date.now(),
        priority: Object.keys(uploads).length + index,
        folderPath,
        file,
      };

      newQueueItems.push(uploadId);
    });

    // Update the ref immediately so queue processing can see the new items
    uploadsRef.current = { ...uploadsRef.current, ...newUploads };
    setUploads(prev => ({ ...prev, ...newUploads }));
    uploadQueue.current.push(...newQueueItems);

    if (!isUploading) {
      // Start on next tick to avoid racing React state updates
      setTimeout(() => processNextInQueue(), 0);
    }
  }, [uploads, isUploading, processNextInQueue]);

  const pauseUpload = useCallback((id: string) => {
    pausedUploads.current.add(id);
    if (abortControllers.current[id]) {
      abortControllers.current[id].abort();
    }

    const next = { ...uploadsRef.current[id], status: 'paused' as const };
    uploadsRef.current = { ...uploadsRef.current, [id]: next };

    setUploads(prev => ({
      ...prev,
      [id]: { ...prev[id], status: 'paused' }
    }));
    toast.info('Upload paused');
  }, []);

  const resumeUpload = useCallback((id: string, file: File) => {
    pausedUploads.current.delete(id);
    fileRefs.current[id] = file;

    const next = { ...uploadsRef.current[id], status: 'queued' as const, file };
    uploadsRef.current = { ...uploadsRef.current, [id]: next };

    setUploads(prev => ({
      ...prev,
      [id]: { ...prev[id], status: 'queued', file }
    }));

    uploadQueue.current.push(id);

    if (!isUploading) {
      setTimeout(() => processNextInQueue(), 0);
    }
  }, [isUploading, processNextInQueue]);

  const cancelUpload = useCallback(async (id: string) => {
    pausedUploads.current.add(id);
    if (abortControllers.current[id]) {
      abortControllers.current[id].abort();
    }

    const state = uploads[id];
    if (state && state.totalChunks > 1) {
      const chunkPaths = state.uploadedChunks.map(i => `${state.storagePath}.chunk_${i}`);
      if (chunkPaths.length > 0) {
        await supabase.storage.from('user-files').remove(chunkPaths);
      }
    }

    uploadQueue.current = uploadQueue.current.filter(qId => qId !== id);
    await deleteUploadState(id);
    delete fileRefs.current[id];
    
    setUploads(prev => {
      const newUploads = { ...prev };
      delete newUploads[id];
      return newUploads;
    });
  }, [uploads, deleteUploadState]);

  const clearCompleted = useCallback(() => {
    setUploads(prev => {
      const newUploads: typeof prev = {};
      Object.entries(prev).forEach(([id, state]) => {
        if (state.status !== 'completed') {
          newUploads[id] = state;
        }
      });
      return newUploads;
    });
  }, []);

  const reorderUpload = useCallback((id: string, direction: 'up' | 'down') => {
    const queueIndex = uploadQueue.current.indexOf(id);
    if (queueIndex === -1) return;

    const newIndex = direction === 'up' ? queueIndex - 1 : queueIndex + 1;
    if (newIndex < 1 || newIndex >= uploadQueue.current.length) return; // Can't move first item (currently uploading)

    const temp = uploadQueue.current[queueIndex];
    uploadQueue.current[queueIndex] = uploadQueue.current[newIndex];
    uploadQueue.current[newIndex] = temp;

    // Update priorities
    setUploads(prev => {
      const newUploads = { ...prev };
      uploadQueue.current.forEach((uploadId, index) => {
        if (newUploads[uploadId]) {
          newUploads[uploadId] = { ...newUploads[uploadId], priority: index };
        }
      });
      return newUploads;
    });
  }, []);

  const getActiveCount = useCallback(() => {
    return Object.values(uploads).filter(u => u.status === 'uploading').length;
  }, [uploads]);

  const getPendingCount = useCallback(() => {
    return Object.values(uploads).filter(u => 
      u.status === 'queued' || u.status === 'uploading' || u.status === 'paused'
    ).length;
  }, [uploads]);

  const getTotalProgress = useCallback(() => {
    const activeUploads = Object.values(uploads).filter(u => 
      u.status === 'uploading' || u.status === 'queued' || u.status === 'paused'
    );
    if (activeUploads.length === 0) return 0;
    return activeUploads.reduce((sum, u) => sum + u.progress, 0) / activeUploads.length;
  }, [uploads]);

  const pauseAll = useCallback(() => {
    Object.keys(uploads).forEach(id => {
      if (uploads[id].status === 'uploading' || uploads[id].status === 'queued') {
        pauseUpload(id);
      }
    });
  }, [uploads, pauseUpload]);

  const resumeAll = useCallback(() => {
    Object.values(uploads).forEach(upload => {
      if (upload.status === 'paused' && upload.file) {
        resumeUpload(upload.id, upload.file);
      }
    });
  }, [uploads, resumeUpload]);

  const moveToFront = useCallback((id: string) => {
    const queueIndex = uploadQueue.current.indexOf(id);
    if (queueIndex <= 1) return; // Already first or currently uploading
    
    // Move to position 1 (after currently uploading)
    uploadQueue.current.splice(queueIndex, 1);
    uploadQueue.current.splice(1, 0, id);
    
    // Update priorities
    setUploads(prev => {
      const newUploads = { ...prev };
      uploadQueue.current.forEach((uploadId, index) => {
        if (newUploads[uploadId]) {
          newUploads[uploadId] = { ...newUploads[uploadId], priority: index };
        }
      });
      return newUploads;
    });
    
    toast.info('Moved to front of queue');
  }, []);

  const getUploadDiagnostics = useCallback((id: string): UploadDiagnostics | null => {
    const upload = uploads[id];
    if (!upload) return null;
    
    return {
      id: upload.id,
      fileName: upload.fileName,
      fileSize: upload.fileSize,
      storagePath: upload.storagePath,
      totalChunks: upload.totalChunks,
      uploadedChunks: upload.uploadedChunks,
      lastUploadedChunk: upload.uploadedChunks.length > 0 
        ? upload.uploadedChunks[upload.uploadedChunks.length - 1] 
        : null,
      failedAt: upload.status === 'error' ? new Date().toISOString() : null,
      error: upload.error || null,
      createdAt: upload.createdAt,
      status: upload.status,
    };
  }, [uploads]);

  const retryUpload = useCallback((id: string) => {
    const upload = uploads[id];
    if (!upload || !upload.file) {
      toast.error('Please reselect the file to retry');
      return;
    }
    
    pausedUploads.current.delete(id);
    
    const next = { ...upload, status: 'queued' as const, error: undefined };
    uploadsRef.current = { ...uploadsRef.current, [id]: next };
    
    setUploads(prev => ({
      ...prev,
      [id]: next
    }));
    
    uploadQueue.current.push(id);
    
    if (!isUploading) {
      setTimeout(() => processNextInQueue(), 0);
    }
    
    toast.info('Retrying upload...');
  }, [uploads, isUploading, processNextInQueue]);

  const getPausedUploadsNeedingFile = useCallback(() => {
    return Object.values(uploads).filter(u => u.status === 'paused' && !u.file);
  }, [uploads]);

  return (
    <UploadContext.Provider value={{
      uploads,
      isUploading,
      addFiles,
      pauseUpload,
      resumeUpload,
      cancelUpload,
      clearCompleted,
      reorderUpload,
      getActiveCount,
      getPendingCount,
      getTotalProgress,
      pauseAll,
      resumeAll,
      moveToFront,
      getUploadDiagnostics,
      retryUpload,
      getPausedUploadsNeedingFile,
      throttleRate,
      setThrottleRate,
    }}>
      {children}
    </UploadContext.Provider>
  );
};

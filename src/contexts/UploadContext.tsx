import { createContext, useContext, useState, useCallback, useRef, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import * as tus from 'tus-js-client';

const DB_NAME = 'CloudStoreUploads';
const STORE_NAME = 'uploads';
const TUS_CHUNK_SIZE = 6 * 1024 * 1024; // 6MB chunks for TUS
const MAX_RETRIES = 10; // More retries for large files
const TOKEN_REFRESH_INTERVAL = 30 * 60 * 1000; // Refresh token every 30 minutes

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
  tusUploadUrl?: string;
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
  addFiles: (files: File[], userId: string, folderPath?: string, folderId?: string) => void;
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
  throttleRate: number;
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
  const [throttleRate, setThrottleRate] = useState(0);
  const throttleRateRef = useRef(0);
  const tusUploads = useRef<Record<string, tus.Upload>>({});
  const pausedUploads = useRef<Set<string>>(new Set());
  const speedTracking = useRef<Record<string, { bytes: number; timestamp: number }[]>>({});
  const fileRefs = useRef<Record<string, File>>({});
  const uploadQueue = useRef<string[]>([]);
  const currentUserId = useRef<string>('');
  const processingRef = useRef(false);
  const tokenRefreshTimer = useRef<NodeJS.Timeout | null>(null);
  const lastTokenRefresh = useRef<number>(0);

  useEffect(() => {
    uploadsRef.current = uploads;
  }, [uploads]);

  useEffect(() => {
    throttleRateRef.current = throttleRate;
  }, [throttleRate]);

  // Cleanup token refresh timer on unmount
  useEffect(() => {
    return () => {
      if (tokenRefreshTimer.current) {
        clearInterval(tokenRefreshTimer.current);
        tokenRefreshTimer.current = null;
      }
    };
  }, []);

  // Token refresh for long uploads
  const refreshAuthToken = useCallback(async (): Promise<string | null> => {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (error) throw error;
      lastTokenRefresh.current = Date.now();
      return data.session?.access_token || null;
    } catch (error) {
      console.error('Failed to refresh token:', error);
      return null;
    }
  }, []);

  // Ensure fresh token for large uploads
  const getValidToken = useCallback(async (): Promise<string | null> => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    
    if (!token) return null;
    
    // Refresh if token is older than 30 minutes
    if (Date.now() - lastTokenRefresh.current > TOKEN_REFRESH_INTERVAL) {
      const newToken = await refreshAuthToken();
      return newToken || token;
    }
    
    return token;
  }, [refreshAuthToken]);

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

  const processNextInQueue = useCallback(async () => {
    if (processingRef.current) return;
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
    processingRef.current = true;
    setIsUploading(true);

    let state: UploadItem = { ...upload, status: 'uploading' };
    setUploads(prev => ({ ...prev, [uploadId]: state }));
    await saveUploadState(state);

    try {
      const accessToken = await getValidToken();
      
      if (!accessToken) {
        throw new Error('Not authenticated');
      }

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || 'ttrbjdpiccvfaccwpodu';
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR0cmJqZHBpY2N2ZmFjY3dwb2R1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ1ODY0MzMsImV4cCI6MjA4MDE2MjQzM30.FvgQ19ihD7nd4Ty4QSrbnYoUwm2RNGnLf032-j_yG4M';

      const tusUpload = new tus.Upload(file, {
        endpoint: `https://${projectId}.supabase.co/storage/v1/upload/resumable`,
        retryDelays: [0, 1000, 3000, 5000, 10000, 20000, 30000, 60000, 120000, 300000], // More retries with longer delays for large files
        headers: {
          authorization: `Bearer ${accessToken}`,
          apikey: anonKey,
        },
        uploadDataDuringCreation: true,
        removeFingerprintOnSuccess: true,
        chunkSize: TUS_CHUNK_SIZE,
        parallelUploads: 1, // Keep at 1 for stability with large files
        metadata: {
          bucketName: 'user-files',
          objectName: state.storagePath,
          contentType: file.type || 'application/octet-stream',
          cacheControl: '3600',
        },
        onError: async (error) => {
          console.error('TUS upload error:', error);
          
          // Check if it's a token expiry issue and retry
          if (error.message?.includes('401') || error.message?.includes('unauthorized')) {
            console.log('Token may have expired, refreshing...');
            const newToken = await refreshAuthToken();
            if (newToken && tusUploads.current[uploadId]) {
              // Update headers with new token and retry
              tusUpload.options.headers = {
                ...tusUpload.options.headers,
                authorization: `Bearer ${newToken}`,
              };
              tusUpload.start();
              return;
            }
          }
          
          if (!pausedUploads.current.has(uploadId)) {
            state.status = 'error';
            state.error = error.message || 'Upload failed';
            setUploads(prev => ({ ...prev, [uploadId]: state }));
            await saveUploadState(state);
            toast.error(`Failed to upload ${state.fileName}`);
          }
          delete tusUploads.current[uploadId];
          delete speedTracking.current[uploadId];
          uploadQueue.current.shift();
          processingRef.current = false;
          processNextInQueue();
        },
        onProgress: (bytesUploaded, bytesTotal) => {
          state.bytesUploaded = bytesUploaded;
          state.progress = Math.round((bytesUploaded / bytesTotal) * 100);
          state.speed = calculateSpeed(uploadId, bytesUploaded);
          state.eta = state.speed > 0 ? (bytesTotal - bytesUploaded) / state.speed : 0;
          
          // Save progress periodically for resume capability
          const chunkNumber = Math.floor(bytesUploaded / TUS_CHUNK_SIZE);
          if (!state.uploadedChunks.includes(chunkNumber)) {
            state.uploadedChunks.push(chunkNumber);
            saveUploadState(state);
          }
          
          setUploads(prev => ({ ...prev, [uploadId]: { ...state } }));
        },
        onSuccess: async () => {
          state.progress = 100;
          state.status = 'completed';
          state.bytesUploaded = file.size;
          
          // Create database record
          const fileName = state.folderPath ? `${state.folderPath}/${state.fileName}` : state.fileName;
          
          const { data: existingFile } = await supabase
            .from('files')
            .select('id')
            .eq('storage_path', state.storagePath)
            .maybeSingle();
          
          if (!existingFile) {
            const insertData: any = {
              user_id: currentUserId.current,
              name: fileName,
              size_bytes: file.size,
              mime_type: state.fileType || 'application/octet-stream',
              storage_path: state.storagePath
            };
            
            const { error: dbError } = await supabase.from('files').insert(insertData);
            if (dbError) {
              console.error('DB insert error:', dbError);
            }
          }

          setUploads(prev => ({ ...prev, [uploadId]: state }));
          await deleteUploadState(uploadId);
          toast.success(`${state.fileName} uploaded successfully!`);
          
          delete tusUploads.current[uploadId];
          delete speedTracking.current[uploadId];
          uploadQueue.current.shift();
          processingRef.current = false;
          processNextInQueue();
        },
      });

      // Store for pause/resume
      tusUploads.current[uploadId] = tusUpload;

      // Set up periodic token refresh for long uploads (every 25 minutes)
      if (!tokenRefreshTimer.current) {
        tokenRefreshTimer.current = setInterval(async () => {
          const newToken = await refreshAuthToken();
          if (newToken) {
            // Update all active TUS uploads with new token
            Object.values(tusUploads.current).forEach(upload => {
              if (upload.options.headers) {
                upload.options.headers.authorization = `Bearer ${newToken}`;
              }
            });
          }
        }, 25 * 60 * 1000);
      }

      // Check for previous uploads to resume
      const previousUploads = await tusUpload.findPreviousUploads();
      if (previousUploads.length > 0) {
        tusUpload.resumeFromPreviousUpload(previousUploads[0]);
      }

      tusUpload.start();

    } catch (error: any) {
      console.error('Upload setup error:', error);
      if (!pausedUploads.current.has(uploadId)) {
        state.status = 'error';
        state.error = error.message || 'Upload failed';
        setUploads(prev => ({ ...prev, [uploadId]: state }));
        await saveUploadState(state);
        toast.error(`Failed to upload ${state.fileName}`);
      }
      uploadQueue.current.shift();
      processingRef.current = false;
      processNextInQueue();
    }
  }, [saveUploadState, deleteUploadState, getValidToken, refreshAuthToken]);

  const addFiles = useCallback((files: File[], userId: string, folderPath?: string, folderId?: string) => {
    currentUserId.current = userId;
    const newUploads: Record<string, UploadItem> = {};
    const newQueueItems: string[] = [];

    files.forEach((file, index) => {
      const uploadId = generateUploadId(file, userId);
      const sanitizedName = sanitizeFileName(file.name);
      const storagePath = folderPath 
        ? `${userId}/${folderPath}/${Date.now()}-${sanitizedName}`
        : `${userId}/${Date.now()}-${sanitizedName}`;

      fileRefs.current[uploadId] = file;

      newUploads[uploadId] = {
        id: uploadId,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        storagePath,
        uploadedChunks: [],
        totalChunks: Math.ceil(file.size / TUS_CHUNK_SIZE),
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

    uploadsRef.current = { ...uploadsRef.current, ...newUploads };
    setUploads(prev => ({ ...prev, ...newUploads }));
    uploadQueue.current.push(...newQueueItems);

    if (!isUploading && !processingRef.current) {
      setTimeout(() => processNextInQueue(), 0);
    }
  }, [uploads, isUploading, processNextInQueue]);

  const pauseUpload = useCallback((id: string) => {
    pausedUploads.current.add(id);
    
    if (tusUploads.current[id]) {
      tusUploads.current[id].abort();
    }

    const next = { ...uploadsRef.current[id], status: 'paused' as const };
    uploadsRef.current = { ...uploadsRef.current, [id]: next };

    setUploads(prev => ({
      ...prev,
      [id]: { ...prev[id], status: 'paused' }
    }));
    
    // If this was the active upload, move to next
    if (uploadQueue.current[0] === id) {
      uploadQueue.current.shift();
      processingRef.current = false;
      processNextInQueue();
    }
    
    toast.info('Upload paused');
  }, [processNextInQueue]);

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

    if (!isUploading && !processingRef.current) {
      setTimeout(() => processNextInQueue(), 0);
    }
  }, [isUploading, processNextInQueue]);

  const cancelUpload = useCallback(async (id: string) => {
    pausedUploads.current.add(id);
    
    if (tusUploads.current[id]) {
      tusUploads.current[id].abort();
      delete tusUploads.current[id];
    }

    uploadQueue.current = uploadQueue.current.filter(qId => qId !== id);
    await deleteUploadState(id);
    delete fileRefs.current[id];
    
    // If this was the active upload, allow next to process
    if (uploadsRef.current[id]?.status === 'uploading') {
      processingRef.current = false;
    }
    
    setUploads(prev => {
      const newUploads = { ...prev };
      delete newUploads[id];
      return newUploads;
    });
    
    if (!processingRef.current) {
      processNextInQueue();
    }
  }, [deleteUploadState, processNextInQueue]);

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
    if (newIndex < 1 || newIndex >= uploadQueue.current.length) return;

    const temp = uploadQueue.current[queueIndex];
    uploadQueue.current[queueIndex] = uploadQueue.current[newIndex];
    uploadQueue.current[newIndex] = temp;

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
    if (queueIndex <= 1) return;
    
    uploadQueue.current.splice(queueIndex, 1);
    uploadQueue.current.splice(1, 0, id);
    
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
    
    if (!isUploading && !processingRef.current) {
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

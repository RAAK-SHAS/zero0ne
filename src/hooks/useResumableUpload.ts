import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

const CHUNK_SIZE = 2 * 1024 * 1024; // 2MB chunks for better reliability
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;
const DB_NAME = 'CloudStoreUploads';
const STORE_NAME = 'uploads';

interface UploadState {
  id: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  userId: string;
  storagePath: string;
  uploadedChunks: number[];
  totalChunks: number;
  status: 'pending' | 'uploading' | 'paused' | 'completed' | 'error';
  error?: string;
  progress: number;
  bytesUploaded: number;
  speed: number;
  eta: number;
  createdAt: number;
  lastUpdated: number;
}

interface UploadProgress {
  fileName: string;
  progress: number;
  status: 'pending' | 'uploading' | 'paused' | 'completed' | 'error';
  error?: string;
  speed: number;
  eta: number;
  bytesUploaded: number;
  totalBytes: number;
}

export const useResumableUpload = () => {
  const [uploads, setUploads] = useState<Record<string, UploadState>>({});
  const [isUploading, setIsUploading] = useState(false);
  const abortControllers = useRef<Record<string, AbortController>>({});
  const pausedUploads = useRef<Set<string>>(new Set());
  const speedTracking = useRef<Record<string, { bytes: number; timestamp: number }[]>>({});

  // Initialize IndexedDB
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

  // Save upload state to IndexedDB
  const saveUploadState = useCallback(async (state: UploadState) => {
    try {
      const db = await openDB();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(state);
      await new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    } catch (error) {
      console.error('Failed to save upload state:', error);
    }
  }, [openDB]);

  // Load pending uploads from IndexedDB
  const loadPendingUploads = useCallback(async (): Promise<UploadState[]> => {
    try {
      const db = await openDB();
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();
      
      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          db.close();
          const uploads = request.result.filter(
            (u: UploadState) => u.status === 'paused' || u.status === 'pending' || u.status === 'uploading'
          );
          resolve(uploads);
        };
        request.onerror = () => {
          db.close();
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('Failed to load pending uploads:', error);
      return [];
    }
  }, [openDB]);

  // Delete upload state from IndexedDB
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

  // Load pending uploads on mount
  useEffect(() => {
    const loadSavedUploads = async () => {
      const pending = await loadPendingUploads();
      if (pending.length > 0) {
        const uploadsMap: Record<string, UploadState> = {};
        pending.forEach(u => {
          u.status = 'paused'; // Mark as paused so user can resume
          uploadsMap[u.id] = u;
        });
        setUploads(prev => ({ ...prev, ...uploadsMap }));
      }
    };
    loadSavedUploads();
  }, [loadPendingUploads]);

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
    
    // Keep only last 10 seconds of data
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

      if (error) {
        if (retries < MAX_RETRIES && !signal.aborted) {
          await new Promise(r => setTimeout(r, RETRY_DELAY * (retries + 1)));
          return uploadChunkWithRetry(chunk, path, signal, retries + 1);
        }
        throw error;
      }
      return true;
    } catch (error) {
      if (retries < MAX_RETRIES && !signal.aborted) {
        await new Promise(r => setTimeout(r, RETRY_DELAY * (retries + 1)));
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
      // Download all chunks and combine them
      const chunks: Blob[] = [];
      
      for (let i = 0; i < totalChunks; i++) {
        const chunkPath = `${storagePath}.chunk_${i}`;
        const { data, error } = await supabase.storage
          .from('user-files')
          .download(chunkPath);
        
        if (error) throw error;
        chunks.push(data);
      }
      
      // Combine into single blob
      const combinedBlob = new Blob(chunks, { type: fileType });
      
      // Upload combined file
      const { error: uploadError } = await supabase.storage
        .from('user-files')
        .upload(storagePath, combinedBlob, {
          cacheControl: '3600',
          upsert: true,
        });
      
      if (uploadError) throw uploadError;
      
      // Clean up chunks
      for (let i = 0; i < totalChunks; i++) {
        const chunkPath = `${storagePath}.chunk_${i}`;
        await supabase.storage.from('user-files').remove([chunkPath]);
      }
      
      return true;
    } catch (error) {
      console.error('Failed to combine chunks:', error);
      throw error;
    }
  };

  const startUpload = useCallback(async (
    file: File,
    userId: string,
    onComplete?: (success: boolean, path?: string) => void
  ) => {
    const uploadId = generateUploadId(file, userId);
    const sanitizedName = sanitizeFileName(file.name);
    const storagePath = `${userId}/${Date.now()}-${sanitizedName}`;
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    const useChunked = file.size > 50 * 1024 * 1024; // Use chunked for files > 50MB

    // Check if we have existing state for this upload
    let existingState = uploads[uploadId];
    
    const state: UploadState = existingState || {
      id: uploadId,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      userId,
      storagePath: existingState?.storagePath || storagePath,
      uploadedChunks: [],
      totalChunks: useChunked ? totalChunks : 1,
      status: 'uploading',
      progress: 0,
      bytesUploaded: 0,
      speed: 0,
      eta: 0,
      createdAt: existingState?.createdAt || Date.now(),
      lastUpdated: Date.now(),
    };

    state.status = 'uploading';
    setUploads(prev => ({ ...prev, [uploadId]: state }));
    await saveUploadState(state);

    // Create abort controller
    abortControllers.current[uploadId] = new AbortController();
    const signal = abortControllers.current[uploadId].signal;
    pausedUploads.current.delete(uploadId);

    setIsUploading(true);

    try {
      if (!useChunked) {
        // Direct upload for smaller files
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
        setUploads(prev => ({ ...prev, [uploadId]: { ...state } }));
        await deleteUploadState(uploadId);
        onComplete?.(true, state.storagePath);
      } else {
        // Chunked upload for large files
        for (let i = 0; i < totalChunks; i++) {
          // Check if paused or aborted
          if (pausedUploads.current.has(uploadId) || signal.aborted) {
            state.status = 'paused';
            setUploads(prev => ({ ...prev, [uploadId]: { ...state } }));
            await saveUploadState(state);
            return;
          }

          // Skip already uploaded chunks
          if (state.uploadedChunks.includes(i)) continue;

          const start = i * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, file.size);
          const chunk = file.slice(start, end);
          const chunkPath = `${state.storagePath}.chunk_${i}`;

          await uploadChunkWithRetry(chunk, chunkPath, signal);

          // Update state
          state.uploadedChunks.push(i);
          state.bytesUploaded = state.uploadedChunks.length * CHUNK_SIZE;
          if (state.bytesUploaded > file.size) state.bytesUploaded = file.size;
          state.progress = Math.round((state.uploadedChunks.length / totalChunks) * 95); // Leave 5% for combining
          state.speed = calculateSpeed(uploadId, state.bytesUploaded);
          state.eta = state.speed > 0 ? (file.size - state.bytesUploaded) / state.speed : 0;
          state.lastUpdated = Date.now();

          setUploads(prev => ({ ...prev, [uploadId]: { ...state } }));
          await saveUploadState(state);
        }

        // Combine chunks
        if (state.uploadedChunks.length === totalChunks) {
          await combineChunks(state.storagePath, totalChunks, file.type);
          state.progress = 100;
          state.status = 'completed';
          setUploads(prev => ({ ...prev, [uploadId]: { ...state } }));
          await deleteUploadState(uploadId);
          onComplete?.(true, state.storagePath);
        }
      }
    } catch (error: any) {
      if (!pausedUploads.current.has(uploadId)) {
        state.status = 'error';
        state.error = error.message || 'Upload failed';
        setUploads(prev => ({ ...prev, [uploadId]: { ...state } }));
        await saveUploadState(state);
        onComplete?.(false);
      }
    } finally {
      delete abortControllers.current[uploadId];
      delete speedTracking.current[uploadId];
      
      // Check if any uploads are still in progress
      const stillUploading = Object.values(uploads).some(
        u => u.status === 'uploading'
      );
      if (!stillUploading) {
        setIsUploading(false);
      }
    }
  }, [uploads, saveUploadState, deleteUploadState, calculateSpeed]);

  const pauseUpload = useCallback((uploadId: string) => {
    pausedUploads.current.add(uploadId);
    if (abortControllers.current[uploadId]) {
      abortControllers.current[uploadId].abort();
    }
    setUploads(prev => ({
      ...prev,
      [uploadId]: { ...prev[uploadId], status: 'paused' }
    }));
  }, []);

  const resumeUpload = useCallback(async (
    uploadId: string,
    file: File,
    onComplete?: (success: boolean, path?: string) => void
  ) => {
    pausedUploads.current.delete(uploadId);
    await startUpload(file, uploads[uploadId]?.userId || '', onComplete);
  }, [uploads, startUpload]);

  const cancelUpload = useCallback(async (uploadId: string) => {
    pausedUploads.current.add(uploadId);
    if (abortControllers.current[uploadId]) {
      abortControllers.current[uploadId].abort();
    }
    
    // Clean up chunks from storage
    const state = uploads[uploadId];
    if (state) {
      for (let i = 0; i < state.totalChunks; i++) {
        const chunkPath = `${state.storagePath}.chunk_${i}`;
        await supabase.storage.from('user-files').remove([chunkPath]);
      }
    }
    
    await deleteUploadState(uploadId);
    setUploads(prev => {
      const newUploads = { ...prev };
      delete newUploads[uploadId];
      return newUploads;
    });
  }, [uploads, deleteUploadState]);

  const clearCompleted = useCallback(() => {
    setUploads(prev => {
      const newUploads: Record<string, UploadState> = {};
      Object.entries(prev).forEach(([id, state]) => {
        if (state.status !== 'completed') {
          newUploads[id] = state;
        }
      });
      return newUploads;
    });
  }, []);

  const getUploadProgress = useCallback((): Record<string, UploadProgress> => {
    const progress: Record<string, UploadProgress> = {};
    Object.entries(uploads).forEach(([id, state]) => {
      progress[state.fileName] = {
        fileName: state.fileName,
        progress: state.progress,
        status: state.status,
        error: state.error,
        speed: state.speed,
        eta: state.eta,
        bytesUploaded: state.bytesUploaded,
        totalBytes: state.fileSize,
      };
    });
    return progress;
  }, [uploads]);

  const getPendingUploads = useCallback(() => {
    return Object.values(uploads).filter(u => u.status === 'paused');
  }, [uploads]);

  return {
    uploads,
    isUploading,
    startUpload,
    pauseUpload,
    resumeUpload,
    cancelUpload,
    clearCompleted,
    getUploadProgress,
    getPendingUploads,
    sanitizeFileName,
  };
};

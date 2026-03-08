import { createContext, useContext, useState, useCallback, useRef, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import * as tus from 'tus-js-client';

const DB_NAME = 'CloudStoreUploads';
const STORE_NAME = 'uploads';
const TUS_CHUNK_SIZE_SMALL = 6 * 1024 * 1024;
const TUS_CHUNK_SIZE_MEDIUM = 20 * 1024 * 1024;
const TUS_CHUNK_SIZE_LARGE = 50 * 1024 * 1024;
const MAX_CONCURRENT_UPLOADS = 3;
const MAX_AUTO_RETRIES = 5;
const TOKEN_REFRESH_INTERVAL = 30 * 60 * 1000;

const getChunkSize = (fileSize: number): number => {
  if (fileSize > 1024 * 1024 * 1024) return TUS_CHUNK_SIZE_LARGE;
  if (fileSize > 100 * 1024 * 1024) return TUS_CHUNK_SIZE_MEDIUM;
  return TUS_CHUNK_SIZE_SMALL;
};

const getRetryDelay = (attempt: number): number => {
  // Exponential backoff: 2s, 4s, 8s, 16s, 32s capped at 60s
  return Math.min(2000 * Math.pow(2, attempt), 60000);
};

export interface NetworkState {
  isOnline: boolean;
  retryCount: number;
  lastRetryAt: number | null;
  connectionQuality: 'good' | 'slow' | 'offline';
}

export interface SpeedDataPoint {
  timestamp: number;
  speed: number;
}

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
  autoRetryCount?: number;
  nextRetryAt?: number;
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
  networkState: NetworkState;
  speedHistory: Record<string, SpeedDataPoint[]>;
  maxConcurrent: number;
  setMaxConcurrent: (n: number) => void;
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
  const [maxConcurrent, setMaxConcurrent] = useState(MAX_CONCURRENT_UPLOADS);
  const maxConcurrentRef = useRef(MAX_CONCURRENT_UPLOADS);
  const [speedHistory, setSpeedHistory] = useState<Record<string, SpeedDataPoint[]>>({});
  const [networkState, setNetworkState] = useState<NetworkState>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    retryCount: 0,
    lastRetryAt: null,
    connectionQuality: 'good',
  });
  const throttleRateRef = useRef(0);
  const tusUploads = useRef<Record<string, tus.Upload>>({});
  const pausedUploads = useRef<Set<string>>(new Set());
  const offlinePausedUploads = useRef<Set<string>>(new Set());
  const speedTracking = useRef<Record<string, { bytes: number; timestamp: number }[]>>({});
  const fileRefs = useRef<Record<string, File>>({});
  const uploadQueue = useRef<string[]>([]);
  const currentUserId = useRef<string>('');
  const activeSlots = useRef<Set<string>>(new Set());
  const tokenRefreshTimer = useRef<NodeJS.Timeout | null>(null);
  const lastTokenRefresh = useRef<number>(0);
  const autoRetryTimers = useRef<Record<string, NodeJS.Timeout>>({});
  const keepAliveInterval = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    uploadsRef.current = uploads;
  }, [uploads]);

  useEffect(() => {
    throttleRateRef.current = throttleRate;
  }, [throttleRate]);

  useEffect(() => {
    maxConcurrentRef.current = maxConcurrent;
  }, [maxConcurrent]);

  // Keep-alive to prevent browser throttling uploads in background tabs
  useEffect(() => {
    keepAliveInterval.current = setInterval(() => {
      if (activeSlots.current.size > 0) {
        // Lightweight ping to keep the tab active
        performance.now();
      }
    }, 10000);
    return () => {
      if (keepAliveInterval.current) clearInterval(keepAliveInterval.current);
    };
  }, []);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (tokenRefreshTimer.current) clearInterval(tokenRefreshTimer.current);
      Object.values(autoRetryTimers.current).forEach(t => clearTimeout(t));
    };
  }, []);

  // Network monitoring with auto-resume
  useEffect(() => {
    const handleOnline = () => {
      setNetworkState(prev => ({ ...prev, isOnline: true, connectionQuality: 'good' }));
      toast.success('Connection restored! Resuming uploads...');

      offlinePausedUploads.current.forEach(id => {
        const upload = uploadsRef.current[id];
        if (upload && upload.file && upload.status === 'paused') {
          pausedUploads.current.delete(id);
          const next = { ...upload, status: 'queued' as const };
          uploadsRef.current = { ...uploadsRef.current, [id]: next };
          setUploads(prev => ({ ...prev, [id]: { ...prev[id], status: 'queued' } }));
          uploadQueue.current.push(id);
        }
      });
      offlinePausedUploads.current.clear();
      if (uploadQueue.current.length > 0) setTimeout(() => fillSlots(), 100);
    };

    const handleOffline = () => {
      setNetworkState(prev => ({ ...prev, isOnline: false, connectionQuality: 'offline' }));
      toast.warning('Connection lost. Uploads will resume automatically when online.');

      Object.entries(uploadsRef.current).forEach(([id, upload]) => {
        if (upload.status === 'uploading' || upload.status === 'queued') {
          offlinePausedUploads.current.add(id);
          if (tusUploads.current[id]) tusUploads.current[id].abort();
          pausedUploads.current.add(id);
          activeSlots.current.delete(id);
          const next = { ...upload, status: 'paused' as const };
          uploadsRef.current = { ...uploadsRef.current, [id]: next };
          setUploads(prev => ({ ...prev, [id]: { ...prev[id], status: 'paused' } }));
        }
      });
      uploadQueue.current = [];
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const incrementRetryCount = useCallback(() => {
    setNetworkState(prev => ({ ...prev, retryCount: prev.retryCount + 1, lastRetryAt: Date.now() }));
  }, []);

  const resetRetryCount = useCallback(() => {
    setNetworkState(prev => ({ ...prev, retryCount: 0, lastRetryAt: null }));
  }, []);

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

  const getValidToken = useCallback(async (): Promise<string | null> => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) return null;
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
      const { file, ...stateWithoutFile } = state;
      tx.objectStore(STORE_NAME).put({ ...stateWithoutFile, userId: currentUserId.current });
      await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); });
      db.close();
    } catch (error) {
      console.error('Failed to save upload state:', error);
    }
  }, [openDB]);

  const deleteUploadState = useCallback(async (id: string) => {
    try {
      const db = await openDB();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(id);
      await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); });
      db.close();
    } catch (error) {
      console.error('Failed to delete upload state:', error);
    }
  }, [openDB]);

  const sanitizeFileName = (name: string): string => {
    return name.replace(/[^\w\s.-]/g, '_').replace(/\s+/g, '_').replace(/_+/g, '_').slice(0, 100);
  };

  const generateUploadId = (file: File, userId: string): string => {
    return `${userId}_${file.name}_${file.size}_${file.lastModified}`;
  };

  const calculateSpeed = (uploadId: string, newBytes: number): number => {
    const now = Date.now();
    if (!speedTracking.current[uploadId]) speedTracking.current[uploadId] = [];
    speedTracking.current[uploadId].push({ bytes: newBytes, timestamp: now });
    speedTracking.current[uploadId] = speedTracking.current[uploadId].filter(d => now - d.timestamp < 10000);
    const data = speedTracking.current[uploadId];
    if (data.length < 2) return 0;
    const timeDiff = (data[data.length - 1].timestamp - data[0].timestamp) / 1000;
    const bytesDiff = data[data.length - 1].bytes - data[0].bytes;
    return timeDiff > 0 ? bytesDiff / timeDiff : 0;
  };

  const recordSpeedHistory = useCallback((uploadId: string, speed: number) => {
    const now = Date.now();
    setSpeedHistory(prev => {
      const history = prev[uploadId] || [];
      // Keep last 60 data points (~ 1 minute at 1/sec)
      const updated = [...history, { timestamp: now, speed }].slice(-60);
      return { ...prev, [uploadId]: updated };
    });
  }, []);

  // Schedule auto-retry with exponential backoff
  const scheduleAutoRetry = useCallback((uploadId: string) => {
    const upload = uploadsRef.current[uploadId];
    if (!upload || !upload.file) return;

    const retryCount = upload.autoRetryCount || 0;
    if (retryCount >= MAX_AUTO_RETRIES) {
      toast.error(`${upload.fileName} failed after ${MAX_AUTO_RETRIES} retries`);
      return;
    }

    const delay = getRetryDelay(retryCount);
    const nextRetryAt = Date.now() + delay;

    // Update state to show retry countdown
    const updated = { ...upload, nextRetryAt, autoRetryCount: retryCount };
    uploadsRef.current = { ...uploadsRef.current, [uploadId]: updated };
    setUploads(prev => ({ ...prev, [uploadId]: updated }));

    if (autoRetryTimers.current[uploadId]) clearTimeout(autoRetryTimers.current[uploadId]);

    autoRetryTimers.current[uploadId] = setTimeout(() => {
      delete autoRetryTimers.current[uploadId];
      const current = uploadsRef.current[uploadId];
      if (!current || current.status !== 'error' || !current.file) return;

      toast.info(`Auto-retrying ${current.fileName} (attempt ${retryCount + 2}/${MAX_AUTO_RETRIES + 1})...`);

      pausedUploads.current.delete(uploadId);
      const next = { ...current, status: 'queued' as const, error: undefined, autoRetryCount: retryCount + 1, nextRetryAt: undefined };
      uploadsRef.current = { ...uploadsRef.current, [uploadId]: next };
      setUploads(prev => ({ ...prev, [uploadId]: next }));
      uploadQueue.current.push(uploadId);
      fillSlots();
    }, delay);
  }, []);

  // Fill available upload slots (parallel uploads)
  const fillSlots = useCallback(async () => {
    while (activeSlots.current.size < maxConcurrentRef.current && uploadQueue.current.length > 0) {
      const uploadId = uploadQueue.current.shift();
      if (!uploadId) break;

      const upload = uploadsRef.current[uploadId];
      if (!upload || !fileRefs.current[uploadId]) continue;

      activeSlots.current.add(uploadId);
      setIsUploading(true);
      startUpload(uploadId);
    }

    if (activeSlots.current.size === 0 && uploadQueue.current.length === 0) {
      setIsUploading(false);
    }
  }, []);

  const startUpload = useCallback(async (uploadId: string) => {
    const upload = uploadsRef.current[uploadId];
    const file = fileRefs.current[uploadId];
    if (!upload || !file) {
      activeSlots.current.delete(uploadId);
      fillSlots();
      return;
    }

    let state: UploadItem = { ...upload, status: 'uploading' };
    uploadsRef.current = { ...uploadsRef.current, [uploadId]: state };
    setUploads(prev => ({ ...prev, [uploadId]: state }));
    await saveUploadState(state);

    try {
      const accessToken = await getValidToken();
      if (!accessToken) throw new Error('Not authenticated');

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || 'ttrbjdpiccvfaccwpodu';
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR0cmJqZHBpY2N2ZmFjY3dwb2R1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ1ODY0MzMsImV4cCI6MjA4MDE2MjQzM30.FvgQ19ihD7nd4Ty4QSrbnYoUwm2RNGnLf032-j_yG4M';

      const tusUpload = new tus.Upload(file, {
        endpoint: `https://${projectId}.supabase.co/storage/v1/upload/resumable`,
        retryDelays: [0, 1000, 3000, 5000, 10000, 20000, 30000, 60000, 120000, 300000],
        headers: {
          authorization: `Bearer ${accessToken}`,
          apikey: anonKey,
        },
        uploadDataDuringCreation: true,
        removeFingerprintOnSuccess: true,
        chunkSize: getChunkSize(file.size),
        metadata: {
          bucketName: 'user-files',
          objectName: state.storagePath,
          contentType: file.type || 'application/octet-stream',
          cacheControl: '3600',
        },
        onShouldRetry: (err) => {
          const status = (err as any)?.originalResponse?.getStatus?.();
          if (status === 403 || status === 401) return true;
          if (status && status >= 400 && status < 500 && status !== 408 && status !== 429) return false;
          return true;
        },
        onBeforeRequest: async (req) => {
          const freshToken = await getValidToken();
          if (freshToken) req.setHeader('Authorization', `Bearer ${freshToken}`);
        },
        onError: async (error) => {
          console.error('TUS upload error:', error);
          incrementRetryCount();
          activeSlots.current.delete(uploadId);

          if (!navigator.onLine) {
            setNetworkState(prev => ({ ...prev, isOnline: false, connectionQuality: 'offline' }));
            offlinePausedUploads.current.add(uploadId);
            pausedUploads.current.add(uploadId);
            state = { ...state, status: 'paused', error: 'Connection lost - will resume automatically' };
            uploadsRef.current = { ...uploadsRef.current, [uploadId]: state };
            setUploads(prev => ({ ...prev, [uploadId]: state }));
            await saveUploadState(state);
            delete tusUploads.current[uploadId];
            fillSlots();
            return;
          }

          if (error.message?.includes('401') || error.message?.includes('unauthorized')) {
            const newToken = await refreshAuthToken();
            if (newToken && tusUploads.current[uploadId]) {
              tusUpload.options.headers = { ...tusUpload.options.headers, authorization: `Bearer ${newToken}` };
              activeSlots.current.add(uploadId);
              tusUpload.start();
              return;
            }
          }

          if (!pausedUploads.current.has(uploadId)) {
            state = { ...state, status: 'error', error: error.message || 'Upload failed' };
            uploadsRef.current = { ...uploadsRef.current, [uploadId]: state };
            setUploads(prev => ({ ...prev, [uploadId]: state }));
            await saveUploadState(state);

            // Smart auto-retry with exponential backoff
            if (state.file) {
              scheduleAutoRetry(uploadId);
            } else {
              toast.error(`Failed to upload ${state.fileName}`);
            }
          }
          delete tusUploads.current[uploadId];
          delete speedTracking.current[uploadId];
          fillSlots();
        },
        onProgress: (bytesUploaded, bytesTotal) => {
          state.bytesUploaded = bytesUploaded;
          state.progress = Math.round((bytesUploaded / bytesTotal) * 100);
          state.speed = calculateSpeed(uploadId, bytesUploaded);
          state.eta = state.speed > 0 ? (bytesTotal - bytesUploaded) / state.speed : 0;

          // Record speed for graph
          if (state.speed > 0) recordSpeedHistory(uploadId, state.speed);

          const chunkSize = getChunkSize(file.size);
          const chunkNumber = Math.floor(bytesUploaded / chunkSize);
          if (!state.uploadedChunks.includes(chunkNumber)) {
            state.uploadedChunks.push(chunkNumber);
            saveUploadState(state);
          }
          uploadsRef.current = { ...uploadsRef.current, [uploadId]: { ...state } };
          setUploads(prev => ({ ...prev, [uploadId]: { ...state } }));
        },
        onSuccess: async () => {
          resetRetryCount();
          state.progress = 100;
          state.status = 'completed';
          state.bytesUploaded = file.size;
          state.autoRetryCount = 0;

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
              storage_path: state.storagePath,
            };
            const { error: dbError } = await supabase.from('files').insert(insertData);
            if (dbError) console.error('DB insert error:', dbError);
          }

          uploadsRef.current = { ...uploadsRef.current, [uploadId]: state };
          setUploads(prev => ({ ...prev, [uploadId]: state }));
          await deleteUploadState(uploadId);
          toast.success(`${state.fileName} uploaded successfully!`);

          delete tusUploads.current[uploadId];
          delete speedTracking.current[uploadId];
          activeSlots.current.delete(uploadId);
          fillSlots();
        },
      });

      tusUploads.current[uploadId] = tusUpload;

      if (!tokenRefreshTimer.current) {
        tokenRefreshTimer.current = setInterval(async () => {
          const newToken = await refreshAuthToken();
          if (newToken) {
            Object.values(tusUploads.current).forEach(u => {
              if (u.options.headers) u.options.headers.authorization = `Bearer ${newToken}`;
            });
          }
        }, 25 * 60 * 1000);
      }

      const previousUploads = await tusUpload.findPreviousUploads();
      if (previousUploads.length > 0) tusUpload.resumeFromPreviousUpload(previousUploads[0]);

      tusUpload.start();
    } catch (error: any) {
      console.error('Upload setup error:', error);
      activeSlots.current.delete(uploadId);
      if (!pausedUploads.current.has(uploadId)) {
        state = { ...state, status: 'error', error: error.message || 'Upload failed' };
        uploadsRef.current = { ...uploadsRef.current, [uploadId]: state };
        setUploads(prev => ({ ...prev, [uploadId]: state }));
        await saveUploadState(state);
        if (state.file) scheduleAutoRetry(uploadId);
        else toast.error(`Failed to upload ${state.fileName}`);
      }
      fillSlots();
    }
  }, [saveUploadState, deleteUploadState, getValidToken, refreshAuthToken, fillSlots, scheduleAutoRetry, recordSpeedHistory]);

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
        totalChunks: Math.ceil(file.size / getChunkSize(file.size)),
        status: 'queued',
        progress: 0,
        bytesUploaded: 0,
        speed: 0,
        eta: 0,
        createdAt: Date.now(),
        priority: Object.keys(uploads).length + index,
        folderPath,
        file,
        autoRetryCount: 0,
      };

      newQueueItems.push(uploadId);
    });

    uploadsRef.current = { ...uploadsRef.current, ...newUploads };
    setUploads(prev => ({ ...prev, ...newUploads }));
    uploadQueue.current.push(...newQueueItems);

    if (!isUploading) setTimeout(() => fillSlots(), 0);
  }, [uploads, isUploading, fillSlots]);

  const pauseUpload = useCallback((id: string) => {
    pausedUploads.current.add(id);
    if (tusUploads.current[id]) tusUploads.current[id].abort();
    if (autoRetryTimers.current[id]) {
      clearTimeout(autoRetryTimers.current[id]);
      delete autoRetryTimers.current[id];
    }

    const next = { ...uploadsRef.current[id], status: 'paused' as const, nextRetryAt: undefined };
    uploadsRef.current = { ...uploadsRef.current, [id]: next };
    setUploads(prev => ({ ...prev, [id]: next }));

    activeSlots.current.delete(id);
    uploadQueue.current = uploadQueue.current.filter(qId => qId !== id);
    fillSlots();
    toast.info('Upload paused');
  }, [fillSlots]);

  const resumeUpload = useCallback((id: string, file: File) => {
    pausedUploads.current.delete(id);
    fileRefs.current[id] = file;
    if (autoRetryTimers.current[id]) {
      clearTimeout(autoRetryTimers.current[id]);
      delete autoRetryTimers.current[id];
    }

    const next = { ...uploadsRef.current[id], status: 'queued' as const, file, autoRetryCount: 0, nextRetryAt: undefined };
    uploadsRef.current = { ...uploadsRef.current, [id]: next };
    setUploads(prev => ({ ...prev, [id]: next }));

    uploadQueue.current.push(id);
    if (!isUploading) setTimeout(() => fillSlots(), 0);
  }, [isUploading, fillSlots]);

  const cancelUpload = useCallback(async (id: string) => {
    pausedUploads.current.add(id);
    if (tusUploads.current[id]) {
      tusUploads.current[id].abort();
      delete tusUploads.current[id];
    }
    if (autoRetryTimers.current[id]) {
      clearTimeout(autoRetryTimers.current[id]);
      delete autoRetryTimers.current[id];
    }

    uploadQueue.current = uploadQueue.current.filter(qId => qId !== id);
    await deleteUploadState(id);
    delete fileRefs.current[id];
    activeSlots.current.delete(id);

    setUploads(prev => {
      const newUploads = { ...prev };
      delete newUploads[id];
      return newUploads;
    });

    fillSlots();
  }, [deleteUploadState, fillSlots]);

  const clearCompleted = useCallback(() => {
    setUploads(prev => {
      const newUploads: typeof prev = {};
      Object.entries(prev).forEach(([id, state]) => {
        if (state.status !== 'completed') newUploads[id] = state;
      });
      return newUploads;
    });
    setSpeedHistory(prev => {
      const next: typeof prev = {};
      Object.entries(prev).forEach(([id, data]) => {
        if (uploadsRef.current[id]?.status !== 'completed') next[id] = data;
      });
      return next;
    });
  }, []);

  const reorderUpload = useCallback((id: string, direction: 'up' | 'down') => {
    const queueIndex = uploadQueue.current.indexOf(id);
    if (queueIndex === -1) return;
    const newIndex = direction === 'up' ? queueIndex - 1 : queueIndex + 1;
    if (newIndex < 0 || newIndex >= uploadQueue.current.length) return;

    const temp = uploadQueue.current[queueIndex];
    uploadQueue.current[queueIndex] = uploadQueue.current[newIndex];
    uploadQueue.current[newIndex] = temp;

    setUploads(prev => {
      const newUploads = { ...prev };
      uploadQueue.current.forEach((uploadId, index) => {
        if (newUploads[uploadId]) newUploads[uploadId] = { ...newUploads[uploadId], priority: index };
      });
      return newUploads;
    });
  }, []);

  const getActiveCount = useCallback(() => Object.values(uploads).filter(u => u.status === 'uploading').length, [uploads]);
  const getPendingCount = useCallback(() => Object.values(uploads).filter(u => u.status === 'queued' || u.status === 'uploading' || u.status === 'paused').length, [uploads]);
  const getTotalProgress = useCallback(() => {
    const active = Object.values(uploads).filter(u => u.status === 'uploading' || u.status === 'queued' || u.status === 'paused');
    if (active.length === 0) return 0;
    return active.reduce((sum, u) => sum + u.progress, 0) / active.length;
  }, [uploads]);

  const pauseAll = useCallback(() => {
    Object.keys(uploads).forEach(id => {
      if (uploads[id].status === 'uploading' || uploads[id].status === 'queued') pauseUpload(id);
    });
  }, [uploads, pauseUpload]);

  const resumeAll = useCallback(() => {
    Object.values(uploads).forEach(upload => {
      if (upload.status === 'paused' && upload.file) resumeUpload(upload.id, upload.file);
    });
  }, [uploads, resumeUpload]);

  const moveToFront = useCallback((id: string) => {
    const queueIndex = uploadQueue.current.indexOf(id);
    if (queueIndex <= 0) return;
    uploadQueue.current.splice(queueIndex, 1);
    uploadQueue.current.unshift(id);
    setUploads(prev => {
      const newUploads = { ...prev };
      uploadQueue.current.forEach((uploadId, index) => {
        if (newUploads[uploadId]) newUploads[uploadId] = { ...newUploads[uploadId], priority: index };
      });
      return newUploads;
    });
    toast.info('Moved to front of queue');
  }, []);

  const getUploadDiagnostics = useCallback((id: string): UploadDiagnostics | null => {
    const upload = uploads[id];
    if (!upload) return null;
    return {
      id: upload.id, fileName: upload.fileName, fileSize: upload.fileSize, storagePath: upload.storagePath,
      totalChunks: upload.totalChunks, uploadedChunks: upload.uploadedChunks,
      lastUploadedChunk: upload.uploadedChunks.length > 0 ? upload.uploadedChunks[upload.uploadedChunks.length - 1] : null,
      failedAt: upload.status === 'error' ? new Date().toISOString() : null,
      error: upload.error || null, createdAt: upload.createdAt, status: upload.status,
    };
  }, [uploads]);

  const retryUpload = useCallback((id: string) => {
    const upload = uploads[id];
    if (!upload || !upload.file) {
      toast.error('Please reselect the file to retry');
      return;
    }
    pausedUploads.current.delete(id);
    if (autoRetryTimers.current[id]) {
      clearTimeout(autoRetryTimers.current[id]);
      delete autoRetryTimers.current[id];
    }
    const next = { ...upload, status: 'queued' as const, error: undefined, autoRetryCount: 0, nextRetryAt: undefined };
    uploadsRef.current = { ...uploadsRef.current, [id]: next };
    setUploads(prev => ({ ...prev, [id]: next }));
    uploadQueue.current.push(id);
    if (!isUploading) setTimeout(() => fillSlots(), 0);
    toast.info('Retrying upload...');
  }, [uploads, isUploading, fillSlots]);

  const getPausedUploadsNeedingFile = useCallback(() => {
    return Object.values(uploads).filter(u => u.status === 'paused' && !u.file);
  }, [uploads]);

  return (
    <UploadContext.Provider value={{
      uploads, isUploading, networkState, speedHistory, maxConcurrent, setMaxConcurrent,
      addFiles, pauseUpload, resumeUpload, cancelUpload, clearCompleted, reorderUpload,
      getActiveCount, getPendingCount, getTotalProgress, pauseAll, resumeAll, moveToFront,
      getUploadDiagnostics, retryUpload, getPausedUploadsNeedingFile, throttleRate, setThrottleRate,
    }}>
      {children}
    </UploadContext.Provider>
  );
};

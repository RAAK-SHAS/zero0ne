import { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

export interface DownloadItem {
  id: string;
  fileName: string;
  fileSize: number;
  status: 'pending' | 'downloading' | 'paused' | 'completed' | 'error';
  error?: string;
  progress: number;
  bytesDownloaded: number;
  speed: number;
  eta: number;
  createdAt: number;
  files?: { name: string; path: string; size: number }[];
  isZip: boolean;
}

interface DownloadContextType {
  downloads: Record<string, DownloadItem>;
  isDownloading: boolean;
  downloadFile: (fileId: string, fileName: string, storagePath: string, size: number) => void;
  downloadMultipleAsZip: (files: { id: string; name: string; path: string; size: number }[], zipName: string) => void;
  pauseDownload: (id: string) => void;
  resumeDownload: (id: string) => void;
  cancelDownload: (id: string) => void;
  clearCompleted: () => void;
  getActiveCount: () => number;
  getPendingCount: () => number;
}

const DownloadContext = createContext<DownloadContextType | null>(null);

export const useDownloadManager = () => {
  const context = useContext(DownloadContext);
  if (!context) {
    throw new Error('useDownloadManager must be used within DownloadProvider');
  }
  return context;
};

export const DownloadProvider = ({ children }: { children: ReactNode }) => {
  const [downloads, setDownloads] = useState<Record<string, DownloadItem>>({});
  const [isDownloading, setIsDownloading] = useState(false);
  const abortControllers = useRef<Record<string, AbortController>>({});
  const pausedDownloads = useRef<Set<string>>(new Set());
  const speedTracking = useRef<Record<string, { bytes: number; timestamp: number }[]>>({});
  const downloadQueue = useRef<string[]>([]);
  const downloadData = useRef<Record<string, { files: { name: string; path: string; size: number }[]; zipName?: string }>>({});

  const calculateSpeed = (downloadId: string, newBytes: number): number => {
    const now = Date.now();
    if (!speedTracking.current[downloadId]) {
      speedTracking.current[downloadId] = [];
    }
    
    speedTracking.current[downloadId].push({ bytes: newBytes, timestamp: now });
    speedTracking.current[downloadId] = speedTracking.current[downloadId].filter(
      d => now - d.timestamp < 10000
    );
    
    const data = speedTracking.current[downloadId];
    if (data.length < 2) return 0;
    
    const timeDiff = (data[data.length - 1].timestamp - data[0].timestamp) / 1000;
    const bytesDiff = data[data.length - 1].bytes - data[0].bytes;
    
    return timeDiff > 0 ? bytesDiff / timeDiff : 0;
  };

  const processNextInQueue = useCallback(async () => {
    if (downloadQueue.current.length === 0) {
      setIsDownloading(false);
      return;
    }

    const downloadId = downloadQueue.current[0];
    const download = downloads[downloadId];
    
    if (!download) {
      downloadQueue.current.shift();
      processNextInQueue();
      return;
    }

    setIsDownloading(true);
    abortControllers.current[downloadId] = new AbortController();
    pausedDownloads.current.delete(downloadId);

    let state: DownloadItem = { ...download, status: 'downloading' };
    setDownloads(prev => ({ ...prev, [downloadId]: state }));

    try {
      const data = downloadData.current[downloadId];
      
      if (download.isZip && data?.files) {
        // Multi-file ZIP download
        const zip = new JSZip();
        let totalDownloaded = 0;
        const totalSize = data.files.reduce((sum, f) => sum + f.size, 0);

        for (const file of data.files) {
          if (pausedDownloads.current.has(downloadId)) {
            state.status = 'paused';
            setDownloads(prev => ({ ...prev, [downloadId]: state }));
            downloadQueue.current.shift();
            processNextInQueue();
            return;
          }

          const { data: blob, error } = await supabase.storage
            .from('user-files')
            .download(file.path);

          if (error) throw error;

          zip.file(file.name, blob);
          totalDownloaded += file.size;
          
          state.bytesDownloaded = totalDownloaded;
          state.progress = Math.round((totalDownloaded / totalSize) * 100);
          state.speed = calculateSpeed(downloadId, totalDownloaded);
          state.eta = state.speed > 0 ? (totalSize - totalDownloaded) / state.speed : 0;
          
          setDownloads(prev => ({ ...prev, [downloadId]: { ...state } }));
        }

        const content = await zip.generateAsync({ type: 'blob' });
        saveAs(content, data.zipName || 'download.zip');
        
        state.progress = 100;
        state.status = 'completed';
        toast.success('Download complete!');
      } else {
        // Single file download
        const { data: signedUrl, error: urlError } = await supabase.storage
          .from('user-files')
          .createSignedUrl(data?.files?.[0]?.path || '', 3600);

        if (urlError) throw urlError;

        const response = await fetch(signedUrl.signedUrl, {
          signal: abortControllers.current[downloadId].signal
        });

        if (!response.ok) throw new Error('Download failed');

        const blob = await response.blob();
        saveAs(blob, download.fileName);
        
        state.progress = 100;
        state.status = 'completed';
        state.bytesDownloaded = download.fileSize;
        toast.success(`${download.fileName} downloaded!`);
      }

      setDownloads(prev => ({ ...prev, [downloadId]: state }));
    } catch (error: any) {
      if (!pausedDownloads.current.has(downloadId)) {
        state.status = 'error';
        state.error = error.message || 'Download failed';
        setDownloads(prev => ({ ...prev, [downloadId]: state }));
        toast.error(`Failed to download ${state.fileName}`);
      }
    } finally {
      delete abortControllers.current[downloadId];
      delete speedTracking.current[downloadId];
      downloadQueue.current.shift();
      processNextInQueue();
    }
  }, [downloads]);

  const downloadFile = useCallback((fileId: string, fileName: string, storagePath: string, size: number) => {
    const downloadId = `single_${fileId}_${Date.now()}`;
    
    downloadData.current[downloadId] = {
      files: [{ name: fileName, path: storagePath, size }]
    };

    const newDownload: DownloadItem = {
      id: downloadId,
      fileName,
      fileSize: size,
      status: 'pending',
      progress: 0,
      bytesDownloaded: 0,
      speed: 0,
      eta: 0,
      createdAt: Date.now(),
      isZip: false,
    };

    setDownloads(prev => ({ ...prev, [downloadId]: newDownload }));
    downloadQueue.current.push(downloadId);

    if (!isDownloading) {
      setTimeout(() => processNextInQueue(), 0);
    }
  }, [isDownloading, processNextInQueue]);

  const downloadMultipleAsZip = useCallback((
    files: { id: string; name: string; path: string; size: number }[],
    zipName: string
  ) => {
    const downloadId = `zip_${Date.now()}`;
    const totalSize = files.reduce((sum, f) => sum + f.size, 0);
    
    downloadData.current[downloadId] = { files, zipName };

    const newDownload: DownloadItem = {
      id: downloadId,
      fileName: zipName,
      fileSize: totalSize,
      status: 'pending',
      progress: 0,
      bytesDownloaded: 0,
      speed: 0,
      eta: 0,
      createdAt: Date.now(),
      files,
      isZip: true,
    };

    setDownloads(prev => ({ ...prev, [downloadId]: newDownload }));
    downloadQueue.current.push(downloadId);

    if (!isDownloading) {
      setTimeout(() => processNextInQueue(), 0);
    }
  }, [isDownloading, processNextInQueue]);

  const pauseDownload = useCallback((id: string) => {
    pausedDownloads.current.add(id);
    if (abortControllers.current[id]) {
      abortControllers.current[id].abort();
    }
    setDownloads(prev => ({
      ...prev,
      [id]: { ...prev[id], status: 'paused' }
    }));
    toast.info('Download paused');
  }, []);

  const resumeDownload = useCallback((id: string) => {
    pausedDownloads.current.delete(id);
    setDownloads(prev => ({
      ...prev,
      [id]: { ...prev[id], status: 'pending' }
    }));
    downloadQueue.current.push(id);
    if (!isDownloading) {
      setTimeout(() => processNextInQueue(), 0);
    }
  }, [isDownloading, processNextInQueue]);

  const cancelDownload = useCallback((id: string) => {
    pausedDownloads.current.add(id);
    if (abortControllers.current[id]) {
      abortControllers.current[id].abort();
    }
    downloadQueue.current = downloadQueue.current.filter(qId => qId !== id);
    delete downloadData.current[id];
    
    setDownloads(prev => {
      const newDownloads = { ...prev };
      delete newDownloads[id];
      return newDownloads;
    });
  }, []);

  const clearCompleted = useCallback(() => {
    setDownloads(prev => {
      const newDownloads: typeof prev = {};
      Object.entries(prev).forEach(([id, state]) => {
        if (state.status !== 'completed') {
          newDownloads[id] = state;
        }
      });
      return newDownloads;
    });
  }, []);

  const getActiveCount = useCallback(() => {
    return Object.values(downloads).filter(d => d.status === 'downloading').length;
  }, [downloads]);

  const getPendingCount = useCallback(() => {
    return Object.values(downloads).filter(d => 
      d.status === 'pending' || d.status === 'downloading' || d.status === 'paused'
    ).length;
  }, [downloads]);

  return (
    <DownloadContext.Provider value={{
      downloads,
      isDownloading,
      downloadFile,
      downloadMultipleAsZip,
      pauseDownload,
      resumeDownload,
      cancelDownload,
      clearCompleted,
      getActiveCount,
      getPendingCount,
    }}>
      {children}
    </DownloadContext.Provider>
  );
};

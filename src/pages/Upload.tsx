import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ThemeToggle } from '@/components/ThemeToggle';
import { UploadManager } from '@/components/UploadManager';
import { toast } from 'sonner';
import { Upload as UploadIcon, ArrowLeft, X, FileIcon, Check, AlertCircle, Pause, Play, Zap, Clock } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { formatBytes } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

const CHUNK_SIZE = 2 * 1024 * 1024; // 2MB chunks
const MAX_RETRIES = 3;
const DB_NAME = 'CloudStoreUploads';
const STORE_NAME = 'uploads';

interface UploadState {
  id: string;
  fileName: string;
  fileSize: number;
  fileType: string;
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
}

const Upload = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploads, setUploads] = useState<Record<string, UploadState & { file?: File }>>({});
  const [isMinimized, setIsMinimized] = useState(false);
  const abortControllers = useRef<Record<string, AbortController>>({});
  const pausedUploads = useRef<Set<string>>(new Set());
  const speedTracking = useRef<Record<string, { bytes: number; timestamp: number }[]>>({});
  const fileRefs = useRef<Record<string, File>>({});

  // IndexedDB helpers
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

  const saveUploadState = useCallback(async (state: UploadState) => {
    try {
      const db = await openDB();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      // Don't save the file object, just the metadata
      const { ...stateWithoutFile } = state;
      store.put({ ...stateWithoutFile, userId: user?.id });
      await new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    } catch (error) {
      console.error('Failed to save upload state:', error);
    }
  }, [openDB, user?.id]);

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

  const loadPendingUploads = useCallback(async () => {
    if (!user) return;
    try {
      const db = await openDB();
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();
      
      request.onsuccess = () => {
        db.close();
        const pending = request.result.filter(
          (u: any) => u.userId === user.id && (u.status === 'paused' || u.status === 'uploading')
        );
        if (pending.length > 0) {
          const uploadsMap: Record<string, UploadState & { file?: File }> = {};
          pending.forEach((u: any) => {
            u.status = 'paused';
            uploadsMap[u.id] = u;
          });
          setUploads(prev => ({ ...prev, ...uploadsMap }));
          if (pending.length > 0) {
            toast.info(`${pending.length} paused upload(s) found. Select the file(s) to resume.`);
          }
        }
      };
    } catch (error) {
      console.error('Failed to load pending uploads:', error);
    }
  }, [openDB, user]);

  useEffect(() => {
    loadPendingUploads();
  }, [loadPendingUploads]);

  const sanitizeFileName = (name: string): string => {
    return name
      .replace(/[^\w\s.-]/g, '_')
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_')
      .slice(0, 100);
  };

  const generateUploadId = (file: File): string => {
    return `${user?.id}_${file.name}_${file.size}_${file.lastModified}`;
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

  const onDrop = useCallback((acceptedFiles: File[]) => {
    // Check if any files match existing paused uploads
    const newFiles: File[] = [];
    
    acceptedFiles.forEach(file => {
      const uploadId = generateUploadId(file);
      if (uploads[uploadId] && uploads[uploadId].status === 'paused') {
        // Resume existing upload
        fileRefs.current[uploadId] = file;
        setUploads(prev => ({
          ...prev,
          [uploadId]: { ...prev[uploadId], file }
        }));
        toast.success(`Ready to resume: ${file.name}`);
      } else {
        newFiles.push(file);
      }
    });
    
    setSelectedFiles(prev => [...prev, ...newFiles]);
  }, [uploads, user?.id]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: true,
  });

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
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
    fileType: string,
    onProgress?: (msg: string) => void
  ): Promise<boolean> => {
    try {
      onProgress?.('Combining chunks...');
      const chunks: Blob[] = [];
      
      for (let i = 0; i < totalChunks; i++) {
        onProgress?.(`Downloading chunk ${i + 1}/${totalChunks}...`);
        const chunkPath = `${storagePath}.chunk_${i}`;
        const { data, error } = await supabase.storage
          .from('user-files')
          .download(chunkPath);
        
        if (error) throw error;
        chunks.push(data);
      }
      
      onProgress?.('Creating final file...');
      const combinedBlob = new Blob(chunks, { type: fileType });
      
      const { error: uploadError } = await supabase.storage
        .from('user-files')
        .upload(storagePath, combinedBlob, {
          cacheControl: '3600',
          upsert: true,
        });
      
      if (uploadError) throw uploadError;
      
      onProgress?.('Cleaning up chunks...');
      const chunkPaths = Array.from({ length: totalChunks }, (_, i) => `${storagePath}.chunk_${i}`);
      await supabase.storage.from('user-files').remove(chunkPaths);
      
      return true;
    } catch (error) {
      console.error('Failed to combine chunks:', error);
      throw error;
    }
  };

  const startUpload = async (file: File) => {
    if (!user) return;

    const uploadId = generateUploadId(file);
    const sanitizedName = sanitizeFileName(file.name);
    
    let existingState = uploads[uploadId];
    const storagePath = existingState?.storagePath || `${user.id}/${Date.now()}-${sanitizedName}`;
    const useChunked = file.size > 50 * 1024 * 1024;
    const totalChunks = useChunked ? Math.ceil(file.size / CHUNK_SIZE) : 1;

    const state: UploadState & { file?: File } = {
      id: uploadId,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      storagePath,
      uploadedChunks: existingState?.uploadedChunks || [],
      totalChunks,
      status: 'uploading',
      progress: existingState?.progress || 0,
      bytesUploaded: existingState?.bytesUploaded || 0,
      speed: 0,
      eta: 0,
      createdAt: existingState?.createdAt || Date.now(),
      file,
    };

    fileRefs.current[uploadId] = file;
    setUploads(prev => ({ ...prev, [uploadId]: state }));
    await saveUploadState(state);

    abortControllers.current[uploadId] = new AbortController();
    const signal = abortControllers.current[uploadId].signal;
    pausedUploads.current.delete(uploadId);

    try {
      if (!useChunked) {
        // Direct upload for smaller files with XHR for progress
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              const progress = Math.round((e.loaded / e.total) * 100);
              const speed = calculateSpeed(uploadId, e.loaded);
              const eta = speed > 0 ? (e.total - e.loaded) / speed : 0;
              
              setUploads(prev => ({
                ...prev,
                [uploadId]: {
                  ...prev[uploadId],
                  progress,
                  bytesUploaded: e.loaded,
                  speed,
                  eta,
                }
              }));
            }
          };

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve();
            } else {
              reject(new Error(`Upload failed with status ${xhr.status}`));
            }
          };

          xhr.onerror = () => reject(new Error('Upload failed'));
          xhr.onabort = () => reject(new Error('Upload cancelled'));

          // Get signed upload URL
          supabase.storage
            .from('user-files')
            .upload(storagePath, file, { cacheControl: '3600', upsert: false })
            .then(({ error }) => {
              if (error) reject(error);
              else resolve();
            })
            .catch(reject);
        });

        state.progress = 100;
        state.status = 'completed';
        state.bytesUploaded = file.size;
      } else {
        // Chunked upload for large files
        for (let i = 0; i < totalChunks; i++) {
          if (pausedUploads.current.has(uploadId) || signal.aborted) {
            state.status = 'paused';
            setUploads(prev => ({ ...prev, [uploadId]: { ...state, file } }));
            await saveUploadState(state);
            return;
          }

          if (state.uploadedChunks.includes(i)) continue;

          const start = i * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, file.size);
          const chunk = file.slice(start, end);
          const chunkPath = `${storagePath}.chunk_${i}`;

          await uploadChunkWithRetry(chunk, chunkPath, signal);

          state.uploadedChunks.push(i);
          state.bytesUploaded = Math.min(state.uploadedChunks.length * CHUNK_SIZE, file.size);
          state.progress = Math.round((state.uploadedChunks.length / totalChunks) * 95);
          state.speed = calculateSpeed(uploadId, state.bytesUploaded);
          state.eta = state.speed > 0 ? (file.size - state.bytesUploaded) / state.speed : 0;

          setUploads(prev => ({ ...prev, [uploadId]: { ...state, file } }));
          await saveUploadState(state);
        }

        if (state.uploadedChunks.length === totalChunks) {
          setUploads(prev => ({
            ...prev,
            [uploadId]: { ...prev[uploadId], progress: 97, status: 'uploading' }
          }));
          
          await combineChunks(storagePath, totalChunks, file.type);
          state.progress = 100;
          state.status = 'completed';
        }
      }

      // Create database record
      const { error: dbError } = await supabase
        .from('files')
        .insert({
          user_id: user.id,
          name: file.name,
          size_bytes: file.size,
          mime_type: file.type,
          storage_path: storagePath
        });

      if (dbError) throw dbError;

      setUploads(prev => ({ ...prev, [uploadId]: { ...state, file } }));
      await deleteUploadState(uploadId);
      toast.success(`${file.name} uploaded successfully!`);

    } catch (error: any) {
      if (!pausedUploads.current.has(uploadId)) {
        state.status = 'error';
        state.error = error.message || 'Upload failed';
        setUploads(prev => ({ ...prev, [uploadId]: { ...state, file } }));
        await saveUploadState(state);
        toast.error(`Failed to upload ${file.name}: ${error.message}`);
      }
    } finally {
      delete abortControllers.current[uploadId];
      delete speedTracking.current[uploadId];
    }
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0 || !user) return;

    try {
      // Check quota
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('storage_used_bytes, storage_quota_bytes')
        .eq('id', user.id)
        .single();

      if (profileError) throw profileError;

      const totalSize = selectedFiles.reduce((sum, file) => sum + file.size, 0);

      if (profile.storage_used_bytes + totalSize > profile.storage_quota_bytes) {
        toast.error('Storage quota exceeded');
        return;
      }

      // Start all uploads
      for (const file of selectedFiles) {
        startUpload(file);
      }
      
      setSelectedFiles([]);
    } catch (error: any) {
      toast.error(error.message || 'Failed to start uploads');
    }
  };

  const pauseUpload = (uploadId: string) => {
    pausedUploads.current.add(uploadId);
    if (abortControllers.current[uploadId]) {
      abortControllers.current[uploadId].abort();
    }
    setUploads(prev => ({
      ...prev,
      [uploadId]: { ...prev[uploadId], status: 'paused' }
    }));
    toast.info('Upload paused. You can resume anytime.');
  };

  const resumeUpload = (uploadId: string, file: File) => {
    pausedUploads.current.delete(uploadId);
    startUpload(file);
  };

  const cancelUpload = async (uploadId: string) => {
    pausedUploads.current.add(uploadId);
    if (abortControllers.current[uploadId]) {
      abortControllers.current[uploadId].abort();
    }

    const state = uploads[uploadId];
    if (state && state.totalChunks > 1) {
      const chunkPaths = state.uploadedChunks.map(i => `${state.storagePath}.chunk_${i}`);
      if (chunkPaths.length > 0) {
        await supabase.storage.from('user-files').remove(chunkPaths);
      }
    }

    await deleteUploadState(uploadId);
    delete fileRefs.current[uploadId];
    setUploads(prev => {
      const newUploads = { ...prev };
      delete newUploads[uploadId];
      return newUploads;
    });
    toast.info('Upload cancelled');
  };

  const clearCompleted = () => {
    setUploads(prev => {
      const newUploads: typeof prev = {};
      Object.entries(prev).forEach(([id, state]) => {
        if (state.status !== 'completed') {
          newUploads[id] = state;
        }
      });
      return newUploads;
    });
  };

  const uploadItems = Object.values(uploads).map(u => ({
    id: u.id,
    fileName: u.fileName,
    fileSize: u.fileSize,
    progress: u.progress,
    status: u.status,
    error: u.error,
    speed: u.speed,
    eta: u.eta,
    bytesUploaded: u.bytesUploaded,
    file: u.file || fileRefs.current[u.id],
  }));

  const hasActiveUploads = uploadItems.some(u => u.status === 'uploading');
  const hasPausedUploads = uploadItems.some(u => u.status === 'paused');

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-accent/20">
      <header className="border-b bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="h-5 w-5 mr-2" />
            Back to Dashboard
          </Button>
          <div className="flex items-center gap-2">
            {hasPausedUploads && (
              <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-600">
                Uploads paused
              </Badge>
            )}
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold">Upload Files</h1>
            <p className="text-muted-foreground">
              Resumable uploads • Pause & resume anytime • Up to 100TB
            </p>
            <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Zap className="h-4 w-4 text-primary" />
                High-speed parallel
              </span>
              <span className="flex items-center gap-1">
                <Pause className="h-4 w-4 text-yellow-500" />
                Resume across sessions
              </span>
            </div>
          </div>

          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-all ${
              isDragActive
                ? 'border-primary bg-primary/10'
                : 'border-muted-foreground/25 hover:border-primary'
            }`}
          >
            <input {...getInputProps()} />
            <UploadIcon className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            {isDragActive ? (
              <p className="text-lg font-medium">Drop files here...</p>
            ) : (
              <>
                <p className="text-lg font-medium mb-2">Drag & drop files here</p>
                <p className="text-sm text-muted-foreground mb-4">or click to browse</p>
                <Button variant="outline">Select Files</Button>
              </>
            )}
          </div>

          {selectedFiles.length > 0 && (
            <div className="bg-card rounded-lg p-6 shadow-lg space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">
                  Ready to Upload ({selectedFiles.length}) - {formatBytes(selectedFiles.reduce((sum, f) => sum + f.size, 0))}
                </h3>
                <Button variant="ghost" size="sm" onClick={() => setSelectedFiles([])}>
                  Clear All
                </Button>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto">
                {selectedFiles.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-accent/50 rounded-lg">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <FileIcon className="h-5 w-5 text-primary flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{file.name}</p>
                        <p className="text-sm text-muted-foreground">{formatBytes(file.size)}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => removeFile(index)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <Button onClick={handleUpload} disabled={hasActiveUploads} className="w-full" size="lg">
                <UploadIcon className="h-5 w-5 mr-2" />
                Upload {selectedFiles.length} File{selectedFiles.length !== 1 ? 's' : ''}
              </Button>
            </div>
          )}

          {hasPausedUploads && selectedFiles.length === 0 && (
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 text-center">
              <p className="text-sm text-yellow-600 dark:text-yellow-400">
                You have paused uploads. Drop the same files here to resume them.
              </p>
            </div>
          )}
        </div>
      </main>

      {uploadItems.length > 0 && (
        <UploadManager
          uploads={uploadItems}
          onPause={pauseUpload}
          onResume={resumeUpload}
          onCancel={cancelUpload}
          onClearCompleted={clearCompleted}
          isMinimized={isMinimized}
          onToggleMinimize={() => setIsMinimized(!isMinimized)}
        />
      )}
    </div>
  );
};

export default Upload;

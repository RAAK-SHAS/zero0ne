import { supabase } from '@/integrations/supabase/client';

export const CHUNKED_UPLOAD_THRESHOLD_BYTES = 512 * 1024 * 1024;
export const MANUAL_CHUNK_SIZE_BYTES = 4 * 1024 * 1024;
const STORAGE_BUCKET = 'user-files';

export type SaveFileHandle = {
  createWritable: () => Promise<{
    write: (data: Blob) => Promise<void>;
    close: () => Promise<void>;
    abort: () => Promise<void>;
  }>;
};

type SaveFilePickerWindow = Window & {
  showSaveFilePicker?: (options: { suggestedName: string }) => Promise<SaveFileHandle>;
};

export interface StoredFileMetadata {
  storage_path: string;
  size_bytes: number;
  mime_type?: string | null;
  upload_strategy?: string | null;
  chunk_size_bytes?: number | null;
  chunk_count?: number | null;
  chunk_paths?: string[] | null;
}

export const shouldUseChunkedStorage = (fileSize: number) => fileSize >= CHUNKED_UPLOAD_THRESHOLD_BYTES;

export const isChunkedStoredFile = (file: Partial<StoredFileMetadata>) =>
  file.upload_strategy === 'chunked' && Array.isArray(file.chunk_paths) && file.chunk_paths.length > 0;

export const buildChunkPath = (storagePath: string, index: number) =>
  `${storagePath}.parts/${String(index).padStart(6, '0')}.part`;

export const getStoragePathsForRemoval = (file: Partial<StoredFileMetadata>) => {
  if (isChunkedStoredFile(file)) return file.chunk_paths as string[];
  return file.storage_path ? [file.storage_path] : [];
};

export const removeStoragePaths = async (paths: string[]) => {
  for (let i = 0; i < paths.length; i += 100) {
    const batch = paths.slice(i, i + 100);
    if (batch.length > 0) await supabase.storage.from(STORAGE_BUCKET).remove(batch);
  }
};

export const downloadStoredFileBlob = async (
  file: StoredFileMetadata,
  options?: {
    signal?: AbortSignal;
    onProgress?: (bytesDownloaded: number) => void;
  }
) => {
  if (isChunkedStoredFile(file)) {
    const chunks: Blob[] = [];
    let downloaded = 0;

    for (const path of file.chunk_paths || []) {
      if (options?.signal?.aborted) throw new DOMException('Download aborted', 'AbortError');

      const data = path.startsWith('http')
        ? await fetch(path, { signal: options?.signal }).then((response) => {
            if (!response.ok) throw new Error('Failed to download file chunk');
            return response.blob();
          })
        : await supabase.storage.from(STORAGE_BUCKET).download(path).then(({ data, error }) => {
            if (error || !data) throw error || new Error('Failed to download file chunk');
            return data;
          });

      chunks.push(data);
      downloaded += data.size;
      options?.onProgress?.(Math.min(downloaded, file.size_bytes));
    }

    return new Blob(chunks, { type: file.mime_type || 'application/octet-stream' });
  }

  const { data: signedUrl, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(file.storage_path, 3600);
  if (error || !signedUrl) throw error || new Error('Failed to create download link');

  const response = await fetch(signedUrl.signedUrl, { signal: options?.signal });
  if (!response.ok) throw new Error('Download failed');

  const blob = await response.blob();
  options?.onProgress?.(file.size_bytes);
  return blob;
};

export const downloadChunkedStoredFileToDisk = async (
  file: StoredFileMetadata,
  fileName: string,
  options?: {
    signal?: AbortSignal;
    onProgress?: (bytesDownloaded: number) => void;
    saveHandle?: Promise<SaveFileHandle | null> | SaveFileHandle | null;
  }
) => {
  const pickerWindow = window as SaveFilePickerWindow;
  if (!isChunkedStoredFile(file) || !pickerWindow.showSaveFilePicker) return false;

  let handle: SaveFileHandle | null;
  if (options?.saveHandle) {
    handle = await options.saveHandle;
    if (!handle) throw new DOMException('Download cancelled', 'AbortError');
  } else {
    try {
      handle = await pickerWindow.showSaveFilePicker({ suggestedName: fileName });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error;
      return false;
    }
  }
  const writable = await handle.createWritable();
  let downloaded = 0;

  try {
    for (const path of file.chunk_paths || []) {
      if (options?.signal?.aborted) throw new DOMException('Download aborted', 'AbortError');

      const data = path.startsWith('http')
        ? await fetch(path, { signal: options?.signal }).then((response) => {
            if (!response.ok) throw new Error('Failed to download file chunk');
            return response.blob();
          })
        : await supabase.storage.from(STORAGE_BUCKET).download(path).then(({ data, error }) => {
            if (error || !data) throw error || new Error('Failed to download file chunk');
            return data;
          });

      await writable.write(data);
      downloaded += data.size;
      options?.onProgress?.(Math.min(downloaded, file.size_bytes));
    }
    await writable.close();
    return true;
  } catch (error) {
    await writable.abort();
    throw error;
  }
};
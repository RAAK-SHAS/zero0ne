import { useEffect, useState } from 'react';
import { useUploadManager } from '@/contexts/UploadContext';

export interface UploadHistoryEntry {
  id: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  folderPath?: string;
  status: 'completed' | 'error';
  error?: string;
  completedAt: number;
  durationMs: number;
  createdAt: number;
}

const STORAGE_KEY = 'cloudstore.upload-history.v1';
const MAX_ENTRIES = 500;

const load = (): UploadHistoryEntry[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const save = (entries: UploadHistoryEntry[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
  } catch {
    /* ignore quota */
  }
};

export const useUploadHistory = () => {
  const { uploads } = useUploadManager();
  const [history, setHistory] = useState<UploadHistoryEntry[]>(() => load());

  // Track terminal-state uploads and push them into history once.
  useEffect(() => {
    setHistory((prev) => {
      const known = new Set(prev.map((e) => e.id));
      const additions: UploadHistoryEntry[] = [];
      for (const u of Object.values(uploads)) {
        if (known.has(u.id)) continue;
        if (u.status === 'completed' || u.status === 'error') {
          additions.push({
            id: u.id,
            fileName: u.fileName,
            fileSize: u.fileSize,
            fileType: u.fileType,
            folderPath: u.folderPath,
            status: u.status,
            error: u.error,
            completedAt: Date.now(),
            durationMs: Date.now() - u.createdAt,
            createdAt: u.createdAt,
          });
        }
      }
      if (additions.length === 0) return prev;
      const next = [...additions, ...prev].slice(0, MAX_ENTRIES);
      save(next);
      return next;
    });
  }, [uploads]);

  const clearHistory = () => {
    save([]);
    setHistory([]);
  };

  const removeEntry = (id: string) => {
    setHistory((prev) => {
      const next = prev.filter((e) => e.id !== id);
      save(next);
      return next;
    });
  };

  return { history, clearHistory, removeEntry };
};

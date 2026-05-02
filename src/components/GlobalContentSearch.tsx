import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Loader2, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface FileItem {
  id: string;
  name: string;
  size_bytes: number;
  mime_type: string | null;
  storage_path: string;
}

interface Hit {
  fileId: string;
  fileName: string;
  excerpt: string;
  matches: number;
}

interface GlobalContentSearchProps {
  files: FileItem[];
  onOpenFile: (fileId: string) => void;
}

const TEXT_EXTS = /\.(txt|md|markdown|json|csv|log|html|htm|xml|yml|yaml|js|jsx|ts|tsx|py|rb|go|rs|java|c|cpp|h|css|scss|sql|sh|env|gitignore|toml|ini)$/i;
const MAX_FILE_BYTES = 2 * 1024 * 1024; // skip files larger than 2MB to keep it fast
const MAX_FILES_SCANNED = 100;

export const useGlobalContentSearch = () => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'F' || e.key === 'f')) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return { open, setOpen };
};

export const GlobalContentSearch = ({ files, onOpenFile }: GlobalContentSearchProps & { open: boolean; onOpenChange: (v: boolean) => void }) => {
  return null; // unused — keep TS happy if anyone imports without props
};

interface DialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  files: FileItem[];
  onOpenFile: (fileId: string) => void;
}

export const GlobalContentSearchDialog = ({ open, onOpenChange, files, onOpenFile }: DialogProps) => {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  const runSearch = async () => {
    if (!query.trim()) return;
    const candidates = files
      .filter(f => TEXT_EXTS.test(f.name) || (f.mime_type ?? '').startsWith('text/'))
      .filter(f => f.size_bytes < MAX_FILE_BYTES)
      .slice(0, MAX_FILES_SCANNED);

    if (candidates.length === 0) {
      toast.info('No text-like files to search in this account');
      return;
    }

    setScanning(true);
    setHits([]);
    setProgress({ done: 0, total: candidates.length });

    const lowerQuery = query.toLowerCase();
    const found: Hit[] = [];

    for (let i = 0; i < candidates.length; i++) {
      const file = candidates[i];
      try {
        const { data: signed, error } = await supabase.storage
          .from('user-files')
          .createSignedUrl(file.storage_path, 60);
        if (error || !signed) continue;
        const res = await fetch(signed.signedUrl);
        if (!res.ok) continue;
        const text = await res.text();
        const lower = text.toLowerCase();
        let count = 0;
        let pos = 0;
        while ((pos = lower.indexOf(lowerQuery, pos)) !== -1) { count++; pos += lowerQuery.length; }
        if (count > 0) {
          const idx = lower.indexOf(lowerQuery);
          const start = Math.max(0, idx - 40);
          const end = Math.min(text.length, idx + lowerQuery.length + 60);
          const excerpt = (start > 0 ? '…' : '') + text.slice(start, end).replace(/\s+/g, ' ').trim() + (end < text.length ? '…' : '');
          found.push({ fileId: file.id, fileName: file.name, excerpt, matches: count });
          setHits([...found]);
        }
      } catch {
        // skip
      }
      setProgress({ done: i + 1, total: candidates.length });
    }

    setScanning(false);
    if (found.length === 0) toast.info(`No matches for "${query}"`);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') runSearch();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" />
            Search inside file contents
          </DialogTitle>
        </DialogHeader>
        <div className="flex gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search text inside .md, .txt, .json, code files…"
            autoFocus
            className="font-mono text-sm"
          />
          <Button onClick={runSearch} disabled={scanning || !query.trim()}>
            {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
          </Button>
        </div>
        {scanning && (
          <p className="text-xs font-mono text-muted-foreground">
            Scanning {progress.done} / {progress.total}…
          </p>
        )}
        <p className="text-[10px] font-mono text-muted-foreground">
          Only text-like files under 2 MB are scanned. PDFs are not indexed.
        </p>
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {hits.map(h => (
            <button
              key={h.fileId}
              onClick={() => { onOpenFile(h.fileId); onOpenChange(false); }}
              className="w-full text-left p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors group"
            >
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary shrink-0" />
                <span className="font-medium text-sm truncate group-hover:text-primary">{h.fileName}</span>
                <span className="ml-auto text-[10px] font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary shrink-0">
                  {h.matches} match{h.matches !== 1 ? 'es' : ''}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1 font-mono truncate">{h.excerpt}</p>
            </button>
          ))}
          {!scanning && hits.length === 0 && query && (
            <p className="text-center text-sm text-muted-foreground py-6">Press Enter to search</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

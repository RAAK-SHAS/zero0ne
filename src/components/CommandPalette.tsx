import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Search, FolderOpen, Upload, Settings, Trash2, Clock, Share2, Terminal,
  Star, File as FileIcon, FolderPlus, Sun, Moon, LogOut, Cloud, CornerDownLeft,
  ArrowUp, ArrowDown, Zap,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { formatBytes } from '@/lib/utils';
import { toast } from 'sonner';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSearch?: (query: string) => void;
}

interface FileHit {
  id: string;
  name: string;
  size_bytes: number;
  mime_type: string | null;
  created_at: string;
  is_favorite?: boolean;
}

type CommandItem = {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  hint?: string;
  shortcut?: string;
  group: 'Actions' | 'Navigation' | 'Files' | 'Recent';
  run: () => void;
};

const RECENT_KEY = 'cloudstore.palette.recent.v1';

const loadRecent = (): string[] => {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch { return []; }
};
const pushRecent = (id: string) => {
  const next = [id, ...loadRecent().filter(x => x !== id)].slice(0, 6);
  localStorage.setItem(RECENT_KEY, JSON.stringify(next));
};

export const CommandPalette = ({ open, onOpenChange, onSearch }: CommandPaletteProps) => {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<FileHit[]>([]);
  const [recentFiles, setRecentFiles] = useState<FileHit[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const listRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    onOpenChange(false);
    setQuery('');
    setActiveIdx(0);
  }, [onOpenChange]);

  // Toggle theme helper
  const toggleTheme = () => {
    const root = document.documentElement;
    const isDark = root.classList.contains('dark');
    root.classList.toggle('dark', !isDark);
    try { localStorage.setItem('theme', !isDark ? 'dark' : 'light'); } catch {}
    toast.success(`${!isDark ? 'Dark' : 'Light'} mode`);
  };

  // Load recent files when opened
  useEffect(() => {
    if (!open || !user) return;
    setQuery('');
    setActiveIdx(0);
    (async () => {
      const { data } = await supabase
        .from('files')
        .select('id,name,size_bytes,mime_type,created_at,is_favorite')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(6);
      setRecentFiles((data as FileHit[]) || []);
    })();
  }, [open, user]);

  // Search files (debounced)
  useEffect(() => {
    if (!open || !user) return;
    const q = query.trim();
    if (!q) { setHits([]); return; }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from('files')
        .select('id,name,size_bytes,mime_type,created_at,is_favorite')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .ilike('name', `%${q}%`)
        .order('created_at', { ascending: false })
        .limit(12);
      setHits((data as FileHit[]) || []);
    }, 160);
    return () => clearTimeout(t);
  }, [query, open, user]);

  const openFile = (f: FileHit) => {
    pushRecent(f.id);
    navigate(`/dashboard?file=${f.id}`);
    close();
  };

  const actions: CommandItem[] = useMemo(() => [
    { id: 'a:upload', icon: Upload, label: 'Upload files', shortcut: 'U', group: 'Actions',
      run: () => { navigate('/upload'); close(); } },
    { id: 'a:new-folder', icon: FolderPlus, label: 'New folder', hint: 'Create in current view', group: 'Actions',
      run: () => { window.dispatchEvent(new CustomEvent('cloudstore:new-folder')); close(); } },
    { id: 'a:theme', icon: document.documentElement.classList.contains('dark') ? Sun : Moon,
      label: 'Toggle theme', shortcut: '⇧D', group: 'Actions', run: () => { toggleTheme(); close(); } },
    { id: 'a:signout', icon: LogOut, label: 'Sign out', group: 'Actions',
      run: async () => { await signOut(); close(); } },
  ], [navigate, signOut]);

  const navItems: CommandItem[] = useMemo(() => [
    { id: 'n:files', icon: FolderOpen, label: 'My Files', shortcut: 'F', group: 'Navigation',
      run: () => { navigate('/dashboard'); close(); } },
    { id: 'n:recent', icon: Clock, label: 'Recent Files', shortcut: 'R', group: 'Navigation',
      run: () => { navigate('/dashboard?view=recent'); close(); } },
    { id: 'n:favorites', icon: Star, label: 'Favorites', group: 'Navigation',
      run: () => { navigate('/dashboard?view=favorites'); close(); } },
    { id: 'n:shared', icon: Share2, label: 'Shared Files', shortcut: 'S', group: 'Navigation',
      run: () => { navigate('/dashboard?view=shared'); close(); } },
    { id: 'n:uploads', icon: Cloud, label: 'Upload Manager', group: 'Navigation',
      run: () => { navigate('/uploads'); close(); } },
    { id: 'n:trash', icon: Trash2, label: 'Trash', shortcut: 'T', group: 'Navigation',
      run: () => { navigate('/trash'); close(); } },
    { id: 'n:settings', icon: Settings, label: 'Settings', shortcut: ',', group: 'Navigation',
      run: () => { navigate('/settings'); close(); } },
  ], [navigate]);

  const q = query.trim().toLowerCase();
  const filterMatch = (label: string) => !q || label.toLowerCase().includes(q);

  const fileItems: CommandItem[] = (q ? hits : recentFiles).map((f) => ({
    id: `f:${f.id}`,
    icon: FileIcon,
    label: f.name,
    hint: `${formatBytes(f.size_bytes)} · ${new Date(f.created_at).toLocaleDateString()}`,
    group: q ? 'Files' : 'Recent',
    run: () => openFile(f),
  }));

  const items: CommandItem[] = useMemo(() => {
    const a = actions.filter(i => filterMatch(i.label));
    const n = navItems.filter(i => filterMatch(i.label));
    return [...a, ...n, ...fileItems];
  }, [actions, navItems, fileItems, q]);

  // Reset active idx when list changes
  useEffect(() => { setActiveIdx(0); }, [query, hits.length, recentFiles.length]);

  // Keyboard nav
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx(i => Math.min(i + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      items[activeIdx]?.run();
    }
  };

  // Auto scroll active into view
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${activeIdx}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  const grouped = useMemo(() => {
    const map = new Map<string, { item: CommandItem; idx: number }[]>();
    items.forEach((item, idx) => {
      const arr = map.get(item.group) || [];
      arr.push({ item, idx });
      map.set(item.group, arr);
    });
    return map;
  }, [items]);

  const groupOrder: CommandItem['group'][] = ['Actions', 'Navigation', q ? 'Files' : 'Recent'];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="p-0 gap-0 max-w-xl glass-heavy neon-border overflow-hidden [&>button]:hidden animate-scale-in"
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <Search className="h-4 w-4 text-primary shrink-0" />
          <Input
            value={query}
            onChange={e => { setQuery(e.target.value); onSearch?.(e.target.value); }}
            placeholder="Search files, run commands…"
            className="border-0 bg-transparent focus-visible:ring-0 h-8 px-0 font-mono text-sm placeholder:text-muted-foreground"
            autoFocus
          />
          <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground">
            ESC
          </kbd>
        </div>

        <div ref={listRef} className="py-2 max-h-[420px] overflow-y-auto">
          {groupOrder.map(group => {
            const rows = grouped.get(group);
            if (!rows || rows.length === 0) return null;
            return (
              <div key={group} className="mb-1">
                <p className="px-4 py-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  {group === 'Files' && <Zap className="h-3 w-3 text-primary" />}
                  {group}
                </p>
                {rows.map(({ item, idx }) => (
                  <button
                    key={item.id}
                    data-idx={idx}
                    onMouseEnter={() => setActiveIdx(idx)}
                    onClick={() => item.run()}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors group ${
                      idx === activeIdx ? 'bg-accent/70' : 'hover:bg-accent/40'
                    }`}
                  >
                    <item.icon className={`h-4 w-4 shrink-0 ${idx === activeIdx ? 'text-primary' : 'text-muted-foreground'}`} />
                    <span className="flex-1 text-left truncate">{item.label}</span>
                    {item.hint && (
                      <span className="hidden sm:inline text-[11px] text-muted-foreground truncate max-w-[180px]">
                        {item.hint}
                      </span>
                    )}
                    {item.shortcut && (
                      <kbd className="h-5 min-w-[20px] inline-flex items-center justify-center rounded border border-border bg-muted px-1 font-mono text-[10px] text-muted-foreground">
                        {item.shortcut}
                      </kbd>
                    )}
                    {idx === activeIdx && (
                      <CornerDownLeft className="h-3 w-3 text-primary" />
                    )}
                  </button>
                ))}
              </div>
            );
          })}

          {items.length === 0 && (
            <div className="px-4 py-10 text-center">
              <p className="text-sm text-muted-foreground font-mono">No results for "{query}"</p>
              <p className="text-[11px] text-muted-foreground/60 mt-2">Try a filename or command name</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 px-4 py-2 border-t border-border bg-muted/30 text-[10px] font-mono text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1"><ArrowUp className="h-3 w-3" /><ArrowDown className="h-3 w-3" /> navigate</span>
            <span className="flex items-center gap-1"><CornerDownLeft className="h-3 w-3" /> open</span>
          </div>
          <span>⌘K to toggle</span>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Hook to open command palette with Cmd+K
export const useCommandPalette = () => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return { open, setOpen };
};

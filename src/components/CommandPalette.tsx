import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Search, FolderOpen, Upload, Settings, Trash2, Clock, Share2, Terminal } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSearch?: (query: string) => void;
}

const commands = [
  { icon: FolderOpen, label: 'My Files', shortcut: 'F', path: '/dashboard' },
  { icon: Clock, label: 'Recent Files', shortcut: 'R', path: '/dashboard?view=recent' },
  { icon: Share2, label: 'Shared Files', shortcut: 'S', path: '/dashboard?view=shared' },
  { icon: Upload, label: 'Upload Files', shortcut: 'U', path: '/upload' },
  { icon: Trash2, label: 'Trash', shortcut: 'T', path: '/trash' },
  { icon: Settings, label: 'Settings', shortcut: ',', path: '/settings' },
];

export const CommandPalette = ({ open, onOpenChange, onSearch }: CommandPaletteProps) => {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  const filtered = commands.filter(c => c.label.toLowerCase().includes(query.toLowerCase()));

  const handleSelect = useCallback((path: string) => {
    navigate(path);
    onOpenChange(false);
    setQuery('');
  }, [navigate, onOpenChange]);

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 gap-0 max-w-lg glass-heavy neon-border overflow-hidden [&>button]:hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <Terminal className="h-4 w-4 text-primary shrink-0" />
          <Input
            value={query}
            onChange={e => { setQuery(e.target.value); onSearch?.(e.target.value); }}
            placeholder="Type a command or search files..."
            className="border-0 bg-transparent focus-visible:ring-0 h-8 px-0 font-mono text-sm placeholder:text-muted-foreground"
            autoFocus
          />
          <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground">ESC</kbd>
        </div>
        <div className="py-2 max-h-[300px] overflow-y-auto">
          <p className="px-4 py-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Navigation</p>
          {filtered.map(cmd => (
            <button
              key={cmd.path}
              onClick={() => handleSelect(cmd.path)}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-accent/50 transition-colors group"
            >
              <cmd.icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              <span className="flex-1 text-left">{cmd.label}</span>
              <kbd className="h-5 min-w-[20px] inline-flex items-center justify-center rounded border border-border bg-muted px-1 font-mono text-[10px] text-muted-foreground">
                {cmd.shortcut}
              </kbd>
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground font-mono">No results for "{query}"</p>
          )}
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
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return { open, setOpen };
};

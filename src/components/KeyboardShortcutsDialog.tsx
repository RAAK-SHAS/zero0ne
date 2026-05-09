import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Keyboard } from 'lucide-react';

const SHORTCUTS: { category: string; items: { keys: string[]; label: string }[] }[] = [
  {
    category: 'Global',
    items: [
      { keys: ['Ctrl', 'K'], label: 'Open command palette' },
      { keys: ['Ctrl', 'Shift', 'F'], label: 'Search inside file contents' },
      { keys: ['Ctrl', '`'], label: 'Toggle terminal' },
      { keys: ['?'], label: 'Show this shortcuts cheatsheet' },
      { keys: ['Esc'], label: 'Close dialogs / panels' },
    ],
  },
  {
    category: 'Files',
    items: [
      { keys: ['Click'], label: 'Select file' },
      { keys: ['Double-click'], label: 'Preview file' },
      { keys: ['Drag'], label: 'Move file into a folder' },
    ],
  },
  {
    category: 'Terminal',
    items: [
      { keys: ['↑', '↓'], label: 'Browse command history' },
      { keys: ['Tab'], label: 'Autocomplete command / filename' },
      { keys: ['|'], label: 'Pipe output (e.g. ls | grep pdf)' },
    ],
  },
];

export const KeyboardShortcutsDialog = () => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      const isEditable = tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable;
      if (isEditable) return;
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        setOpen(prev => !prev);
      }
    };
    const openHandler = () => setOpen(true);
    window.addEventListener('keydown', handler);
    window.addEventListener('open-shortcuts', openHandler);
    return () => {
      window.removeEventListener('keydown', handler);
      window.removeEventListener('open-shortcuts', openHandler);
    };
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5 text-primary" />
            Keyboard Shortcuts
          </DialogTitle>
        </DialogHeader>
        <div className="grid sm:grid-cols-2 gap-6 mt-2">
          {SHORTCUTS.map(group => (
            <div key={group.category}>
              <h4 className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2">
                {group.category}
              </h4>
              <ul className="space-y-1.5">
                {group.items.map((item, i) => (
                  <li key={i} className="flex items-center justify-between text-sm gap-2">
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className="flex gap-1 shrink-0">
                      {item.keys.map(k => (
                        <kbd
                          key={k}
                          className="px-1.5 py-0.5 rounded border border-border bg-muted text-[10px] font-mono"
                        >
                          {k}
                        </kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-4 text-[11px] text-muted-foreground text-center font-mono">
          Tip: press <kbd className="px-1 rounded border border-border bg-muted">?</kbd> anywhere to open this dialog.
        </p>
      </DialogContent>
    </Dialog>
  );
};

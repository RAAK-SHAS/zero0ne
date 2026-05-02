import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Trash2, Share2, X, FolderInput, FolderArchive } from 'lucide-react';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import { motion } from 'framer-motion';

interface FolderOption {
  id: string;
  name: string;
  parent_id: string | null;
}

interface BatchActionsProps {
  selectedCount: number;
  folders: FolderOption[];
  currentFolderId: string | null;
  onDownloadZip: () => void;
  onShareZip: () => void;
  onDelete: () => void;
  onMove: (folderId: string | null) => void;
  onClear: () => void;
}

export const BatchActions = ({
  selectedCount,
  folders,
  currentFolderId,
  onDownloadZip,
  onShareZip,
  onDelete,
  onMove,
  onClear,
}: BatchActionsProps) => {
  const [moveOpen, setMoveOpen] = useState(false);

  if (selectedCount === 0) return null;

  // Show only folders that are not the current one (where files already are)
  const moveTargets = folders.filter(f => f.id !== currentFolderId);

  return (
    <motion.div
      initial={{ y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 80, opacity: 0 }}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
    >
      <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-card/95 backdrop-blur-xl border border-primary/30 shadow-2xl shadow-primary/10">
        <span className="text-sm font-mono">
          <span className="text-primary font-bold">{selectedCount}</span>{' '}
          {selectedCount === 1 ? 'file' : 'files'} selected
        </span>
        <div className="h-5 w-px bg-border" />
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={onDownloadZip} title="Download as ZIP">
            <Download className="h-4 w-4 mr-1.5" />
            <span className="hidden sm:inline">ZIP</span>
          </Button>

          <Popover open={moveOpen} onOpenChange={setMoveOpen}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" title="Move to folder">
                <FolderInput className="h-4 w-4 mr-1.5" />
                <span className="hidden sm:inline">Move</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent align="center" className="w-64 p-0 max-h-72 overflow-y-auto">
              <div className="p-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                Move to…
              </div>
              {currentFolderId !== null && (
                <button
                  onClick={() => { onMove(null); setMoveOpen(false); }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center gap-2"
                >
                  <FolderArchive className="h-4 w-4 text-muted-foreground" />
                  Root /
                </button>
              )}
              {moveTargets.length === 0 && (
                <p className="px-3 py-4 text-xs text-center text-muted-foreground">No other folders</p>
              )}
              {moveTargets.map(f => (
                <button
                  key={f.id}
                  onClick={() => { onMove(f.id); setMoveOpen(false); }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center gap-2"
                >
                  <FolderArchive className="h-4 w-4 text-muted-foreground" />
                  {f.name}
                </button>
              ))}
            </PopoverContent>
          </Popover>

          <Button variant="ghost" size="sm" onClick={onShareZip} title="Share files">
            <Share2 className="h-4 w-4 mr-1.5" />
            <span className="hidden sm:inline">Share</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
            title="Delete all"
          >
            <Trash2 className="h-4 w-4 mr-1.5" />
            <span className="hidden sm:inline">Delete</span>
          </Button>
        </div>
        <div className="h-5 w-px bg-border" />
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClear} title="Clear selection">
          <X className="h-4 w-4" />
        </Button>
      </div>
    </motion.div>
  );
};

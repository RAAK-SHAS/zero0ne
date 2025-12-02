import { Button } from '@/components/ui/button';
import { Download, Trash2, Share2, X } from 'lucide-react';

interface BatchActionsProps {
  selectedCount: number;
  onDownload: () => void;
  onShare: () => void;
  onDelete: () => void;
  onClear: () => void;
}

export const BatchActions = ({
  selectedCount,
  onDownload,
  onShare,
  onDelete,
  onClear,
}: BatchActionsProps) => {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-background border rounded-lg shadow-lg p-4 flex items-center gap-4 z-50">
      <span className="text-sm font-medium">
        {selectedCount} {selectedCount === 1 ? 'file' : 'files'} selected
      </span>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onDownload}>
          <Download className="h-4 w-4 mr-2" />
          Download
        </Button>
        <Button variant="outline" size="sm" onClick={onShare}>
          <Share2 className="h-4 w-4 mr-2" />
          Share
        </Button>
        <Button variant="outline" size="sm" onClick={onDelete}>
          <Trash2 className="h-4 w-4 mr-2" />
          Delete
        </Button>
        <Button variant="ghost" size="sm" onClick={onClear}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

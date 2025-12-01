import { File as FileIcon, MoreVertical, Download, Share2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatBytes } from '@/lib/utils';
import { format } from 'date-fns';

interface FileItem {
  id: string;
  name: string;
  size_bytes: number;
  mime_type: string | null;
  created_at: string;
}

interface FileListProps {
  files: FileItem[];
  onDownload: (fileId: string) => void;
  onShare: (fileId: string) => void;
  onDelete: (fileId: string) => void;
}

export const FileList = ({ files, onDownload, onShare, onDelete }: FileListProps) => {
  if (files.length === 0) {
    return (
      <div className="text-center py-12">
        <FileIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">No files yet. Upload your first file!</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {files.map((file) => (
        <div
          key={file.id}
          className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
        >
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <FileIcon className="h-8 w-8 text-primary flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-medium truncate">{file.name}</p>
              <div className="flex gap-3 text-sm text-muted-foreground">
                <span>{formatBytes(file.size_bytes)}</span>
                <span>•</span>
                <span>{format(new Date(file.created_at), 'MMM d, yyyy')}</span>
              </div>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onDownload(file.id)}>
                <Download className="h-4 w-4 mr-2" />
                Download
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onShare(file.id)}>
                <Share2 className="h-4 w-4 mr-2" />
                Share
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => onDelete(file.id)}
                className="text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ))}
    </div>
  );
};
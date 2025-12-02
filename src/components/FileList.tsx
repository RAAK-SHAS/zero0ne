import { MoreVertical, Download, Share2, Trash2, Edit2, Eye, Lock, Clock } from 'lucide-react';
import { FileIcon } from './FileIcon';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
  storage_path: string;
  is_encrypted?: boolean;
}

interface FileListProps {
  files: FileItem[];
  selectedFiles: string[];
  onSelectFile: (fileId: string) => void;
  onSelectAll: (selected: boolean) => void;
  onDownload: (fileId: string) => void;
  onShare: (fileId: string) => void;
  onDelete: (fileId: string) => void;
  onRename: (fileId: string) => void;
  onPreview: (fileId: string) => void;
  onEncrypt: (fileId: string) => void;
  onVersionHistory: (fileId: string) => void;
}

export const FileList = ({ 
  files, 
  selectedFiles,
  onSelectFile,
  onSelectAll,
  onDownload, 
  onShare, 
  onDelete, 
  onRename,
  onPreview,
  onEncrypt,
  onVersionHistory
}: FileListProps) => {
  if (files.length === 0) {
    return (
      <div className="text-center py-12">
        <FileIcon fileName="" mimeType={null} className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">No files yet. Upload your first file!</p>
      </div>
    );
  }

  const allSelected = files.length > 0 && selectedFiles.length === files.length;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground">
        <Checkbox 
          checked={allSelected}
          onCheckedChange={onSelectAll}
        />
        <span>Select all</span>
      </div>
      
      {files.map((file) => {
        const isSelected = selectedFiles.includes(file.id);
        
        return (
          <div
            key={file.id}
            className={`flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors ${
              isSelected ? 'bg-accent/30 border-primary' : ''
            }`}
          >
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <Checkbox 
                checked={isSelected}
                onCheckedChange={() => onSelectFile(file.id)}
              />
              
              <div 
                className="flex items-center gap-4 flex-1 min-w-0 cursor-pointer"
                onClick={() => onPreview(file.id)}
              >
                <FileIcon 
                  fileName={file.name}
                  mimeType={file.mime_type}
                  storagePath={file.storage_path}
                  showThumbnail
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">{file.name}</p>
                    {file.is_encrypted && <Lock className="h-3 w-3 text-muted-foreground" />}
                  </div>
                  <div className="flex gap-3 text-sm text-muted-foreground">
                    <span>{formatBytes(file.size_bytes)}</span>
                    <span>•</span>
                    <span>{format(new Date(file.created_at), 'MMM d, yyyy')}</span>
                  </div>
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
                <DropdownMenuItem onClick={() => onPreview(file.id)}>
                  <Eye className="h-4 w-4 mr-2" />
                  Preview
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDownload(file.id)}>
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onShare(file.id)}>
                  <Share2 className="h-4 w-4 mr-2" />
                  Share
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onRename(file.id)}>
                  <Edit2 className="h-4 w-4 mr-2" />
                  Rename
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onVersionHistory(file.id)}>
                  <Clock className="h-4 w-4 mr-2" />
                  Version History
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onEncrypt(file.id)}>
                  <Lock className="h-4 w-4 mr-2" />
                  {file.is_encrypted ? 'Decrypt' : 'Encrypt'}
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => onDelete(file.id)}
                  className="text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Move to Trash
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      })}
    </div>
  );
};
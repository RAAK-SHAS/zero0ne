import { memo, useCallback } from 'react';
import { MoreVertical, Download, Share2, Trash2, Edit2, Eye, Lock, Clock, Archive, Star } from 'lucide-react';
import { FileIcon } from './FileIcon';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatBytes, cn } from '@/lib/utils';
import { format } from 'date-fns';

interface FileItem {
  id: string;
  name: string;
  size_bytes: number;
  mime_type: string | null;
  created_at: string;
  storage_path: string;
  is_encrypted?: boolean;
  is_favorite?: boolean;
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
  onExtractZip?: (fileId: string) => void;
  onToggleFavorite?: (fileId: string, current: boolean) => void;
}

const isArchiveFile = (fileName: string): boolean => {
  return /\.(zip|rar|7z|tar|gz|bz2|xz|tgz)$/i.test(fileName);
};

const FileRow = memo(({
  file,
  isSelected,
  onSelectFile,
  onDownload,
  onShare,
  onDelete,
  onRename,
  onPreview,
  onEncrypt,
  onVersionHistory,
  onExtractZip,
  onToggleFavorite,
}: {
  file: FileItem;
  isSelected: boolean;
  onSelectFile: (fileId: string) => void;
  onDownload: (fileId: string) => void;
  onShare: (fileId: string) => void;
  onDelete: (fileId: string) => void;
  onRename: (fileId: string) => void;
  onPreview: (fileId: string) => void;
  onEncrypt: (fileId: string) => void;
  onVersionHistory: (fileId: string) => void;
  onExtractZip?: (fileId: string) => void;
  onToggleFavorite?: (fileId: string, current: boolean) => void;
}) => {
  const handleCheckboxChange = useCallback(() => {
    onSelectFile(file.id);
  }, [file.id, onSelectFile]);

  const handlePreviewClick = useCallback(() => {
    onPreview(file.id);
  }, [file.id, onPreview]);

  const handleFavoriteClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleFavorite?.(file.id, file.is_favorite || false);
  }, [file.id, file.is_favorite, onToggleFavorite]);

  return (
    <div
      className={cn(
        "group flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200",
        "hover:bg-muted/50",
        isSelected && "bg-primary/5 ring-1 ring-primary/20"
      )}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <Checkbox 
          checked={isSelected}
          onCheckedChange={handleCheckboxChange}
          className="transition-transform data-[state=checked]:bg-primary data-[state=checked]:border-primary"
        />
        
        {onToggleFavorite && (
          <button
            onClick={handleFavoriteClick}
            className="transition-all duration-200 hover:scale-110 shrink-0"
          >
            <Star
              className={cn(
                "h-4 w-4 transition-all duration-200",
                file.is_favorite
                  ? "fill-amber-400 text-amber-400"
                  : "text-muted-foreground/30 hover:text-amber-400"
              )}
            />
          </button>
        )}
        
        <div 
          className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer group/preview"
          onClick={handlePreviewClick}
        >
          <div className="h-10 w-10 rounded-lg bg-muted/70 flex items-center justify-center shrink-0 group-hover/preview:bg-primary/10 transition-colors">
            <FileIcon 
              fileName={file.name}
              mimeType={file.mime_type}
              storagePath={file.storage_path}
              showThumbnail
              className="h-5 w-5"
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="font-medium text-sm truncate group-hover/preview:text-primary transition-colors">
                {file.name}
              </p>
              {file.is_encrypted && (
                <div className="px-1.5 py-0.5 rounded-md bg-amber-500/10 shrink-0">
                  <Lock className="h-3 w-3 text-amber-500" />
                </div>
              )}
              {isArchiveFile(file.name) && (
                <div className="px-1.5 py-0.5 rounded-md bg-primary/10 shrink-0">
                  <Archive className="h-3 w-3 text-primary" />
                </div>
              )}
            </div>
            <div className="flex gap-2 text-xs text-muted-foreground mt-0.5">
              <span className="tabular-nums">{formatBytes(file.size_bytes)}</span>
              <span className="text-border">·</span>
              <span>{format(new Date(file.created_at), 'MMM d, yyyy')}</span>
            </div>
          </div>
        </div>
      </div>
      
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="ghost" 
            size="icon"
            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-all duration-200"
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={() => onPreview(file.id)}>
            <Eye className="h-4 w-4 mr-2" /> Preview
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onDownload(file.id)}>
            <Download className="h-4 w-4 mr-2" /> Download
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onShare(file.id)}>
            <Share2 className="h-4 w-4 mr-2" /> Share
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => onRename(file.id)}>
            <Edit2 className="h-4 w-4 mr-2" /> Rename
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onVersionHistory(file.id)}>
            <Clock className="h-4 w-4 mr-2" /> Version History
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onEncrypt(file.id)}>
            <Lock className="h-4 w-4 mr-2" /> {file.is_encrypted ? 'Decrypt' : 'Encrypt'}
          </DropdownMenuItem>
          {isArchiveFile(file.name) && onExtractZip && (
            <DropdownMenuItem onClick={() => onExtractZip(file.id)}>
              <Archive className="h-4 w-4 mr-2" /> Extract Archive
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => onDelete(file.id)} className="text-destructive focus:text-destructive">
            <Trash2 className="h-4 w-4 mr-2" /> Move to Trash
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
});

FileRow.displayName = 'FileRow';

export const FileList = memo(({ 
  files, selectedFiles, onSelectFile, onSelectAll, onDownload, onShare, 
  onDelete, onRename, onPreview, onEncrypt, onVersionHistory, onExtractZip, onToggleFavorite
}: FileListProps) => {
  if (files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
          <FolderOpenIcon className="h-8 w-8 text-muted-foreground/50" />
        </div>
        <p className="text-muted-foreground font-medium">No files yet</p>
        <p className="text-xs text-muted-foreground/60 mt-1">Upload your first file to get started</p>
      </div>
    );
  }

  const allSelected = files.length > 0 && selectedFiles.length === files.length;

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-3 px-4 py-2 text-xs text-muted-foreground">
        <Checkbox 
          checked={allSelected}
          onCheckedChange={onSelectAll}
        />
        <span className="font-medium">
          {selectedFiles.length > 0 ? `${selectedFiles.length} selected` : 'Select all'}
        </span>
        <span className="ml-auto tabular-nums">{files.length} file{files.length !== 1 ? 's' : ''}</span>
      </div>
      
      <div className="space-y-0.5">
        {files.map((file) => (
          <FileRow
            key={file.id}
            file={file}
            isSelected={selectedFiles.includes(file.id)}
            onSelectFile={onSelectFile}
            onDownload={onDownload}
            onShare={onShare}
            onDelete={onDelete}
            onRename={onRename}
            onPreview={onPreview}
            onEncrypt={onEncrypt}
            onVersionHistory={onVersionHistory}
            onExtractZip={onExtractZip}
            onToggleFavorite={onToggleFavorite}
          />
        ))}
      </div>
    </div>
  );
});

FileList.displayName = 'FileList';

// Small helper to avoid importing another icon
const FolderOpenIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2"/>
  </svg>
);

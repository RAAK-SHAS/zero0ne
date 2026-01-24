import { memo, useCallback } from 'react';
import { Star, MoreHorizontal, Download, Share, Trash2, Edit2, Eye, Lock, History, Archive } from 'lucide-react';
import { formatBytes } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { FileIcon } from '@/components/FileIcon';
import { TagDisplay } from '@/components/TagManager';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface FileItem {
  id: string;
  name: string;
  size_bytes: number;
  mime_type: string | null;
  created_at: string;
  storage_path?: string;
  is_encrypted?: boolean;
  is_favorite?: boolean;
  tags?: string[];
}

interface FileGridProps {
  files: FileItem[];
  selectedFiles: string[];
  onSelectFile: (fileId: string) => void;
  onDownload: (fileId: string) => void;
  onShare: (fileId: string) => void;
  onDelete: (fileId: string) => void;
  onRename: (fileId: string) => void;
  onPreview: (fileId: string) => void;
  onEncrypt?: (fileId: string) => void;
  onVersionHistory?: (fileId: string) => void;
  onExtractZip?: (fileId: string) => void;
  onToggleFavorite?: (fileId: string, current: boolean) => void;
}

// Memoized file card for better performance
const FileCard = memo(({
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
  onEncrypt?: (fileId: string) => void;
  onVersionHistory?: (fileId: string) => void;
  onExtractZip?: (fileId: string) => void;
  onToggleFavorite?: (fileId: string, current: boolean) => void;
}) => {
  const isArchive = /\.(zip|rar|7z|tar|gz|bz2|xz|tgz)$/i.test(file.name);

  const handleSelect = useCallback(() => {
    onSelectFile(file.id);
  }, [file.id, onSelectFile]);

  const handlePreview = useCallback(() => {
    onPreview(file.id);
  }, [file.id, onPreview]);

  const handleFavoriteClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleFavorite?.(file.id, file.is_favorite || false);
  }, [file.id, file.is_favorite, onToggleFavorite]);

  return (
    <div
      className={cn(
        "group relative bg-card border rounded-xl p-4 cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02] hover:border-primary/50 animate-fade-in",
        isSelected && "ring-2 ring-primary shadow-lg border-primary"
      )}
      onClick={handleSelect}
      onDoubleClick={handlePreview}
    >
      {/* Favorite button */}
      {onToggleFavorite && (
        <button
          onClick={handleFavoriteClick}
          className="absolute top-3 left-3 z-10 transition-transform hover:scale-110"
        >
          <Star
            className={cn(
              "h-4 w-4 transition-all duration-200",
              file.is_favorite
                ? "fill-yellow-400 text-yellow-400 drop-shadow-sm"
                : "text-muted-foreground/40 hover:text-yellow-400"
            )}
          />
        </button>
      )}

      {/* Menu button */}
      <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-all duration-200 z-10">
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="secondary" size="icon" className="h-7 w-7 shadow-sm">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => onPreview(file.id)}>
              <Eye className="h-4 w-4 mr-2" />
              Preview
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDownload(file.id)}>
              <Download className="h-4 w-4 mr-2" />
              Download
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onShare(file.id)}>
              <Share className="h-4 w-4 mr-2" />
              Share
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onRename(file.id)}>
              <Edit2 className="h-4 w-4 mr-2" />
              Rename
            </DropdownMenuItem>
            {onEncrypt && (
              <DropdownMenuItem onClick={() => onEncrypt(file.id)}>
                <Lock className="h-4 w-4 mr-2" />
                {file.is_encrypted ? 'Decrypt' : 'Encrypt'}
              </DropdownMenuItem>
            )}
            {onVersionHistory && (
              <DropdownMenuItem onClick={() => onVersionHistory(file.id)}>
                <History className="h-4 w-4 mr-2" />
                Version History
              </DropdownMenuItem>
            )}
            {isArchive && onExtractZip && (
              <DropdownMenuItem onClick={() => onExtractZip(file.id)}>
                <Archive className="h-4 w-4 mr-2" />
                Extract Archive
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onDelete(file.id)} className="text-destructive focus:text-destructive">
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* File icon with thumbnail support */}
      <div className="flex justify-center mb-3 pt-2">
        <div className="relative group-hover:scale-105 transition-transform duration-200">
          <FileIcon 
            fileName={file.name} 
            mimeType={file.mime_type} 
            storagePath={file.storage_path}
            showThumbnail
            className="h-14 w-14" 
          />
          {/* Hover overlay */}
          <div className="absolute inset-0 bg-primary/10 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
        </div>
      </div>

      {/* File info */}
      <div className="text-center space-y-1.5">
        <p className="font-medium text-sm truncate px-1" title={file.name}>
          {file.name}
        </p>
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <span className="tabular-nums">{formatBytes(file.size_bytes)}</span>
          <span className="h-1 w-1 rounded-full bg-muted-foreground/50" />
          <span>{formatDistanceToNow(new Date(file.created_at), { addSuffix: true })}</span>
        </div>
      </div>

      {/* Tags */}
      {file.tags && file.tags.length > 0 && (
        <div className="mt-3 flex justify-center">
          <TagDisplay tags={file.tags} maxVisible={2} />
        </div>
      )}

      {/* Status indicators */}
      <div className="absolute bottom-3 right-3 flex items-center gap-1">
        {file.is_encrypted && (
          <div className="p-1 rounded bg-yellow-500/10">
            <Lock className="h-3 w-3 text-yellow-500" />
          </div>
        )}
        {isArchive && (
          <div className="p-1 rounded bg-primary/10">
            <Archive className="h-3 w-3 text-primary" />
          </div>
        )}
      </div>
    </div>
  );
});

FileCard.displayName = 'FileCard';

export const FileGrid = memo(({
  files,
  selectedFiles,
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
}: FileGridProps) => {
  if (files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center animate-fade-in">
        <div className="p-4 rounded-full bg-muted/50 mb-4">
          <Archive className="h-8 w-8 text-muted-foreground" />
        </div>
        <p className="text-muted-foreground font-medium">No files in this folder</p>
        <p className="text-xs text-muted-foreground/70 mt-1">Upload files or create a new folder to get started</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {files.map((file) => (
        <FileCard
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
  );
});

FileGrid.displayName = 'FileGrid';

import { memo, useCallback } from 'react';
import { Star, MoreHorizontal, Download, Share, Trash2, Edit2, Eye, Lock, History, Archive, Pencil, Clock3 } from 'lucide-react';
import { formatBytes } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { FileIcon } from '@/components/FileIcon';
import { TagDisplay } from '@/components/TagManager';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger,
} from '@/components/ui/context-menu';
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
  onEdit?: (fileId: string) => void;
}

// Generate AI-like auto tag from mime type
const getAutoTag = (name: string, mimeType: string | null): string | null => {
  if (!mimeType && !name) return null;
  const ext = name.split('.').pop()?.toLowerCase();
  if (mimeType?.startsWith('image/')) return 'IMAGE';
  if (mimeType?.startsWith('video/')) return 'VIDEO';
  if (mimeType?.startsWith('audio/')) return 'AUDIO';
  if (mimeType === 'application/pdf' || ext === 'pdf') return 'DOCUMENT';
  if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext || '')) return 'OFFICE';
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext || '')) return 'ARCHIVE';
  if (['js', 'ts', 'py', 'java', 'cpp', 'go', 'rs'].includes(ext || '')) return 'CODE';
  if (['json', 'xml', 'csv', 'yaml'].includes(ext || '')) return 'DATA';
  return null;
};

const FileCard = memo(({
  file, isSelected, onSelectFile, onDownload, onShare, onDelete, onRename,
  onPreview, onEncrypt, onVersionHistory, onExtractZip, onToggleFavorite, onEdit,
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
  onEdit?: (fileId: string) => void;
}) => {
  const isArchive = /\.(zip|rar|7z|tar|gz|bz2|xz|tgz)$/i.test(file.name);
  const isEditable = /\.(pdf|mp4|webm|mov|avi|mkv|mp3|wav|ogg|flac|aac|wma|jpg|jpeg|png|gif|webp|bmp|svg|md|txt|markdown)$/i.test(file.name);
  const autoTag = getAutoTag(file.name, file.mime_type);

  const handleSelect = useCallback(() => onSelectFile(file.id), [file.id, onSelectFile]);
  const handlePreview = useCallback(() => onPreview(file.id), [file.id, onPreview]);
  const handleFavoriteClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleFavorite?.(file.id, file.is_favorite || false);
  }, [file.id, file.is_favorite, onToggleFavorite]);

  const handleDragStart = useCallback((e: React.DragEvent) => {
    e.dataTransfer.setData('application/x-file-ids', JSON.stringify([file.id]));
    e.dataTransfer.effectAllowed = 'move';
  }, [file.id]);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
      <div
      className={cn(
          "group relative flex min-h-[220px] flex-col rounded-lg border p-4 cursor-pointer transition-all duration-150",
          "border-border/70 surface-gradient shadow-sm hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-lg",
          isSelected && "border-primary/40 bg-primary/5 shadow-[0_0_0_1px_hsl(var(--primary)/0.15)]"
      )}
      draggable
      onDragStart={handleDragStart}
      onClick={handleSelect}
      onDoubleClick={handlePreview}
    >
      {/* Favorite */}
      {onToggleFavorite && (
        <button onClick={handleFavoriteClick} className="absolute top-3 left-3 z-10 transition-all duration-200 hover:scale-110">
          <Star className={cn("h-4 w-4 transition-all", file.is_favorite ? "fill-primary text-primary" : "text-muted-foreground/20 hover:text-primary")} />
        </button>
      )}

      {/* Menu */}
      <div className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 transition-all duration-200 z-10">
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="secondary" size="icon" className="h-7 w-7 border border-border/70 bg-card/95 shadow-sm">
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => onPreview(file.id)}><Eye className="h-4 w-4 mr-2" />Preview</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDownload(file.id)}><Download className="h-4 w-4 mr-2" />Download</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onShare(file.id)}><Share className="h-4 w-4 mr-2" />Share</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onRename(file.id)}><Edit2 className="h-4 w-4 mr-2" />Rename</DropdownMenuItem>
            {isEditable && onEdit && <DropdownMenuItem onClick={() => onEdit(file.id)}><Pencil className="h-4 w-4 mr-2" />Edit File</DropdownMenuItem>}
            {onEncrypt && <DropdownMenuItem onClick={() => onEncrypt(file.id)}><Lock className="h-4 w-4 mr-2" />{file.is_encrypted ? 'Decrypt' : 'Encrypt'}</DropdownMenuItem>}
            {onVersionHistory && <DropdownMenuItem onClick={() => onVersionHistory(file.id)}><History className="h-4 w-4 mr-2" />Version History</DropdownMenuItem>}
            {isArchive && onExtractZip && <DropdownMenuItem onClick={() => onExtractZip(file.id)}><Archive className="h-4 w-4 mr-2" />Extract</DropdownMenuItem>}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onDelete(file.id)} className="text-destructive focus:text-destructive"><Trash2 className="h-4 w-4 mr-2" />Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Icon */}
      <div className="mb-4 flex items-center justify-between gap-3 pt-1">
        <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-border/70 bg-accent/35 transition-colors group-hover:bg-primary/10">
          <FileIcon fileName={file.name} mimeType={file.mime_type} storagePath={file.storage_path} showThumbnail className="h-7 w-7" />
        </div>
        {autoTag && (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-[10px] font-medium text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            {autoTag}
          </span>
        )}
      </div>

      {/* Info */}
      <div className="space-y-2 text-left">
        <p className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-5" title={file.name}>{file.name}</p>
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="tabular-nums">{formatBytes(file.size_bytes)}</span>
          <span className="text-border">·</span>
          <span>{formatDistanceToNow(new Date(file.created_at), { addSuffix: true })}</span>
        </div>
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <Clock3 className="h-3 w-3" />
          <span className="truncate">Updated {formatDistanceToNow(new Date(file.created_at), { addSuffix: true })}</span>
        </div>
      </div>

      {/* Tags */}
      {file.tags && file.tags.length > 0 && (
        <div className="mt-3 flex justify-start">
          <TagDisplay tags={file.tags} maxVisible={2} />
        </div>
      )}

      {/* Status indicators */}
      <div className="mt-auto flex items-center justify-between pt-4">
        <div className="flex items-center gap-1">
          {file.is_encrypted && <div className="rounded-md bg-primary/10 p-1.5"><Lock className="h-3 w-3 text-primary" /></div>}
          {isArchive && <div className="rounded-md bg-accent p-1.5"><Archive className="h-3 w-3 text-primary" /></div>}
        </div>
        <div className="text-[11px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
          Double-click to preview
        </div>
      </div>
    </div>
  );
});

FileCard.displayName = 'FileCard';

export const FileGrid = memo(({
  files, selectedFiles, onSelectFile, onDownload, onShare, onDelete,
  onRename, onPreview, onEncrypt, onVersionHistory, onExtractZip, onToggleFavorite, onEdit,
}: FileGridProps) => {
  if (files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border/80 bg-card/40 py-20 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-border/70 bg-accent/30">
          <Archive className="h-8 w-8 text-muted-foreground/50" />
        </div>
        <p className="font-medium text-foreground">No files in this folder</p>
        <p className="mt-1 text-xs text-muted-foreground/80">Upload files or create a folder to get started</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
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
          onEdit={onEdit}
        />
      ))}
    </div>
  );
});

FileGrid.displayName = 'FileGrid';

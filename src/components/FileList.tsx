import { memo, useCallback } from 'react';
import { MoreVertical, Download, Share2, Trash2, Edit2, Eye, Lock, Clock, Archive, Star, Pencil } from 'lucide-react';
import { FileIcon } from './FileIcon';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
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
  onEdit?: (fileId: string) => void;
}

const isArchiveFile = (fileName: string): boolean => /\.(zip|rar|7z|tar|gz|bz2|xz|tgz)$/i.test(fileName);

const getAutoTag = (name: string, mimeType: string | null): string | null => {
  const ext = name.split('.').pop()?.toLowerCase();
  if (mimeType?.startsWith('image/')) return 'IMAGE';
  if (mimeType?.startsWith('video/')) return 'VIDEO';
  if (mimeType?.startsWith('audio/')) return 'AUDIO';
  if (mimeType === 'application/pdf' || ext === 'pdf') return 'DOCUMENT';
  if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext || '')) return 'OFFICE';
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext || '')) return 'ARCHIVE';
  if (['js', 'ts', 'py', 'java', 'cpp'].includes(ext || '')) return 'CODE';
  return null;
};

const FileRow = memo(({
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
  onEncrypt: (fileId: string) => void;
  onVersionHistory: (fileId: string) => void;
  onExtractZip?: (fileId: string) => void;
  onToggleFavorite?: (fileId: string, current: boolean) => void;
  onEdit?: (fileId: string) => void;
}) => {
  const autoTag = getAutoTag(file.name, file.mime_type);
  const isEditable = /\.(pdf|mp4|webm|mov|avi|mkv|mp3|wav|ogg|flac|aac|wma|jpg|jpeg|png|gif|webp|bmp|svg|md|txt|markdown)$/i.test(file.name);
  const handleCheckboxChange = useCallback(() => onSelectFile(file.id), [file.id, onSelectFile]);
  const handlePreviewClick = useCallback(() => onPreview(file.id), [file.id, onPreview]);
  const handleFavoriteClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleFavorite?.(file.id, file.is_favorite || false);
  }, [file.id, file.is_favorite, onToggleFavorite]);

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('application/x-file-ids', JSON.stringify([file.id]));
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div
      className={cn(
        "group flex items-center justify-between rounded-lg border px-4 py-3 transition-all duration-200",
        "border-transparent bg-card/40 hover:border-border/80 hover:bg-card",
        isSelected && "border-primary/35 bg-primary/5 shadow-[0_0_0_1px_hsl(var(--primary)/0.12)]"
      )}
      draggable
      onDragStart={handleDragStart}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <Checkbox
          checked={isSelected}
          onCheckedChange={handleCheckboxChange}
          className="transition-transform data-[state=checked]:bg-primary data-[state=checked]:border-primary"
        />

        {onToggleFavorite && (
          <button onClick={handleFavoriteClick} className="transition-all duration-200 hover:scale-110 shrink-0">
            <Star className={cn("h-4 w-4 transition-all duration-200", file.is_favorite ? "fill-primary text-primary" : "text-muted-foreground/30 hover:text-primary")} />
          </button>
        )}

          <div className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer group/preview" onClick={handlePreviewClick}>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-accent/30 transition-colors group-hover/preview:bg-primary/10">
            <FileIcon fileName={file.name} mimeType={file.mime_type} storagePath={file.storage_path} showThumbnail className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="font-medium text-sm truncate group-hover/preview:text-primary transition-colors">{file.name}</p>
              {file.is_encrypted && <div className="px-1.5 py-0.5 rounded-md bg-primary/10 shrink-0"><Lock className="h-3 w-3 text-primary" /></div>}
              {isArchiveFile(file.name) && <div className="px-1.5 py-0.5 rounded-md bg-accent shrink-0"><Archive className="h-3 w-3 text-primary" /></div>}
              {autoTag && (
                  <span className="hidden shrink-0 items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium text-primary sm:inline-flex">
                  <span className="h-1 w-1 rounded-full bg-primary" />
                  {autoTag}
                </span>
              )}
            </div>
              <div className="mt-0.5 flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span className="tabular-nums">{formatBytes(file.size_bytes)}</span>
              <span className="text-border">·</span>
              <span>{format(new Date(file.created_at), 'MMM d, yyyy')}</span>
                <span className="text-border">·</span>
                <span>Click to preview</span>
            </div>
          </div>
        </div>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-all duration-200">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={() => onPreview(file.id)}><Eye className="h-4 w-4 mr-2" /> Preview</DropdownMenuItem>
          <DropdownMenuItem onClick={() => onDownload(file.id)}><Download className="h-4 w-4 mr-2" /> Download</DropdownMenuItem>
          <DropdownMenuItem onClick={() => onShare(file.id)}><Share2 className="h-4 w-4 mr-2" /> Share</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => onRename(file.id)}><Edit2 className="h-4 w-4 mr-2" /> Rename</DropdownMenuItem>
          {isEditable && onEdit && <DropdownMenuItem onClick={() => onEdit(file.id)}><Pencil className="h-4 w-4 mr-2" /> Edit File</DropdownMenuItem>}
          <DropdownMenuItem onClick={() => onVersionHistory(file.id)}><Clock className="h-4 w-4 mr-2" /> Version History</DropdownMenuItem>
          <DropdownMenuItem onClick={() => onEncrypt(file.id)}><Lock className="h-4 w-4 mr-2" /> {file.is_encrypted ? 'Decrypt' : 'Encrypt'}</DropdownMenuItem>
          {isArchiveFile(file.name) && onExtractZip && (
            <DropdownMenuItem onClick={() => onExtractZip(file.id)}><Archive className="h-4 w-4 mr-2" /> Extract Archive</DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => onDelete(file.id)} className="text-destructive focus:text-destructive"><Trash2 className="h-4 w-4 mr-2" /> Move to Trash</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
});

FileRow.displayName = 'FileRow';

export const FileList = memo(({
  files, selectedFiles, onSelectFile, onSelectAll, onDownload, onShare,
  onDelete, onRename, onPreview, onEncrypt, onVersionHistory, onExtractZip, onToggleFavorite, onEdit
}: FileListProps) => {
  if (files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border/80 bg-card/40 py-20 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-border/70 bg-accent/30">
          <FolderOpenIcon className="h-8 w-8 text-muted-foreground/50" />
        </div>
        <p className="font-medium text-foreground">No files yet</p>
        <p className="mt-1 text-xs text-muted-foreground/80">Upload your first file to get started</p>
      </div>
    );
  }

  const allSelected = files.length > 0 && selectedFiles.length === files.length;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 rounded-lg border border-border/70 bg-card/40 px-4 py-2 text-xs text-muted-foreground">
        <Checkbox checked={allSelected} onCheckedChange={onSelectAll} />
        <span className="font-medium">{selectedFiles.length > 0 ? `${selectedFiles.length} selected` : 'Select all'}</span>
        <span className="ml-auto tabular-nums">{files.length} file{files.length !== 1 ? 's' : ''}</span>
      </div>
      <div className="space-y-0.5">
        {files.map((file) => (
          <FileRow
            key={file.id} file={file} isSelected={selectedFiles.includes(file.id)}
            onSelectFile={onSelectFile} onDownload={onDownload} onShare={onShare}
            onDelete={onDelete} onRename={onRename} onPreview={onPreview}
            onEncrypt={onEncrypt} onVersionHistory={onVersionHistory}
            onExtractZip={onExtractZip} onToggleFavorite={onToggleFavorite}
            onEdit={onEdit}
          />
        ))}
      </div>
    </div>
  );
});

FileList.displayName = 'FileList';

const FolderOpenIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2"/>
  </svg>
);

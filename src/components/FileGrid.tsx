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

export const FileGrid = ({
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
      <div className="text-center py-12 text-muted-foreground">
        No files in this folder
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
      {files.map((file) => {
        const isSelected = selectedFiles.includes(file.id);
        const isZip = file.name.endsWith('.zip') || file.mime_type === 'application/zip';

        return (
          <div
            key={file.id}
            className={cn(
              "group relative bg-card border rounded-lg p-3 cursor-pointer transition-all hover:shadow-md",
              isSelected && "ring-2 ring-primary"
            )}
            onClick={() => onSelectFile(file.id)}
            onDoubleClick={() => onPreview(file.id)}
          >
            {/* Favorite button */}
            {onToggleFavorite && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFavorite(file.id, file.is_favorite || false);
                }}
                className="absolute top-2 left-2 z-10"
              >
                <Star
                  className={cn(
                    "h-4 w-4 transition-colors",
                    file.is_favorite
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-muted-foreground/50 hover:text-yellow-400"
                  )}
                />
              </button>
            )}

            {/* Menu button */}
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                    <MoreHorizontal className="h-4 w-4" />
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
                  {isZip && onExtractZip && (
                    <DropdownMenuItem onClick={() => onExtractZip(file.id)}>
                      <Archive className="h-4 w-4 mr-2" />
                      Extract
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => onDelete(file.id)} className="text-destructive">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* File icon */}
            <div className="flex justify-center mb-3 pt-4">
              <FileIcon fileName={file.name} mimeType={file.mime_type} className="h-12 w-12" />
            </div>

            {/* File info */}
            <div className="text-center space-y-1">
              <p className="font-medium text-sm truncate" title={file.name}>
                {file.name}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatBytes(file.size_bytes)}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(file.created_at), { addSuffix: true })}
              </p>
            </div>

            {/* Tags */}
            {file.tags && file.tags.length > 0 && (
              <div className="mt-2 flex justify-center">
                <TagDisplay tags={file.tags} maxVisible={2} />
              </div>
            )}

            {/* Encryption indicator */}
            {file.is_encrypted && (
              <div className="absolute bottom-2 right-2">
                <Lock className="h-3 w-3 text-yellow-500" />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

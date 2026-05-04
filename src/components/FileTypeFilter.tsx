import { memo } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Image, 
  Video, 
  FileText, 
  Music, 
  Archive, 
  File,
  Files,
  FileCode2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface FileTypeFilterProps {
  value: FileTypeCategory;
  onChange: (value: FileTypeCategory) => void;
  fileCounts?: Record<FileTypeCategory, number>;
}

export type FileTypeCategory = 'all' | 'images' | 'videos' | 'documents' | 'audio' | 'archives' | 'code' | 'other';

const FILE_TYPE_CONFIG: Record<FileTypeCategory, { label: string; icon: React.ElementType; extensions: string[] }> = {
  all: { label: 'All Files', icon: Files, extensions: [] },
  images: { label: 'Images', icon: Image, extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'tiff', 'heic', 'heif'] },
  videos: { label: 'Videos', icon: Video, extensions: ['mp4', 'webm', 'mov', 'avi', 'mkv', 'flv', 'wmv', 'm4v', '3gp', 'ogv'] },
  documents: { label: 'Documents', icon: FileText, extensions: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'rtf', 'odt', 'ods', 'odp'] },
  audio: { label: 'Audio', icon: Music, extensions: ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'wma', 'aiff', 'ape', 'opus'] },
  archives: { label: 'Archives', icon: Archive, extensions: ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'tgz', 'tar.gz'] },
  code: { label: 'Code', icon: FileCode2, extensions: ['csv', 'md', 'json', 'xml', 'html', 'css', 'js', 'ts', 'jsx', 'tsx', 'py', 'java', 'c', 'cpp', 'h', 'hpp', 'go', 'rs', 'sql', 'yaml', 'yml', 'ipynb'] },
  other: { label: 'Other', icon: File, extensions: [] },
};

export const getFileTypeCategory = (fileName: string, mimeType?: string | null): FileTypeCategory => {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  
  for (const [category, config] of Object.entries(FILE_TYPE_CONFIG)) {
    if (category === 'all' || category === 'other') continue;
    if (config.extensions.includes(ext)) return category as FileTypeCategory;
  }
  
  if (mimeType) {
    if (mimeType.startsWith('image/')) return 'images';
    if (mimeType.startsWith('video/')) return 'videos';
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType.startsWith('text/') || mimeType.includes('document')) return 'documents';
  }
  
  return 'other';
};

export const FileTypeFilter = memo(({ value, onChange, fileCounts }: FileTypeFilterProps) => {
  const currentConfig = FILE_TYPE_CONFIG[value];
  const Icon = currentConfig.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className={cn(
          "flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-mono transition-all duration-200",
          "border border-border/50 bg-background/50",
          "hover:border-primary/30 hover:bg-primary/5",
          value !== 'all' && "border-primary/30 bg-primary/5 text-primary"
        )}>
          <Icon className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{currentConfig.label}</span>
          {value !== 'all' && fileCounts?.[value] !== undefined && (
            <span className="ml-0.5 h-4 min-w-[16px] inline-flex items-center justify-center rounded bg-primary/20 text-primary text-[10px] px-1">
              {fileCounts[value]}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuRadioGroup value={value} onValueChange={(v) => onChange(v as FileTypeCategory)}>
          {Object.entries(FILE_TYPE_CONFIG).map(([key, config]) => {
            const ItemIcon = config.icon;
            const count = fileCounts?.[key as FileTypeCategory];
            return (
              <DropdownMenuRadioItem key={key} value={key} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ItemIcon className="h-4 w-4" />
                  <span>{config.label}</span>
                </div>
                {count !== undefined && key !== 'all' && (
                  <span className="text-xs text-muted-foreground">{count}</span>
                )}
              </DropdownMenuRadioItem>
            );
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
});

FileTypeFilter.displayName = 'FileTypeFilter';

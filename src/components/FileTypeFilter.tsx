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
  Filter, 
  Image, 
  Video, 
  FileText, 
  Music, 
  Archive, 
  File,
  Files
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export type FileTypeCategory = 'all' | 'images' | 'videos' | 'documents' | 'audio' | 'archives' | 'other';

interface FileTypeFilterProps {
  value: FileTypeCategory;
  onChange: (value: FileTypeCategory) => void;
  fileCounts?: Record<FileTypeCategory, number>;
}

const FILE_TYPE_CONFIG: Record<FileTypeCategory, { label: string; icon: React.ElementType; extensions: string[] }> = {
  all: { 
    label: 'All Files', 
    icon: Files,
    extensions: [] 
  },
  images: { 
    label: 'Images', 
    icon: Image,
    extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'tiff', 'heic', 'heif'] 
  },
  videos: { 
    label: 'Videos', 
    icon: Video,
    extensions: ['mp4', 'webm', 'mov', 'avi', 'mkv', 'flv', 'wmv', 'm4v', '3gp', 'ogv'] 
  },
  documents: { 
    label: 'Documents', 
    icon: FileText,
    extensions: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'rtf', 'odt', 'ods', 'odp', 'csv', 'md', 'json', 'xml', 'html', 'css', 'js', 'ts', 'jsx', 'tsx', 'py', 'java', 'c', 'cpp', 'h', 'hpp', 'ipynb'] 
  },
  audio: { 
    label: 'Audio', 
    icon: Music,
    extensions: ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'wma', 'aiff', 'ape', 'opus'] 
  },
  archives: { 
    label: 'Archives', 
    icon: Archive,
    extensions: ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'tgz', 'tar.gz'] 
  },
  other: { 
    label: 'Other', 
    icon: File,
    extensions: [] 
  },
};

export const getFileTypeCategory = (fileName: string, mimeType?: string | null): FileTypeCategory => {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  
  for (const [category, config] of Object.entries(FILE_TYPE_CONFIG)) {
    if (category === 'all' || category === 'other') continue;
    if (config.extensions.includes(ext)) {
      return category as FileTypeCategory;
    }
  }
  
  // Fallback to mime type check
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
        <Button variant="outline" size="sm" className="gap-2">
          <Icon className="h-4 w-4" />
          <span className="hidden sm:inline">{currentConfig.label}</span>
          {value !== 'all' && (
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
              {fileCounts?.[value] || 0}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuRadioGroup value={value} onValueChange={(v) => onChange(v as FileTypeCategory)}>
          {Object.entries(FILE_TYPE_CONFIG).map(([key, config]) => {
            const ItemIcon = config.icon;
            const count = fileCounts?.[key as FileTypeCategory];
            return (
              <DropdownMenuRadioItem 
                key={key} 
                value={key}
                className="flex items-center justify-between"
              >
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

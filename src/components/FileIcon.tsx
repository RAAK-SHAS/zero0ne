import { 
  FileText, 
  FileImage, 
  FileVideo, 
  FileAudio, 
  FileArchive, 
  File as FileGeneric,
  FileSpreadsheet,
  FileCode
} from 'lucide-react';
import { useState } from 'react';

interface FileIconProps {
  fileName: string;
  mimeType: string | null;
  storagePath?: string;
  className?: string;
  showThumbnail?: boolean;
}

export const FileIcon = ({ fileName, mimeType, storagePath, className = "h-8 w-8", showThumbnail = false }: FileIconProps) => {
  const [thumbnailError, setThumbnailError] = useState(false);
  
  const getFileType = () => {
    if (mimeType) {
      if (mimeType.startsWith('image/')) return 'image';
      if (mimeType.startsWith('video/')) return 'video';
      if (mimeType.startsWith('audio/')) return 'audio';
      if (mimeType.includes('pdf')) return 'pdf';
      if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return 'spreadsheet';
      if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('7z')) return 'archive';
      if (mimeType.includes('json') || mimeType.includes('javascript') || mimeType.includes('typescript')) return 'code';
    }

    const ext = fileName.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext || '')) return 'image';
    if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext || '')) return 'video';
    if (['mp3', 'wav', 'ogg', 'flac', 'm4a'].includes(ext || '')) return 'audio';
    if (ext === 'pdf') return 'pdf';
    if (['xls', 'xlsx', 'csv'].includes(ext || '')) return 'spreadsheet';
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext || '')) return 'archive';
    if (['js', 'ts', 'tsx', 'jsx', 'json', 'html', 'css', 'py', 'java'].includes(ext || '')) return 'code';

    return 'generic';
  };

  const fileType = getFileType();
  const iconClass = `${className} text-primary flex-shrink-0`;

  // Show thumbnail for images if enabled and available
  if (showThumbnail && fileType === 'image' && storagePath && !thumbnailError) {
    return (
      <div className={`${className} relative overflow-hidden rounded bg-muted flex items-center justify-center`}>
        <FileImage className={iconClass} />
      </div>
    );
  }

  // Return appropriate icon based on file type
  switch (fileType) {
    case 'image':
      return <FileImage className={iconClass} />;
    case 'video':
      return <FileVideo className={iconClass} />;
    case 'audio':
      return <FileAudio className={iconClass} />;
    case 'pdf':
      return <FileText className={iconClass} />;
    case 'spreadsheet':
      return <FileSpreadsheet className={iconClass} />;
    case 'archive':
      return <FileArchive className={iconClass} />;
    case 'code':
      return <FileCode className={iconClass} />;
    default:
      return <FileGeneric className={iconClass} />;
  }
};
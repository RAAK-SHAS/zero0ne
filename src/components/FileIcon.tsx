import {
  FileText,
  FileImage,
  FileVideo,
  FileAudio,
  FileArchive,
  File as FileGeneric,
  FileSpreadsheet,
  FileCode,
  type LucideIcon,
} from 'lucide-react';

interface FileIconProps {
  fileName: string;
  mimeType: string | null;
  storagePath?: string;
  className?: string;
  showThumbnail?: boolean;
}

type FileType = 'image' | 'video' | 'audio' | 'pdf' | 'spreadsheet' | 'archive' | 'code' | 'generic';

const TYPE_META: Record<FileType, { icon: LucideIcon; color: string }> = {
  image:       { icon: FileImage,       color: 'text-violet-400' },
  video:       { icon: FileVideo,       color: 'text-rose-400' },
  audio:       { icon: FileAudio,       color: 'text-amber-400' },
  pdf:         { icon: FileText,        color: 'text-red-400' },
  spreadsheet: { icon: FileSpreadsheet, color: 'text-emerald-400' },
  archive:     { icon: FileArchive,     color: 'text-yellow-500' },
  code:        { icon: FileCode,        color: 'text-sky-400' },
  generic:     { icon: FileGeneric,     color: 'text-muted-foreground' },
};

const detectType = (fileName: string, mimeType: string | null): FileType => {
  if (mimeType) {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType.includes('pdf')) return 'pdf';
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('csv')) return 'spreadsheet';
    if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('7z') || mimeType.includes('tar')) return 'archive';
    if (mimeType.includes('json') || mimeType.includes('javascript') || mimeType.includes('typescript') || mimeType.includes('xml')) return 'code';
  }
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  if (['jpg','jpeg','png','gif','webp','svg','bmp','heic','avif'].includes(ext)) return 'image';
  if (['mp4','mov','avi','mkv','webm','m4v'].includes(ext)) return 'video';
  if (['mp3','wav','ogg','flac','m4a','aac'].includes(ext)) return 'audio';
  if (ext === 'pdf') return 'pdf';
  if (['xls','xlsx','csv','ods','numbers'].includes(ext)) return 'spreadsheet';
  if (['zip','rar','7z','tar','gz','bz2','xz','tgz'].includes(ext)) return 'archive';
  if (['js','ts','tsx','jsx','json','html','css','py','java','c','cpp','go','rs','rb','php','sh','sql','yml','yaml','md','xml'].includes(ext)) return 'code';
  return 'generic';
};

export const FileIcon = ({ fileName, mimeType, className = 'h-8 w-8' }: FileIconProps) => {
  const type = detectType(fileName, mimeType);
  const { icon: Icon, color } = TYPE_META[type];
  return <Icon className={`${className} ${color} flex-shrink-0`} />;
};

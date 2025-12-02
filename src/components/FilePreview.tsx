import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, X } from 'lucide-react';
import { CodeEditor } from './CodeEditor';

interface FilePreviewProps {
  file: {
    id: string;
    name: string;
    mime_type: string | null;
    storage_path: string;
  } | null;
  downloadUrl: string | null;
  open: boolean;
  onClose: () => void;
  onDownload: () => void;
}

export const FilePreview = ({ file, downloadUrl, open, onClose, onDownload }: FilePreviewProps) => {
  if (!file || !downloadUrl) return null;

  const getFileType = () => {
    const mimeType = file.mime_type || '';
    const ext = file.name.split('.').pop()?.toLowerCase() || '';

    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType.includes('pdf')) return 'pdf';
    if (mimeType.includes('text') || ['txt', 'md', 'json', 'xml', 'csv'].includes(ext)) return 'text';
    if (['js', 'ts', 'tsx', 'jsx', 'py', 'java', 'cpp', 'c', 'html', 'css'].includes(ext)) return 'code';
    
    return 'unknown';
  };

  const fileType = getFileType();
  const ext = file.name.split('.').pop()?.toLowerCase() || '';

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="truncate pr-8">{file.name}</DialogTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="icon" onClick={onDownload}>
                <Download className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>
        
        <div className="flex-1 overflow-auto">
          {fileType === 'image' && (
            <img src={downloadUrl} alt={file.name} className="w-full h-auto" />
          )}
          
          {fileType === 'video' && (
            <video controls className="w-full h-auto max-h-[70vh]">
              <source src={downloadUrl} type={file.mime_type || undefined} />
              Your browser does not support video playback.
            </video>
          )}
          
          {fileType === 'audio' && (
            <div className="flex items-center justify-center p-8">
              <audio controls className="w-full max-w-2xl">
                <source src={downloadUrl} type={file.mime_type || undefined} />
                Your browser does not support audio playback.
              </audio>
            </div>
          )}
          
          {fileType === 'pdf' && (
            <iframe
              src={downloadUrl}
              className="w-full h-[70vh] border-0"
              title={file.name}
            />
          )}
          
          {fileType === 'code' && (
            <CodeEditor 
              fileUrl={downloadUrl} 
              fileName={file.name}
              language={ext}
            />
          )}
          
          {fileType === 'text' && (
            <TextPreview url={downloadUrl} />
          )}
          
          {fileType === 'unknown' && (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <p className="text-muted-foreground mb-4">Preview not available for this file type</p>
              <Button onClick={onDownload}>
                <Download className="h-4 w-4 mr-2" />
                Download to view
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

const TextPreview = ({ url }: { url: string }) => {
  const [content, setContent] = useState<string>('Loading...');

  useState(() => {
    fetch(url)
      .then(res => res.text())
      .then(setContent)
      .catch(() => setContent('Error loading file'));
  });

  return (
    <pre className="p-4 bg-muted rounded-lg overflow-auto max-h-[70vh] text-sm">
      {content}
    </pre>
  );
};

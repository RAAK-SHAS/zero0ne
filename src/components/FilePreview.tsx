import { useState, useEffect, memo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, X, Maximize2, Minimize2 } from 'lucide-react';
import { CodeEditor } from './CodeEditor';
import { NotebookViewer } from './NotebookViewer';
import { cn } from '@/lib/utils';

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

const TextPreview = memo(({ url }: { url: string }) => {
  const [content, setContent] = useState<string>('Loading...');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    fetch(url)
      .then(res => res.text())
      .then(text => {
        setContent(text.substring(0, 100000));
        setIsLoading(false);
      })
      .catch(() => {
        setContent('Error loading file');
        setIsLoading(false);
      });
  }, [url]);

  return (
    <div className="relative">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      )}
      <pre className={cn(
        "p-4 bg-muted rounded-lg overflow-auto max-h-[70vh] text-sm whitespace-pre-wrap font-mono transition-opacity duration-300",
        isLoading && "opacity-50"
      )}>
        {content}
      </pre>
    </div>
  );
});

TextPreview.displayName = 'TextPreview';

export const FilePreview = memo(({ file, downloadUrl, open, onClose, onDownload }: FilePreviewProps) => {
  const [isFullscreen, setIsFullscreen] = useState(false);

  if (!file || !downloadUrl) return null;

  const getFileType = () => {
    const mimeType = file.mime_type || '';
    const ext = file.name.split('.').pop()?.toLowerCase() || '';

    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType.includes('pdf') || ext === 'pdf') return 'pdf';
    if (['docx', 'doc', 'xlsx', 'xls', 'pptx', 'ppt'].includes(ext)) return 'office';
    if (ext === 'ipynb') return 'notebook';
    if (mimeType.includes('text') || ['txt', 'md', 'json', 'xml', 'csv', 'yaml', 'yml', 'log', 'ini', 'conf', 'env'].includes(ext)) return 'text';
    if (['js', 'ts', 'tsx', 'jsx', 'py', 'java', 'cpp', 'c', 'h', 'hpp', 'cs', 'go', 'rs', 'rb', 'php', 'swift', 'kt', 'scala', 'html', 'css', 'scss', 'sass', 'less', 'sql', 'sh', 'bash', 'zsh', 'ps1', 'r', 'lua', 'perl', 'dart', 'vue', 'svelte'].includes(ext)) return 'code';
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'archive';
    
    return 'unknown';
  };

  const fileType = getFileType();
  const ext = file.name.split('.').pop()?.toLowerCase() || '';

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className={cn(
        "flex flex-col overflow-hidden transition-all duration-300",
        isFullscreen 
          ? "max-w-[95vw] max-h-[95vh] w-[95vw] h-[95vh]" 
          : "max-w-5xl max-h-[90vh]"
      )}>
        <DialogHeader className="shrink-0">
          <div className="flex items-center justify-between gap-4">
            <DialogTitle className="truncate pr-4 text-lg">{file.name}</DialogTitle>
            <div className="flex gap-2 shrink-0">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="hover:bg-primary/10"
              >
                {isFullscreen ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </Button>
              <Button variant="outline" size="icon" onClick={onDownload} className="hover:bg-primary/10">
                <Download className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <DialogDescription className="sr-only">Preview of {file.name}</DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-auto animate-fade-in">
          {fileType === 'image' && (
            <div className="flex items-center justify-center min-h-[300px] bg-muted/30 rounded-lg">
              <img 
                src={downloadUrl} 
                alt={file.name} 
                className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-lg transition-transform duration-300 hover:scale-[1.02]" 
              />
            </div>
          )}
          
          {fileType === 'video' && (
            <div className="bg-muted/30 rounded-lg p-2">
              <video controls className="w-full h-auto max-h-[70vh] rounded-lg shadow-lg">
                <source src={downloadUrl} type={file.mime_type || undefined} />
                Your browser does not support video playback.
              </video>
            </div>
          )}
          
          {fileType === 'audio' && (
            <div className="flex items-center justify-center p-8 bg-gradient-to-br from-primary/5 to-primary/10 rounded-lg min-h-[200px]">
              <div className="w-full max-w-2xl space-y-4">
                <div className="flex items-center justify-center">
                  <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center animate-pulse">
                    <div className="w-16 h-16 rounded-full bg-primary/30 flex items-center justify-center">
                      <div className="w-8 h-8 rounded-full bg-primary" />
                    </div>
                  </div>
                </div>
                <audio controls className="w-full">
                  <source src={downloadUrl} type={file.mime_type || undefined} />
                  Your browser does not support audio playback.
                </audio>
              </div>
            </div>
          )}
          
          {fileType === 'pdf' && (
            <iframe
              src={`${downloadUrl}#toolbar=1&navpanes=1&scrollbar=1`}
              className="w-full h-[70vh] border-0 rounded-lg shadow-lg"
              title={file.name}
            />
          )}
          
          {fileType === 'office' && (
            <iframe
              src={`https://docs.google.com/gview?url=${encodeURIComponent(downloadUrl)}&embedded=true`}
              className="w-full h-[70vh] border-0 rounded-lg shadow-lg"
              title={file.name}
            />
          )}
          
          {fileType === 'code' && (
            <div className="rounded-lg overflow-hidden border shadow-sm">
              <CodeEditor 
                fileUrl={downloadUrl} 
                fileName={file.name}
                language={ext}
              />
            </div>
          )}
          
          {fileType === 'notebook' && (
            <div className="rounded-lg overflow-hidden border shadow-sm">
              <NotebookViewer fileUrl={downloadUrl} />
            </div>
          )}
          
          {fileType === 'text' && (
            <TextPreview url={downloadUrl} />
          )}

          {fileType === 'archive' && (
            <div className="flex flex-col items-center justify-center p-12 text-center bg-gradient-to-br from-primary/5 to-primary/10 rounded-lg">
              <div className="p-4 rounded-full bg-primary/10 mb-4">
                <Download className="h-8 w-8 text-primary" />
              </div>
              <p className="text-muted-foreground mb-4 max-w-md">
                This is an archive file. Download to extract contents or use the Extract option from the file menu.
              </p>
              <Button onClick={onDownload} className="gap-2">
                <Download className="h-4 w-4" />
                Download Archive
              </Button>
            </div>
          )}
          
          {fileType === 'unknown' && (
            <div className="flex flex-col items-center justify-center p-12 text-center bg-muted/30 rounded-lg">
              <div className="p-4 rounded-full bg-muted mb-4">
                <Download className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground mb-4">Preview not available for this file type</p>
              <Button onClick={onDownload} variant="outline" className="gap-2">
                <Download className="h-4 w-4" />
                Download to view
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
});

FilePreview.displayName = 'FilePreview';

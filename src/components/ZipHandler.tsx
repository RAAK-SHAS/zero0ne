import { useState } from 'react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Archive, FolderOpen, Download, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatBytes } from '@/lib/utils';

interface ZipFile {
  id: string;
  name: string;
  storage_path: string;
  size_bytes: number;
}

interface ZipHandlerProps {
  files: ZipFile[];
  userId: string;
  onFilesExtracted?: () => void;
}

export const ZipHandler = ({ files, userId, onFilesExtracted }: ZipHandlerProps) => {
  const [extractDialogOpen, setExtractDialogOpen] = useState(false);
  const [extractingFile, setExtractingFile] = useState<ZipFile | null>(null);
  const [extractedFiles, setExtractedFiles] = useState<{ name: string; size: number }[]>([]);
  const [progress, setProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);

  const zipFiles = files.filter(f => 
    f.name.toLowerCase().endsWith('.zip') || 
    f.name.toLowerCase().endsWith('.rar') ||
    f.name.toLowerCase().endsWith('.7z')
  );

  const compressFiles = async (selectedFiles: ZipFile[]) => {
    if (selectedFiles.length === 0) {
      toast.error('No files selected for compression');
      return;
    }

    setIsProcessing(true);
    setProgress(0);

    try {
      const zip = new JSZip();
      
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        
        const { data: signedUrl } = await supabase.storage
          .from('user-files')
          .createSignedUrl(file.storage_path, 3600);

        if (signedUrl?.signedUrl) {
          const response = await fetch(signedUrl.signedUrl);
          const blob = await response.blob();
          zip.file(file.name, blob);
        }

        setProgress(((i + 1) / selectedFiles.length) * 50);
      }

      const content = await zip.generateAsync({ 
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      }, (metadata) => {
        setProgress(50 + (metadata.percent / 2));
      });

      const zipName = selectedFiles.length === 1 
        ? selectedFiles[0].name.replace(/\.[^/.]+$/, '.zip')
        : `files_${Date.now()}.zip`;

      saveAs(content, zipName);
      toast.success('Files compressed and downloaded!');
    } catch (error) {
      console.error('Compression error:', error);
      toast.error('Failed to compress files');
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  const extractZip = async (file: ZipFile) => {
    setExtractingFile(file);
    setExtractDialogOpen(true);
    setIsProcessing(true);
    setProgress(0);
    setExtractedFiles([]);

    try {
      const { data: signedUrl } = await supabase.storage
        .from('user-files')
        .createSignedUrl(file.storage_path, 3600);

      if (!signedUrl?.signedUrl) {
        throw new Error('Failed to get file URL');
      }

      const response = await fetch(signedUrl.signedUrl);
      const blob = await response.blob();
      
      const zip = await JSZip.loadAsync(blob);
      const fileList: { name: string; size: number }[] = [];
      const entries = Object.entries(zip.files);
      
      for (let i = 0; i < entries.length; i++) {
        const [relativePath, zipEntry] = entries[i];
        
        if (!zipEntry.dir) {
          const content = await zipEntry.async('blob');
          fileList.push({ name: relativePath, size: content.size });

          // Upload extracted file to storage
          const sanitizedName = sanitizeFileName(relativePath.split('/').pop() || relativePath);
          const storagePath = `${userId}/${Date.now()}-${sanitizedName}`;

          const { error: uploadError } = await supabase.storage
            .from('user-files')
            .upload(storagePath, content);

          if (!uploadError) {
            await supabase.from('files').insert({
              user_id: userId,
              name: relativePath.split('/').pop() || relativePath,
              size_bytes: content.size,
              mime_type: getMimeType(relativePath),
              storage_path: storagePath
            });
          }
        }

        setProgress(((i + 1) / entries.length) * 100);
      }

      setExtractedFiles(fileList);
      toast.success(`Extracted ${fileList.length} files!`);
      onFilesExtracted?.();
    } catch (error) {
      console.error('Extraction error:', error);
      toast.error('Failed to extract archive');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      <div className="flex gap-2">
        {files.length > 0 && (
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => compressFiles(files)}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Archive className="h-4 w-4 mr-2" />
            )}
            Compress to ZIP
          </Button>
        )}
      </div>

      <Dialog open={extractDialogOpen} onOpenChange={setExtractDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5" />
              {extractingFile?.name}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {isProcessing && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Extracting...</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} />
              </div>
            )}

            {extractedFiles.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Extracted Files:</p>
                <div className="max-h-48 overflow-auto space-y-1">
                  {extractedFiles.map((f, i) => (
                    <div key={i} className="flex justify-between text-sm p-2 bg-muted rounded">
                      <span className="truncate flex-1">{f.name}</span>
                      <span className="text-muted-foreground ml-2">{formatBytes(f.size)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Button 
              onClick={() => setExtractDialogOpen(false)} 
              className="w-full"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

// Helper function to sanitize file names
function sanitizeFileName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .substring(0, 200);
}

// Helper function to get MIME type
function getMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    'pdf': 'application/pdf',
    'txt': 'text/plain',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'mp4': 'video/mp4',
    'mp3': 'audio/mpeg',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'zip': 'application/zip',
    'json': 'application/json',
    'xml': 'application/xml',
    'html': 'text/html',
    'css': 'text/css',
    'js': 'text/javascript',
    'ts': 'text/typescript',
    'py': 'text/x-python',
    'ipynb': 'application/x-ipynb+json',
  };
  return mimeTypes[ext || ''] || 'application/octet-stream';
}

export { sanitizeFileName };

import { useState } from 'react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Archive, FolderOpen, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatBytes } from '@/lib/utils';

// Security constants for ZIP extraction
const MAX_TOTAL_SIZE = 1024 * 1024 * 1024; // 1GB max total extracted size
const MAX_FILE_COUNT = 1000; // Maximum files in archive
const MAX_INDIVIDUAL_FILE_SIZE = 100 * 1024 * 1024; // 100MB per file
const MAX_PATH_DEPTH = 10; // Maximum directory nesting
const MAX_FILENAME_LENGTH = 255;

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
  userQuotaBytes?: number;
  userUsedBytes?: number;
}

export const ZipHandler = ({ 
  files, 
  userId, 
  onFilesExtracted,
  userQuotaBytes = MAX_TOTAL_SIZE,
  userUsedBytes = 0
}: ZipHandlerProps) => {
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

  /**
   * Validate path for security issues
   */
  const validatePath = (relativePath: string): { valid: boolean; error?: string } => {
    const pathParts = relativePath.split('/');
    
    // Check path depth
    if (pathParts.length > MAX_PATH_DEPTH) {
      return { valid: false, error: `Path too deep: ${relativePath}` };
    }
    
    // Check for path traversal attempts
    if (pathParts.some(part => part === '..' || part === '.')) {
      return { valid: false, error: `Invalid path traversal detected: ${relativePath}` };
    }
    
    // Check filename length
    const fileName = pathParts[pathParts.length - 1];
    if (!fileName || fileName.length > MAX_FILENAME_LENGTH) {
      return { valid: false, error: `Invalid filename length: ${fileName}` };
    }
    
    return { valid: true };
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
      const entries = Object.entries(zip.files);
      
      // Pre-validation phase: check total size, file count, and paths
      let totalSize = 0;
      let fileCount = 0;
      const validEntries: [string, JSZip.JSZipObject][] = [];
      
      for (const [relativePath, zipEntry] of entries) {
        if (zipEntry.dir) continue;
        
        // Check file count
        fileCount++;
        if (fileCount > MAX_FILE_COUNT) {
          throw new Error(`Archive contains too many files (maximum ${MAX_FILE_COUNT})`);
        }
        
        // Validate path security
        const pathValidation = validatePath(relativePath);
        if (!pathValidation.valid) {
          console.warn(`Skipping invalid path: ${relativePath}`);
          continue;
        }
        
        // Get uncompressed size from metadata if available
        const uncompressedSize = (zipEntry as any)._data?.uncompressedSize;
        if (uncompressedSize && uncompressedSize > MAX_INDIVIDUAL_FILE_SIZE) {
          throw new Error(`File too large: ${relativePath} (${formatBytes(uncompressedSize)})`);
        }
        
        validEntries.push([relativePath, zipEntry]);
      }
      
      // Check user quota before extraction
      const availableSpace = userQuotaBytes - userUsedBytes;
      if (totalSize > availableSpace) {
        throw new Error(`Insufficient storage quota. Archive may exceed available space.`);
      }
      
      // Confirm if many files
      if (validEntries.length > 100) {
        const confirmExtract = confirm(
          `This archive contains ${validEntries.length} files. Continue extraction?`
        );
        if (!confirmExtract) {
          setIsProcessing(false);
          setExtractDialogOpen(false);
          return;
        }
      }
      
      const fileList: { name: string; size: number }[] = [];
      let extractedSize = 0;
      
      // Extraction phase with runtime size checking
      for (let i = 0; i < validEntries.length; i++) {
        const [relativePath, zipEntry] = validEntries[i];
        
        const content = await zipEntry.async('blob');
        
        // Check individual file size
        if (content.size > MAX_INDIVIDUAL_FILE_SIZE) {
          console.warn(`Skipping oversized file: ${relativePath}`);
          continue;
        }
        
        // Check running total
        extractedSize += content.size;
        if (extractedSize > MAX_TOTAL_SIZE) {
          throw new Error(`Archive extraction exceeded maximum size limit (${formatBytes(MAX_TOTAL_SIZE)})`);
        }
        
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

        setProgress(((i + 1) / validEntries.length) * 100);
      }

      setExtractedFiles(fileList);
      toast.success(`Extracted ${fileList.length} files!`);
      onFilesExtracted?.();
    } catch (error) {
      console.error('Extraction error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to extract archive';
      toast.error(errorMessage);
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

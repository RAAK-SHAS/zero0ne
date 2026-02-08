import { useState, useEffect, useCallback } from 'react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { Archive } from 'libarchive.js';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Archive as ArchiveIcon, 
  FolderOpen, 
  Loader2, 
  Lock, 
  Download, 
  FileIcon,
  Folder,
  AlertCircle,
  X
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatBytes } from '@/lib/utils';

// Initialize libarchive.js with custom worker factory for Vite compatibility
Archive.init({
  getWorker: () => {
    // Use Vite's native worker import with proper bundling
    return new Worker(
      new URL('libarchive.js/dist/worker-bundle.js', import.meta.url),
      { type: 'module' }
    );
  }
});

// Security constants
const MAX_TOTAL_SIZE = 1024 * 1024 * 1024; // 1GB max
const MAX_FILE_COUNT = 1000;
const MAX_INDIVIDUAL_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const MAX_PATH_DEPTH = 10;
const MAX_FILENAME_LENGTH = 255;

// Supported archive extensions
const ARCHIVE_EXTENSIONS = ['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz', '.tar.gz', '.tgz'];

// Export utility function to check if file is an archive
export const isArchiveExtension = (fileName: string) => 
  ARCHIVE_EXTENSIONS.some(ext => fileName.toLowerCase().endsWith(ext));

interface ArchiveFile {
  id: string;
  name: string;
  storage_path: string;
  size_bytes: number;
}

interface PreviewFile {
  name: string;
  path: string;
  size: number;
  isDirectory: boolean;
  extractable: boolean;
}

interface ArchiveManagerProps {
  files: ArchiveFile[];
  userId: string;
  onFilesExtracted?: () => void;
  userQuotaBytes?: number;
  userUsedBytes?: number;
}

// Helper functions
const validatePath = (relativePath: string): { valid: boolean; error?: string } => {
  const pathParts = relativePath.split('/').filter(p => p);
  
  if (pathParts.length > MAX_PATH_DEPTH) {
    return { valid: false, error: `Path too deep` };
  }
  
  if (pathParts.some(part => part === '..' || part === '.')) {
    return { valid: false, error: `Path traversal detected` };
  }
  
  const fileName = pathParts[pathParts.length - 1];
  if (fileName && fileName.length > MAX_FILENAME_LENGTH) {
    return { valid: false, error: `Filename too long` };
  }
  
  return { valid: true };
};

const sanitizeFileName = (name: string): string => {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .substring(0, 200);
};

const getMimeType = (filename: string): string => {
  const ext = filename.split('.').pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    'pdf': 'application/pdf',
    'txt': 'text/plain',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'mp4': 'video/mp4',
    'webm': 'video/webm',
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'ppt': 'application/vnd.ms-powerpoint',
    'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'zip': 'application/zip',
    'json': 'application/json',
    'xml': 'application/xml',
    'html': 'text/html',
    'css': 'text/css',
    'js': 'text/javascript',
    'ts': 'text/typescript',
    'py': 'text/x-python',
  };
  return mimeTypes[ext || ''] || 'application/octet-stream';
};

/**
 * ArchiveManager - Component for creating ZIP archives from selected files
 */
export const ArchiveManager = ({ 
  files, 
  userId, 
  onFilesExtracted,
}: ArchiveManagerProps) => {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  const createArchive = async () => {
    if (files.length === 0) {
      toast.error('No files selected');
      return;
    }

    setIsProcessing(true);
    setProgress(0);

    try {
      const zip = new JSZip();
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        const { data: signedUrl, error: urlError } = await supabase.storage
          .from('user-files')
          .createSignedUrl(file.storage_path, 3600);

        if (urlError) {
          console.error('Error getting signed URL:', urlError);
          continue;
        }

        if (signedUrl?.signedUrl) {
          try {
            const response = await fetch(signedUrl.signedUrl);
            if (!response.ok) throw new Error('Failed to fetch file');
            const blob = await response.blob();
            zip.file(file.name, blob);
          } catch (fetchError) {
            console.error(`Failed to fetch ${file.name}:`, fetchError);
          }
        }

        setProgress(((i + 1) / files.length) * 50);
      }

      const content = await zip.generateAsync({ 
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      }, (metadata) => {
        setProgress(50 + (metadata.percent / 2));
      });

      const zipName = files.length === 1 
        ? files[0].name.replace(/\.[^/.]+$/, '.zip')
        : `archive_${Date.now()}.zip`;

      saveAs(content, zipName);
      toast.success('Archive created and downloaded!');
      setCreateDialogOpen(false);
    } catch (error) {
      console.error('Archive creation error:', error);
      toast.error('Failed to create archive');
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  return (
    <>
      <Button 
        variant="outline" 
        size="sm"
        onClick={() => setCreateDialogOpen(true)}
        disabled={isProcessing || files.length === 0}
        className="gap-2"
      >
        {isProcessing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ArchiveIcon className="h-4 w-4" />
        )}
        Create ZIP ({files.length})
      </Button>

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArchiveIcon className="h-5 w-5" />
              Create ZIP Archive
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Files to compress ({files.length})</Label>
              <ScrollArea className="h-32 border rounded-md p-2">
                {files.map((file, idx) => (
                  <div key={idx} className="flex justify-between text-sm py-1">
                    <span className="truncate flex-1">{file.name}</span>
                    <span className="text-muted-foreground ml-2">{formatBytes(file.size_bytes)}</span>
                  </div>
                ))}
              </ScrollArea>
            </div>

            {isProcessing && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Creating archive...</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)} disabled={isProcessing}>
              Cancel
            </Button>
            <Button onClick={createArchive} disabled={isProcessing} className="gap-2">
              {isProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArchiveIcon className="h-4 w-4" />
              )}
              Create & Download
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

/**
 * ArchivePreviewWrapper - Component for previewing and extracting archive contents
 */
interface ArchivePreviewWrapperProps {
  file: ArchiveFile;
  userId: string;
  onClose: () => void;
  onFilesExtracted?: () => void;
  userQuotaBytes?: number;
  userUsedBytes?: number;
}

// Type for libarchive instance
type LibArchiveInstance = {
  getFilesArray: () => Promise<{ file: { name: string; size: number; extract: () => Promise<File> }; path: string }[]>;
  hasEncryptedData: () => Promise<boolean | null>;
  usePassword: (password: string) => Promise<void>;
  extractFiles: () => Promise<Record<string, any>>;
  close: () => Promise<void>;
};

export const ArchivePreviewWrapper = ({
  file,
  userId,
  onClose,
  onFilesExtracted,
}: ArchivePreviewWrapperProps) => {
  const [previewDialogOpen, setPreviewDialogOpen] = useState(true);
  const [extractDialogOpen, setExtractDialogOpen] = useState(false);
  const [previewFiles, setPreviewFiles] = useState<PreviewFile[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isExtracting, setIsExtracting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [extractedFiles, setExtractedFiles] = useState<{ name: string; size: number }[]>([]);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [archivePassword, setArchivePassword] = useState('');
  const [archiveBlob, setArchiveBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // State for archive type detection
  const [archiveType, setArchiveType] = useState<'zip' | 'libarchive' | null>(null);
  const [libArchiveRef, setLibArchiveRef] = useState<LibArchiveInstance | null>(null);
  const [libArchiveFilesMap, setLibArchiveFilesMap] = useState<Map<string, { name: string; size: number; extract: () => Promise<File> }>>(new Map());

  // Helper to detect archive format
  const getArchiveFormat = (fileName: string): 'zip' | 'libarchive' => {
    const lowerName = fileName.toLowerCase();
    if (lowerName.endsWith('.zip')) return 'zip';
    return 'libarchive'; // Use libarchive.js for RAR, 7z, TAR, etc.
  };

  const loadArchive = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Get signed URL for the archive
      const { data: signedUrl, error: urlError } = await supabase.storage
        .from('user-files')
        .createSignedUrl(file.storage_path, 3600);

      if (urlError || !signedUrl?.signedUrl) {
        throw new Error('Failed to get file URL');
      }

      // Fetch the archive
      const response = await fetch(signedUrl.signedUrl);
      if (!response.ok) {
        throw new Error('Failed to download archive');
      }
      
      const blob = await response.blob();
      setArchiveBlob(blob);

      const format = getArchiveFormat(file.name);
      setArchiveType(format);

      if (format === 'zip') {
        // Parse ZIP file with JSZip
        try {
          const zip = await JSZip.loadAsync(blob);
          const entries = Object.entries(zip.files);
          
          if (entries.length === 0) {
            setError('Archive appears to be empty');
            setIsLoading(false);
            return;
          }

          const fileList: PreviewFile[] = entries.map(([relativePath, zipEntry]) => {
            const pathValidation = validatePath(relativePath);
            return {
              name: relativePath.split('/').filter(p => p).pop() || relativePath,
              path: relativePath,
              size: (zipEntry as any)._data?.uncompressedSize || 0,
              isDirectory: zipEntry.dir,
              extractable: pathValidation.valid && !zipEntry.dir
            };
          });
          
          // Sort: folders first, then by path
          const sortedFiles = fileList.sort((a, b) => {
            if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
            return a.path.localeCompare(b.path);
          });
          
          setPreviewFiles(sortedFiles);
        } catch (zipError: any) {
          // Check if password protected
          if (zipError.message?.includes('Encrypted') || zipError.message?.includes('password')) {
            setNeedsPassword(true);
          } else {
            console.error('ZIP parsing error:', zipError);
            setError('Failed to read archive contents');
          }
        }
      } else {
        // Use libarchive.js for RAR, 7z, TAR, etc.
        try {
          // Create a File object from the blob
          const archiveFile = new File([blob], file.name, { type: blob.type || 'application/octet-stream' });
          
          // Open the archive with libarchive.js
          const archive = await Archive.open(archiveFile) as unknown as LibArchiveInstance;
          setLibArchiveRef(archive);
          
          // Check for encrypted data
          const isEncrypted = await archive.hasEncryptedData();
          if (isEncrypted === true) {
            setNeedsPassword(true);
            setIsLoading(false);
            return;
          }
          
          // Get file listing
          const filesArray = await archive.getFilesArray();
          
          if (filesArray.length === 0) {
            setError('Archive appears to be empty');
            setIsLoading(false);
            return;
          }
          
          // Build files map for extraction
          const filesMap = new Map<string, { name: string; size: number; extract: () => Promise<File> }>();
          const fileList: PreviewFile[] = filesArray.map((entry) => {
            const fullPath = entry.path + entry.file.name;
            const pathValidation = validatePath(fullPath);
            
            filesMap.set(fullPath, entry.file);
            
            return {
              name: entry.file.name,
              path: fullPath,
              size: entry.file.size || 0,
              isDirectory: false, // libarchive.js only returns files
              extractable: pathValidation.valid
            };
          });
          
          setLibArchiveFilesMap(filesMap);
          
          // Sort by path
          const sortedFiles = fileList.sort((a, b) => a.path.localeCompare(b.path));
          setPreviewFiles(sortedFiles);
        } catch (archiveError: any) {
          console.error('Archive parsing error:', archiveError);
          
          // Check for common errors
          if (archiveError.message?.includes('password') || archiveError.message?.includes('encrypted')) {
            setNeedsPassword(true);
          } else if (archiveError.message?.includes('Worker')) {
            setError('Failed to initialize archive reader. Please try again.');
          } else {
            setError(`Failed to read archive: ${archiveError.message || 'Unknown error'}`);
          }
        }
      }
    } catch (error: any) {
      console.error('Archive load error:', error);
      setError(error.message || 'Failed to load archive');
    } finally {
      setIsLoading(false);
    }
  }, [file]);

  useEffect(() => {
    loadArchive();
    
    // Cleanup libarchive instance on unmount
    return () => {
      if (libArchiveRef) {
        libArchiveRef.close?.().catch(console.error);
      }
    };
  }, [loadArchive]);

  const handlePasswordSubmit = async () => {
    if (!archiveBlob || !archivePassword) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      if (archiveType === 'libarchive' && libArchiveRef) {
        // Use password with libarchive
        await libArchiveRef.usePassword(archivePassword);
        
        // Try to get files again
        const filesArray = await libArchiveRef.getFilesArray();
        
        const filesMap = new Map<string, { name: string; size: number; extract: () => Promise<File> }>();
        const fileList: PreviewFile[] = filesArray.map((entry) => {
          const fullPath = entry.path + entry.file.name;
          const pathValidation = validatePath(fullPath);
          
          filesMap.set(fullPath, entry.file);
          
          return {
            name: entry.file.name,
            path: fullPath,
            size: entry.file.size || 0,
            isDirectory: false,
            extractable: pathValidation.valid
          };
        });
        
        setLibArchiveFilesMap(filesMap);
        setPreviewFiles(fileList.sort((a, b) => a.path.localeCompare(b.path)));
        setNeedsPassword(false);
      } else {
        // JSZip doesn't natively support encrypted ZIPs
        setError('Password-protected ZIP files are not currently supported for preview. Please extract locally.');
        setNeedsPassword(false);
      }
    } catch (passwordError: any) {
      console.error('Password error:', passwordError);
      setError('Incorrect password or failed to decrypt archive.');
    } finally {
      setIsLoading(false);
    }
  };

  const extractSelectedFiles = async () => {
    if (!archiveBlob) return;
    
    setExtractDialogOpen(true);
    setIsExtracting(true);
    setProgress(0);
    setExtractedFiles([]);

    try {
      const filesToExtract = selectedFiles.size > 0 
        ? previewFiles.filter(f => selectedFiles.has(f.path) && f.extractable)
        : previewFiles.filter(f => f.extractable);

      if (filesToExtract.length === 0) {
        toast.error('No files to extract');
        setIsExtracting(false);
        setExtractDialogOpen(false);
        return;
      }

      // Check file count limit
      if (filesToExtract.length > MAX_FILE_COUNT) {
        toast.error(`Too many files to extract (max ${MAX_FILE_COUNT})`);
        setIsExtracting(false);
        setExtractDialogOpen(false);
        return;
      }

      const fileList: { name: string; size: number }[] = [];
      let totalExtractedSize = 0;

      if (archiveType === 'zip') {
        // Extract from ZIP using JSZip
        const zip = await JSZip.loadAsync(archiveBlob);

        for (let i = 0; i < filesToExtract.length; i++) {
          const fileInfo = filesToExtract[i];
          const zipEntry = zip.files[fileInfo.path];
          
          if (!zipEntry || zipEntry.dir) continue;

          try {
            const content = await zipEntry.async('blob');
            
            // Check individual file size
            if (content.size > MAX_INDIVIDUAL_FILE_SIZE) {
              console.warn(`Skipping oversized file: ${fileInfo.name}`);
              continue;
            }
            
            // Check total size limit
            totalExtractedSize += content.size;
            if (totalExtractedSize > MAX_TOTAL_SIZE) {
              throw new Error('Total extraction size limit exceeded');
            }

            const sanitizedName = sanitizeFileName(fileInfo.name);
            const storagePath = `${userId}/${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${sanitizedName}`;

            // Upload to storage
            const { error: uploadError } = await supabase.storage
              .from('user-files')
              .upload(storagePath, content);

            if (uploadError) {
              console.error(`Upload error for ${fileInfo.name}:`, uploadError);
              continue;
            }

            // Create file record
            const { error: insertError } = await supabase.from('files').insert({
              user_id: userId,
              name: fileInfo.name,
              size_bytes: content.size,
              mime_type: getMimeType(fileInfo.name),
              storage_path: storagePath
            });

            if (insertError) {
              console.error(`Insert error for ${fileInfo.name}:`, insertError);
              // Clean up uploaded file
              await supabase.storage.from('user-files').remove([storagePath]);
              continue;
            }

            fileList.push({ name: fileInfo.name, size: content.size });
          } catch (fileError) {
            console.error(`Error extracting ${fileInfo.name}:`, fileError);
          }

          setProgress(((i + 1) / filesToExtract.length) * 100);
        }
      } else {
        // Extract using libarchive.js
        for (let i = 0; i < filesToExtract.length; i++) {
          const fileInfo = filesToExtract[i];
          const compressedFile = libArchiveFilesMap.get(fileInfo.path);
          
          if (!compressedFile) continue;

          try {
            // Extract the file using libarchive
            const extractedFile = await compressedFile.extract();
            const content = new Blob([extractedFile], { type: 'application/octet-stream' });
            
            // Check individual file size
            if (content.size > MAX_INDIVIDUAL_FILE_SIZE) {
              console.warn(`Skipping oversized file: ${fileInfo.name}`);
              continue;
            }
            
            // Check total size limit
            totalExtractedSize += content.size;
            if (totalExtractedSize > MAX_TOTAL_SIZE) {
              throw new Error('Total extraction size limit exceeded');
            }

            const sanitizedName = sanitizeFileName(fileInfo.name);
            const storagePath = `${userId}/${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${sanitizedName}`;

            // Upload to storage
            const { error: uploadError } = await supabase.storage
              .from('user-files')
              .upload(storagePath, content);

            if (uploadError) {
              console.error(`Upload error for ${fileInfo.name}:`, uploadError);
              continue;
            }

            // Create file record
            const { error: insertError } = await supabase.from('files').insert({
              user_id: userId,
              name: fileInfo.name,
              size_bytes: content.size,
              mime_type: getMimeType(fileInfo.name),
              storage_path: storagePath
            });

            if (insertError) {
              console.error(`Insert error for ${fileInfo.name}:`, insertError);
              // Clean up uploaded file
              await supabase.storage.from('user-files').remove([storagePath]);
              continue;
            }

            fileList.push({ name: fileInfo.name, size: content.size });
          } catch (fileError) {
            console.error(`Error extracting ${fileInfo.name}:`, fileError);
          }

          setProgress(((i + 1) / filesToExtract.length) * 100);
        }
      }

      setExtractedFiles(fileList);
      
      if (fileList.length > 0) {
        toast.success(`Extracted ${fileList.length} files!`);
        onFilesExtracted?.();
      } else {
        toast.error('No files were extracted');
      }
    } catch (error: any) {
      console.error('Extraction error:', error);
      toast.error(error.message || 'Failed to extract files');
    } finally {
      setIsExtracting(false);
    }
  };

  const downloadSingleFile = async (fileInfo: PreviewFile) => {
    if (!archiveBlob) return;
    
    try {
      if (archiveType === 'zip') {
        // Download from ZIP using JSZip
        const zip = await JSZip.loadAsync(archiveBlob);
        const zipEntry = zip.files[fileInfo.path];
        
        if (!zipEntry) {
          toast.error('File not found in archive');
          return;
        }
        
        const content = await zipEntry.async('blob');
        saveAs(content, fileInfo.name);
      } else {
        // Download using libarchive.js
        const compressedFile = libArchiveFilesMap.get(fileInfo.path);
        
        if (!compressedFile) {
          toast.error('File not found in archive');
          return;
        }
        
        const extractedFile = await compressedFile.extract();
        saveAs(extractedFile, fileInfo.name);
      }
      
      toast.success(`Downloaded ${fileInfo.name}`);
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download file');
    }
  };

  const downloadFullArchive = () => {
    if (!archiveBlob) return;
    saveAs(archiveBlob, file.name);
    toast.success(`Downloaded ${file.name}`);
  };

  const toggleFileSelection = (path: string) => {
    setSelectedFiles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(path)) {
        newSet.delete(path);
      } else {
        newSet.add(path);
      }
      return newSet;
    });
  };

  const selectAll = () => {
    const allPaths = previewFiles.filter(f => f.extractable).map(f => f.path);
    setSelectedFiles(new Set(allPaths));
  };

  const handleClose = () => {
    setPreviewDialogOpen(false);
    onClose();
  };

  const extractableCount = previewFiles.filter(f => f.extractable).length;

  return (
    <>
      {/* Main Preview Dialog */}
      <Dialog open={previewDialogOpen} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader className="shrink-0 pb-4 border-b">
            <DialogTitle className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <FolderOpen className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{file.name}</p>
                <p className="text-sm text-muted-foreground font-normal">
                  {formatBytes(file.size_bytes)}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={handleClose}>
                <X className="h-4 w-4" />
              </Button>
            </DialogTitle>
          </DialogHeader>

          {/* Loading State */}
          {isLoading && (
            <div className="flex-1 flex flex-col items-center justify-center py-12 gap-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-muted-foreground">Loading archive contents...</p>
            </div>
          )}

          {/* Error State */}
          {error && !isLoading && (
            <div className="flex-1 flex flex-col items-center justify-center py-8 gap-4">
              <AlertCircle className="h-12 w-12 text-destructive" />
              <p className="text-center text-muted-foreground max-w-md">{error}</p>
              <Button onClick={downloadFullArchive} className="gap-2">
                <Download className="h-4 w-4" />
                Download Archive
              </Button>
            </div>
          )}

          {/* Password Required State */}
          {needsPassword && !isLoading && !error && (
            <div className="flex-1 flex flex-col items-center justify-center py-8 gap-6">
              <div className="p-4 rounded-full bg-yellow-500/10">
                <Lock className="h-8 w-8 text-yellow-500" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="font-semibold">Password Protected</h3>
                <p className="text-sm text-muted-foreground">
                  This archive requires a password
                </p>
              </div>
              <div className="w-full max-w-xs space-y-4">
                <Input
                  type="password"
                  value={archivePassword}
                  onChange={(e) => setArchivePassword(e.target.value)}
                  placeholder="Enter password"
                  onKeyDown={(e) => e.key === 'Enter' && archivePassword && handlePasswordSubmit()}
                />
                <Button 
                  onClick={handlePasswordSubmit} 
                  disabled={!archivePassword}
                  className="w-full gap-2"
                >
                  <Lock className="h-4 w-4" />
                  Unlock
                </Button>
              </div>
            </div>
          )}

          {/* File List */}
          {!isLoading && !error && !needsPassword && previewFiles.length > 0 && (
            <>
              <div className="flex items-center justify-between py-3 shrink-0">
                <div className="flex items-center gap-3">
                  <span className="text-sm">
                    <span className="font-medium">{extractableCount}</span>
                    <span className="text-muted-foreground"> files</span>
                  </span>
                  {selectedFiles.size > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                      {selectedFiles.size} selected
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={selectAll} className="text-xs">
                    Select All
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedFiles(new Set())} className="text-xs">
                    Clear
                  </Button>
                </div>
              </div>

              <ScrollArea className="flex-1 min-h-0 -mx-2">
                <div className="space-y-1 px-2">
                  {previewFiles.map((f, idx) => (
                    <div
                      key={idx}
                      className={`flex items-center gap-3 p-3 rounded-lg transition-colors hover:bg-muted/50 ${
                        selectedFiles.has(f.path) ? 'bg-primary/5 ring-1 ring-primary/20' : ''
                      } ${!f.extractable ? 'opacity-50' : ''}`}
                    >
                      {f.extractable && (
                        <Checkbox
                          checked={selectedFiles.has(f.path)}
                          onCheckedChange={() => toggleFileSelection(f.path)}
                          className="shrink-0"
                        />
                      )}
                      <div className={`shrink-0 p-1.5 rounded ${f.isDirectory ? 'bg-primary/10' : 'bg-muted'}`}>
                        {f.isDirectory ? (
                          <Folder className="h-4 w-4 text-primary" />
                        ) : (
                          <FileIcon className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <span className="flex-1 truncate text-sm">{f.path}</span>
                      {!f.isDirectory && (
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-muted-foreground">{formatBytes(f.size)}</span>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-7 w-7" 
                            onClick={() => downloadSingleFile(f)}
                          >
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>

              <DialogFooter className="pt-4 border-t shrink-0 gap-2">
                <Button variant="outline" onClick={downloadFullArchive} className="gap-2">
                  <Download className="h-4 w-4" />
                  Download ZIP
                </Button>
                <Button onClick={extractSelectedFiles} className="gap-2">
                  <FolderOpen className="h-4 w-4" />
                  Extract {selectedFiles.size > 0 ? `${selectedFiles.size} Files` : 'All'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Extraction Progress Dialog */}
      <Dialog open={extractDialogOpen} onOpenChange={setExtractDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${isExtracting ? 'bg-primary/10' : 'bg-green-500/10'}`}>
                <FolderOpen className={`h-5 w-5 ${isExtracting ? 'text-primary' : 'text-green-500'}`} />
              </div>
              {isExtracting ? 'Extracting Files...' : 'Extraction Complete'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {isExtracting && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-medium">{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            )}

            {extractedFiles.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Extracted Files</p>
                  <span className="text-xs text-muted-foreground">{extractedFiles.length} files</span>
                </div>
                <ScrollArea className="max-h-48">
                  <div className="space-y-1">
                    {extractedFiles.map((f, i) => (
                      <div key={i} className="flex justify-between text-sm p-2 bg-muted/50 rounded">
                        <span className="truncate flex-1">{f.name}</span>
                        <span className="text-muted-foreground ml-2">{formatBytes(f.size)}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            <Button 
              onClick={() => { 
                setExtractDialogOpen(false); 
                handleClose(); 
              }} 
              className="w-full" 
              disabled={isExtracting}
            >
              {isExtracting ? 'Please wait...' : 'Done'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

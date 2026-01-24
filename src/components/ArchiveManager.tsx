import { useState, useCallback, useEffect } from 'react';
import { Archive, ArchiveCompression, ArchiveFormat } from 'libarchive.js';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
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
  Eye, 
  Download, 
  FileIcon,
  Folder,
  ChevronRight,
  ChevronDown,
  AlertCircle
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatBytes } from '@/lib/utils';

// Initialize libarchive worker
Archive.init({
  workerUrl: 'https://cdn.jsdelivr.net/npm/libarchive.js@2.0.2/dist/worker-bundle.js'
});

// Security constants
const MAX_TOTAL_SIZE = 1024 * 1024 * 1024; // 1GB max
const MAX_FILE_COUNT = 1000;
const MAX_INDIVIDUAL_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const MAX_PATH_DEPTH = 10;
const MAX_FILENAME_LENGTH = 255;

// Supported archive extensions
const ARCHIVE_EXTENSIONS = ['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz', '.tar.gz', '.tgz'];

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

export const ArchiveManager = ({ 
  files, 
  userId, 
  onFilesExtracted,
  userQuotaBytes = MAX_TOTAL_SIZE,
  userUsedBytes = 0
}: ArchiveManagerProps) => {
  // Dialog states
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [extractDialogOpen, setExtractDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  
  // Processing states
  const [currentArchive, setCurrentArchive] = useState<ArchiveFile | null>(null);
  const [previewFiles, setPreviewFiles] = useState<PreviewFile[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [extractedFiles, setExtractedFiles] = useState<{ name: string; size: number }[]>([]);
  
  // Password states
  const [archivePassword, setArchivePassword] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [isEncrypted, setIsEncrypted] = useState(false);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [pendingArchiveBlob, setPendingArchiveBlob] = useState<Blob | null>(null);

  // Filter archive files
  const archiveFiles = files.filter(f => 
    ARCHIVE_EXTENSIONS.some(ext => f.name.toLowerCase().endsWith(ext))
  );

  const isArchiveFile = (fileName: string) => 
    ARCHIVE_EXTENSIONS.some(ext => fileName.toLowerCase().endsWith(ext));

  const validatePath = (relativePath: string): { valid: boolean; error?: string } => {
    const pathParts = relativePath.split('/').filter(p => p);
    
    if (pathParts.length > MAX_PATH_DEPTH) {
      return { valid: false, error: `Path too deep: ${relativePath}` };
    }
    
    if (pathParts.some(part => part === '..' || part === '.')) {
      return { valid: false, error: `Path traversal detected: ${relativePath}` };
    }
    
    const fileName = pathParts[pathParts.length - 1];
    if (fileName && fileName.length > MAX_FILENAME_LENGTH) {
      return { valid: false, error: `Filename too long: ${fileName}` };
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
    };
    return mimeTypes[ext || ''] || 'application/octet-stream';
  };

  // Preview archive contents without extracting
  const previewArchive = async (file: ArchiveFile) => {
    setCurrentArchive(file);
    setPreviewFiles([]);
    setSelectedFiles(new Set());
    setExpandedFolders(new Set());
    setIsProcessing(true);
    setNeedsPassword(false);
    setArchivePassword('');
    setPreviewDialogOpen(true);

    try {
      const { data: signedUrl } = await supabase.storage
        .from('user-files')
        .createSignedUrl(file.storage_path, 3600);

      if (!signedUrl?.signedUrl) {
        throw new Error('Failed to get file URL');
      }

      const response = await fetch(signedUrl.signedUrl);
      const blob = await response.blob();

      // Check if it's a standard ZIP (use JSZip for better password support check)
      if (file.name.toLowerCase().endsWith('.zip')) {
        try {
          const zip = await JSZip.loadAsync(blob);
          const entries = Object.entries(zip.files);
          
          const fileList: PreviewFile[] = [];
          for (const [relativePath, zipEntry] of entries) {
            const pathValidation = validatePath(relativePath);
            fileList.push({
              name: relativePath.split('/').filter(p => p).pop() || relativePath,
              path: relativePath,
              size: (zipEntry as any)._data?.uncompressedSize || 0,
              isDirectory: zipEntry.dir,
              extractable: pathValidation.valid
            });
          }
          
          setPreviewFiles(fileList.sort((a, b) => {
            if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
            return a.path.localeCompare(b.path);
          }));
        } catch (err: any) {
          // Check if password protected
          if (err.message?.includes('Encrypted')) {
            setNeedsPassword(true);
            setPendingArchiveBlob(blob);
          } else {
            throw err;
          }
        }
      } else {
        // Use libarchive for other formats
        const archive = await Archive.open(blob as File);
        
        // Check for encryption
        const hasEncryption = await archive.hasEncryptedData();
        if (hasEncryption) {
          setNeedsPassword(true);
          setPendingArchiveBlob(blob);
          setIsProcessing(false);
          return;
        }
        
        const filesArray = await archive.getFilesArray();
        
        const fileList: PreviewFile[] = filesArray.map((entry: any) => {
          const pathValidation = validatePath(entry.path + entry.file.name);
          return {
            name: entry.file.name,
            path: entry.path + entry.file.name,
            size: entry.file.size || 0,
            isDirectory: false,
            extractable: pathValidation.valid
          };
        });
        
        setPreviewFiles(fileList.sort((a, b) => a.path.localeCompare(b.path)));
      }
    } catch (error) {
      console.error('Preview error:', error);
      toast.error('Failed to preview archive');
      setPreviewDialogOpen(false);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle password entry for encrypted archives
  const handlePasswordSubmit = async () => {
    if (!pendingArchiveBlob || !currentArchive) return;
    
    setIsProcessing(true);
    
    try {
      if (currentArchive.name.toLowerCase().endsWith('.zip')) {
        // For ZIP files, we'll need to try extraction with password
        toast.info('Password-protected ZIP preview requires extraction');
        setNeedsPassword(false);
        setPasswordDialogOpen(false);
        // Proceed to extraction with password
        await extractArchiveWithPassword(pendingArchiveBlob, archivePassword);
      } else {
        // Use libarchive for other formats
        const archive = await Archive.open(pendingArchiveBlob as File);
        await archive.usePassword(archivePassword);
        
        const filesArray = await archive.getFilesArray();
        
        const fileList: PreviewFile[] = filesArray.map((entry: any) => {
          const pathValidation = validatePath(entry.path + entry.file.name);
          return {
            name: entry.file.name,
            path: entry.path + entry.file.name,
            size: entry.file.size || 0,
            isDirectory: false,
            extractable: pathValidation.valid
          };
        });
        
        setPreviewFiles(fileList.sort((a, b) => a.path.localeCompare(b.path)));
        setNeedsPassword(false);
      }
    } catch (error) {
      console.error('Password error:', error);
      toast.error('Invalid password or failed to decrypt');
    } finally {
      setIsProcessing(false);
    }
  };

  // Extract selected or all files
  const extractSelectedFiles = async () => {
    if (!currentArchive) return;
    
    setExtractDialogOpen(true);
    setIsProcessing(true);
    setProgress(0);
    setExtractedFiles([]);

    try {
      const { data: signedUrl } = await supabase.storage
        .from('user-files')
        .createSignedUrl(currentArchive.storage_path, 3600);

      if (!signedUrl?.signedUrl) {
        throw new Error('Failed to get file URL');
      }

      const response = await fetch(signedUrl.signedUrl);
      const blob = await response.blob();
      
      const filesToExtract = selectedFiles.size > 0 
        ? previewFiles.filter(f => selectedFiles.has(f.path) && !f.isDirectory && f.extractable)
        : previewFiles.filter(f => !f.isDirectory && f.extractable);

      if (filesToExtract.length === 0) {
        toast.error('No files selected for extraction');
        setIsProcessing(false);
        return;
      }

      // Confirm if many files
      if (filesToExtract.length > 100) {
        const confirmExtract = confirm(
          `Extract ${filesToExtract.length} files?`
        );
        if (!confirmExtract) {
          setIsProcessing(false);
          setExtractDialogOpen(false);
          return;
        }
      }

      const fileList: { name: string; size: number }[] = [];
      let extractedSize = 0;

      if (currentArchive.name.toLowerCase().endsWith('.zip')) {
        const zip = await JSZip.loadAsync(blob);
        
        for (let i = 0; i < filesToExtract.length; i++) {
          const fileInfo = filesToExtract[i];
          const zipEntry = zip.files[fileInfo.path];
          
          if (!zipEntry || zipEntry.dir) continue;
          
          const content = await zipEntry.async('blob');
          
          if (content.size > MAX_INDIVIDUAL_FILE_SIZE) {
            console.warn(`Skipping oversized file: ${fileInfo.path}`);
            continue;
          }
          
          extractedSize += content.size;
          if (extractedSize > MAX_TOTAL_SIZE) {
            throw new Error(`Extraction exceeded size limit (${formatBytes(MAX_TOTAL_SIZE)})`);
          }

          const sanitizedName = sanitizeFileName(fileInfo.name);
          const storagePath = `${userId}/${Date.now()}-${sanitizedName}`;

          const { error: uploadError } = await supabase.storage
            .from('user-files')
            .upload(storagePath, content);

          if (!uploadError) {
            await supabase.from('files').insert({
              user_id: userId,
              name: fileInfo.name,
              size_bytes: content.size,
              mime_type: getMimeType(fileInfo.name),
              storage_path: storagePath
            });
            fileList.push({ name: fileInfo.name, size: content.size });
          }

          setProgress(((i + 1) / filesToExtract.length) * 100);
        }
      } else {
        // Use libarchive for other formats
        const archive = await Archive.open(blob as File);
        
        if (archivePassword) {
          await archive.usePassword(archivePassword);
        }
        
        let extracted = 0;
        await archive.extractFiles((entry: { file: File; path: string }) => {
          const fullPath = entry.path + entry.file.name;
          const shouldExtract = filesToExtract.some(f => f.path === fullPath);
          
          if (shouldExtract) {
            extracted++;
            setProgress((extracted / filesToExtract.length) * 100);
          }
        });

        const filesObj = await archive.getFilesObject();
        
        const processFiles = async (obj: any, currentPath: string = '') => {
          for (const [name, value] of Object.entries(obj)) {
            const fullPath = currentPath ? `${currentPath}/${name}` : name;
            
            if (value instanceof File) {
              const shouldExtract = filesToExtract.some(f => f.path === fullPath || f.name === name);
              
              if (shouldExtract && value.size <= MAX_INDIVIDUAL_FILE_SIZE) {
                extractedSize += value.size;
                if (extractedSize > MAX_TOTAL_SIZE) {
                  throw new Error('Extraction exceeded size limit');
                }

                const sanitizedName = sanitizeFileName(name);
                const storagePath = `${userId}/${Date.now()}-${sanitizedName}`;

                const { error: uploadError } = await supabase.storage
                  .from('user-files')
                  .upload(storagePath, value);

                if (!uploadError) {
                  await supabase.from('files').insert({
                    user_id: userId,
                    name: name,
                    size_bytes: value.size,
                    mime_type: getMimeType(name),
                    storage_path: storagePath
                  });
                  fileList.push({ name, size: value.size });
                }
              }
            } else if (typeof value === 'object') {
              await processFiles(value, fullPath);
            }
          }
        };

        await processFiles(filesObj);
      }

      setExtractedFiles(fileList);
      toast.success(`Extracted ${fileList.length} files!`);
      onFilesExtracted?.();
    } catch (error) {
      console.error('Extraction error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to extract';
      toast.error(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  const extractArchiveWithPassword = async (blob: Blob, password: string) => {
    // Similar to extractSelectedFiles but uses password
    setExtractDialogOpen(true);
    setPreviewDialogOpen(false);
    setIsProcessing(true);
    setProgress(0);
    setExtractedFiles([]);

    try {
      const archive = await Archive.open(blob as File);
      await archive.usePassword(password);
      
      const filesArray = await archive.getFilesArray();
      const fileList: { name: string; size: number }[] = [];
      let extractedSize = 0;
      
      for (let i = 0; i < filesArray.length; i++) {
        const entry = filesArray[i];
        const file = await entry.file.extract();
        
        if (file.size > MAX_INDIVIDUAL_FILE_SIZE) continue;
        
        extractedSize += file.size;
        if (extractedSize > MAX_TOTAL_SIZE) {
          throw new Error('Extraction exceeded size limit');
        }

        const sanitizedName = sanitizeFileName(entry.file.name);
        const storagePath = `${userId}/${Date.now()}-${sanitizedName}`;

        const { error: uploadError } = await supabase.storage
          .from('user-files')
          .upload(storagePath, file);

        if (!uploadError) {
          await supabase.from('files').insert({
            user_id: userId,
            name: entry.file.name,
            size_bytes: file.size,
            mime_type: getMimeType(entry.file.name),
            storage_path: storagePath
          });
          fileList.push({ name: entry.file.name, size: file.size });
        }

        setProgress(((i + 1) / filesArray.length) * 100);
      }

      setExtractedFiles(fileList);
      toast.success(`Extracted ${fileList.length} files!`);
      onFilesExtracted?.();
    } catch (error) {
      console.error('Extraction error:', error);
      toast.error('Failed to extract with password');
    } finally {
      setIsProcessing(false);
    }
  };

  // Create new archive with optional password
  const createArchive = async (selectedFiles: ArchiveFile[], format: 'zip' | 'tar.gz' = 'zip') => {
    if (selectedFiles.length === 0) {
      toast.error('No files selected');
      return;
    }

    setIsProcessing(true);
    setProgress(0);

    try {
      if (format === 'zip') {
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

        // Note: JSZip doesn't support password protection directly
        // For password-protected ZIPs, we'd need a different approach
        const content = await zip.generateAsync({ 
          type: 'blob',
          compression: 'DEFLATE',
          compressionOptions: { level: 6 }
        }, (metadata) => {
          setProgress(50 + (metadata.percent / 2));
        });

        const zipName = selectedFiles.length === 1 
          ? selectedFiles[0].name.replace(/\.[^/.]+$/, '.zip')
          : `archive_${Date.now()}.zip`;

        saveAs(content, zipName);
        toast.success('Archive created!');
      } else {
        // Use libarchive for tar.gz with optional password
        const filesToArchive: any[] = [];
        
        for (let i = 0; i < selectedFiles.length; i++) {
          const file = selectedFiles[i];
          
          const { data: signedUrl } = await supabase.storage
            .from('user-files')
            .createSignedUrl(file.storage_path, 3600);

          if (signedUrl?.signedUrl) {
            const response = await fetch(signedUrl.signedUrl);
            const blob = await response.blob();
            // Convert Blob to File for libarchive compatibility
            const fileObj = new File([blob], file.name, { type: blob.type });
            filesToArchive.push({ file: fileObj, pathname: file.name });
          }

          setProgress(((i + 1) / selectedFiles.length) * 80);
        }

        const archiveBlob = await Archive.write({
          files: filesToArchive,
          outputFileName: `archive_${Date.now()}.tar.gz`,
          compression: ArchiveCompression.GZIP,
          format: ArchiveFormat.USTAR,
          passphrase: createPassword || null,
        });

        saveAs(archiveBlob, `archive_${Date.now()}.tar.gz`);
        toast.success('Archive created!');
        setProgress(100);
      }
    } catch (error) {
      console.error('Archive creation error:', error);
      toast.error('Failed to create archive');
    } finally {
      setIsProcessing(false);
      setProgress(0);
      setCreateDialogOpen(false);
      setCreatePassword('');
    }
  };

  // Download single file from preview
  const downloadSingleFile = async (fileInfo: PreviewFile) => {
    if (!currentArchive) return;
    
    try {
      const { data: signedUrl } = await supabase.storage
        .from('user-files')
        .createSignedUrl(currentArchive.storage_path, 3600);

      if (!signedUrl?.signedUrl) {
        throw new Error('Failed to get URL');
      }

      const response = await fetch(signedUrl.signedUrl);
      const blob = await response.blob();
      
      if (currentArchive.name.toLowerCase().endsWith('.zip')) {
        const zip = await JSZip.loadAsync(blob);
        const file = await zip.files[fileInfo.path].async('blob');
        saveAs(file, fileInfo.name);
      } else {
        const archive = await Archive.open(blob as File);
        if (archivePassword) {
          await archive.usePassword(archivePassword);
        }
        const filesObj = await archive.getFilesObject();
        
        // Navigate to the file
        const parts = fileInfo.path.split('/').filter(p => p);
        let current: any = filesObj;
        for (const part of parts) {
          if (current[part]) {
            current = current[part];
          }
        }
        
        if (current instanceof File) {
          saveAs(current, fileInfo.name);
        }
      }
      
      toast.success(`Downloaded ${fileInfo.name}`);
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download file');
    }
  };

  const toggleFileSelection = (path: string) => {
    const newSelected = new Set(selectedFiles);
    if (newSelected.has(path)) {
      newSelected.delete(path);
    } else {
      newSelected.add(path);
    }
    setSelectedFiles(newSelected);
  };

  const toggleFolder = (path: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedFolders(newExpanded);
  };

  const selectAll = () => {
    const allPaths = previewFiles.filter(f => !f.isDirectory && f.extractable).map(f => f.path);
    setSelectedFiles(new Set(allPaths));
  };

  const deselectAll = () => {
    setSelectedFiles(new Set());
  };

  // Build tree structure for display
  const buildFileTree = (files: PreviewFile[]) => {
    const tree: { [key: string]: PreviewFile[] } = { '': [] };
    
    files.forEach(file => {
      const parts = file.path.split('/').filter(p => p);
      if (parts.length === 1 || file.isDirectory) {
        tree[''].push(file);
      } else {
        const folder = parts.slice(0, -1).join('/');
        if (!tree[folder]) tree[folder] = [];
        tree[folder].push(file);
      }
    });
    
    return tree;
  };

  return (
    <>
      {/* Main action buttons */}
      <div className="flex gap-2">
        {files.length > 0 && (
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              setCreateDialogOpen(true);
            }}
            disabled={isProcessing}
            className="gap-2 transition-all hover:shadow-md"
          >
            {isProcessing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArchiveIcon className="h-4 w-4" />
            )}
            Create Archive
          </Button>
        )}
      </div>

      {/* Preview Dialog */}
      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader className="shrink-0 pb-4 border-b">
            <DialogTitle className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <FolderOpen className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{currentArchive?.name}</p>
                <p className="text-sm text-muted-foreground font-normal">
                  {formatBytes(currentArchive?.size_bytes || 0)}
                </p>
              </div>
              {isEncrypted && (
                <div className="p-1.5 rounded-full bg-yellow-500/10">
                  <Lock className="h-4 w-4 text-yellow-500" />
                </div>
              )}
            </DialogTitle>
          </DialogHeader>

          {isProcessing && (
            <div className="flex-1 flex flex-col items-center justify-center py-12 gap-4">
              <div className="relative">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <div className="absolute inset-0 h-12 w-12 animate-ping rounded-full bg-primary/20" />
              </div>
              <p className="text-muted-foreground animate-pulse">Loading archive contents...</p>
            </div>
          )}

          {needsPassword && !isProcessing && (
            <div className="flex-1 flex flex-col items-center justify-center py-8 gap-6">
              <div className="p-4 rounded-full bg-yellow-500/10">
                <Lock className="h-8 w-8 text-yellow-500" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="font-semibold">Password Protected</h3>
                <p className="text-sm text-muted-foreground">
                  This archive requires a password to view contents
                </p>
              </div>
              <div className="w-full max-w-xs space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="archive-password">Password</Label>
                  <Input
                    id="archive-password"
                    type="password"
                    value={archivePassword}
                    onChange={(e) => setArchivePassword(e.target.value)}
                    placeholder="Enter archive password"
                    className="text-center"
                    onKeyDown={(e) => e.key === 'Enter' && archivePassword && handlePasswordSubmit()}
                  />
                </div>
                <Button 
                  onClick={handlePasswordSubmit} 
                  disabled={!archivePassword}
                  className="w-full gap-2"
                >
                  <Lock className="h-4 w-4" />
                  Unlock Archive
                </Button>
              </div>
            </div>
          )}

          {!isProcessing && !needsPassword && previewFiles.length > 0 && (
            <>
              <div className="flex items-center justify-between py-3 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="text-sm">
                    <span className="font-medium">{previewFiles.filter(f => !f.isDirectory).length}</span>
                    <span className="text-muted-foreground"> files</span>
                  </div>
                  {selectedFiles.size > 0 && (
                    <div className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                      {selectedFiles.size} selected
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={selectAll} className="text-xs">
                    Select All
                  </Button>
                  <Button variant="ghost" size="sm" onClick={deselectAll} className="text-xs">
                    Clear
                  </Button>
                </div>
              </div>

              <ScrollArea className="flex-1 min-h-0 -mx-2">
                <div className="space-y-1 px-2">
                  {previewFiles.map((file, idx) => (
                    <div
                      key={idx}
                      className={`flex items-center gap-3 p-3 rounded-lg transition-all duration-200 hover:bg-muted/50 ${
                        selectedFiles.has(file.path) ? 'bg-primary/5 border border-primary/20' : 'border border-transparent'
                      } ${!file.extractable ? 'opacity-50' : ''}`}
                    >
                      {!file.isDirectory && (
                        <Checkbox
                          checked={selectedFiles.has(file.path)}
                          onCheckedChange={() => toggleFileSelection(file.path)}
                          disabled={!file.extractable}
                          className="shrink-0"
                        />
                      )}
                      <div className={`shrink-0 p-1.5 rounded ${file.isDirectory ? 'bg-primary/10' : 'bg-muted'}`}>
                        {file.isDirectory ? (
                          <Folder className="h-4 w-4 text-primary" />
                        ) : (
                          <FileIcon className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <span className="flex-1 truncate text-sm font-medium">{file.path}</span>
                      {!file.isDirectory && (
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {formatBytes(file.size)}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 hover:bg-primary/10"
                            onClick={() => downloadSingleFile(file)}
                          >
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                      {!file.extractable && (
                        <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>

              <DialogFooter className="pt-4 border-t shrink-0">
                <Button variant="outline" onClick={() => setPreviewDialogOpen(false)}>
                  Cancel
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
              <div className={`p-2 rounded-lg ${isProcessing ? 'bg-primary/10' : 'bg-green-500/10'}`}>
                <FolderOpen className={`h-5 w-5 ${isProcessing ? 'text-primary' : 'text-green-500'}`} />
              </div>
              {isProcessing ? 'Extracting Files' : 'Extraction Complete'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {isProcessing && (
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-medium tabular-nums">{Math.round(progress)}%</span>
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
                      <div key={i} className="flex justify-between text-sm p-2.5 bg-muted/50 rounded-lg">
                        <span className="truncate flex-1 font-medium">{f.name}</span>
                        <span className="text-muted-foreground ml-2 tabular-nums">{formatBytes(f.size)}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            <Button 
              onClick={() => setExtractDialogOpen(false)} 
              className="w-full"
              disabled={isProcessing}
              variant={isProcessing ? 'outline' : 'default'}
            >
              {isProcessing ? 'Processing...' : 'Done'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Archive Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <ArchiveIcon className="h-5 w-5 text-primary" />
              </div>
              Create Archive
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="p-3 rounded-lg bg-muted/50 text-sm">
              <span className="font-medium">{files.length}</span>
              <span className="text-muted-foreground"> file{files.length !== 1 ? 's' : ''} will be compressed</span>
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-password">Password Protection (Optional)</Label>
              <Input
                id="create-password"
                type="password"
                value={createPassword}
                onChange={(e) => setCreatePassword(e.target.value)}
                placeholder="Leave empty for no password"
              />
              <p className="text-xs text-muted-foreground">
                Password protection is available with TAR.GZ format
              </p>
            </div>

            {isProcessing && (
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Creating archive...</span>
                  <span className="font-medium tabular-nums">{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)} disabled={isProcessing}>
              Cancel
            </Button>
            <Button 
              onClick={() => createArchive(files, createPassword ? 'tar.gz' : 'zip')}
              disabled={isProcessing}
              className="gap-2"
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArchiveIcon className="h-4 w-4" />
              )}
              {createPassword ? 'Create TAR.GZ' : 'Create ZIP'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

// Export utility function to check if file is an archive
export const isArchiveExtension = (fileName: string) => 
  ARCHIVE_EXTENSIONS.some(ext => fileName.toLowerCase().endsWith(ext));

// Wrapper component for previewing a single archive file
interface ArchivePreviewWrapperProps {
  file: ArchiveFile;
  userId: string;
  onClose: () => void;
  onFilesExtracted?: () => void;
  userQuotaBytes?: number;
  userUsedBytes?: number;
}

export const ArchivePreviewWrapper = ({
  file,
  userId,
  onClose,
  onFilesExtracted,
  userQuotaBytes,
  userUsedBytes
}: ArchivePreviewWrapperProps) => {
  const [previewDialogOpen, setPreviewDialogOpen] = useState(true);
  const [extractDialogOpen, setExtractDialogOpen] = useState(false);
  const [previewFiles, setPreviewFiles] = useState<PreviewFile[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [extractedFiles, setExtractedFiles] = useState<{ name: string; size: number }[]>([]);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [archivePassword, setArchivePassword] = useState('');
  const [pendingArchiveBlob, setPendingArchiveBlob] = useState<Blob | null>(null);

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
      'mp4': 'video/mp4',
      'mp3': 'audio/mpeg',
    };
    return mimeTypes[ext || ''] || 'application/octet-stream';
  };

  // Note: loadArchive is defined below and called in useEffect after definition

  const loadArchive = async () => {
    setIsProcessing(true);
    try {
      const { data: signedUrl } = await supabase.storage
        .from('user-files')
        .createSignedUrl(file.storage_path, 3600);

      if (!signedUrl?.signedUrl) {
        throw new Error('Failed to get file URL');
      }

      const response = await fetch(signedUrl.signedUrl);
      const blob = await response.blob();

      if (file.name.toLowerCase().endsWith('.zip')) {
        try {
          const zip = await JSZip.loadAsync(blob);
          const entries = Object.entries(zip.files);
          
          const fileList: PreviewFile[] = [];
          for (const [relativePath, zipEntry] of entries) {
            const pathValidation = validatePath(relativePath);
            fileList.push({
              name: relativePath.split('/').filter(p => p).pop() || relativePath,
              path: relativePath,
              size: (zipEntry as any)._data?.uncompressedSize || 0,
              isDirectory: zipEntry.dir,
              extractable: pathValidation.valid
            });
          }
          
          setPreviewFiles(fileList.sort((a, b) => {
            if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
            return a.path.localeCompare(b.path);
          }));
        } catch (err: any) {
          if (err.message?.includes('Encrypted')) {
            setNeedsPassword(true);
            setPendingArchiveBlob(blob);
          } else {
            throw err;
          }
        }
      } else {
        const archive = await Archive.open(blob as File);
        const hasEncryption = await archive.hasEncryptedData();
        if (hasEncryption) {
          setNeedsPassword(true);
          setPendingArchiveBlob(blob);
          setIsProcessing(false);
          return;
        }
        
        const filesArray = await archive.getFilesArray();
        const fileList: PreviewFile[] = filesArray.map((entry: any) => {
          const pathValidation = validatePath(entry.path + entry.file.name);
          return {
            name: entry.file.name,
            path: entry.path + entry.file.name,
            size: entry.file.size || 0,
            isDirectory: false,
            extractable: pathValidation.valid
          };
        });
        
        setPreviewFiles(fileList.sort((a, b) => a.path.localeCompare(b.path)));
      }
    } catch (error) {
      console.error('Preview error:', error);
      toast.error('Failed to preview archive');
      onClose();
    } finally {
      setIsProcessing(false);
    }
  };

  // Load archive on mount
  useEffect(() => {
    loadArchive();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePasswordSubmit = async () => {
    if (!pendingArchiveBlob) return;
    setIsProcessing(true);
    try {
      const archive = await Archive.open(pendingArchiveBlob as File);
      await archive.usePassword(archivePassword);
      
      const filesArray = await archive.getFilesArray();
      const fileList: PreviewFile[] = filesArray.map((entry: any) => {
        const pathValidation = validatePath(entry.path + entry.file.name);
        return {
          name: entry.file.name,
          path: entry.path + entry.file.name,
          size: entry.file.size || 0,
          isDirectory: false,
          extractable: pathValidation.valid
        };
      });
      
      setPreviewFiles(fileList.sort((a, b) => a.path.localeCompare(b.path)));
      setNeedsPassword(false);
    } catch (error) {
      toast.error('Invalid password');
    } finally {
      setIsProcessing(false);
    }
  };

  const extractSelectedFiles = async () => {
    setExtractDialogOpen(true);
    setIsProcessing(true);
    setProgress(0);
    setExtractedFiles([]);

    try {
      const { data: signedUrl } = await supabase.storage
        .from('user-files')
        .createSignedUrl(file.storage_path, 3600);

      if (!signedUrl?.signedUrl) throw new Error('Failed to get file URL');

      const response = await fetch(signedUrl.signedUrl);
      const blob = await response.blob();
      
      const filesToExtract = selectedFiles.size > 0 
        ? previewFiles.filter(f => selectedFiles.has(f.path) && !f.isDirectory && f.extractable)
        : previewFiles.filter(f => !f.isDirectory && f.extractable);

      if (filesToExtract.length === 0) {
        toast.error('No files selected');
        setIsProcessing(false);
        return;
      }

      const fileList: { name: string; size: number }[] = [];
      let extractedSize = 0;

      if (file.name.toLowerCase().endsWith('.zip')) {
        const zip = await JSZip.loadAsync(blob);
        
        for (let i = 0; i < filesToExtract.length; i++) {
          const fileInfo = filesToExtract[i];
          const zipEntry = zip.files[fileInfo.path];
          if (!zipEntry || zipEntry.dir) continue;
          
          const content = await zipEntry.async('blob');
          if (content.size > MAX_INDIVIDUAL_FILE_SIZE) continue;
          
          extractedSize += content.size;
          if (extractedSize > MAX_TOTAL_SIZE) {
            throw new Error('Size limit exceeded');
          }

          const sanitizedName = sanitizeFileName(fileInfo.name);
          const storagePath = `${userId}/${Date.now()}-${sanitizedName}`;

          const { error: uploadError } = await supabase.storage
            .from('user-files')
            .upload(storagePath, content);

          if (!uploadError) {
            await supabase.from('files').insert({
              user_id: userId,
              name: fileInfo.name,
              size_bytes: content.size,
              mime_type: getMimeType(fileInfo.name),
              storage_path: storagePath
            });
            fileList.push({ name: fileInfo.name, size: content.size });
          }

          setProgress(((i + 1) / filesToExtract.length) * 100);
        }
      } else {
        const archive = await Archive.open(blob as File);
        if (archivePassword) await archive.usePassword(archivePassword);
        
        const filesObj = await archive.getFilesObject();
        
        const processFiles = async (obj: any, currentPath: string = '') => {
          for (const [name, value] of Object.entries(obj)) {
            const fullPath = currentPath ? `${currentPath}/${name}` : name;
            
            if (value instanceof File) {
              const shouldExtract = filesToExtract.some(f => f.path === fullPath || f.name === name);
              
              if (shouldExtract && value.size <= MAX_INDIVIDUAL_FILE_SIZE) {
                extractedSize += value.size;
                if (extractedSize > MAX_TOTAL_SIZE) throw new Error('Size limit exceeded');

                const sanitizedName = sanitizeFileName(name);
                const storagePath = `${userId}/${Date.now()}-${sanitizedName}`;

                const { error: uploadError } = await supabase.storage
                  .from('user-files')
                  .upload(storagePath, value);

                if (!uploadError) {
                  await supabase.from('files').insert({
                    user_id: userId,
                    name: name,
                    size_bytes: value.size,
                    mime_type: getMimeType(name),
                    storage_path: storagePath
                  });
                  fileList.push({ name, size: value.size });
                }
              }
            } else if (typeof value === 'object') {
              await processFiles(value, fullPath);
            }
          }
        };

        await processFiles(filesObj);
      }

      setExtractedFiles(fileList);
      toast.success(`Extracted ${fileList.length} files!`);
      onFilesExtracted?.();
    } catch (error) {
      console.error('Extraction error:', error);
      toast.error('Failed to extract');
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadSingleFile = async (fileInfo: PreviewFile) => {
    try {
      const { data: signedUrl } = await supabase.storage
        .from('user-files')
        .createSignedUrl(file.storage_path, 3600);

      if (!signedUrl?.signedUrl) throw new Error('Failed to get URL');

      const response = await fetch(signedUrl.signedUrl);
      const blob = await response.blob();
      
      if (file.name.toLowerCase().endsWith('.zip')) {
        const zip = await JSZip.loadAsync(blob);
        const zipFile = await zip.files[fileInfo.path].async('blob');
        saveAs(zipFile, fileInfo.name);
      } else {
        const archive = await Archive.open(blob as File);
        if (archivePassword) await archive.usePassword(archivePassword);
        const filesObj = await archive.getFilesObject();
        
        const parts = fileInfo.path.split('/').filter(p => p);
        let current: any = filesObj;
        for (const part of parts) {
          if (current[part]) current = current[part];
        }
        
        if (current instanceof File) saveAs(current, fileInfo.name);
      }
      
      toast.success(`Downloaded ${fileInfo.name}`);
    } catch (error) {
      toast.error('Failed to download');
    }
  };

  const toggleFileSelection = (path: string) => {
    const newSelected = new Set(selectedFiles);
    if (newSelected.has(path)) {
      newSelected.delete(path);
    } else {
      newSelected.add(path);
    }
    setSelectedFiles(newSelected);
  };

  const selectAll = () => {
    const allPaths = previewFiles.filter(f => !f.isDirectory && f.extractable).map(f => f.path);
    setSelectedFiles(new Set(allPaths));
  };

  const handleClose = () => {
    setPreviewDialogOpen(false);
    onClose();
  };

  return (
    <>
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
            </DialogTitle>
          </DialogHeader>

          {isProcessing && !extractDialogOpen && (
            <div className="flex-1 flex flex-col items-center justify-center py-12 gap-4">
              <div className="relative">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <div className="absolute inset-0 h-12 w-12 animate-ping rounded-full bg-primary/20" />
              </div>
              <p className="text-muted-foreground animate-pulse">Loading archive contents...</p>
            </div>
          )}

          {needsPassword && !isProcessing && (
            <div className="flex-1 flex flex-col items-center justify-center py-8 gap-6">
              <div className="p-4 rounded-full bg-yellow-500/10">
                <Lock className="h-8 w-8 text-yellow-500" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="font-semibold">Password Protected</h3>
                <p className="text-sm text-muted-foreground">
                  This archive requires a password to view contents
                </p>
              </div>
              <div className="w-full max-w-xs space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="archive-password">Password</Label>
                  <Input
                    id="archive-password"
                    type="password"
                    value={archivePassword}
                    onChange={(e) => setArchivePassword(e.target.value)}
                    placeholder="Enter archive password"
                    className="text-center"
                    onKeyDown={(e) => e.key === 'Enter' && archivePassword && handlePasswordSubmit()}
                  />
                </div>
                <Button 
                  onClick={handlePasswordSubmit} 
                  disabled={!archivePassword}
                  className="w-full gap-2"
                >
                  <Lock className="h-4 w-4" />
                  Unlock Archive
                </Button>
              </div>
            </div>
          )}

          {!isProcessing && !needsPassword && previewFiles.length > 0 && (
            <>
              <div className="flex items-center justify-between py-3 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="text-sm">
                    <span className="font-medium">{previewFiles.filter(f => !f.isDirectory).length}</span>
                    <span className="text-muted-foreground"> files</span>
                  </div>
                  {selectedFiles.size > 0 && (
                    <div className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                      {selectedFiles.size} selected
                    </div>
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
                      className={`flex items-center gap-3 p-3 rounded-lg transition-all duration-200 hover:bg-muted/50 ${
                        selectedFiles.has(f.path) ? 'bg-primary/5 border border-primary/20' : 'border border-transparent'
                      } ${!f.extractable ? 'opacity-50' : ''}`}
                    >
                      {!f.isDirectory && (
                        <Checkbox
                          checked={selectedFiles.has(f.path)}
                          onCheckedChange={() => toggleFileSelection(f.path)}
                          disabled={!f.extractable}
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
                      <span className="flex-1 truncate text-sm font-medium">{f.path}</span>
                      {!f.isDirectory && (
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-muted-foreground tabular-nums">{formatBytes(f.size)}</span>
                          <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-primary/10" onClick={() => downloadSingleFile(f)}>
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                      {!f.extractable && <AlertCircle className="h-4 w-4 text-destructive shrink-0" />}
                    </div>
                  ))}
                </div>
              </ScrollArea>

              <DialogFooter className="pt-4 border-t shrink-0">
                <Button variant="outline" onClick={handleClose}>Cancel</Button>
                <Button onClick={extractSelectedFiles} className="gap-2">
                  <FolderOpen className="h-4 w-4" />
                  Extract {selectedFiles.size > 0 ? `${selectedFiles.size} Files` : 'All'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={extractDialogOpen} onOpenChange={setExtractDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${isProcessing ? 'bg-primary/10' : 'bg-green-500/10'}`}>
                <FolderOpen className={`h-5 w-5 ${isProcessing ? 'text-primary' : 'text-green-500'}`} />
              </div>
              {isProcessing ? 'Extracting Files' : 'Extraction Complete'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {isProcessing && (
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-medium tabular-nums">{Math.round(progress)}%</span>
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
                      <div key={i} className="flex justify-between text-sm p-2.5 bg-muted/50 rounded-lg">
                        <span className="truncate flex-1 font-medium">{f.name}</span>
                        <span className="text-muted-foreground ml-2 tabular-nums">{formatBytes(f.size)}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
            <Button 
              onClick={() => { setExtractDialogOpen(false); handleClose(); }} 
              className="w-full" 
              disabled={isProcessing}
              variant={isProcessing ? 'outline' : 'default'}
            >
              {isProcessing ? 'Processing...' : 'Done'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

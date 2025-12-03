import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { StorageBar } from '@/components/StorageBar';
import { FileList } from '@/components/FileList';
import { ThemeToggle } from '@/components/ThemeToggle';
import { ShareModal } from '@/components/ShareModal';
import { RenameDialog } from '@/components/RenameDialog';
import { FilePreview } from '@/components/FilePreview';
import { VersionHistory } from '@/components/VersionHistory';
import { EncryptionDialog } from '@/components/EncryptionDialog';
import { BatchActions } from '@/components/BatchActions';
import { SearchFilter } from '@/components/SearchFilter';
import { ZipHandler } from '@/components/ZipHandler';
import { toast } from 'sonner';
import { Upload, Cloud, LogOut, Trash2, ArrowUpDown, Loader2 } from 'lucide-react';
import JSZip from 'jszip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useDropzone } from 'react-dropzone';

// Sanitize filename to remove special characters
const sanitizeFileName = (name: string): string => {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .substring(0, 200);
};

interface Profile {
  storage_used_bytes: number;
  storage_quota_bytes: number;
}

interface FileItem {
  id: string;
  name: string;
  size_bytes: number;
  mime_type: string | null;
  storage_path: string;
  created_at: string;
  is_encrypted?: boolean;
}

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteFileId, setDeleteFileId] = useState<string | null>(null);
  const [shareFileId, setShareFileId] = useState<string | null>(null);
  const [shareDialog, setShareDialog] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [shareToken, setShareToken] = useState('');
  const [renameFileId, setRenameFileId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'size'>('date');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [versionHistoryFileId, setVersionHistoryFileId] = useState<string | null>(null);
  const [encryptFileId, setEncryptFileId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user) return;

    try {
      const [profileRes, filesRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('files').select('*').is('deleted_at', null).order('created_at', { ascending: false })
      ]);

      if (profileRes.error) throw profileRes.error;
      if (filesRes.error) throw filesRes.error;

      setProfile(profileRes.data);
      setFiles(filesRes.data || []);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    
    setUploading(true);

    for (const file of acceptedFiles) {
      try {
        // Check storage quota
        const { data: currentProfile } = await supabase
          .from('profiles')
          .select('storage_used_bytes, storage_quota_bytes')
          .single();

        if (currentProfile && currentProfile.storage_used_bytes + file.size > currentProfile.storage_quota_bytes) {
          toast.error(`Not enough storage space for ${file.name}`);
          continue;
        }

        // Upload file with sanitized name
        const sanitizedName = sanitizeFileName(file.name);
        const filePath = `${user?.id}/${Date.now()}-${sanitizedName}`;
        const { error: uploadError } = await supabase.storage
          .from('user-files')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        // Create database record
        const { error: dbError } = await supabase
          .from('files')
          .insert({
            name: file.name,
            size_bytes: file.size,
            mime_type: file.type,
            storage_path: filePath,
            user_id: user!.id
          });

        if (dbError) throw dbError;
      } catch (error) {
        toast.error(`Failed to upload ${file.name}`);
      }
    }

    setUploading(false);
    await loadData();
    toast.success(`${acceptedFiles.length} file(s) uploaded successfully`);
  }, [user]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    noClick: true,
    noKeyboard: true
  });

  const handleDownload = async (fileId: string) => {
    try {
      const file = files.find(f => f.id === fileId);
      if (!file) return;

      const { data, error } = await supabase.storage
        .from('user-files')
        .createSignedUrl(file.storage_path, 60);

      if (error) throw error;
      
      window.open(data.signedUrl, '_blank');
      toast.success('Opening file...');
    } catch (error: any) {
      toast.error(error.message || 'Failed to download file');
    }
  };

  const handlePreview = async (fileId: string) => {
    try {
      const file = files.find(f => f.id === fileId);
      if (!file) return;

      const { data, error } = await supabase.storage
        .from('user-files')
        .createSignedUrl(file.storage_path, 3600);

      if (error) throw error;
      
      setPreviewFile(file);
      setPreviewUrl(data.signedUrl);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load preview');
    }
  };

  const handleShare = async (fileId: string) => {
    try {
      const { data, error } = await supabase
        .from('shares')
        .insert({ file_id: fileId })
        .select()
        .single();

      if (error) throw error;

      const link = `${window.location.origin}/share/${data.token}`;
      setShareLink(link);
      setShareToken(data.token);
      setShareFileId(fileId);
      setShareDialog(true);
      
      navigator.clipboard.writeText(link);
      toast.success('Share link copied to clipboard!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to create share link');
    }
  };

  const handleUpdateShare = async (expirationDays: number | null, password: string | null) => {
    try {
      const updates: any = {};
      
      if (expirationDays !== null) {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + expirationDays);
        updates.expires_at = expiresAt.toISOString();
      } else {
        updates.expires_at = null;
      }

      if (password) {
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        updates.password_hash = hashHex;
      } else {
        updates.password_hash = null;
      }

      const { error } = await supabase
        .from('shares')
        .update(updates)
        .eq('token', shareToken);

      if (error) throw error;
    } catch (error: any) {
      throw error;
    }
  };

  const handleRename = async (newName: string) => {
    if (!renameFileId) return;

    try {
      const { error } = await supabase
        .from('files')
        .update({ name: newName })
        .eq('id', renameFileId);

      if (error) throw error;

      toast.success('File renamed successfully');
      loadData();
      setRenameFileId(null);
    } catch (error: any) {
      toast.error(error.message || 'Failed to rename file');
      throw error;
    }
  };

  const handleDelete = async () => {
    if (!deleteFileId) return;

    try {
      const { error } = await supabase
        .from('files')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', deleteFileId);

      if (error) throw error;

      toast.success('File moved to trash');
      loadData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to move file to trash');
    } finally {
      setDeleteFileId(null);
    }
  };

  const handleSelectFile = (fileId: string) => {
    setSelectedFiles(prev => 
      prev.includes(fileId) 
        ? prev.filter(id => id !== fileId)
        : [...prev, fileId]
    );
  };

  const handleSelectAll = (selected: boolean) => {
    setSelectedFiles(selected ? filteredAndSortedFiles.map(f => f.id) : []);
  };

  const handleBatchDownload = async () => {
    for (const fileId of selectedFiles) {
      await handleDownload(fileId);
    }
    setSelectedFiles([]);
  };

  const handleBatchShare = async () => {
    if (selectedFiles.length === 1) {
      handleShare(selectedFiles[0]);
    } else {
      toast.info('Batch sharing coming soon');
    }
  };

  const handleBatchDelete = () => {
    if (selectedFiles.length > 0) {
      setDeleteFileId(selectedFiles[0]); // Simplified for now
    }
  };

  const handleExtractZip = async (fileId: string) => {
    const file = files.find(f => f.id === fileId);
    if (!file) return;

    toast.info('Extracting archive...');

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
      let extractedCount = 0;
      
      for (const [relativePath, zipEntry] of entries) {
        if (!zipEntry.dir) {
          const content = await zipEntry.async('blob');
          const fileName = relativePath.split('/').pop() || relativePath;
          const sanitizedName = sanitizeFileName(fileName);
          const storagePath = `${user?.id}/${Date.now()}-${sanitizedName}`;

          const { error: uploadError } = await supabase.storage
            .from('user-files')
            .upload(storagePath, content);

          if (!uploadError) {
            await supabase.from('files').insert({
              user_id: user!.id,
              name: fileName,
              size_bytes: content.size,
              mime_type: getMimeType(fileName),
              storage_path: storagePath
            });
            extractedCount++;
          }
        }
      }

      toast.success(`Extracted ${extractedCount} files!`);
      loadData();
    } catch (error) {
      console.error('Extraction error:', error);
      toast.error('Failed to extract archive');
    }
  };

  // Helper function to get MIME type
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
  };

  const filteredAndSortedFiles = files
    .filter(file => 
      file.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'size':
          return b.size_bytes - a.size_bytes;
        case 'date':
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      {...getRootProps()} 
      className="min-h-screen bg-gradient-to-br from-background to-accent/20"
    >
      <input {...getInputProps()} />
      
      {isDragActive && (
        <div className="fixed inset-0 bg-primary/20 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-card p-8 rounded-lg border-2 border-dashed border-primary">
            <Upload className="h-16 w-16 mx-auto mb-4 text-primary" />
            <p className="text-xl font-medium">Drop files here to upload</p>
          </div>
        </div>
      )}

      {uploading && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-card p-8 rounded-lg shadow-lg">
            <Loader2 className="h-12 w-12 mx-auto mb-4 text-primary animate-spin" />
            <p className="text-lg font-medium">Uploading files...</p>
          </div>
        </div>
      )}

      <header className="border-b bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cloud className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold">CloudStore</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate('/trash')}>
              <Trash2 className="h-4 w-4 mr-2" />
              Trash
            </Button>
            <ThemeToggle />
            <Button variant="ghost" size="icon" onClick={signOut}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="bg-card rounded-lg p-6 shadow-lg">
            <StorageBar
              used={profile?.storage_used_bytes || 0}
              total={profile?.storage_quota_bytes || 107374182400}
            />
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h2 className="text-2xl font-bold">My Files</h2>
            <div className="flex gap-2 w-full sm:w-auto">
              <SearchFilter value={searchQuery} onChange={setSearchQuery} />
              <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                <SelectTrigger className="w-[140px]">
                  <ArrowUpDown className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date">Date</SelectItem>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="size">Size</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={() => navigate('/upload')}>
                <Upload className="h-4 w-4 mr-2" />
                Upload
              </Button>
            </div>
          </div>

          <div className="bg-card rounded-lg p-6 shadow-lg">
            <FileList
              files={filteredAndSortedFiles}
              selectedFiles={selectedFiles}
              onSelectFile={handleSelectFile}
              onSelectAll={handleSelectAll}
              onDownload={handleDownload}
              onShare={handleShare}
              onDelete={(id) => setDeleteFileId(id)}
              onRename={(id) => setRenameFileId(id)}
              onPreview={handlePreview}
              onEncrypt={(id) => setEncryptFileId(id)}
              onVersionHistory={(id) => setVersionHistoryFileId(id)}
              onExtractZip={handleExtractZip}
            />
          </div>
        </div>
      </main>

      {selectedFiles.length > 0 && (
        <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 z-40">
          <ZipHandler 
            files={files.filter(f => selectedFiles.includes(f.id))} 
            userId={user?.id || ''} 
            onFilesExtracted={loadData}
          />
        </div>
      )}

      <BatchActions
        selectedCount={selectedFiles.length}
        onDownload={handleBatchDownload}
        onShare={handleBatchShare}
        onDelete={handleBatchDelete}
        onClear={() => setSelectedFiles([])}
      />

      <AlertDialog open={!!deleteFileId} onOpenChange={() => setDeleteFileId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Move to Trash</AlertDialogTitle>
            <AlertDialogDescription>
              This file will be moved to trash and automatically deleted after 30 days.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Move to Trash</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ShareModal
        open={shareDialog}
        onOpenChange={setShareDialog}
        shareLink={shareLink}
        onUpdateShare={handleUpdateShare}
      />

      <RenameDialog
        open={!!renameFileId}
        onOpenChange={(open) => !open && setRenameFileId(null)}
        currentName={files.find(f => f.id === renameFileId)?.name || ''}
        onRename={handleRename}
      />

      <FilePreview
        file={previewFile}
        downloadUrl={previewUrl}
        open={!!previewFile}
        onClose={() => {
          setPreviewFile(null);
          setPreviewUrl(null);
        }}
        onDownload={() => previewFile && handleDownload(previewFile.id)}
      />

      <VersionHistory
        fileId={versionHistoryFileId}
        fileName={files.find(f => f.id === versionHistoryFileId)?.name || ''}
        open={!!versionHistoryFileId}
        onClose={() => setVersionHistoryFileId(null)}
      />

      <EncryptionDialog
        fileId={encryptFileId}
        fileName={files.find(f => f.id === encryptFileId)?.name || ''}
        isEncrypted={files.find(f => f.id === encryptFileId)?.is_encrypted || false}
        open={!!encryptFileId}
        onClose={() => setEncryptFileId(null)}
        onSuccess={loadData}
      />
    </div>
  );
};

export default Dashboard;

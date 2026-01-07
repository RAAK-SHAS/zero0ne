import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useUploadManager } from '@/contexts/UploadContext';
import { useDownloadManager } from '@/contexts/DownloadContext';
import { useFolders } from '@/hooks/useFolders';
import { useFavorites } from '@/hooks/useFavorites';
import { useActivityLog } from '@/hooks/useActivityLog';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { StorageBar } from '@/components/StorageBar';
import { FileList } from '@/components/FileList';
import { FileGrid } from '@/components/FileGrid';
import { ThemeToggle } from '@/components/ThemeToggle';
import { ShareModal } from '@/components/ShareModal';
import { RenameDialog } from '@/components/RenameDialog';
import { FilePreview } from '@/components/FilePreview';
import { VersionHistory } from '@/components/VersionHistory';
import { EncryptionDialog } from '@/components/EncryptionDialog';
import { BatchActions } from '@/components/BatchActions';
import { SearchFilter } from '@/components/SearchFilter';
import { ZipHandler } from '@/components/ZipHandler';
import { GlobalUploadIndicator } from '@/components/GlobalUploadIndicator';
import { DownloadManager } from '@/components/DownloadManager';
import { UploadQueuePanel } from '@/components/UploadQueuePanel';
import { ResumeUploadDialog } from '@/components/ResumeUploadDialog';
import { CreateFolderDialog } from '@/components/CreateFolderDialog';
import { FolderBreadcrumb } from '@/components/FolderBreadcrumb';
import { FolderGrid } from '@/components/FolderGrid';
import { ViewToggle } from '@/components/ViewToggle';
import { ActivityPanel } from '@/components/ActivityPanel';
import { StorageAnalytics } from '@/components/StorageAnalytics';
import { TagManager } from '@/components/TagManager';
import { toast } from 'sonner';
import { 
  Upload, 
  Cloud, 
  LogOut, 
  Trash2, 
  ArrowUpDown, 
  FolderPlus, 
  Star, 
  BarChart3,
  Activity
} from 'lucide-react';
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useDropzone } from 'react-dropzone';

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
  is_favorite?: boolean;
  tags?: string[];
  folder_id?: string | null;
  user_id: string;
  deleted_at: string | null;
}

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteFileId, setDeleteFileId] = useState<string | null>(null);
  const [deleteFolderId, setDeleteFolderId] = useState<string | null>(null);
  const [shareFileId, setShareFileId] = useState<string | null>(null);
  const [shareDialog, setShareDialog] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [shareToken, setShareToken] = useState('');
  const [renameFileId, setRenameFileId] = useState<string | null>(null);
  const [renameFolderId, setRenameFolderId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'size'>('date');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [versionHistoryFileId, setVersionHistoryFileId] = useState<string | null>(null);
  const [encryptFileId, setEncryptFileId] = useState<string | null>(null);
  const [showUploadQueue, setShowUploadQueue] = useState(false);
  const [resumeUploadId, setResumeUploadId] = useState<string | null>(null);
  const [resumeFileName, setResumeFileName] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [filterFavorites, setFilterFavorites] = useState(false);
  const [filterTag, setFilterTag] = useState<string | null>(null);
  
  const { addFiles, isUploading, uploads, resumeUpload, cancelUpload, getPausedUploadsNeedingFile } = useUploadManager();
  const { downloadFile, downloadMultipleAsZip } = useDownloadManager();
  const { toggleFavorite } = useFavorites();
  const { logActivity } = useActivityLog(user?.id);
  
  const {
    folders,
    currentFolderId,
    setCurrentFolderId,
    createFolder,
    renameFolder,
    deleteFolder,
    moveToFolder,
    getCurrentPath,
    getChildFolders,
  } = useFolders(user?.id);

  useEffect(() => {
    loadData();
  }, [user]);

  // Realtime subscription for file updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('files-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'files',
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newFile = payload.new as FileItem;
            if (newFile.user_id === user.id && !newFile.deleted_at) {
              setFiles(prev => [newFile, ...prev.filter(f => f.id !== newFile.id)]);
            }
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as FileItem;
            if (updated.deleted_at) {
              setFiles(prev => prev.filter(f => f.id !== updated.id));
            } else {
              setFiles(prev => prev.map(f => f.id === updated.id ? updated : f));
            }
          } else if (payload.eventType === 'DELETE') {
            setFiles(prev => prev.filter(f => f.id !== (payload.old as FileItem).id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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

  const handleReselectFile = (uploadId: string, fileName: string) => {
    setResumeUploadId(uploadId);
    setResumeFileName(fileName);
  };

  const handleFileReselected = (uploadId: string, file: File) => {
    resumeUpload(uploadId, file);
    setResumeUploadId(null);
    toast.success('Upload resumed!');
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0 || !user) return;
    addFiles(acceptedFiles, user.id, undefined, currentFolderId || undefined);
    toast.info(`Added ${acceptedFiles.length} file(s) to upload queue`);
  }, [user, addFiles, currentFolderId]);

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
      logActivity('download', 'file', fileId, file.name);
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
      const file = files.find(f => f.id === fileId);
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
      logActivity('share', 'file', fileId, file?.name || null);
      toast.success('Share link copied to clipboard!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to create share link');
    }
  };

  const handleUpdateShare = async (expirationDays: number | null, password: string | null) => {
    try {
      // Use edge function for secure bcrypt password hashing
      const session = await supabase.auth.getSession();
      const accessToken = session.data.session?.access_token;
      
      if (!accessToken) {
        throw new Error('Not authenticated');
      }

      const { data, error } = await supabase.functions.invoke('update-share', {
        body: {
          shareToken,
          password,
          expirationDays
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    } catch (error: any) {
      throw error;
    }
  };

  const handleRename = async (newName: string) => {
    if (!renameFileId) return;

    try {
      const file = files.find(f => f.id === renameFileId);
      const { error } = await supabase
        .from('files')
        .update({ name: newName })
        .eq('id', renameFileId);

      if (error) throw error;

      logActivity('rename', 'file', renameFileId, newName, { oldName: file?.name });
      toast.success('File renamed successfully');
      loadData();
      setRenameFileId(null);
    } catch (error: any) {
      toast.error(error.message || 'Failed to rename file');
      throw error;
    }
  };

  const handleRenameFolder = async (newName: string) => {
    if (!renameFolderId) return;
    await renameFolder(renameFolderId, newName);
    setRenameFolderId(null);
  };

  const handleDelete = async () => {
    if (!deleteFileId) return;

    try {
      const file = files.find(f => f.id === deleteFileId);
      const { error } = await supabase
        .from('files')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', deleteFileId);

      if (error) throw error;

      logActivity('delete', 'file', deleteFileId, file?.name || null);
      toast.success('File moved to trash');
      loadData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to move file to trash');
    } finally {
      setDeleteFileId(null);
    }
  };

  const handleDeleteFolder = async () => {
    if (!deleteFolderId) return;
    await deleteFolder(deleteFolderId);
    setDeleteFolderId(null);
  };

  const handleCreateFolder = async (name: string) => {
    const result = await createFolder(name, currentFolderId);
    if (result) {
      logActivity('folder_create', 'folder', result.id, name);
    }
    return result;
  };

  const handleToggleFavorite = async (fileId: string, current: boolean) => {
    const newState = await toggleFavorite(fileId, current);
    logActivity(newState ? 'favorite' : 'unfavorite', 'file', fileId, files.find(f => f.id === fileId)?.name || null);
    loadData();
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
      setDeleteFileId(selectedFiles[0]);
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
          const sanitizedName = fileName.replace(/[^\w\s.-]/g, '_').replace(/\s+/g, '_').slice(0, 100);
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
              storage_path: storagePath,
              folder_id: currentFolderId,
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

  // Get all unique tags from files
  const allTags = [...new Set(files.flatMap(f => f.tags || []))];

  // Filter and sort files
  const filteredAndSortedFiles = files
    .filter(file => {
      // Filter by current folder
      if (currentFolderId) {
        if (file.folder_id !== currentFolderId) return false;
      } else {
        if (file.folder_id) return false;
      }
      
      // Filter by search
      if (searchQuery && !file.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      
      // Filter by favorites
      if (filterFavorites && !file.is_favorite) return false;
      
      // Filter by tag
      if (filterTag && !(file.tags || []).includes(filterTag)) return false;
      
      return true;
    })
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

  const currentFolders = getChildFolders(currentFolderId);
  const currentPath = getCurrentPath();

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

      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cloud className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold">CloudStore</h1>
          </div>
          <div className="flex items-center gap-2">
            <GlobalUploadIndicator />
            
            {/* Analytics Sheet */}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <BarChart3 className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>Storage Analytics</SheetTitle>
                </SheetHeader>
                <div className="mt-6">
                  <Tabs defaultValue="analytics">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="analytics">
                        <BarChart3 className="h-4 w-4 mr-2" />
                        Storage
                      </TabsTrigger>
                      <TabsTrigger value="activity">
                        <Activity className="h-4 w-4 mr-2" />
                        Activity
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent value="analytics" className="mt-4">
                      <StorageAnalytics userId={user?.id} />
                    </TabsContent>
                    <TabsContent value="activity" className="mt-4">
                      <ActivityPanel userId={user?.id} />
                    </TabsContent>
                  </Tabs>
                </div>
              </SheetContent>
            </Sheet>
            
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

          {/* Folder navigation */}
          {(currentFolderId || folders.length > 0) && (
            <div className="bg-card rounded-lg px-4 py-2 shadow-lg">
              <FolderBreadcrumb path={currentPath} onNavigate={setCurrentFolderId} />
            </div>
          )}

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h2 className="text-2xl font-bold">
              {filterFavorites ? 'Favorites' : 'My Files'}
              {filterTag && <span className="text-primary ml-2">#{filterTag}</span>}
            </h2>
            <div className="flex flex-wrap gap-2 w-full sm:w-auto">
              <SearchFilter value={searchQuery} onChange={setSearchQuery} />
              
              {/* Favorites filter */}
              <Button
                variant={filterFavorites ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterFavorites(!filterFavorites)}
              >
                <Star className={`h-4 w-4 ${filterFavorites ? 'fill-current' : ''}`} />
              </Button>

              {/* Tag filter */}
              {allTags.length > 0 && (
                <Select 
                  value={filterTag || ''} 
                  onValueChange={(v) => setFilterTag(v || null)}
                >
                  <SelectTrigger className="w-[120px]">
                    <SelectValue placeholder="Filter tag" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All tags</SelectItem>
                    {allTags.map(tag => (
                      <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              
              <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                <SelectTrigger className="w-[120px]">
                  <ArrowUpDown className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date">Date</SelectItem>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="size">Size</SelectItem>
                </SelectContent>
              </Select>
              
              <ViewToggle view={viewMode} onChange={setViewMode} />
              
              <Button variant="outline" onClick={() => setShowCreateFolder(true)}>
                <FolderPlus className="h-4 w-4 mr-2" />
                New Folder
              </Button>
              
              <Button onClick={() => navigate('/upload')}>
                <Upload className="h-4 w-4 mr-2" />
                Upload
              </Button>
            </div>
          </div>

          <div className="bg-card rounded-lg p-6 shadow-lg">
            {/* Folders */}
            <FolderGrid
              folders={currentFolders}
              onOpen={setCurrentFolderId}
              onRename={setRenameFolderId}
              onDelete={setDeleteFolderId}
            />
            
            {/* Files */}
            {viewMode === 'list' ? (
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
            ) : (
              <FileGrid
                files={filteredAndSortedFiles}
                selectedFiles={selectedFiles}
                onSelectFile={handleSelectFile}
                onDownload={handleDownload}
                onShare={handleShare}
                onDelete={(id) => setDeleteFileId(id)}
                onRename={(id) => setRenameFileId(id)}
                onPreview={handlePreview}
                onEncrypt={(id) => setEncryptFileId(id)}
                onVersionHistory={(id) => setVersionHistoryFileId(id)}
                onExtractZip={handleExtractZip}
                onToggleFavorite={handleToggleFavorite}
              />
            )}
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

      {/* File Delete Dialog */}
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

      {/* Folder Delete Dialog */}
      <AlertDialog open={!!deleteFolderId} onOpenChange={() => setDeleteFolderId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Folder</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the folder. Files inside will be moved to root.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteFolder}>Delete</AlertDialogAction>
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

      <RenameDialog
        open={!!renameFolderId}
        onOpenChange={(open) => !open && setRenameFolderId(null)}
        currentName={folders.find(f => f.id === renameFolderId)?.name || ''}
        onRename={handleRenameFolder}
      />

      <CreateFolderDialog
        open={showCreateFolder}
        onOpenChange={setShowCreateFolder}
        onCreateFolder={handleCreateFolder}
        parentFolderName={currentPath[currentPath.length - 1]?.name}
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

import { useEffect, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
import { ArchiveManager, isArchiveExtension, ArchivePreviewWrapper } from '@/components/ArchiveManager';
import { GlobalUploadIndicator } from '@/components/GlobalUploadIndicator';
import { DownloadManager } from '@/components/DownloadManager';
import { UploadQueuePanel } from '@/components/UploadQueuePanel';
import { UploadSummary } from '@/components/UploadSummary';
import { ResumeUploadDialog } from '@/components/ResumeUploadDialog';
import { CreateFolderDialog } from '@/components/CreateFolderDialog';
import { FolderBreadcrumb } from '@/components/FolderBreadcrumb';
import { FolderGrid } from '@/components/FolderGrid';
import { ViewToggle } from '@/components/ViewToggle';
import { ActivityPanel } from '@/components/ActivityPanel';
import { StorageAnalytics } from '@/components/StorageAnalytics';
import { TagManager } from '@/components/TagManager';
import { FileTypeFilter, FileTypeCategory, getFileTypeCategory } from '@/components/FileTypeFilter';
import { SortControl, SortConfig } from '@/components/SortControl';
import { AppSidebar } from '@/components/AppSidebar';
import { MobileNav } from '@/components/MobileNav';
import { CommandPalette, useCommandPalette } from '@/components/CommandPalette';
import { GlobalContentSearchDialog, useGlobalContentSearch } from '@/components/GlobalContentSearch';
import { CameraUploadButton } from '@/components/CameraUploadButton';
import { SystemLog, useSystemLog } from '@/components/SystemLog';
import { TerminalPanel } from '@/components/TerminalPanel';
import { useTerminal } from '@/hooks/useTerminal';
import { toast } from 'sonner';
import { FolderLockDialog } from '@/components/FolderLockDialog';
import { PDFEditor } from '@/components/editors/PDFEditor';
import { VideoEditor } from '@/components/editors/VideoEditor';
import { AudioEditor } from '@/components/editors/AudioEditor';
import { ImageEditor } from '@/components/editors/ImageEditor';
import { MarkdownEditor } from '@/components/editors/MarkdownEditor';
import { 
  Upload, Cloud, LogOut, Trash2, FolderPlus, Star, BarChart3,
  Activity, EyeOff, Menu, Terminal, Search
} from 'lucide-react';
import JSZip from 'jszip';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
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
  const [searchParams] = useSearchParams();
  const currentView = searchParams.get('view') || 'files';
  
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
  const [sortConfig, setSortConfig] = useState<SortConfig>({ field: 'date', direction: 'desc' });
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [versionHistoryFileId, setVersionHistoryFileId] = useState<string | null>(null);
  const [encryptFileId, setEncryptFileId] = useState<string | null>(null);
  const [showUploadQueue, setShowUploadQueue] = useState(false);
  const [resumeUploadId, setResumeUploadId] = useState<string | null>(null);
  const [resumeFileName, setResumeFileName] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>(() => {
    if (typeof window === 'undefined') return 'list';
    const saved = localStorage.getItem('cloudstore-view-mode');
    return saved === 'grid' ? 'grid' : 'list';
  });
  useEffect(() => {
    localStorage.setItem('cloudstore-view-mode', viewMode);
  }, [viewMode]);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [filterFavorites, setFilterFavorites] = useState(false);
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<FileTypeCategory>('all');
  const [previewArchiveFile, setPreviewArchiveFile] = useState<FileItem | null>(null);
  const [editFile, setEditFile] = useState<FileItem | null>(null);
  const [editFileUrl, setEditFileUrl] = useState<string | null>(null);
  const [editType, setEditType] = useState<'pdf' | 'video' | 'audio' | 'image' | 'markdown' | null>(null);
  
  const { addFiles, isUploading, uploads, resumeUpload, cancelUpload, getPausedUploadsNeedingFile } = useUploadManager();
  const { downloadFile, downloadMultipleAsZip } = useDownloadManager();
  const { toggleFavorite } = useFavorites();
  const { logActivity } = useActivityLog(user?.id);
  const { open: cmdOpen, setOpen: setCmdOpen } = useCommandPalette();
  const { open: contentSearchOpen, setOpen: setContentSearchOpen } = useGlobalContentSearch();
  const { logs: systemLogs, addLog } = useSystemLog();
  
  const {
    folders,
    currentFolderId,
    setCurrentFolderId,
    showHidden,
    setShowHidden,
    createFolder,
    renameFolder,
    deleteFolder,
    toggleHidden,
    markUnlocked,
    isFolderUnlocked,
    moveToFolder,
    getCurrentPath,
    getChildFolders,
  } = useFolders(user?.id);

  // Terminal state
  const [terminalOpen, setTerminalOpen] = useState(false);

  // Folder lock dialog state
  const [lockFolderId, setLockFolderId] = useState<string | null>(null);
  const [lockAction, setLockAction] = useState<'lock' | 'unlock' | 'remove_lock' | 'change_password'>('lock');

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
        .createSignedUrl(file.storage_path, 3600, {
          download: false,
        });

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
        .select('id, file_id, token, expires_at, created_at')
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
      logActivity('folder_create', 'folder', null, name);
    }
    return result;
  };

  const terminal = useTerminal(user?.id, files, folders, {
    onNavigateFolder: setCurrentFolderId,
    onDownload: handleDownload,
    onPreview: handlePreview,
    onShare: handleShare,
    onDelete: (id: string) => setDeleteFileId(id),
    onRename: (id: string) => setRenameFileId(id),
    onCreateFolder: handleCreateFolder,
    onDeleteFolder: (id: string) => setDeleteFolderId(id),
    onUploadClick: () => navigate('/upload'),
    refreshData: loadData,
  });

  useEffect(() => {
    terminal.syncFolderState(currentFolderId);
  }, [currentFolderId, terminal.syncFolderState]);

  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => {
      if (e.ctrlKey && e.key === '`') {
        e.preventDefault();
        setTerminalOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

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

  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  const handleBatchDownloadZip = async () => {
    if (selectedFiles.length === 0) return;
    const sel = files.filter(f => selectedFiles.includes(f.id));
    if (sel.length === 1) {
      await handleDownload(sel[0].id);
      return;
    }
    toast.info(`Packaging ${sel.length} files…`);
    try {
      const zip = new JSZip();
      for (const file of sel) {
        const { data: signed, error } = await supabase.storage
          .from('user-files')
          .createSignedUrl(file.storage_path, 120);
        if (error || !signed) continue;
        const res = await fetch(signed.signedUrl);
        if (!res.ok) continue;
        zip.file(file.name, await res.blob());
      }
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cloudstore-${Date.now()}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Downloaded ${sel.length} files as ZIP`);
      setSelectedFiles([]);
    } catch (e: any) {
      toast.error(e.message || 'ZIP download failed');
    }
  };

  const handleBatchShare = async () => {
    if (selectedFiles.length === 0) return;
    if (selectedFiles.length === 1) {
      handleShare(selectedFiles[0]);
      return;
    }
    // Create a share link for each selected file and copy them all to clipboard
    try {
      const links: string[] = [];
      for (const fileId of selectedFiles) {
        const { data, error } = await supabase
          .from('shares')
          .insert({ file_id: fileId })
          .select('token')
          .single();
        if (!error && data) links.push(`${window.location.origin}/share/${data.token}`);
      }
      await navigator.clipboard.writeText(links.join('\n'));
      toast.success(`Created ${links.length} share links · copied to clipboard`);
      setSelectedFiles([]);
    } catch (e: any) {
      toast.error(e.message || 'Batch share failed');
    }
  };

  const handleBatchDelete = () => {
    if (selectedFiles.length === 0) return;
    setBulkDeleteOpen(true);
  };

  const confirmBatchDelete = async () => {
    try {
      const { error } = await supabase
        .from('files')
        .update({ deleted_at: new Date().toISOString() })
        .in('id', selectedFiles);
      if (error) throw error;
      logActivity('delete', 'file', null, `Deleted ${selectedFiles.length} files`);
      toast.success(`Moved ${selectedFiles.length} files to trash`);
      setSelectedFiles([]);
      loadData();
    } catch (e: any) {
      toast.error(e.message || 'Bulk delete failed');
    } finally {
      setBulkDeleteOpen(false);
    }
  };

  const handleBatchMove = async (folderId: string | null) => {
    if (selectedFiles.length === 0) return;
    try {
      await moveToFolder(selectedFiles, folderId);
      logActivity('move', 'file', null, `Moved ${selectedFiles.length} files`);
      toast.success(`Moved ${selectedFiles.length} files`);
      setSelectedFiles([]);
      loadData();
    } catch (e: any) {
      toast.error(e.message || 'Move failed');
    }
  };

  const handleEdit = async (fileId: string) => {
    const file = files.find(f => f.id === fileId);
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const mime = file.mime_type || '';

    let type: 'pdf' | 'video' | 'audio' | 'image' | 'markdown' | null = null;
    if (mime.includes('pdf') || ext === 'pdf') type = 'pdf';
    else if (mime.startsWith('video/') || ['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext)) type = 'video';
    else if (mime.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'flac', 'aac', 'wma'].includes(ext)) type = 'audio';
    else if (mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext)) type = 'image';
    else if (['md', 'txt', 'markdown'].includes(ext)) type = 'markdown';

    if (!type) {
      toast.error('No editor available for this file type');
      return;
    }

    try {
      const { data, error } = await supabase.storage
        .from('user-files')
        .createSignedUrl(file.storage_path, 3600, { download: false });
      if (error) throw error;

      setEditFile(file);
      setEditFileUrl(data.signedUrl);
      setEditType(type);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load file for editing');
    }
  };

  const handleExtractZip = async (fileId: string) => {
    const file = files.find(f => f.id === fileId);
    if (!file) return;

    if (isArchiveExtension(file.name)) {
      setPreviewArchiveFile(file);
    } else {
      toast.error('Not a supported archive format');
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

  // Calculate file type counts for filter
  const fileTypeCounts = useMemo(() => {
    const counts: Record<FileTypeCategory, number> = {
      all: 0,
      images: 0,
      videos: 0,
      documents: 0,
      audio: 0,
      archives: 0,
      code: 0,
      other: 0,
    };
    
    files.forEach(file => {
      if (currentFolderId) {
        if (file.folder_id !== currentFolderId) return;
      } else {
        if (file.folder_id) return;
      }
      
      const category = getFileTypeCategory(file.name, file.mime_type);
      counts[category]++;
      counts.all++;
    });
    
    return counts;
  }, [files, currentFolderId]);

  // Filter and sort files
  const filteredAndSortedFiles = useMemo(() => {
    let baseFiles = files;

    // Apply view-specific filters
    if (currentView === 'recent') {
      // Show files from last 7 days, sorted by date
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      baseFiles = files.filter(f => new Date(f.created_at) >= sevenDaysAgo);
    } else if (currentView === 'shared') {
      // For now, show files that have been shared (we'd need to query shares table)
      // This is a simplified version - show all files as a placeholder
      baseFiles = files;
    }

    return baseFiles
      .filter(file => {
        // Only apply folder filter in main files view
        if (currentView === 'files') {
          if (currentFolderId) {
            if (file.folder_id !== currentFolderId) return false;
          } else {
            if (file.folder_id) return false;
          }
        }
        
        // Filter by search
        if (searchQuery && !file.name.toLowerCase().includes(searchQuery.toLowerCase())) {
          return false;
        }
        
        // Filter by favorites
        if (filterFavorites && !file.is_favorite) return false;
        
        // Filter by tag
        if (filterTag && !(file.tags || []).includes(filterTag)) return false;
        
        // Filter by file type
        if (filterType !== 'all') {
          const category = getFileTypeCategory(file.name, file.mime_type);
          if (category !== filterType) return false;
        }
        
        return true;
      })
      .sort((a, b) => {
        const { field, direction } = sortConfig;
        let comparison = 0;
        
        switch (field) {
          case 'name':
            comparison = a.name.localeCompare(b.name);
            break;
          case 'size':
            comparison = a.size_bytes - b.size_bytes;
            break;
          case 'date':
          default:
            comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        }
        
        return direction === 'asc' ? comparison : -comparison;
      });
  }, [files, currentFolderId, searchQuery, filterFavorites, filterTag, filterType, sortConfig, currentView]);

  const currentFolders = getChildFolders(currentFolderId);
  const currentPath = getCurrentPath();
  const recentCount = useMemo(() => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    return files.filter(f => new Date(f.created_at) >= sevenDaysAgo).length;
  }, [files]);
  const quickTypeCounts = useMemo(() => ({
    images: files.filter(f => getFileTypeCategory(f.name, f.mime_type) === 'images').length,
    documents: files.filter(f => getFileTypeCategory(f.name, f.mime_type) === 'documents').length,
    code: files.filter(f => /\.(js|ts|jsx|tsx|py|java|cpp|c|go|rs|md|json|yml|yaml|html|css|sql|ipynb)$/i.test(f.name)).length,
  }), [files]);

  const viewTitle = currentView === 'recent' ? 'Recent Files' : currentView === 'shared' ? 'Shared Files' : filterFavorites ? 'Favorites' : 'My Files';

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
    <div className="relative flex h-screen bg-background">
      <div className="pointer-events-none fixed inset-0" style={{
        backgroundImage: `linear-gradient(hsl(var(--primary) / 0.04) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary) / 0.04) 1px, transparent 1px)`,
        backgroundSize: '72px 72px',
        maskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.35), rgba(0,0,0,0.05))',
      }} />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top,_hsl(var(--primary)/0.08),_transparent_42%)] opacity-70" />
      {/* Sidebar - desktop */}
      <AppSidebar
        storageUsed={profile?.storage_used_bytes || 0}
        storageTotal={profile?.storage_quota_bytes || 109951162777600}
        onUploadClick={() => navigate('/upload')}
        onNewFolderClick={() => setShowCreateFolder(true)}
        recentCount={recentCount}
        sharedCount={0}
        typeCounts={quickTypeCounts}
        onQuickFilterClick={(filter) => {
          setCurrentFolderId(null);
          setFilterFavorites(false);
          setFilterType(filter === 'code' ? 'code' : filter);
          setSearchQuery('');
        }}
      />

      {/* Main content */}
      <div
        {...getRootProps()}
        className="flex-1 flex flex-col min-h-0 overflow-hidden"
      >
        <input {...getInputProps()} />
        
        {isDragActive && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/45 backdrop-blur-sm">
            <div className="rounded-xl border-2 border-dashed border-primary bg-card px-10 py-12 text-center shadow-2xl">
              <Upload className="h-16 w-16 mx-auto mb-4 text-primary" />
              <p className="text-xl font-semibold">Drop files to upload</p>
              <p className="mt-2 text-sm text-muted-foreground">They’ll be added to the queue immediately.</p>
            </div>
          </div>
        )}

        {/* Mobile header */}
        <header className="md:hidden border-b border-border glass sticky top-0 z-40">
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cloud className="h-6 w-6 text-primary" />
              <h1 className="text-lg font-bold">CloudStore</h1>
            </div>
            <div className="flex items-center gap-1">
              <GlobalUploadIndicator />
              <Button variant="ghost" size="icon" onClick={() => setCmdOpen(true)}><Search className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" onClick={signOut}><LogOut className="h-4 w-4" /></Button>
            </div>
          </div>
        </header>

        {/* Desktop header bar */}
        <header className="hidden md:flex sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-xl">
          <div className="flex-1 px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div>
                <h1 className="text-xl font-semibold">{viewTitle}</h1>
                <p className="text-sm text-muted-foreground">
                  {filteredAndSortedFiles.length} item{filteredAndSortedFiles.length !== 1 ? 's' : ''}
                  {currentFolders.length > 0 ? ` · ${currentFolders.length} folder${currentFolders.length !== 1 ? 's' : ''}` : ''}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setCmdOpen(true)} className="border-border/70 bg-card/50 text-xs gap-2 hover:bg-accent/50">
                <Search className="h-3 w-3" />
                <span className="hidden lg:inline">Search</span>
                <kbd className="hidden lg:inline h-4 px-1 rounded bg-muted border border-border text-[9px]">⌘K</kbd>
              </Button>
              <Button variant="outline" size="sm" onClick={() => setTerminalOpen(true)} className="border-border/70 bg-card/50 text-xs gap-2 hover:bg-accent/50">
                <Terminal className="h-3.5 w-3.5" />
                <span className="hidden lg:inline">Advanced Terminal</span>
              </Button>
              <GlobalUploadIndicator />
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon"><BarChart3 className="h-5 w-5" /></Button>
                </SheetTrigger>
                <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
                  <SheetHeader><SheetTitle>Storage Analytics</SheetTitle></SheetHeader>
                  <div className="mt-6">
                    <Tabs defaultValue="analytics">
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="analytics"><BarChart3 className="h-4 w-4 mr-2" />Storage</TabsTrigger>
                        <TabsTrigger value="activity"><Activity className="h-4 w-4 mr-2" />Activity</TabsTrigger>
                      </TabsList>
                      <TabsContent value="analytics" className="mt-4"><StorageAnalytics userId={user?.id} /></TabsContent>
                      <TabsContent value="activity" className="mt-4"><ActivityPanel userId={user?.id} /></TabsContent>
                    </Tabs>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto pb-20 md:pb-6">
          <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 space-y-6">
            {/* Storage bar - mobile only */}
            <div className="rounded-lg border border-border/70 bg-card/65 p-4 md:hidden">
              <StorageBar used={profile?.storage_used_bytes || 0} total={profile?.storage_quota_bytes || 109951162777600} />
            </div>

            {currentView === 'files' && (currentFolderId || folders.length > 0) && (
              <div className="rounded-lg border border-border/70 bg-card/70 px-4 py-2.5 shadow-sm">
                <FolderBreadcrumb path={currentPath} onNavigate={setCurrentFolderId} />
              </div>
            )}

            {/* Toolbar */}
            <div className="space-y-4">
              <h2 className="text-2xl font-bold md:hidden">
                {viewTitle}
                {filterTag && <span className="text-primary ml-2">#{filterTag}</span>}
              </h2>
              
              <div className="rounded-xl border border-border/70 bg-card/75 p-3 shadow-sm">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                  <div className="flex flex-1 flex-col gap-3 lg:flex-row lg:items-center">
                <SearchFilter value={searchQuery} onChange={setSearchQuery} />
                
                {/* Quick action buttons */}
                <div className="flex items-center gap-1 rounded-lg border border-border/70 bg-background/40 p-0.5">
                  <button
                    onClick={() => setFilterFavorites(!filterFavorites)}
                    className={`flex items-center justify-center h-8 w-8 rounded-md transition-all duration-200 ${
                      filterFavorites 
                        ? 'bg-primary/10 text-primary shadow-sm shadow-primary/10' 
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    }`}
                    title="Favorites"
                  >
                    <Star className={`h-3.5 w-3.5 ${filterFavorites ? 'fill-current' : ''}`} />
                  </button>

                  {currentView === 'files' && (
                    <button
                      onClick={() => setShowHidden(!showHidden)}
                      className={`flex items-center justify-center h-8 w-8 rounded-md transition-all duration-200 ${
                        showHidden
                          ? 'bg-primary/10 text-primary shadow-sm shadow-primary/10'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                      }`}
                      title={showHidden ? "Hide hidden folders" : "Show hidden folders"}
                    >
                      <EyeOff className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                  <div className="hidden h-8 w-px bg-border/70 lg:block" />

                {/* Tag filter */}
                {allTags.length > 0 && (
                  <Select 
                    value={filterTag || '__all_tags'} 
                    onValueChange={(v) => setFilterTag(v === '__all_tags' ? null : v)}
                  >
                    <SelectTrigger className="h-9 w-[140px] bg-background/50 text-xs border-border/70">
                      <SelectValue placeholder="Tags" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all_tags">All tags</SelectItem>
                      {allTags.map(tag => (
                        <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                
                <FileTypeFilter 
                  value={filterType} 
                  onChange={setFilterType} 
                  fileCounts={fileTypeCounts}
                />
                
                <SortControl value={sortConfig} onChange={setSortConfig} />
                  </div>

                  <div className="flex items-center justify-between gap-3 xl:justify-end">
                    <div className="text-xs text-muted-foreground">
                      Live results update as you type
                    </div>
                  <ViewToggle view={viewMode} onChange={setViewMode} />
                  
                  {/* Mobile-only action buttons */}
                  <div className="flex gap-1.5 md:hidden">
                    <Button variant="outline" size="sm" onClick={() => setShowCreateFolder(true)} className="h-9 w-9 p-0">
                      <FolderPlus className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" onClick={() => navigate('/upload')} className="h-9 w-9 p-0">
                      <Upload className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                </div>
              </div>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={currentView}
                initial={{ opacity: 0, x: 40, scale: 0.98 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -40, scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30, mass: 0.8 }}
                className="rounded-xl border border-border/70 bg-card/85 p-4 shadow-lg md:p-6"
              >
                {/* Folders - only in files view */}
                {currentView === 'files' && (
                  <FolderGrid
                    folders={currentFolders}
                    onOpen={(id) => {
                      const folder = folders.find(f => f.id === id);
                      if (folder?.is_locked && !isFolderUnlocked(id)) {
                        setLockFolderId(id);
                        setLockAction('unlock');
                      } else {
                        setCurrentFolderId(id);
                      }
                    }}
                    onRename={setRenameFolderId}
                    onDelete={setDeleteFolderId}
                    onToggleHidden={toggleHidden}
                    onLock={(id) => { setLockFolderId(id); setLockAction('lock'); }}
                    onUnlock={(id) => { setLockFolderId(id); setLockAction('unlock'); }}
                    onRemoveLock={(id) => { setLockFolderId(id); setLockAction('remove_lock'); }}
                    onChangePassword={(id) => { setLockFolderId(id); setLockAction('change_password'); }}
                    isFolderUnlocked={isFolderUnlocked}
                    onDropFiles={async (fileIds, folderId) => {
                      await moveToFolder(fileIds, folderId);
                      logActivity('move', 'file', null, `Moved ${fileIds.length} file(s)`);
                      loadData();
                    }}
                  />
                )}
                
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
                    onToggleFavorite={handleToggleFavorite}
                    onEdit={handleEdit}
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
                    onEdit={handleEdit}
                  />
                )}
              </motion.div>
            </AnimatePresence>

            {/* System Log */}
            <SystemLog logs={systemLogs} />
          </div>
        </main>

        <MobileNav />
      </div>

      {/* Command Palette */}
      <CommandPalette open={cmdOpen} onOpenChange={setCmdOpen} onSearch={setSearchQuery} />
      <GlobalContentSearchDialog
        open={contentSearchOpen}
        onOpenChange={setContentSearchOpen}
        files={files}
        onOpenFile={handlePreview}
      />

      {/* Terminal Panel */}
      <TerminalPanel
        lines={terminal.lines}
        isProcessing={terminal.isProcessing}
        onExecute={terminal.executeCommand}
        getAutocomplete={terminal.getAutocomplete}
        commandHistory={terminal.commandHistory}
        historyIndex={terminal.historyIndex}
        setHistoryIndex={terminal.setHistoryIndex}
        isOpen={terminalOpen}
        onToggle={() => setTerminalOpen(prev => !prev)}
      />

      {selectedFiles.length > 0 && (
        <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 z-40">
          <ArchiveManager 
            files={files.filter(f => selectedFiles.includes(f.id))} 
            userId={user?.id || ''} 
            onFilesExtracted={loadData}
            userQuotaBytes={profile?.storage_quota_bytes}
            userUsedBytes={profile?.storage_used_bytes}
          />
        </div>
      )}
      
      {/* Archive Preview Manager */}
      {previewArchiveFile && (
        <ArchivePreviewWrapper
          file={previewArchiveFile}
          userId={user?.id || ''}
          onClose={() => setPreviewArchiveFile(null)}
          onFilesExtracted={loadData}
          userQuotaBytes={profile?.storage_quota_bytes}
          userUsedBytes={profile?.storage_used_bytes}
        />
      )}

      {/* Upload Summary */}
      <UploadSummary onOpenQueue={() => setShowUploadQueue(true)} />

      <UploadQueuePanel
        isOpen={showUploadQueue}
        onClose={() => setShowUploadQueue(false)}
        onReselectFile={handleReselectFile}
      />

      <ResumeUploadDialog
        open={!!resumeUploadId}
        onOpenChange={(open) => {
          if (!open) setResumeUploadId(null);
        }}
        uploadId={resumeUploadId || ''}
        fileName={resumeFileName}
        onFileSelected={handleFileReselected}
        onCancel={() => {
          if (resumeUploadId) cancelUpload(resumeUploadId);
          setResumeUploadId(null);
        }}
      />

      <BatchActions
        selectedCount={selectedFiles.length}
        folders={folders}
        currentFolderId={currentFolderId}
        onDownloadZip={handleBatchDownloadZip}
        onShareZip={handleBatchShare}
        onDelete={handleBatchDelete}
        onMove={handleBatchMove}
        onClear={() => setSelectedFiles([])}
      />

      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedFiles.length} files?</AlertDialogTitle>
            <AlertDialogDescription>
              They will be moved to Trash and permanently removed after 30 days.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmBatchDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Move to Trash
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
        livePath={files.find(f => f.id === versionHistoryFileId)?.storage_path}
        open={!!versionHistoryFileId}
        onClose={() => setVersionHistoryFileId(null)}
        onRestored={loadData}
      />

      <EncryptionDialog
        fileId={encryptFileId}
        fileName={files.find(f => f.id === encryptFileId)?.name || ''}
        storagePath={files.find(f => f.id === encryptFileId)?.storage_path}
        isEncrypted={files.find(f => f.id === encryptFileId)?.is_encrypted || false}
        open={!!encryptFileId}
        onClose={() => setEncryptFileId(null)}
        onSuccess={loadData}
      />

      <FolderLockDialog
        open={!!lockFolderId}
        onOpenChange={(open) => { if (!open) setLockFolderId(null); }}
        folderId={lockFolderId}
        folderName={folders.find(f => f.id === lockFolderId)?.name || ''}
        isLocked={folders.find(f => f.id === lockFolderId)?.is_locked || false}
        action={lockAction}
        onSuccess={() => {
          if (lockAction === 'unlock' && lockFolderId) {
            markUnlocked(lockFolderId);
            setCurrentFolderId(lockFolderId);
          }
          loadData();
        }}
      />

      {/* Editors */}
      <PDFEditor
        file={editType === 'pdf' ? editFile : null}
        fileUrl={editType === 'pdf' ? editFileUrl : null}
        open={editType === 'pdf'}
        onClose={() => { setEditFile(null); setEditFileUrl(null); setEditType(null); }}
        onSaved={loadData}
      />
      <VideoEditor
        file={editType === 'video' ? editFile : null}
        fileUrl={editType === 'video' ? editFileUrl : null}
        open={editType === 'video'}
        onClose={() => { setEditFile(null); setEditFileUrl(null); setEditType(null); }}
        onSaved={loadData}
      />
      <AudioEditor
        file={editType === 'audio' ? editFile : null}
        fileUrl={editType === 'audio' ? editFileUrl : null}
        open={editType === 'audio'}
        onClose={() => { setEditFile(null); setEditFileUrl(null); setEditType(null); }}
        onSaved={loadData}
      />
      <ImageEditor
        file={editType === 'image' ? editFile : null}
        fileUrl={editType === 'image' ? editFileUrl : null}
        open={editType === 'image'}
        onClose={() => { setEditFile(null); setEditFileUrl(null); setEditType(null); }}
        onSaved={loadData}
      />
      <MarkdownEditor
        file={editType === 'markdown' ? editFile : null}
        fileUrl={editType === 'markdown' ? editFileUrl : null}
        open={editType === 'markdown'}
        onClose={() => { setEditFile(null); setEditFileUrl(null); setEditType(null); }}
        onSaved={loadData}
      />
    </div>
  );
};

export default Dashboard;

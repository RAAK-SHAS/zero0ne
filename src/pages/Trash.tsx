import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Trash2, RotateCcw, X, AlertTriangle } from 'lucide-react';
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
import { AppSidebar } from '@/components/AppSidebar';
import { MobileNav } from '@/components/MobileNav';
import { FileIcon } from '@/components/FileIcon';
import { formatBytes } from '@/lib/utils';
import { format } from 'date-fns';

interface FileItem {
  id: string;
  name: string;
  size_bytes: number;
  mime_type: string | null;
  storage_path: string;
  created_at: string;
  deleted_at: string;
}

const Trash = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteFileId, setDeleteFileId] = useState<string | null>(null);
  const [profile, setProfile] = useState<{ storage_used_bytes: number; storage_quota_bytes: number } | null>(null);

  useEffect(() => {
    loadFiles();
    if (user) {
      supabase.from('profiles').select('storage_used_bytes, storage_quota_bytes').eq('id', user.id).single().then(({ data }) => {
        if (data) setProfile(data);
      });
    }
  }, [user]);

  const loadFiles = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('files')
        .select('*')
        .eq('user_id', user.id)
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false });
      if (error) throw error;
      setFiles(data || []);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load trash');
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (fileId: string) => {
    try {
      const { error } = await supabase.from('files').update({ deleted_at: null }).eq('id', fileId);
      if (error) throw error;
      toast.success('File restored');
      loadFiles();
    } catch (error: any) {
      toast.error(error.message || 'Failed to restore file');
    }
  };

  const handleDeletePermanently = async () => {
    if (!deleteFileId) return;
    try {
      const file = files.find(f => f.id === deleteFileId);
      if (!file) return;
      const { error: storageError } = await supabase.storage.from('user-files').remove([file.storage_path]);
      if (storageError) throw storageError;
      const { error: dbError } = await supabase.from('files').delete().eq('id', deleteFileId);
      if (dbError) throw dbError;
      toast.success('File permanently deleted');
      loadFiles();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete file');
    } finally {
      setDeleteFileId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent mx-auto"></div>
          <p className="mt-3 text-sm text-muted-foreground">Loading trash...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      <AppSidebar
        storageUsed={profile?.storage_used_bytes || 0}
        storageTotal={profile?.storage_quota_bytes || 109951162777600}
        onUploadClick={() => navigate('/upload')}
        onNewFolderClick={() => navigate('/dashboard')}
      />

      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Mobile header */}
        <header className="md:hidden border-b border-border/60 bg-card/95 glass px-4 py-3 flex items-center gap-3">
          <Trash2 className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold">Trash</h1>
        </header>

        {/* Desktop header */}
        <header className="hidden md:flex border-b border-border/60 bg-card/50 glass h-14 items-center px-6">
          <h2 className="text-lg font-semibold">Trash</h2>
        </header>

        <main className="flex-1 overflow-y-auto pb-20 md:pb-6">
          <div className="max-w-4xl mx-auto px-4 md:px-6 py-6">
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl mb-6 text-sm text-muted-foreground">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Files in trash are automatically deleted after 30 days
            </div>

            <div className="bg-card rounded-xl border border-border/60 overflow-hidden">
              {files.length === 0 ? (
                <div className="text-center py-20">
                  <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
                    <Trash2 className="h-8 w-8 text-muted-foreground/50" />
                  </div>
                  <p className="text-muted-foreground font-medium">Trash is empty</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Deleted files will appear here</p>
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {files.map((file) => (
                    <div key={file.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="h-10 w-10 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
                          <FileIcon fileName={file.name} mimeType={file.mime_type} storagePath={file.storage_path} className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm truncate">{file.name}</p>
                          <div className="flex gap-2 text-xs text-muted-foreground">
                            <span className="tabular-nums">{formatBytes(file.size_bytes)}</span>
                            <span className="text-border">·</span>
                            <span>Deleted {format(new Date(file.deleted_at), 'MMM d, yyyy')}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1.5 shrink-0 ml-3">
                        <Button variant="outline" size="sm" onClick={() => handleRestore(file.id)} className="h-8 text-xs">
                          <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Restore
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => setDeleteFileId(file.id)} className="h-8 text-xs">
                          <X className="h-3.5 w-3.5 mr-1.5" /> Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </main>

        <MobileNav />
      </div>

      <AlertDialog open={!!deleteFileId} onOpenChange={() => setDeleteFileId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Permanently</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone. The file will be permanently removed.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePermanently}>Delete Permanently</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Trash;

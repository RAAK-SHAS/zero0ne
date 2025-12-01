import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { StorageBar } from '@/components/StorageBar';
import { FileList } from '@/components/FileList';
import { ThemeToggle } from '@/components/ThemeToggle';
import { toast } from 'sonner';
import { Upload, Cloud, LogOut } from 'lucide-react';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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
}

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteFileId, setDeleteFileId] = useState<string | null>(null);
  const [shareDialog, setShareDialog] = useState(false);
  const [shareLink, setShareLink] = useState('');

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user) return;

    try {
      const [profileRes, filesRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('files').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
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
      setShareDialog(true);
      
      navigator.clipboard.writeText(link);
      toast.success('Share link copied to clipboard!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to create share link');
    }
  };

  const handleDelete = async () => {
    if (!deleteFileId) return;

    try {
      const file = files.find(f => f.id === deleteFileId);
      if (!file) return;

      const { error: storageError } = await supabase.storage
        .from('user-files')
        .remove([file.storage_path]);

      if (storageError) throw storageError;

      const { error: dbError } = await supabase
        .from('files')
        .delete()
        .eq('id', deleteFileId);

      if (dbError) throw dbError;

      toast.success('File deleted successfully');
      loadData();
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-accent/20">
      <header className="border-b bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cloud className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold">CloudStore</h1>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="ghost" size="icon" onClick={signOut}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="bg-card rounded-lg p-6 shadow-lg">
            <StorageBar
              used={profile?.storage_used_bytes || 0}
              total={profile?.storage_quota_bytes || 10737418240}
            />
          </div>

          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">My Files</h2>
            <Button onClick={() => navigate('/upload')}>
              <Upload className="h-4 w-4 mr-2" />
              Upload File
            </Button>
          </div>

          <div className="bg-card rounded-lg p-6 shadow-lg">
            <FileList
              files={files}
              onDownload={handleDownload}
              onShare={handleShare}
              onDelete={(id) => setDeleteFileId(id)}
            />
          </div>
        </div>
      </main>

      <AlertDialog open={!!deleteFileId} onOpenChange={() => setDeleteFileId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete File</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this file? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={shareDialog} onOpenChange={setShareDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share File</DialogTitle>
            <DialogDescription>
              Anyone with this link can download the file
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Share Link</Label>
            <Input value={shareLink} readOnly onClick={(e) => e.currentTarget.select()} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Dashboard;
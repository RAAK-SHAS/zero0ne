import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { StorageBar } from '@/components/StorageBar';
import { FileList } from '@/components/FileList';
import { ThemeToggle } from '@/components/ThemeToggle';
import { ShareModal } from '@/components/ShareModal';
import { RenameDialog } from '@/components/RenameDialog';
import { toast } from 'sonner';
import { Upload, Cloud, LogOut, Trash2, ArrowUpDown } from 'lucide-react';
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
  const [shareToken, setShareToken] = useState('');
  const [renameFileId, setRenameFileId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'size'>('date');

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
      setShareToken(data.token);
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
        // Hash password using Web Crypto API
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

  const sortedFiles = [...files].sort((a, b) => {
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
    <div className="min-h-screen bg-gradient-to-br from-background to-accent/20">
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
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="bg-card rounded-lg p-6 shadow-lg">
            <StorageBar
              used={profile?.storage_used_bytes || 0}
              total={profile?.storage_quota_bytes || 10737418240}
            />
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h2 className="text-2xl font-bold">My Files</h2>
            <div className="flex gap-2 w-full sm:w-auto">
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
              <Button onClick={() => navigate('/upload')} className="flex-1 sm:flex-none">
                <Upload className="h-4 w-4 mr-2" />
                Upload File
              </Button>
            </div>
          </div>

          <div className="bg-card rounded-lg p-6 shadow-lg">
            <FileList
              files={sortedFiles}
              onDownload={handleDownload}
              onShare={handleShare}
              onDelete={(id) => setDeleteFileId(id)}
              onRename={(id) => setRenameFileId(id)}
            />
          </div>
        </div>
      </main>

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
    </div>
  );
};

export default Dashboard;
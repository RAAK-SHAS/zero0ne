import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Download, Cloud, Lock } from 'lucide-react';
import { FileIcon } from '@/components/FileIcon';
import { formatBytes } from '@/lib/utils';
import { format } from 'date-fns';

interface FileData {
  id: string;
  name: string;
  size_bytes: number;
  mime_type: string | null;
  storage_path: string;
  created_at: string;
}

const Share = () => {
  const { token } = useParams();
  const [file, setFile] = useState<FileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [passwordRequired, setPasswordRequired] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token || token.trim().length < 10) {
      setError('invalid');
      setLoading(false);
      return;
    }
    loadFile();
  }, [token]);

  const loadFile = async (pwd?: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('get-shared-file', {
        body: { token, password: pwd }
      });

      if (error) {
        if (error.message.includes('Password required') || error.message.includes('Incorrect password')) {
          setPasswordRequired(true);
          if (pwd) {
            setError('Incorrect password');
          }
          return;
        }
        throw error;
      }

      if (data?.file) {
        setFile(data.file);
        setPasswordRequired(false);
        setError('');
      } else if (data?.error === 'Share link has expired') {
        setError('expired');
      } else {
        throw new Error('Invalid or expired share link');
      }
    } catch (error: any) {
      if (error.message.includes('expired')) {
        setError('expired');
      } else {
        toast.error(error.message || 'Failed to load file');
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    loadFile(password);
  };

  const handleDownload = async () => {
    if (!file) return;

    setDownloading(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-shared-file', {
        body: { token, password }
      });

      if (error) throw error;

      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
        toast.success('Opening file...');
      } else {
        throw new Error('Failed to generate download link');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to download file');
    } finally {
      setDownloading(false);
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

  if (error === 'expired') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-accent/20 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Cloud className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <CardTitle>Link Expired</CardTitle>
            <CardDescription>This share link has expired and is no longer accessible</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (passwordRequired && !file) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-accent/20 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Lock className="h-12 w-12 text-primary mx-auto mb-4" />
            <CardTitle>Password Protected</CardTitle>
            <CardDescription>This file is password protected</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Enter Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  required
                />
                {error && (
                  <p className="text-sm text-destructive">{error}</p>
                )}
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Verifying...' : 'Access File'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!file) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-accent/20 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Cloud className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <CardTitle>File Not Found</CardTitle>
            <CardDescription>This file may have been deleted or the link is invalid</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-accent/20 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Cloud className="h-12 w-12 text-primary mx-auto mb-4" />
          <CardTitle>Download File</CardTitle>
          <CardDescription>Someone shared this file with you</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4 p-4 border rounded-lg">
            <FileIcon 
              fileName={file.name}
              mimeType={file.mime_type}
              storagePath={file.storage_path}
              className="h-10 w-10"
              showThumbnail
            />
            <div className="min-w-0 flex-1">
              <p className="font-medium truncate">{file.name}</p>
              <div className="flex gap-2 text-sm text-muted-foreground">
                <span>{formatBytes(file.size_bytes)}</span>
                <span>•</span>
                <span>{format(new Date(file.created_at), 'MMM d, yyyy')}</span>
              </div>
            </div>
          </div>
          <Button 
            onClick={handleDownload} 
            className="w-full" 
            disabled={downloading}
          >
            <Download className="h-4 w-4 mr-2" />
            {downloading ? 'Preparing download...' : 'Download File'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Share;
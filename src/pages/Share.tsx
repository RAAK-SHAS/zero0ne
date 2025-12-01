import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Download, Cloud, File as FileIcon } from 'lucide-react';
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

  useEffect(() => {
    loadFile();
  }, [token]);

  const loadFile = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('get-shared-file', {
        body: { token }
      });

      if (error) throw error;

      if (data?.file) {
        setFile(data.file);
      } else {
        throw new Error('Invalid or expired share link');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to load file');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!file) return;

    setDownloading(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-shared-file', {
        body: { token }
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
            <FileIcon className="h-10 w-10 text-primary flex-shrink-0" />
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
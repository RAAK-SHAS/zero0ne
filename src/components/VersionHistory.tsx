import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, RotateCcw, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { formatBytes } from '@/lib/utils';
import { toast } from 'sonner';

interface Version {
  id: string;
  version_number: number;
  size_bytes: number;
  created_at: string;
  storage_path: string;
}

interface VersionHistoryProps {
  fileId: string | null;
  fileName: string;
  open: boolean;
  onClose: () => void;
}

export const VersionHistory = ({ fileId, fileName, open, onClose }: VersionHistoryProps) => {
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && fileId) {
      loadVersions();
    }
  }, [open, fileId]);

  const loadVersions = async () => {
    if (!fileId) return;
    
    setLoading(true);
    const { data, error } = await supabase
      .from('file_versions')
      .select('*')
      .eq('file_id', fileId)
      .order('version_number', { ascending: false });

    if (error) {
      toast.error('Failed to load version history');
    } else {
      setVersions(data || []);
    }
    setLoading(false);
  };

  const downloadVersion = async (version: Version) => {
    const { data, error } = await supabase.storage
      .from('user-files')
      .createSignedUrl(version.storage_path, 60);

    if (error) {
      toast.error('Failed to download version');
      return;
    }

    window.open(data.signedUrl, '_blank');
  };

  const restoreVersion = async (version: Version) => {
    toast.info('Version restore functionality coming soon');
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Version History: {fileName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-2 max-h-96 overflow-y-auto">
          {loading && <p className="text-center text-muted-foreground py-8">Loading versions...</p>}
          
          {!loading && versions.length === 0 && (
            <p className="text-center text-muted-foreground py-8">No version history available</p>
          )}

          {versions.map((version) => (
            <div
              key={version.id}
              className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
            >
              <div className="flex-1">
                <p className="font-medium">Version {version.version_number}</p>
                <div className="flex gap-3 text-sm text-muted-foreground">
                  <span>{formatBytes(version.size_bytes)}</span>
                  <span>•</span>
                  <span>{format(new Date(version.created_at), 'MMM d, yyyy h:mm a')}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => downloadVersion(version)}
                >
                  <Download className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => restoreVersion(version)}
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};

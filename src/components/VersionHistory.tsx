import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, RotateCcw, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { formatBytes } from '@/lib/utils';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

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
  livePath?: string;
  open: boolean;
  onClose: () => void;
  onRestored?: () => void;
}

export const VersionHistory = ({ fileId, fileName, livePath, open, onClose, onRestored }: VersionHistoryProps) => {
  const { user } = useAuth();
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);

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
    if (!fileId || !livePath || !user) {
      toast.error('Cannot restore: missing file information');
      return;
    }
    if (!confirm(`Restore version ${version.version_number}? Current version will be archived first.`)) return;

    setRestoring(version.id);
    try {
      // Snapshot current bytes first as a new version
      const { data: currentBlob } = await supabase.storage.from('user-files').download(livePath);
      const nextVersion = (versions[0]?.version_number || 0) + 1;
      if (currentBlob) {
        const snapshotPath = `${user.id}/versions/${fileId}/v${nextVersion}_${Date.now()}`;
        await supabase.storage
          .from('user-files')
          .upload(snapshotPath, currentBlob, { cacheControl: '3600', upsert: false });
        await supabase.from('file_versions').insert({
          file_id: fileId,
          version_number: nextVersion,
          storage_path: snapshotPath,
          size_bytes: currentBlob.size,
          created_by: user.id,
        });
      }

      // Download chosen version bytes & overwrite live path
      const { data: oldBlob, error: dlErr } = await supabase.storage
        .from('user-files')
        .download(version.storage_path);
      if (dlErr || !oldBlob) throw dlErr || new Error('Could not load version');

      const { error: upErr } = await supabase.storage
        .from('user-files')
        .update(livePath, oldBlob, { cacheControl: '3600', upsert: true });
      if (upErr) throw upErr;

      await supabase.from('files').update({ size_bytes: oldBlob.size }).eq('id', fileId);

      toast.success(`Restored version ${version.version_number}`);
      await loadVersions();
      onRestored?.();
    } catch (e: any) {
      toast.error(e.message || 'Restore failed');
    } finally {
      setRestoring(null);
    }
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
            <p className="text-center text-muted-foreground py-8">
              No version history yet. Versions are created automatically when you save edits to a file.
            </p>
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
                <Button variant="outline" size="sm" onClick={() => downloadVersion(version)} title="Download this version">
                  <Download className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => restoreVersion(version)}
                  disabled={restoring === version.id}
                  title="Restore this version"
                >
                  <RotateCcw className={`h-4 w-4 ${restoring === version.id ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};

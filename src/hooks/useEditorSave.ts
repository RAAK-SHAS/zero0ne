import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SaveOptions {
  fileId: string;
  fileName: string;
  storagePath: string;
  userId: string;
}

export const useEditorSave = () => {
  const [isSaving, setIsSaving] = useState(false);

  const saveToCloud = async (blob: Blob, options: SaveOptions): Promise<boolean> => {
    setIsSaving(true);
    try {
      // 1. Snapshot the CURRENT bytes to a versioned path BEFORE we overwrite.
      //    This way the version history actually contains the old version.
      const { data: existing } = await supabase.storage
        .from('user-files')
        .download(options.storagePath);

      const { data: versionData } = await supabase
        .from('file_versions')
        .select('version_number')
        .eq('file_id', options.fileId)
        .order('version_number', { ascending: false })
        .limit(1);
      const nextVersion = (versionData?.[0]?.version_number || 0) + 1;

      let snapshotPath: string | null = null;
      if (existing) {
        snapshotPath = `${options.userId}/versions/${options.fileId}/v${nextVersion}_${Date.now()}`;
        const { error: snapErr } = await supabase.storage
          .from('user-files')
          .upload(snapshotPath, existing, { cacheControl: '3600', upsert: false });
        if (snapErr) {
          console.warn('Could not snapshot previous version:', snapErr.message);
          snapshotPath = null;
        }
      }

      // 2. Overwrite live file
      const { error: uploadError } = await supabase.storage
        .from('user-files')
        .update(options.storagePath, blob, { cacheControl: '3600', upsert: true });
      if (uploadError) throw uploadError;

      // 3. Update size
      const { error: dbError } = await supabase
        .from('files')
        .update({ size_bytes: blob.size })
        .eq('id', options.fileId);
      if (dbError) throw dbError;

      // 4. Record version pointing to the SNAPSHOT (or current path as fallback)
      if (snapshotPath) {
        await supabase.from('file_versions').insert({
          file_id: options.fileId,
          version_number: nextVersion,
          storage_path: snapshotPath,
          size_bytes: existing!.size,
          created_by: options.userId,
        });
      }

      toast.success('File saved · previous version archived');
      setIsSaving(false);
      return true;
    } catch (error: any) {
      toast.error(error.message || 'Failed to save file');
      setIsSaving(false);
      return false;
    }
  };

  const downloadLocally = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `edited_${fileName}`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('File downloaded!');
  };

  return { saveToCloud, downloadLocally, isSaving };
};

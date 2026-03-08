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
      // Upload the edited file, overwriting the existing one
      const { error: uploadError } = await supabase.storage
        .from('user-files')
        .update(options.storagePath, blob, {
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // Update file size in database
      const { error: dbError } = await supabase
        .from('files')
        .update({ size_bytes: blob.size })
        .eq('id', options.fileId);

      if (dbError) throw dbError;

      // Create a version entry
      const { data: versionData } = await supabase
        .from('file_versions')
        .select('version_number')
        .eq('file_id', options.fileId)
        .order('version_number', { ascending: false })
        .limit(1);

      const nextVersion = (versionData?.[0]?.version_number || 0) + 1;

      await supabase.from('file_versions').insert({
        file_id: options.fileId,
        version_number: nextVersion,
        storage_path: options.storagePath,
        size_bytes: blob.size,
        created_by: options.userId,
      });

      toast.success('File saved to cloud!');
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

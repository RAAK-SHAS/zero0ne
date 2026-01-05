import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const TAG_COLORS: Record<string, string> = {
  work: 'bg-blue-500/20 text-blue-600 border-blue-500/30',
  personal: 'bg-green-500/20 text-green-600 border-green-500/30',
  important: 'bg-red-500/20 text-red-600 border-red-500/30',
  archive: 'bg-gray-500/20 text-gray-600 border-gray-500/30',
  project: 'bg-purple-500/20 text-purple-600 border-purple-500/30',
  reference: 'bg-yellow-500/20 text-yellow-600 border-yellow-500/30',
  shared: 'bg-pink-500/20 text-pink-600 border-pink-500/30',
  default: 'bg-accent text-accent-foreground border-border',
};

export const PRESET_TAGS = [
  'work',
  'personal',
  'important',
  'archive',
  'project',
  'reference',
  'shared',
];

export const useFileTags = () => {
  const [loading, setLoading] = useState(false);

  const addTag = useCallback(async (fileId: string, tag: string) => {
    setLoading(true);
    try {
      // Get current tags
      const { data: file, error: fetchError } = await supabase
        .from('files')
        .select('tags')
        .eq('id', fileId)
        .single();

      if (fetchError) throw fetchError;

      const currentTags = file?.tags || [];
      if (currentTags.includes(tag)) {
        toast.info('Tag already exists');
        return;
      }

      const { error } = await supabase
        .from('files')
        .update({ tags: [...currentTags, tag] })
        .eq('id', fileId);

      if (error) throw error;
      toast.success(`Added tag "${tag}"`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to add tag');
    } finally {
      setLoading(false);
    }
  }, []);

  const removeTag = useCallback(async (fileId: string, tag: string) => {
    setLoading(true);
    try {
      const { data: file, error: fetchError } = await supabase
        .from('files')
        .select('tags')
        .eq('id', fileId)
        .single();

      if (fetchError) throw fetchError;

      const currentTags = file?.tags || [];
      const { error } = await supabase
        .from('files')
        .update({ tags: currentTags.filter((t: string) => t !== tag) })
        .eq('id', fileId);

      if (error) throw error;
      toast.success(`Removed tag "${tag}"`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to remove tag');
    } finally {
      setLoading(false);
    }
  }, []);

  const setTags = useCallback(async (fileId: string, tags: string[]) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('files')
        .update({ tags })
        .eq('id', fileId);

      if (error) throw error;
    } catch (error: any) {
      toast.error(error.message || 'Failed to update tags');
    } finally {
      setLoading(false);
    }
  }, []);

  const getTagColor = useCallback((tag: string) => {
    return TAG_COLORS[tag.toLowerCase()] || TAG_COLORS.default;
  }, []);

  return {
    loading,
    addTag,
    removeTag,
    setTags,
    getTagColor,
    presetTags: PRESET_TAGS,
  };
};

import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const useFavorites = () => {
  const toggleFavorite = useCallback(async (fileId: string, currentState: boolean) => {
    try {
      const { error } = await supabase
        .from('files')
        .update({ is_favorite: !currentState })
        .eq('id', fileId);

      if (error) throw error;
      
      toast.success(currentState ? 'Removed from favorites' : 'Added to favorites');
      return !currentState;
    } catch (error: any) {
      toast.error(error.message || 'Failed to update favorite');
      return currentState;
    }
  }, []);

  const setFavorite = useCallback(async (fileIds: string[], isFavorite: boolean) => {
    try {
      const { error } = await supabase
        .from('files')
        .update({ is_favorite: isFavorite })
        .in('id', fileIds);

      if (error) throw error;
      
      toast.success(isFavorite ? 'Added to favorites' : 'Removed from favorites');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update favorites');
    }
  }, []);

  return {
    toggleFavorite,
    setFavorite,
  };
};

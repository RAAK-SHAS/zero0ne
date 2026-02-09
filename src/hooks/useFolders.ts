import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Folder {
  id: string;
  user_id: string;
  name: string;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
  is_hidden: boolean;
  is_locked: boolean;
}

export const useFolders = (userId: string | undefined) => {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showHidden, setShowHidden] = useState(false);
  const [unlockedFolders, setUnlockedFolders] = useState<Set<string>>(new Set());

  const loadFolders = useCallback(async () => {
    if (!userId) return;
    
    try {
      // Use the safe view that excludes password_hash
      const { data, error } = await supabase
        .from('folders_safe')
        .select('*')
        .order('name');
      
      if (error) throw error;
      setFolders((data as Folder[]) || []);
    } catch (error: any) {
      console.error('Failed to load folders:', error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadFolders();
  }, [loadFolders]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel('folders-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'folders',
        },
        () => {
          // Reload from safe view on any change
          loadFolders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, loadFolders]);

  // Clear unlocked folders on page visibility change (simulates logout/refresh)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) return;
      // Don't clear on tab focus, only on actual navigation/refresh
    };
    
    const handleBeforeUnload = () => {
      setUnlockedFolders(new Set());
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  const createFolder = useCallback(async (name: string, parentId: string | null = null) => {
    if (!userId) return null;

    try {
      const { data, error } = await supabase
        .from('folders')
        .insert({
          user_id: userId,
          name,
          parent_id: parentId,
        })
        .select()
        .single();

      if (error) throw error;
      toast.success('Folder created');
      return data;
    } catch (error: any) {
      toast.error(error.message || 'Failed to create folder');
      return null;
    }
  }, [userId]);

  const renameFolder = useCallback(async (folderId: string, newName: string) => {
    try {
      const { error } = await supabase
        .from('folders')
        .update({ name: newName, updated_at: new Date().toISOString() })
        .eq('id', folderId);

      if (error) throw error;
      toast.success('Folder renamed');
    } catch (error: any) {
      toast.error(error.message || 'Failed to rename folder');
    }
  }, []);

  const deleteFolder = useCallback(async (folderId: string) => {
    try {
      const { error } = await supabase
        .from('folders')
        .delete()
        .eq('id', folderId);

      if (error) throw error;
      toast.success('Folder deleted');
      
      if (currentFolderId === folderId) {
        setCurrentFolderId(null);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete folder');
    }
  }, [currentFolderId]);

  const toggleHidden = useCallback(async (folderId: string, isHidden: boolean) => {
    try {
      const { error } = await supabase
        .from('folders')
        .update({ is_hidden: !isHidden, updated_at: new Date().toISOString() })
        .eq('id', folderId);

      if (error) throw error;
      toast.success(isHidden ? 'Folder unhidden' : 'Folder hidden');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update folder');
    }
  }, []);

  const markUnlocked = useCallback((folderId: string) => {
    setUnlockedFolders(prev => new Set(prev).add(folderId));
  }, []);

  const isFolderUnlocked = useCallback((folderId: string) => {
    return unlockedFolders.has(folderId);
  }, [unlockedFolders]);

  const moveToFolder = useCallback(async (fileIds: string[], folderId: string | null) => {
    try {
      const { error } = await supabase
        .from('files')
        .update({ folder_id: folderId })
        .in('id', fileIds);

      if (error) throw error;
      toast.success(`Moved ${fileIds.length} file(s)`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to move files');
    }
  }, []);

  const getCurrentPath = useCallback(() => {
    const path: Folder[] = [];
    let current = folders.find(f => f.id === currentFolderId);
    
    while (current) {
      path.unshift(current);
      current = folders.find(f => f.id === current?.parent_id);
    }
    
    return path;
  }, [folders, currentFolderId]);

  const getChildFolders = useCallback((parentId: string | null) => {
    return folders.filter(f => {
      if (f.parent_id !== parentId) return false;
      // Hide hidden folders unless showHidden is on
      if (f.is_hidden && !showHidden) return false;
      return true;
    });
  }, [folders, showHidden]);

  return {
    folders,
    currentFolderId,
    setCurrentFolderId,
    loading,
    showHidden,
    setShowHidden,
    createFolder,
    renameFolder,
    deleteFolder,
    toggleHidden,
    markUnlocked,
    isFolderUnlocked,
    moveToFolder,
    getCurrentPath,
    getChildFolders,
    refreshFolders: loadFolders,
  };
};

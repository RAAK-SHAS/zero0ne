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
}

export const useFolders = (userId: string | undefined) => {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadFolders = useCallback(async () => {
    if (!userId) return;
    
    try {
      const { data, error } = await supabase
        .from('folders')
        .select('*')
        .order('name');
      
      if (error) throw error;
      setFolders(data || []);
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
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setFolders(prev => [...prev, payload.new as Folder]);
          } else if (payload.eventType === 'UPDATE') {
            setFolders(prev => prev.map(f => f.id === (payload.new as Folder).id ? payload.new as Folder : f));
          } else if (payload.eventType === 'DELETE') {
            setFolders(prev => prev.filter(f => f.id !== (payload.old as Folder).id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

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
    return folders.filter(f => f.parent_id === parentId);
  }, [folders]);

  return {
    folders,
    currentFolderId,
    setCurrentFolderId,
    loading,
    createFolder,
    renameFolder,
    deleteFolder,
    moveToFolder,
    getCurrentPath,
    getChildFolders,
    refreshFolders: loadFolders,
  };
};

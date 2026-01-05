import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ActivityLog {
  id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  entity_name: string | null;
  metadata: any;
  created_at: string;
}

export type ActionType = 
  | 'upload' 
  | 'download' 
  | 'delete' 
  | 'restore' 
  | 'rename' 
  | 'move' 
  | 'share' 
  | 'favorite' 
  | 'unfavorite'
  | 'tag_add'
  | 'tag_remove'
  | 'folder_create'
  | 'folder_delete';

export const useActivityLog = (userId: string | undefined) => {
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  const loadActivities = useCallback(async (limit = 50) => {
    if (!userId) return;
    
    try {
      const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      setActivities(data || []);
    } catch (error) {
      console.error('Failed to load activities:', error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadActivities();
  }, [loadActivities]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel('activity-logs-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'activity_logs',
        },
        (payload) => {
          setActivities(prev => [payload.new as ActivityLog, ...prev].slice(0, 100));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const logActivity = useCallback(async (
    action: ActionType,
    entityType: 'file' | 'folder',
    entityId: string | null,
    entityName: string | null,
    metadata: Record<string, any> = {}
  ) => {
    if (!userId) return;

    try {
      await supabase.from('activity_logs').insert({
        user_id: userId,
        action,
        entity_type: entityType,
        entity_id: entityId,
        entity_name: entityName,
        metadata,
      });
    } catch (error) {
      console.error('Failed to log activity:', error);
    }
  }, [userId]);

  const getActionIcon = (action: string) => {
    const icons: Record<string, string> = {
      upload: '📤',
      download: '📥',
      delete: '🗑️',
      restore: '♻️',
      rename: '✏️',
      move: '📁',
      share: '🔗',
      favorite: '⭐',
      unfavorite: '☆',
      tag_add: '🏷️',
      tag_remove: '🏷️',
      folder_create: '📂',
      folder_delete: '📂',
    };
    return icons[action] || '📄';
  };

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      upload: 'Uploaded',
      download: 'Downloaded',
      delete: 'Deleted',
      restore: 'Restored',
      rename: 'Renamed',
      move: 'Moved',
      share: 'Shared',
      favorite: 'Favorited',
      unfavorite: 'Unfavorited',
      tag_add: 'Added tag',
      tag_remove: 'Removed tag',
      folder_create: 'Created folder',
      folder_delete: 'Deleted folder',
    };
    return labels[action] || action;
  };

  return {
    activities,
    loading,
    logActivity,
    refreshActivities: loadActivities,
    getActionIcon,
    getActionLabel,
  };
};

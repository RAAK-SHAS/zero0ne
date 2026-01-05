import { useState, useCallback, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface FileTypeBreakdown {
  type: string;
  label: string;
  size: number;
  count: number;
  percentage: number;
  color: string;
}

interface StorageStats {
  totalUsed: number;
  totalQuota: number;
  percentUsed: number;
  fileCount: number;
  averageFileSize: number;
  largestFile: { name: string; size: number } | null;
  breakdownByType: FileTypeBreakdown[];
}

const FILE_TYPE_CONFIG: Record<string, { label: string; color: string; extensions: string[] }> = {
  images: { 
    label: 'Images', 
    color: 'hsl(var(--chart-1))', 
    extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'] 
  },
  videos: { 
    label: 'Videos', 
    color: 'hsl(var(--chart-2))', 
    extensions: ['mp4', 'mov', 'avi', 'mkv', 'webm', 'flv'] 
  },
  audio: { 
    label: 'Audio', 
    color: 'hsl(var(--chart-3))', 
    extensions: ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac'] 
  },
  documents: { 
    label: 'Documents', 
    color: 'hsl(var(--chart-4))', 
    extensions: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'rtf'] 
  },
  code: { 
    label: 'Code', 
    color: 'hsl(var(--chart-5))', 
    extensions: ['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'c', 'html', 'css', 'json', 'xml'] 
  },
  archives: { 
    label: 'Archives', 
    color: 'hsl(var(--primary))', 
    extensions: ['zip', 'rar', '7z', 'tar', 'gz'] 
  },
  other: { 
    label: 'Other', 
    color: 'hsl(var(--muted-foreground))', 
    extensions: [] 
  },
};

export const useStorageAnalytics = (userId: string | undefined) => {
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [loading, setLoading] = useState(true);

  const getFileType = useCallback((fileName: string): string => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    
    for (const [type, config] of Object.entries(FILE_TYPE_CONFIG)) {
      if (config.extensions.includes(ext)) {
        return type;
      }
    }
    return 'other';
  }, []);

  const calculateStats = useCallback(async () => {
    if (!userId) return;

    setLoading(true);
    try {
      const [profileRes, filesRes] = await Promise.all([
        supabase.from('profiles').select('storage_used_bytes, storage_quota_bytes').eq('id', userId).single(),
        supabase.from('files').select('name, size_bytes').is('deleted_at', null),
      ]);

      if (profileRes.error) throw profileRes.error;
      if (filesRes.error) throw filesRes.error;

      const files = filesRes.data || [];
      const profile = profileRes.data;

      // Calculate breakdown by type
      const typeMap: Record<string, { size: number; count: number }> = {};
      let largestFile: { name: string; size: number } | null = null;

      files.forEach(file => {
        const type = getFileType(file.name);
        if (!typeMap[type]) {
          typeMap[type] = { size: 0, count: 0 };
        }
        typeMap[type].size += file.size_bytes;
        typeMap[type].count += 1;

        if (!largestFile || file.size_bytes > largestFile.size) {
          largestFile = { name: file.name, size: file.size_bytes };
        }
      });

      const totalUsed = profile.storage_used_bytes;
      const breakdownByType: FileTypeBreakdown[] = Object.entries(typeMap)
        .map(([type, data]) => ({
          type,
          label: FILE_TYPE_CONFIG[type]?.label || type,
          size: data.size,
          count: data.count,
          percentage: totalUsed > 0 ? (data.size / totalUsed) * 100 : 0,
          color: FILE_TYPE_CONFIG[type]?.color || FILE_TYPE_CONFIG.other.color,
        }))
        .sort((a, b) => b.size - a.size);

      setStats({
        totalUsed,
        totalQuota: profile.storage_quota_bytes,
        percentUsed: profile.storage_quota_bytes > 0 ? (totalUsed / profile.storage_quota_bytes) * 100 : 0,
        fileCount: files.length,
        averageFileSize: files.length > 0 ? totalUsed / files.length : 0,
        largestFile,
        breakdownByType,
      });
    } catch (error) {
      console.error('Failed to calculate storage stats:', error);
    } finally {
      setLoading(false);
    }
  }, [userId, getFileType]);

  useEffect(() => {
    calculateStats();
  }, [calculateStats]);

  const quotaWarning = useMemo(() => {
    if (!stats) return null;
    
    if (stats.percentUsed >= 95) {
      return { level: 'critical', message: 'Storage almost full! Delete some files to continue uploading.' };
    }
    if (stats.percentUsed >= 80) {
      return { level: 'warning', message: 'Running low on storage space.' };
    }
    if (stats.percentUsed >= 60) {
      return { level: 'info', message: 'Storage usage is moderate.' };
    }
    return null;
  }, [stats]);

  return {
    stats,
    loading,
    quotaWarning,
    refreshStats: calculateStats,
  };
};

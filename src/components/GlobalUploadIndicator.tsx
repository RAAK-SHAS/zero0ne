import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Maximize2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Upload, 
  Pause, 
  Zap, 
  ChevronDown,
  X,
  Gauge,
  Wifi,
  WifiOff,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';
import { formatBytes } from '@/lib/utils';
import { useUploadManager } from '@/contexts/UploadContext';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const formatTime = (seconds: number): string => {
  if (!seconds || seconds === Infinity || isNaN(seconds)) return '--:--';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
};

const formatSpeed = (bytesPerSecond: number): string => {
  if (!bytesPerSecond || isNaN(bytesPerSecond)) return '0 B/s';
  return `${formatBytes(bytesPerSecond)}/s`;
};

// Throttle presets in bytes per second
const THROTTLE_PRESETS = [
  { label: 'Unlimited', value: 0 },
  { label: '10 MB/s', value: 10 * 1024 * 1024 },
  { label: '5 MB/s', value: 5 * 1024 * 1024 },
  { label: '2 MB/s', value: 2 * 1024 * 1024 },
  { label: '1 MB/s', value: 1 * 1024 * 1024 },
  { label: '500 KB/s', value: 500 * 1024 },
  { label: '256 KB/s', value: 256 * 1024 },
  { label: '128 KB/s', value: 128 * 1024 },
];

export const GlobalUploadIndicator = () => {
  const { 
    uploads, 
    isUploading, 
    pauseUpload, 
    cancelUpload, 
    clearCompleted,
    getActiveCount,
    getPendingCount,
    getTotalProgress,
    throttleRate,
    setThrottleRate,
    networkState
  } = useUploadManager();

  const uploadList = Object.values(uploads);
  const activeCount = getActiveCount();
  const pendingCount = getPendingCount();
  const progress = getTotalProgress();

  const activeUploads = uploadList.filter(u => u.status === 'uploading');
  const totalSpeed = activeUploads.reduce((sum, u) => sum + u.speed, 0);
  const completedCount = uploadList.filter(u => u.status === 'completed').length;
  const pausedCount = uploadList.filter(u => u.status === 'paused').length;
  const offlineCount = uploadList.filter(u => u.error?.includes('Connection lost')).length;

  const getThrottleLabel = (value: number) => {
    const preset = THROTTLE_PRESETS.find(p => p.value === value);
    return preset?.label || formatSpeed(value);
  };

  if (uploadList.length === 0) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className={`relative gap-2 ${!networkState.isOnline ? 'border-destructive/50' : ''}`}
        >
          {!networkState.isOnline ? (
            <WifiOff className="h-4 w-4 text-destructive" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          {isUploading && networkState.isOnline && (
            <div className="flex items-center gap-2">
              <span className="text-xs">{Math.round(progress)}%</span>
              <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all duration-300" 
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
          {!networkState.isOnline && offlineCount > 0 && (
            <span className="text-xs text-destructive">Offline</span>
          )}
          {pendingCount > 0 && networkState.isOnline && (
            <Badge variant="secondary" className="h-5 min-w-5 px-1.5">
              {pendingCount}
            </Badge>
          )}
          {pausedCount > 0 && networkState.isOnline && (
            <Badge variant="outline" className="h-5 min-w-5 px-1.5">
              <Pause className="h-3 w-3" />
            </Badge>
          )}
          {networkState.retryCount > 0 && networkState.isOnline && (
            <Badge variant="outline" className="h-5 px-1.5 gap-1">
              <RefreshCw className="h-3 w-3" />
              <span className="text-xs">{networkState.retryCount}</span>
            </Badge>
          )}
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-3 border-b">
          {/* Network Status Banner */}
          {!networkState.isOnline && (
            <div className="flex items-center gap-2 p-2 mb-3 rounded-md bg-destructive/10 text-destructive">
              <WifiOff className="h-4 w-4" />
              <div className="flex-1">
                <p className="text-xs font-medium">No Internet Connection</p>
                <p className="text-xs opacity-80">Uploads will resume automatically</p>
              </div>
            </div>
          )}
          
          {networkState.retryCount > 0 && networkState.isOnline && (
            <div className="flex items-center gap-2 p-2 mb-3 rounded-md bg-muted">
              <RefreshCw className="h-4 w-4 text-muted-foreground animate-spin" />
              <div className="flex-1">
                <p className="text-xs font-medium">Retrying upload...</p>
                <p className="text-xs text-muted-foreground">Attempt #{networkState.retryCount}</p>
              </div>
            </div>
          )}
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h4 className="font-medium text-sm">Uploads</h4>
              {networkState.isOnline ? (
                <Wifi className="h-3 w-3 text-primary" />
              ) : (
                <WifiOff className="h-3 w-3 text-destructive" />
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {isUploading && totalSpeed > 0 && networkState.isOnline && (
                <span className="flex items-center gap-1">
                  <Zap className="h-3 w-3 text-primary" />
                  {formatSpeed(totalSpeed)}
                </span>
              )}
            </div>
          </div>
          {pendingCount > 0 && (
            <Progress value={progress} className="h-1.5 mt-2" />
          )}
          
          {/* Throttle Control */}
          <div className="mt-3 pt-3 border-t">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Gauge className="h-3 w-3" />
                Speed Limit
              </span>
              <span className="text-xs font-medium">
                {getThrottleLabel(throttleRate)}
              </span>
            </div>
            <Select
              value={String(throttleRate)}
              onValueChange={(val) => setThrottleRate(Number(val))}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Select speed limit" />
              </SelectTrigger>
              <SelectContent>
                {THROTTLE_PRESETS.map((preset) => (
                  <SelectItem key={preset.value} value={String(preset.value)}>
                    {preset.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <ScrollArea className="max-h-64">
          <div className="p-2 space-y-1">
            {uploadList.map((upload) => (
              <div 
                key={upload.id} 
                className="flex items-center gap-2 p-2 rounded-md hover:bg-accent/50 text-sm"
              >
                <div className="flex-1 min-w-0">
                  <p className="truncate font-medium">{upload.fileName}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{formatBytes(upload.bytesUploaded)} / {formatBytes(upload.fileSize)}</span>
                    {upload.status === 'uploading' && (
                      <span className="text-primary">{upload.progress}%</span>
                    )}
                    {upload.status === 'paused' && upload.error?.includes('Connection lost') && (
                      <Badge variant="outline" className="text-xs py-0 h-4 gap-1">
                        <WifiOff className="h-2.5 w-2.5" />
                        Offline
                      </Badge>
                    )}
                    {upload.status === 'paused' && !upload.error?.includes('Connection lost') && (
                      <Badge variant="outline" className="text-xs py-0 h-4">
                        Paused
                      </Badge>
                    )}
                    {upload.status === 'completed' && (
                      <Badge variant="secondary" className="text-xs py-0 h-4">
                        Done
                      </Badge>
                    )}
                    {upload.status === 'error' && (
                      <Badge variant="destructive" className="text-xs py-0 h-4">
                        Error
                      </Badge>
                    )}
                  </div>
                  {upload.status === 'uploading' && (
                    <Progress value={upload.progress} className="h-1 mt-1" />
                  )}
                </div>
                {upload.status === 'uploading' && (
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6"
                    onClick={() => pauseUpload(upload.id)}
                  >
                    <Pause className="h-3 w-3" />
                  </Button>
                )}
                {(upload.status === 'paused' || upload.status === 'error') && (
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6 text-destructive"
                    onClick={() => cancelUpload(upload.id)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>

        {completedCount > 0 && (
          <div className="p-2 border-t">
            <Button 
              variant="ghost" 
              size="sm" 
              className="w-full text-xs"
              onClick={clearCompleted}
            >
              Clear {completedCount} completed
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};

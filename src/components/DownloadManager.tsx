import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Download, 
  Pause, 
  Play,
  Zap, 
  ChevronDown,
  X,
  Archive
} from 'lucide-react';
import { formatBytes } from '@/lib/utils';
import { useDownloadManager } from '@/contexts/DownloadContext';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';

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

export const DownloadManager = () => {
  const { 
    downloads, 
    isDownloading, 
    pauseDownload, 
    resumeDownload,
    cancelDownload, 
    clearCompleted,
    getPendingCount,
  } = useDownloadManager();

  const downloadList = Object.values(downloads);
  const pendingCount = getPendingCount();
  const activeDownloads = downloadList.filter(d => d.status === 'downloading');
  const totalSpeed = activeDownloads.reduce((sum, d) => sum + d.speed, 0);
  const completedCount = downloadList.filter(d => d.status === 'completed').length;
  const pausedCount = downloadList.filter(d => d.status === 'paused').length;
  
  const progress = pendingCount > 0
    ? downloadList.filter(d => d.status !== 'completed' && d.status !== 'error')
        .reduce((sum, d) => sum + d.progress, 0) / Math.max(1, pendingCount)
    : 0;

  if (downloadList.length === 0) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="relative gap-2"
        >
          <Download className="h-4 w-4" />
          {isDownloading && (
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
          {pendingCount > 0 && (
            <Badge variant="secondary" className="h-5 min-w-5 px-1.5">
              {pendingCount}
            </Badge>
          )}
          {pausedCount > 0 && (
            <Badge variant="secondary" className="h-5 min-w-5 px-1.5 bg-yellow-500/20 text-yellow-600">
              <Pause className="h-3 w-3" />
            </Badge>
          )}
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-3 border-b">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm">Downloads</h4>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {isDownloading && totalSpeed > 0 && (
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
        </div>
        
        <ScrollArea className="max-h-64">
          <div className="p-2 space-y-1">
            {downloadList.map((download) => (
              <div 
                key={download.id} 
                className="flex items-center gap-2 p-2 rounded-md hover:bg-accent/50 text-sm"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    {download.isZip && <Archive className="h-3 w-3 text-muted-foreground" />}
                    <p className="truncate font-medium">{download.fileName}</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{formatBytes(download.bytesDownloaded)} / {formatBytes(download.fileSize)}</span>
                    {download.status === 'downloading' && (
                      <span className="text-primary">{download.progress}%</span>
                    )}
                    {download.status === 'paused' && (
                      <Badge variant="secondary" className="text-xs py-0 h-4 bg-yellow-500/20 text-yellow-600">
                        Paused
                      </Badge>
                    )}
                    {download.status === 'completed' && (
                      <Badge variant="secondary" className="text-xs py-0 h-4 bg-green-500/20 text-green-600">
                        Done
                      </Badge>
                    )}
                    {download.status === 'error' && (
                      <Badge variant="destructive" className="text-xs py-0 h-4">
                        Error
                      </Badge>
                    )}
                  </div>
                  {download.status === 'downloading' && (
                    <Progress value={download.progress} className="h-1 mt-1" />
                  )}
                </div>
                {download.status === 'downloading' && (
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6"
                    onClick={() => pauseDownload(download.id)}
                  >
                    <Pause className="h-3 w-3" />
                  </Button>
                )}
                {download.status === 'paused' && (
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6"
                    onClick={() => resumeDownload(download.id)}
                  >
                    <Play className="h-3 w-3" />
                  </Button>
                )}
                {(download.status === 'paused' || download.status === 'error') && (
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6 text-destructive"
                    onClick={() => cancelDownload(download.id)}
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

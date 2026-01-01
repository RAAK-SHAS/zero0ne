import { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Upload, 
  X, 
  Pause, 
  Play, 
  Check, 
  AlertCircle, 
  Clock,
  Zap,
  FileIcon,
  ChevronUp,
  ChevronDown,
  Trash2
} from 'lucide-react';
import { formatBytes } from '@/lib/utils';

interface UploadItem {
  id: string;
  fileName: string;
  fileSize: number;
  progress: number;
  status: 'pending' | 'uploading' | 'paused' | 'completed' | 'error';
  error?: string;
  speed: number;
  eta: number;
  bytesUploaded: number;
  file?: File;
}

interface UploadManagerProps {
  uploads: UploadItem[];
  onPause: (id: string) => void;
  onResume: (id: string, file: File) => void;
  onCancel: (id: string) => void;
  onClearCompleted: () => void;
  isMinimized?: boolean;
  onToggleMinimize?: () => void;
}

const formatTime = (seconds: number): string => {
  if (!seconds || seconds === Infinity) return '--:--';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }
  return `${secs}s`;
};

const formatSpeed = (bytesPerSecond: number): string => {
  if (!bytesPerSecond) return '0 B/s';
  return `${formatBytes(bytesPerSecond)}/s`;
};

export const UploadManager = ({
  uploads,
  onPause,
  onResume,
  onCancel,
  onClearCompleted,
  isMinimized = false,
  onToggleMinimize
}: UploadManagerProps) => {
  const activeUploads = uploads.filter(u => u.status === 'uploading');
  const pausedUploads = uploads.filter(u => u.status === 'paused');
  const completedUploads = uploads.filter(u => u.status === 'completed');
  const errorUploads = uploads.filter(u => u.status === 'error');
  const pendingUploads = uploads.filter(u => u.status === 'pending');

  const totalProgress = uploads.length > 0
    ? uploads.reduce((sum, u) => sum + u.progress, 0) / uploads.length
    : 0;

  const totalSpeed = activeUploads.reduce((sum, u) => sum + u.speed, 0);
  const avgEta = activeUploads.length > 0
    ? activeUploads.reduce((sum, u) => sum + u.eta, 0) / activeUploads.length
    : 0;

  if (uploads.length === 0) return null;

  const getStatusIcon = (status: UploadItem['status']) => {
    switch (status) {
      case 'completed':
        return <Check className="h-4 w-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      case 'paused':
        return <Pause className="h-4 w-4 text-yellow-500" />;
      case 'uploading':
        return <Zap className="h-4 w-4 text-primary animate-pulse" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: UploadItem['status']) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-500">Completed</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      case 'paused':
        return <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-600">Paused</Badge>;
      case 'uploading':
        return <Badge variant="default">Uploading</Badge>;
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  return (
    <Card className="fixed bottom-4 right-4 w-96 shadow-2xl z-50 max-h-[80vh] flex flex-col">
      <CardHeader className="py-3 px-4 border-b cursor-pointer" onClick={onToggleMinimize}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            <CardTitle className="text-sm">
              Upload Manager
              {activeUploads.length > 0 && (
                <span className="ml-2 text-xs text-muted-foreground">
                  ({activeUploads.length} active)
                </span>
              )}
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {pausedUploads.length > 0 && (
              <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-600">
                {pausedUploads.length} paused
              </Badge>
            )}
            {isMinimized ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </div>
        </div>
        
        {!isMinimized && (activeUploads.length > 0 || pausedUploads.length > 0) && (
          <div className="mt-2 space-y-2">
            <Progress value={totalProgress} className="h-2" />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{Math.round(totalProgress)}% complete</span>
              {activeUploads.length > 0 && (
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <Zap className="h-3 w-3" />
                    {formatSpeed(totalSpeed)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatTime(avgEta)}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </CardHeader>

      {!isMinimized && (
        <CardContent className="p-0 flex-1 overflow-hidden">
          <ScrollArea className="h-full max-h-[50vh]">
            <div className="p-2 space-y-2">
              {uploads.map((upload) => (
                <div
                  key={upload.id}
                  className="p-3 rounded-lg bg-accent/30 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 flex-1 min-w-0">
                      {getStatusIcon(upload.status)}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{upload.fileName}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{formatBytes(upload.bytesUploaded)} / {formatBytes(upload.fileSize)}</span>
                          {upload.status === 'uploading' && upload.speed > 0 && (
                            <>
                              <span>•</span>
                              <span>{formatSpeed(upload.speed)}</span>
                              <span>•</span>
                              <span>{formatTime(upload.eta)} left</span>
                            </>
                          )}
                        </div>
                        {upload.error && (
                          <p className="text-xs text-destructive mt-1">{upload.error}</p>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      {upload.status === 'uploading' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => onPause(upload.id)}
                        >
                          <Pause className="h-3 w-3" />
                        </Button>
                      )}
                      {upload.status === 'paused' && upload.file && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => onResume(upload.id, upload.file!)}
                        >
                          <Play className="h-3 w-3" />
                        </Button>
                      )}
                      {(upload.status === 'paused' || upload.status === 'error') && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          onClick={() => onCancel(upload.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                  
                  {(upload.status === 'uploading' || upload.status === 'paused') && (
                    <Progress value={upload.progress} className="h-1" />
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>

          {completedUploads.length > 0 && (
            <div className="p-2 border-t">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs"
                onClick={onClearCompleted}
              >
                Clear {completedUploads.length} completed
              </Button>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
};

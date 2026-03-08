import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Upload, X, Pause, Play, Check, AlertCircle, Clock, Zap,
  Trash2, GripVertical, Copy, SkipForward, PauseCircle, PlayCircle,
  Bug, RefreshCw, Layers
} from 'lucide-react';
import { formatBytes } from '@/lib/utils';
import { useUploadManager, UploadItem } from '@/contexts/UploadContext';
import { UploadSpeedGraph } from '@/components/UploadSpeedGraph';
import { toast } from 'sonner';

const formatTime = (seconds: number): string => {
  if (!seconds || seconds === Infinity) return '--:--';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
};

const formatSpeed = (bytesPerSecond: number): string => {
  if (!bytesPerSecond) return '0 B/s';
  return `${formatBytes(bytesPerSecond)}/s`;
};

interface UploadQueuePanelProps {
  isOpen: boolean;
  onClose: () => void;
  onReselectFile: (uploadId: string, fileName: string) => void;
}

export const UploadQueuePanel = ({ isOpen, onClose, onReselectFile }: UploadQueuePanelProps) => {
  const {
    uploads, isUploading, pauseUpload, resumeUpload, cancelUpload, clearCompleted,
    reorderUpload, pauseAll, resumeAll, moveToFront, getUploadDiagnostics, retryUpload,
    speedHistory, maxConcurrent, setMaxConcurrent,
  } = useUploadManager();

  const [expandedDiagnostics, setExpandedDiagnostics] = useState<Set<string>>(new Set());
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const uploadList = Object.values(uploads).sort((a, b) => a.priority - b.priority);
  const activeUploads = uploadList.filter(u => u.status === 'uploading');
  const pausedUploads = uploadList.filter(u => u.status === 'paused');
  const queuedUploads = uploadList.filter(u => u.status === 'queued');
  const completedUploads = uploadList.filter(u => u.status === 'completed');
  const errorUploads = uploadList.filter(u => u.status === 'error');

  const totalProgress = uploadList.length > 0
    ? uploadList.filter(u => u.status !== 'completed' && u.status !== 'error')
        .reduce((sum, u) => sum + u.progress, 0) / Math.max(1, uploadList.filter(u => u.status !== 'completed' && u.status !== 'error').length)
    : 0;

  const totalSpeed = activeUploads.reduce((sum, u) => sum + u.speed, 0);

  const toggleDiagnostics = (id: string) => {
    setExpandedDiagnostics(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const copyDiagnostics = (upload: UploadItem) => {
    const diagnostics = getUploadDiagnostics(upload.id);
    navigator.clipboard.writeText(JSON.stringify(diagnostics, null, 2));
    toast.success('Diagnostics copied to clipboard');
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (draggedId && draggedId !== id) setDragOverId(id);
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (draggedId && draggedId !== targetId) {
      const draggedIndex = uploadList.findIndex(u => u.id === draggedId);
      const targetIndex = uploadList.findIndex(u => u.id === targetId);
      const dir = draggedIndex > targetIndex ? 'up' : 'down';
      const steps = Math.abs(draggedIndex - targetIndex);
      for (let i = 0; i < steps; i++) reorderUpload(draggedId, dir);
    }
    setDraggedId(null);
    setDragOverId(null);
  };

  const getStatusIcon = (status: UploadItem['status']) => {
    switch (status) {
      case 'completed': return <Check className="h-4 w-4 text-green-500" />;
      case 'error': return <AlertCircle className="h-4 w-4 text-destructive" />;
      case 'paused': return <Pause className="h-4 w-4 text-yellow-500" />;
      case 'uploading': return <Zap className="h-4 w-4 text-primary animate-pulse" />;
      default: return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getRetryCountdown = (upload: UploadItem) => {
    if (!upload.nextRetryAt) return null;
    const remaining = Math.max(0, Math.ceil((upload.nextRetryAt - Date.now()) / 1000));
    if (remaining <= 0) return null;
    return remaining;
  };

  if (!isOpen) return null;

  return (
    <Card className="fixed bottom-4 right-4 w-[440px] shadow-2xl z-50 max-h-[80vh] flex flex-col">
      <CardHeader className="py-3 px-4 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            <CardTitle className="text-sm">Upload Queue</CardTitle>
            {activeUploads.length > 0 && (
              <Badge variant="default" className="text-xs">
                {activeUploads.length}/{maxConcurrent} active
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            {/* Concurrency selector */}
            <Select value={String(maxConcurrent)} onValueChange={v => setMaxConcurrent(Number(v))}>
              <SelectTrigger className="h-7 w-[70px] text-xs">
                <Layers className="h-3 w-3 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5].map(n => (
                  <SelectItem key={n} value={String(n)} className="text-xs">{n}x</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(queuedUploads.length > 0 || activeUploads.length > 0) && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={pauseAll} title="Pause all">
                <PauseCircle className="h-4 w-4" />
              </Button>
            )}
            {pausedUploads.length > 0 && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={resumeAll} title="Resume all">
                <PlayCircle className="h-4 w-4" />
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {(activeUploads.length > 0 || queuedUploads.length > 0) && (
          <div className="mt-2 space-y-2">
            <Progress value={totalProgress} className="h-2" />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{Math.round(totalProgress)}% complete</span>
              {activeUploads.length > 0 && (
                <span className="flex items-center gap-1">
                  <Zap className="h-3 w-3" />
                  {formatSpeed(totalSpeed)}
                </span>
              )}
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent className="p-0 flex-1 overflow-hidden">
        <ScrollArea className="h-full max-h-[50vh]">
          <div className="p-2 space-y-1">
            {uploadList.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">No uploads in queue</div>
            ) : (
              uploadList.map((upload) => {
                const retryCountdown = getRetryCountdown(upload);
                return (
                  <div
                    key={upload.id}
                    draggable={upload.status === 'queued'}
                    onDragStart={(e) => handleDragStart(e, upload.id)}
                    onDragOver={(e) => handleDragOver(e, upload.id)}
                    onDragLeave={() => setDragOverId(null)}
                    onDrop={(e) => handleDrop(e, upload.id)}
                    onDragEnd={() => { setDraggedId(null); setDragOverId(null); }}
                    className={`p-3 rounded-lg bg-accent/30 space-y-2 ${
                      dragOverId === upload.id ? 'ring-2 ring-primary' : ''
                    } ${draggedId === upload.id ? 'opacity-50' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 flex-1 min-w-0">
                        {upload.status === 'queued' && (
                          <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab mt-0.5" />
                        )}
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
                          {/* Auto-retry countdown */}
                          {upload.status === 'error' && retryCountdown !== null && (
                            <div className="flex items-center gap-1 text-xs text-yellow-500 mt-1">
                              <RefreshCw className="h-3 w-3 animate-spin" />
                              <span>Retrying in {retryCountdown}s (attempt {(upload.autoRetryCount || 0) + 1}/5)</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        {upload.status === 'queued' && (
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveToFront(upload.id)} title="Upload next">
                            <SkipForward className="h-3 w-3" />
                          </Button>
                        )}
                        {upload.status === 'uploading' && (
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => pauseUpload(upload.id)}>
                            <Pause className="h-3 w-3" />
                          </Button>
                        )}
                        {upload.status === 'paused' && !upload.file && (
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onReselectFile(upload.id, upload.fileName)} title="Reselect file to resume">
                            <RefreshCw className="h-3 w-3" />
                          </Button>
                        )}
                        {upload.status === 'paused' && upload.file && (
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => resumeUpload(upload.id, upload.file!)}>
                            <Play className="h-3 w-3" />
                          </Button>
                        )}
                        {upload.status === 'error' && (
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => toggleDiagnostics(upload.id)} title="View diagnostics">
                            <Bug className="h-3 w-3" />
                          </Button>
                        )}
                        {(upload.status === 'paused' || upload.status === 'error' || upload.status === 'queued') && (
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => cancelUpload(upload.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {(upload.status === 'uploading' || upload.status === 'paused') && (
                      <Progress value={upload.progress} className="h-1" />
                    )}

                    {/* Speed graph for active uploads */}
                    {upload.status === 'uploading' && speedHistory[upload.id]?.length > 1 && (
                      <div className="pt-1">
                        <UploadSpeedGraph data={speedHistory[upload.id]} width={380} height={36} />
                      </div>
                    )}

                    {upload.error && (
                      <p className="text-xs text-destructive">{upload.error}</p>
                    )}

                    {/* Diagnostics panel */}
                    {expandedDiagnostics.has(upload.id) && (
                      <div className="mt-2 p-2 bg-muted/50 rounded text-xs space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="font-medium">Diagnostics</span>
                          <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => copyDiagnostics(upload)}>
                            <Copy className="h-3 w-3 mr-1" />Copy
                          </Button>
                        </div>
                        <div className="space-y-0.5 font-mono text-muted-foreground">
                          <p>ID: {upload.id.slice(0, 20)}...</p>
                          <p>Size: {formatBytes(upload.fileSize)}</p>
                          <p>Chunks: {upload.uploadedChunks.length}/{upload.totalChunks}</p>
                          <p>Last chunk: {upload.uploadedChunks.length > 0 ? upload.uploadedChunks[upload.uploadedChunks.length - 1] : 'N/A'}</p>
                          <p>Path: {upload.storagePath}</p>
                          <p>Auto-retries: {upload.autoRetryCount || 0}/{5}</p>
                          {upload.error && <p className="text-destructive">Error: {upload.error}</p>}
                        </div>
                        {upload.status === 'error' && upload.file && (
                          <Button variant="outline" size="sm" className="w-full mt-2 text-xs" onClick={() => retryUpload(upload.id)}>
                            <RefreshCw className="h-3 w-3 mr-1" />Retry Now
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>

        {completedUploads.length > 0 && (
          <div className="p-2 border-t">
            <Button variant="ghost" size="sm" className="w-full text-xs" onClick={clearCompleted}>
              Clear {completedUploads.length} completed
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

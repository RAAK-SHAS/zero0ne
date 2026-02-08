import { memo, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Check, 
  AlertCircle, 
  Upload, 
  RefreshCw,
  X,
  ChevronDown,
  ChevronUp,
  Loader2
} from 'lucide-react';
import { formatBytes } from '@/lib/utils';
import { useUploadManager, UploadItem } from '@/contexts/UploadContext';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface UploadSummaryProps {
  onOpenQueue: () => void;
}

export const UploadSummary = memo(({ onOpenQueue }: UploadSummaryProps) => {
  const { uploads, retryUpload, clearCompleted, isUploading, networkState } = useUploadManager();
  const [showDetails, setShowDetails] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const uploadList = Object.values(uploads);
  const activeUploads = uploadList.filter(u => u.status === 'uploading');
  const queuedUploads = uploadList.filter(u => u.status === 'queued');
  const completedUploads = uploadList.filter(u => u.status === 'completed');
  const failedUploads = uploadList.filter(u => u.status === 'error');
  const pausedUploads = uploadList.filter(u => u.status === 'paused');

  const totalInProgress = activeUploads.length + queuedUploads.length + pausedUploads.length;
  const hasActivity = uploadList.length > 0;
  
  // Calculate overall progress
  const totalBytes = uploadList
    .filter(u => u.status !== 'completed' && u.status !== 'error')
    .reduce((sum, u) => sum + u.fileSize, 0);
  const uploadedBytes = uploadList
    .filter(u => u.status !== 'completed' && u.status !== 'error')
    .reduce((sum, u) => sum + u.bytesUploaded, 0);
  const overallProgress = totalBytes > 0 ? Math.round((uploadedBytes / totalBytes) * 100) : 0;

  // Reset dismissed when new uploads come in
  useEffect(() => {
    if (totalInProgress > 0) {
      setDismissed(false);
    }
  }, [totalInProgress]);

  // Auto-show details when there are failures
  useEffect(() => {
    if (failedUploads.length > 0 && totalInProgress === 0) {
      setShowDetails(true);
    }
  }, [failedUploads.length, totalInProgress]);

  const handleRetryAll = () => {
    failedUploads.forEach(upload => {
      if (upload.file) {
        retryUpload(upload.id);
      }
    });
  };

  const handleDismiss = () => {
    clearCompleted();
    setDismissed(true);
  };

  // Don't show if no activity or dismissed
  if (!hasActivity || (dismissed && totalInProgress === 0 && failedUploads.length === 0)) {
    return null;
  }

  // All done state
  const allDone = totalInProgress === 0 && (completedUploads.length > 0 || failedUploads.length > 0);

  return (
    <Card className="fixed bottom-4 left-4 w-80 shadow-xl z-40 overflow-hidden">
      <CardContent className="p-3 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isUploading ? (
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            ) : allDone && failedUploads.length === 0 ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : failedUploads.length > 0 ? (
              <AlertCircle className="h-4 w-4 text-destructive" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            <span className="font-medium text-sm">
              {isUploading ? 'Uploading...' : allDone ? 'Upload Complete' : 'Uploads'}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {allDone && (
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleDismiss}>
                <X className="h-3 w-3" />
              </Button>
            )}
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-6 text-xs"
              onClick={onOpenQueue}
            >
              Details
            </Button>
          </div>
        </div>

        {/* Progress bar during upload */}
        {isUploading && (
          <div className="space-y-1">
            <Progress value={overallProgress} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{overallProgress}% complete</span>
              <span>
                {activeUploads.length} active
                {queuedUploads.length > 0 && `, ${queuedUploads.length} queued`}
              </span>
            </div>
          </div>
        )}

        {/* Network status */}
        {!networkState.isOnline && (
          <div className="flex items-center gap-2 px-2 py-1.5 bg-destructive/10 rounded text-xs text-destructive">
            <AlertCircle className="h-3 w-3" />
            <span>Offline - uploads paused</span>
          </div>
        )}

        {/* Summary when done */}
        {allDone && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              {completedUploads.length > 0 && (
                <Badge variant="secondary" className="bg-green-500/10 text-green-600">
                  <Check className="h-3 w-3 mr-1" />
                  {completedUploads.length} completed
                </Badge>
              )}
              {failedUploads.length > 0 && (
                <Badge variant="secondary" className="bg-destructive/10 text-destructive">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  {failedUploads.length} failed
                </Badge>
              )}
            </div>

            {/* Failed uploads details */}
            {failedUploads.length > 0 && (
              <Collapsible open={showDetails} onOpenChange={setShowDetails}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full justify-between h-7 text-xs">
                    <span>Failed uploads</span>
                    {showDetails ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-1 mt-1">
                  {failedUploads.slice(0, 5).map(upload => (
                    <div key={upload.id} className="flex items-center justify-between p-2 bg-destructive/5 rounded text-xs">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{upload.fileName}</p>
                        <p className="text-destructive/70 truncate">{upload.error || 'Upload failed'}</p>
                      </div>
                      {upload.file && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 ml-2"
                          onClick={() => retryUpload(upload.id)}
                        >
                          <RefreshCw className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  ))}
                  {failedUploads.length > 5 && (
                    <p className="text-xs text-muted-foreground text-center py-1">
                      +{failedUploads.length - 5} more
                    </p>
                  )}
                  
                  {/* Retry all button */}
                  {failedUploads.some(u => u.file) && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full mt-2 h-7 text-xs"
                      onClick={handleRetryAll}
                    >
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Retry all failed
                    </Button>
                  )}
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>
        )}

        {/* Active uploads preview */}
        {isUploading && activeUploads.length > 0 && (
          <div className="space-y-1">
            {activeUploads.slice(0, 2).map(upload => (
              <div key={upload.id} className="flex items-center gap-2 text-xs">
                <Loader2 className="h-3 w-3 animate-spin text-primary flex-shrink-0" />
                <span className="truncate flex-1">{upload.fileName}</span>
                <span className="text-muted-foreground">{upload.progress}%</span>
              </div>
            ))}
            {activeUploads.length > 2 && (
              <p className="text-xs text-muted-foreground">
                +{activeUploads.length - 2} more uploading
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
});

UploadSummary.displayName = 'UploadSummary';

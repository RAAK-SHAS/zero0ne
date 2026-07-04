import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { useUploadManager, UploadItem } from '@/contexts/UploadContext';
import { useUploadHistory, UploadHistoryEntry } from '@/hooks/useUploadHistory';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { formatBytes } from '@/lib/utils';
import {
  ArrowLeft, Pause, Play, X, RotateCcw, Trash2, Search, Zap, Wifi, WifiOff,
  CheckCircle2, XCircle, Clock3, UploadCloud, ArrowUp, History as HistoryIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const formatSpeed = (bps: number) => (!bps || isNaN(bps) ? '0 B/s' : `${formatBytes(bps)}/s`);
const formatEta = (secs: number) => {
  if (!secs || !isFinite(secs)) return '—';
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = Math.floor(secs % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
};

const statusMeta: Record<UploadItem['status'], { label: string; className: string }> = {
  pending:    { label: 'Pending',   className: 'bg-muted text-muted-foreground' },
  queued:     { label: 'Queued',    className: 'bg-blue-500/15 text-blue-500' },
  uploading:  { label: 'Uploading', className: 'bg-primary/15 text-primary' },
  paused:     { label: 'Paused',    className: 'bg-yellow-500/15 text-yellow-600' },
  completed:  { label: 'Done',      className: 'bg-green-500/15 text-green-600' },
  error:      { label: 'Error',     className: 'bg-destructive/15 text-destructive' },
};

const ActiveRow = ({ u }: { u: UploadItem }) => {
  const { pauseUpload, resumeUpload, cancelUpload, moveToFront, retryUpload } = useUploadManager();
  const meta = statusMeta[u.status];
  return (
    <Card className="p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <p className="truncate font-medium text-sm">{u.fileName}</p>
            <Badge variant="secondary" className={cn('text-[10px] py-0 h-4', meta.className)}>
              {meta.label}
            </Badge>
          </div>
          {u.folderPath && (
            <p className="text-xs text-muted-foreground truncate">📁 {u.folderPath}</p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground tabular-nums">
            <span>{formatBytes(u.bytesUploaded)} / {formatBytes(u.fileSize)}</span>
            <span>{u.progress}%</span>
            {u.status === 'uploading' && (
              <>
                <span className="flex items-center gap-1 text-primary">
                  <Zap className="h-3 w-3" /> {formatSpeed(u.speed)}
                </span>
                <span>ETA {formatEta(u.eta)}</span>
              </>
            )}
            {u.totalChunks > 0 && (
              <span>Chunks {u.uploadedChunks.length}/{u.totalChunks}</span>
            )}
            {u.autoRetryCount ? <span>Retry #{u.autoRetryCount}</span> : null}
          </div>
          {u.error && (
            <p className="mt-2 text-xs text-destructive break-words line-clamp-2">{u.error}</p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {u.status === 'uploading' && (
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => pauseUpload(u.id)} title="Pause">
              <Pause className="h-4 w-4" />
            </Button>
          )}
          {u.status === 'paused' && u.file && (
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => resumeUpload(u.id, u.file!)} title="Resume">
              <Play className="h-4 w-4" />
            </Button>
          )}
          {u.status === 'error' && (
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => retryUpload(u.id)} title="Retry">
              <RotateCcw className="h-4 w-4" />
            </Button>
          )}
          {(u.status === 'queued' || u.status === 'pending') && (
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => moveToFront(u.id)} title="Move to front">
              <ArrowUp className="h-4 w-4" />
            </Button>
          )}
          {u.status !== 'completed' && (
            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => cancelUpload(u.id)} title="Cancel">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      <Progress value={u.progress} className="h-1.5" />
    </Card>
  );
};

const HistoryRow = ({ e, onRemove }: { e: UploadHistoryEntry; onRemove: (id: string) => void }) => {
  const isOk = e.status === 'completed';
  return (
    <Card className="p-3 flex items-center gap-3">
      <div className={cn('h-8 w-8 rounded-full flex items-center justify-center shrink-0',
        isOk ? 'bg-green-500/15 text-green-600' : 'bg-destructive/15 text-destructive')}>
        {isOk ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-sm">{e.fileName}</p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground tabular-nums">
          <span>{formatBytes(e.fileSize)}</span>
          <span>{formatDistanceToNow(e.completedAt, { addSuffix: true })}</span>
          <span>Took {formatEta(e.durationMs / 1000)}</span>
          {e.folderPath && <span className="truncate">📁 {e.folderPath}</span>}
        </div>
        {!isOk && e.error && (
          <p className="text-xs text-destructive break-words line-clamp-1">{e.error}</p>
        )}
      </div>
      <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground" onClick={() => onRemove(e.id)} title="Remove">
        <X className="h-4 w-4" />
      </Button>
    </Card>
  );
};

const Uploads = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    uploads, isUploading, pauseAll, resumeAll, clearCompleted,
    getActiveCount, getPendingCount, getTotalProgress, networkState,
  } = useUploadManager();
  const { history, clearHistory, removeEntry } = useUploadHistory();
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState('active');

  const list = useMemo(() => Object.values(uploads).sort((a, b) => b.createdAt - a.createdAt), [uploads]);

  const filtered = (items: UploadItem[]) =>
    query ? items.filter((u) => u.fileName.toLowerCase().includes(query.toLowerCase())) : items;

  const buckets = useMemo(() => ({
    active: filtered(list.filter((u) => u.status === 'uploading' || u.status === 'queued' || u.status === 'pending')),
    paused: filtered(list.filter((u) => u.status === 'paused')),
    completed: filtered(list.filter((u) => u.status === 'completed')),
    error: filtered(list.filter((u) => u.status === 'error')),
    all: filtered(list),
  }), [list, query]);

  const filteredHistory = query
    ? history.filter((e) => e.fileName.toLowerCase().includes(query.toLowerCase()))
    : history;

  const totalSpeed = list.filter((u) => u.status === 'uploading').reduce((s, u) => s + u.speed, 0);
  const totalBytes = list.reduce((s, u) => s + u.fileSize, 0);
  const uploadedBytes = list.reduce((s, u) => s + u.bytesUploaded, 0);

  const renderList = (items: UploadItem[], emptyLabel: string) => (
    <ScrollArea className="h-[calc(100vh-320px)] pr-3">
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <UploadCloud className="h-10 w-10 mb-3 opacity-50" />
          <p className="text-sm">{emptyLabel}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((u) => <ActiveRow key={u.id} u={u} />)}
        </div>
      )}
    </ScrollArea>
  );

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                <UploadCloud className="h-6 w-6 text-primary" />
                Upload Manager
              </h1>
              <p className="text-xs text-muted-foreground">
                Full view of your upload queue, active transfers and history.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={pauseAll} disabled={!isUploading}>
              <Pause className="h-4 w-4 mr-1.5" /> Pause all
            </Button>
            <Button variant="outline" size="sm" onClick={resumeAll}>
              <Play className="h-4 w-4 mr-1.5" /> Resume all
            </Button>
          </div>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="p-4">
            <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
              <Clock3 className="h-3 w-3" /> In queue
            </div>
            <div className="text-2xl font-bold tabular-nums">{getPendingCount()}</div>
            <div className="text-xs text-muted-foreground">{getActiveCount()} active</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
              <Zap className="h-3 w-3" /> Speed
            </div>
            <div className="text-2xl font-bold tabular-nums">{formatSpeed(totalSpeed)}</div>
            <div className="text-xs text-muted-foreground">{Math.round(getTotalProgress())}% overall</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground mb-1">Transferred</div>
            <div className="text-2xl font-bold tabular-nums">{formatBytes(uploadedBytes)}</div>
            <div className="text-xs text-muted-foreground">of {formatBytes(totalBytes)}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
              {networkState.isOnline ? <Wifi className="h-3 w-3 text-green-500" /> : <WifiOff className="h-3 w-3 text-destructive" />}
              Network
            </div>
            <div className="text-2xl font-bold">{networkState.isOnline ? 'Online' : 'Offline'}</div>
            <div className="text-xs text-muted-foreground">
              {networkState.retryCount > 0 ? `Retrying #${networkState.retryCount}` : 'Stable'}
            </div>
          </Card>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search uploads by filename…"
            className="pl-9"
          />
        </div>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid grid-cols-5 w-full">
            <TabsTrigger value="active" className="gap-1.5">
              Active <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">{buckets.active.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="paused" className="gap-1.5">
              Paused <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">{buckets.paused.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="completed" className="gap-1.5">
              Done <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">{buckets.completed.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="error" className="gap-1.5">
              Failed <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">{buckets.error.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-1.5">
              <HistoryIcon className="h-3 w-3" />
              History <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">{filteredHistory.length}</Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="mt-4">
            {renderList(buckets.active, 'No active uploads. Drop files anywhere to start.')}
          </TabsContent>
          <TabsContent value="paused" className="mt-4">
            {renderList(buckets.paused, 'No paused uploads.')}
          </TabsContent>
          <TabsContent value="completed" className="mt-4">
            <div className="flex justify-end mb-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => { clearCompleted(); toast.success('Cleared completed uploads'); }}
                disabled={buckets.completed.length === 0}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Clear
              </Button>
            </div>
            {renderList(buckets.completed, 'No completed uploads in this session.')}
          </TabsContent>
          <TabsContent value="error" className="mt-4">
            {renderList(buckets.error, 'No failed uploads. Nice.')}
          </TabsContent>
          <TabsContent value="history" className="mt-4">
            <div className="flex justify-between items-center mb-2">
              <p className="text-xs text-muted-foreground">
                Persistent log across sessions ({history.length} entries, max 500).
              </p>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => { clearHistory(); toast.success('History cleared'); }}
                disabled={history.length === 0}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Clear history
              </Button>
            </div>
            <ScrollArea className="h-[calc(100vh-360px)] pr-3">
              {filteredHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <HistoryIcon className="h-10 w-10 mb-3 opacity-50" />
                  <p className="text-sm">No upload history yet.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredHistory.map((e) => (
                    <HistoryRow key={e.id} e={e} onRemove={removeEntry} />
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Uploads;

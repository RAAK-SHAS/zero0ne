import { useState, useRef, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import {
  Play, Pause, SkipBack, SkipForward, Scissors, Volume2, VolumeX,
  X, Save, Download, Upload, Mic, Square, Waves, SlidersHorizontal, Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useEditorSave } from '@/hooks/useEditorSave';

interface AudioEditorProps {
  file: { id: string; name: string; mime_type: string | null; storage_path: string; user_id: string } | null;
  fileUrl: string | null;
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

const formatTime = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

export const AudioEditor = ({ file, fileUrl, open, onClose, onSaved }: AudioEditorProps) => {
  const waveformRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<any>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState([80]);
  const [isMuted, setIsMuted] = useState(false);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(100);
  const [isRecording, setIsRecording] = useState(false);
  const [loading, setLoading] = useState(true);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);

  const [fadeIn, setFadeIn] = useState([0]);
  const [fadeOut, setFadeOut] = useState([0]);
  const [bass, setBass] = useState([0]);
  const [treble, setTreble] = useState([0]);
  const [showEffects, setShowEffects] = useState(false);

  const { saveToCloud, downloadLocally, isSaving } = useEditorSave();

  useEffect(() => {
    if (!open || !fileUrl || !waveformRef.current) return;

    let ws: any = null;
    setLoading(true);

    const initWavesurfer = async () => {
      const WaveSurfer = (await import('wavesurfer.js')).default;
      if (wavesurferRef.current) wavesurferRef.current.destroy();

      ws = WaveSurfer.create({
        container: waveformRef.current!,
        waveColor: 'hsl(168, 60%, 30%)',
        progressColor: 'hsl(168, 100%, 50%)',
        cursorColor: 'hsl(168, 100%, 50%)',
        barWidth: 2, barGap: 1, barRadius: 2,
        height: 120, normalize: true, backend: 'WebAudio',
      });

      ws.on('ready', () => { setDuration(ws.getDuration()); setLoading(false); ws.setVolume(volume[0] / 100); });
      ws.on('audioprocess', () => setCurrentTime(ws.getCurrentTime()));
      ws.on('play', () => setIsPlaying(true));
      ws.on('pause', () => setIsPlaying(false));
      ws.on('finish', () => setIsPlaying(false));

      ws.load(fileUrl);
      wavesurferRef.current = ws;
    };

    initWavesurfer();
    return () => { if (ws) { ws.destroy(); wavesurferRef.current = null; } };
  }, [open, fileUrl]);

  const togglePlay = () => wavesurferRef.current?.playPause();
  const skipBack = () => { const ws = wavesurferRef.current; if (ws) ws.setTime(Math.max(0, ws.getCurrentTime() - 5)); };
  const skipForward = () => { const ws = wavesurferRef.current; if (ws) ws.setTime(Math.min(ws.getDuration(), ws.getCurrentTime() + 5)); };

  const handleVolumeChange = (val: number[]) => {
    setVolume(val);
    if (wavesurferRef.current) wavesurferRef.current.setVolume(val[0] / 100);
  };

  const toggleMute = () => {
    const ws = wavesurferRef.current;
    if (!ws) return;
    ws.setVolume(isMuted ? volume[0] / 100 : 0);
    setIsMuted(!isMuted);
  };

  const handleTrimChange = (val: number[]) => { setTrimStart(val[0]); setTrimEnd(val[1]); };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        setRecordedChunks(chunks);
        setRecordedBlob(blob);
        stream.getTracks().forEach(t => t.stop());
        toast.success('Recording saved!');
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setIsRecording(true);
      toast.info('Recording started...');
    } catch {
      toast.error('Microphone access denied');
    }
  };

  const stopRecording = () => { mediaRecorderRef.current?.stop(); setIsRecording(false); };

  const handleSaveRecordingToCloud = async () => {
    if (!file || !recordedBlob) return;
    const recordingPath = file.storage_path.replace(/\.[^.]+$/, '_recording.webm');
    await saveToCloud(recordedBlob, {
      fileId: file.id,
      fileName: `${file.name}_recording.webm`,
      storagePath: recordingPath,
      userId: file.user_id,
    });
    onSaved?.();
  };

  const handleSaveEditsToCloud = async () => {
    if (!file) return;
    const editData = {
      trimStart: (trimStart / 100) * duration,
      trimEnd: (trimEnd / 100) * duration,
      fadeIn: fadeIn[0], fadeOut: fadeOut[0],
      bass: bass[0], treble: treble[0],
    };
    const blob = new Blob([JSON.stringify(editData, null, 2)], { type: 'application/json' });
    const metadataPath = file.storage_path.replace(/\.[^.]+$/, '_edits.json');
    await saveToCloud(blob, {
      fileId: file.id,
      fileName: file.name,
      storagePath: metadataPath,
      userId: file.user_id,
    });
    onSaved?.();
  };

  const handleDownloadRecording = () => {
    if (!recordedBlob) return;
    downloadLocally(recordedBlob, `recording_${file?.name || 'audio'}.webm`);
  };

  if (!file || !fileUrl) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-4 py-3 border-b border-border glass shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <DialogTitle className="text-base truncate">{file.name}</DialogTitle>
              <Badge variant="secondary" className="text-xs font-mono">AUDIO EDITOR</Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="default" size="sm" onClick={handleSaveEditsToCloud} className="gap-1" disabled={isSaving}>
                {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                Save to Cloud
              </Button>
              <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
            </div>
          </div>
          <DialogDescription className="sr-only">Edit audio: {file.name}</DialogDescription>
        </DialogHeader>

        {/* Waveform */}
        <div className="px-6 pt-6 pb-2 bg-card/30">
          <div className="rounded-xl neon-border p-4 bg-background/50 relative overflow-hidden">
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-10">
                <div className="flex items-center gap-2 text-primary">
                  <Waves className="h-5 w-5 animate-pulse" /><span className="text-sm">Loading waveform...</span>
                </div>
              </div>
            )}
            <div ref={waveformRef} className="w-full" />
            <div className="absolute bottom-0 left-0 right-0 h-1">
              <div className="absolute h-full bg-primary/30" style={{ left: `${trimStart}%`, width: `${trimEnd - trimStart}%` }} />
            </div>
          </div>
          <div className="flex justify-between mt-2">
            <span className="text-xs font-mono tabular-nums text-muted-foreground">{formatTime(currentTime)}</span>
            <span className="text-xs font-mono tabular-nums text-muted-foreground">{formatTime(duration)}</span>
          </div>
        </div>

        {/* Trim */}
        <div className="px-6 py-2">
          <div className="flex items-center gap-2 mb-1">
            <Scissors className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs text-muted-foreground">
              Trim: {formatTime((trimStart / 100) * duration)} — {formatTime((trimEnd / 100) * duration)}
            </span>
          </div>
          <Slider value={[trimStart, trimEnd]} onValueChange={handleTrimChange} min={0} max={100} step={0.1} className="w-full" />
        </div>

        {/* Controls */}
        <div className="px-6 py-3 border-t border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={skipBack} className="h-8 w-8"><SkipBack className="h-4 w-4" /></Button>
            <Button variant="default" size="icon" onClick={togglePlay} className="h-10 w-10 rounded-full">
              {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={skipForward} className="h-8 w-8"><SkipForward className="h-4 w-4" /></Button>
          </div>

          <div className="flex items-center gap-3">
            <Button variant={isRecording ? 'destructive' : 'outline'} size="sm" onClick={isRecording ? stopRecording : startRecording} className="gap-1">
              {isRecording ? <Square className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
              <span className="text-xs">{isRecording ? 'Stop' : 'Record'}</span>
            </Button>

            <Button variant={showEffects ? 'default' : 'outline'} size="sm" onClick={() => setShowEffects(!showEffects)} className="gap-1">
              <SlidersHorizontal className="h-3.5 w-3.5" /><span className="text-xs">Effects</span>
            </Button>

            <Button variant="ghost" size="icon" onClick={toggleMute} className="h-8 w-8">
              {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </Button>
            <Slider value={volume} onValueChange={handleVolumeChange} min={0} max={100} step={1} className="w-20" />
          </div>
        </div>

        {/* Effects */}
        {showEffects && (
          <div className="px-6 py-4 border-t border-border bg-card/30 space-y-4">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-primary" /> Audio Effects
            </h4>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Fade In (sec)', value: fadeIn, setter: setFadeIn, min: 0, max: 10, step: 0.5, unit: 's' },
                { label: 'Fade Out (sec)', value: fadeOut, setter: setFadeOut, min: 0, max: 10, step: 0.5, unit: 's' },
                { label: 'Bass', value: bass, setter: setBass, min: -10, max: 10, step: 1, unit: 'dB' },
                { label: 'Treble', value: treble, setter: setTreble, min: -10, max: 10, step: 1, unit: 'dB' },
              ].map(({ label, value, setter, min, max, step, unit }) => (
                <div key={label}>
                  <label className="text-xs text-muted-foreground mb-1 block">{label}</label>
                  <Slider value={value} onValueChange={setter} min={min} max={max} step={step} />
                  <span className="text-xs text-primary tabular-nums">{value[0] > 0 ? '+' : ''}{value[0]}{unit}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recording info */}
        {recordedBlob && (
          <div className="px-6 py-2 border-t border-border flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              <Mic className="h-3 w-3 mr-1" /> Recording captured
            </Badge>
            <Button variant="outline" size="sm" onClick={handleDownloadRecording} className="gap-1 text-xs">
              <Download className="h-3 w-3" /> Download
            </Button>
            <Button variant="default" size="sm" onClick={handleSaveRecordingToCloud} className="gap-1 text-xs" disabled={isSaving}>
              <Upload className="h-3 w-3" /> Save to Cloud
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

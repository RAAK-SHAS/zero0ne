import { useState, useRef, useCallback, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import {
  Play, Pause, SkipBack, SkipForward, Scissors, Type, Volume2, VolumeX,
  X, Save, Maximize2, RotateCcw, Clock, Film,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface VideoEditorProps {
  file: { id: string; name: string; mime_type: string | null } | null;
  fileUrl: string | null;
  open: boolean;
  onClose: () => void;
}

const formatTime = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
};

export const VideoEditor = ({ file, fileUrl, open, onClose }: VideoEditorProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(100);
  const [volume, setVolume] = useState([100]);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [textOverlay, setTextOverlay] = useState('');
  const [showTextOverlay, setShowTextOverlay] = useState(false);
  const [overlayPosition, setOverlayPosition] = useState<'top' | 'center' | 'bottom'>('bottom');
  const [overlayColor, setOverlayColor] = useState('hsl(168, 100%, 50%)');

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    const handleLoadedMetadata = () => {
      setDuration(video.duration);
      setTrimEnd(100);
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, [fileUrl]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  const seek = (time: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = time;
    setCurrentTime(time);
  };

  const handleTimelineChange = (val: number[]) => {
    seek((val[0] / 100) * duration);
  };

  const handleTrimChange = (val: number[]) => {
    setTrimStart(val[0]);
    setTrimEnd(val[1]);
  };

  const handleVolumeChange = (val: number[]) => {
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val[0] / 100;
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(!isMuted);
  };

  const changeSpeed = () => {
    const speeds = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];
    const idx = speeds.indexOf(playbackSpeed);
    const next = speeds[(idx + 1) % speeds.length];
    setPlaybackSpeed(next);
    if (videoRef.current) videoRef.current.playbackRate = next;
  };

  const handleSave = () => {
    const trimStartTime = (trimStart / 100) * duration;
    const trimEndTime = (trimEnd / 100) * duration;
    toast.success(`Video trim set: ${formatTime(trimStartTime)} - ${formatTime(trimEndTime)}`);
  };

  const skipBack = () => seek(Math.max(0, currentTime - 5));
  const skipForward = () => seek(Math.min(duration, currentTime + 5));
  const goToTrimStart = () => seek((trimStart / 100) * duration);

  if (!file || !fileUrl) return null;

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const trimStartTime = (trimStart / 100) * duration;
  const trimEndTime = (trimEnd / 100) * duration;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] w-[95vw] h-[95vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-4 py-3 border-b border-border glass shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <DialogTitle className="text-base truncate">{file.name}</DialogTitle>
              <Badge variant="secondary" className="text-xs font-mono">VIDEO EDITOR</Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleSave} className="gap-1">
                <Save className="h-3.5 w-3.5" /> Save
              </Button>
              <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
            </div>
          </div>
          <DialogDescription className="sr-only">Edit video: {file.name}</DialogDescription>
        </DialogHeader>

        {/* Video Preview */}
        <div className="flex-1 bg-black flex items-center justify-center relative overflow-hidden">
          <video
            ref={videoRef}
            src={fileUrl}
            className="max-w-full max-h-full object-contain"
            onClick={togglePlay}
          />

          {/* Text overlay preview */}
          {showTextOverlay && textOverlay && (
            <div className={cn(
              "absolute left-0 right-0 flex justify-center pointer-events-none",
              overlayPosition === 'top' && "top-8",
              overlayPosition === 'center' && "top-1/2 -translate-y-1/2",
              overlayPosition === 'bottom' && "bottom-16",
            )}>
              <span
                className="px-4 py-2 rounded-lg text-lg font-bold backdrop-blur-sm"
                style={{
                  color: overlayColor,
                  backgroundColor: 'rgba(0,0,0,0.6)',
                  textShadow: `0 0 10px ${overlayColor}`,
                }}
              >
                {textOverlay}
              </span>
            </div>
          )}

          {/* Play button overlay */}
          {!isPlaying && (
            <button
              onClick={togglePlay}
              className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/30 transition-colors"
            >
              <div className="h-16 w-16 rounded-full bg-primary/80 flex items-center justify-center backdrop-blur-sm">
                <Play className="h-8 w-8 text-primary-foreground ml-1" />
              </div>
            </button>
          )}
        </div>

        {/* Timeline & Controls */}
        <div className="shrink-0 border-t border-border bg-card/80 glass">
          {/* Trim range */}
          <div className="px-4 pt-3">
            <div className="flex items-center gap-2 mb-1">
              <Scissors className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs text-muted-foreground">Trim: {formatTime(trimStartTime)} — {formatTime(trimEndTime)}</span>
            </div>
            <div className="relative">
              {/* Trim markers */}
              <Slider
                value={[trimStart, trimEnd]}
                onValueChange={handleTrimChange}
                min={0} max={100} step={0.1}
                className="w-full"
              />
              {/* Playhead indicator */}
              <div
                className="absolute top-0 h-full w-0.5 bg-primary z-10 pointer-events-none"
                style={{ left: `${progress}%` }}
              />
            </div>
          </div>

          {/* Playback timeline */}
          <div className="px-4 pt-2">
            <Slider
              value={[progress]}
              onValueChange={handleTimelineChange}
              min={0} max={100} step={0.01}
              className="w-full"
            />
          </div>

          {/* Controls */}
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={skipBack} className="h-8 w-8">
                <SkipBack className="h-4 w-4" />
              </Button>
              <Button variant="default" size="icon" onClick={togglePlay} className="h-10 w-10 rounded-full">
                {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
              </Button>
              <Button variant="ghost" size="icon" onClick={skipForward} className="h-8 w-8">
                <SkipForward className="h-4 w-4" />
              </Button>

              <span className="text-xs font-mono tabular-nums text-muted-foreground ml-2">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Text overlay toggle */}
              <div className="flex items-center gap-2">
                <Button
                  variant={showTextOverlay ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setShowTextOverlay(!showTextOverlay)}
                  className="gap-1"
                >
                  <Type className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline text-xs">Text</span>
                </Button>
                {showTextOverlay && (
                  <Input
                    value={textOverlay}
                    onChange={e => setTextOverlay(e.target.value)}
                    placeholder="Overlay text..."
                    className="w-40 h-8 text-xs"
                  />
                )}
              </div>

              {/* Speed */}
              <Button variant="ghost" size="sm" onClick={changeSpeed} className="gap-1 font-mono text-xs">
                <Clock className="h-3.5 w-3.5" />
                {playbackSpeed}x
              </Button>

              {/* Volume */}
              <Button variant="ghost" size="icon" onClick={toggleMute} className="h-8 w-8">
                {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </Button>
              <Slider
                value={volume}
                onValueChange={handleVolumeChange}
                min={0} max={100} step={1}
                className="w-20"
              />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

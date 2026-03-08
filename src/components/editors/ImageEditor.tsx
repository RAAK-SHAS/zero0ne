import { useState, useRef, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import {
  RotateCw, RotateCcw, FlipHorizontal, FlipVertical, Crop, Download,
  X, Save, Sun, Contrast, Droplets, Palette, Undo2, Redo2, ZoomIn, ZoomOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ImageEditorProps {
  file: { id: string; name: string } | null;
  fileUrl: string | null;
  open: boolean;
  onClose: () => void;
}

interface ImageState {
  rotation: number;
  flipH: boolean;
  flipV: boolean;
  brightness: number;
  contrast: number;
  saturation: number;
  blur: number;
  sepia: number;
  hueRotate: number;
}

const defaultState: ImageState = {
  rotation: 0,
  flipH: false,
  flipV: false,
  brightness: 100,
  contrast: 100,
  saturation: 100,
  blur: 0,
  sepia: 0,
  hueRotate: 0,
};

const PRESETS = [
  { name: 'Original', state: { ...defaultState } },
  { name: 'Vintage', state: { ...defaultState, sepia: 60, contrast: 110, saturation: 80, brightness: 95 } },
  { name: 'Vivid', state: { ...defaultState, saturation: 150, contrast: 120, brightness: 105 } },
  { name: 'Cool', state: { ...defaultState, hueRotate: 180, saturation: 80 } },
  { name: 'Warm', state: { ...defaultState, hueRotate: 30, saturation: 110 } },
  { name: 'B&W', state: { ...defaultState, saturation: 0, contrast: 120 } },
  { name: 'Neon', state: { ...defaultState, saturation: 200, contrast: 150, brightness: 110, hueRotate: 90 } },
  { name: 'Fade', state: { ...defaultState, brightness: 115, contrast: 80, saturation: 80 } },
];

export const ImageEditor = ({ file, fileUrl, open, onClose }: ImageEditorProps) => {
  const [state, setState] = useState<ImageState>({ ...defaultState });
  const [undoStack, setUndoStack] = useState<ImageState[]>([]);
  const [redoStack, setRedoStack] = useState<ImageState[]>([]);
  const [zoom, setZoom] = useState(100);
  const [isCropping, setIsCropping] = useState(false);
  const [cropStart, setCropStart] = useState<{ x: number; y: number } | null>(null);
  const [cropEnd, setCropEnd] = useState<{ x: number; y: number } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (open) {
      setState({ ...defaultState });
      setUndoStack([]);
      setRedoStack([]);
      setZoom(100);
    }
  }, [open, fileUrl]);

  const pushState = useCallback(() => {
    setUndoStack(prev => [...prev, { ...state }]);
    setRedoStack([]);
  }, [state]);

  const updateState = (partial: Partial<ImageState>) => {
    pushState();
    setState(prev => ({ ...prev, ...partial }));
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    setRedoStack(r => [...r, state]);
    setState(undoStack[undoStack.length - 1]);
    setUndoStack(u => u.slice(0, -1));
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    setUndoStack(u => [...u, state]);
    setState(redoStack[redoStack.length - 1]);
    setRedoStack(r => r.slice(0, -1));
  };

  const getFilterString = () => {
    return [
      `brightness(${state.brightness}%)`,
      `contrast(${state.contrast}%)`,
      `saturate(${state.saturation}%)`,
      `blur(${state.blur}px)`,
      `sepia(${state.sepia}%)`,
      `hue-rotate(${state.hueRotate}deg)`,
    ].join(' ');
  };

  const getTransformString = () => {
    const parts = [];
    parts.push(`scale(${zoom / 100})`);
    parts.push(`rotate(${state.rotation}deg)`);
    if (state.flipH) parts.push('scaleX(-1)');
    if (state.flipV) parts.push('scaleY(-1)');
    return parts.join(' ');
  };

  const handleDownload = () => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const rad = (state.rotation * Math.PI) / 180;
      const sin = Math.abs(Math.sin(rad));
      const cos = Math.abs(Math.cos(rad));
      canvas.width = img.width * cos + img.height * sin;
      canvas.height = img.width * sin + img.height * cos;
      const ctx = canvas.getContext('2d')!;
      ctx.filter = getFilterString();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(rad);
      if (state.flipH) ctx.scale(-1, 1);
      if (state.flipV) ctx.scale(1, -1);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      
      const link = document.createElement('a');
      link.download = `edited_${file?.name || 'image.png'}`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      toast.success('Image downloaded!');
    };
    img.src = fileUrl!;
  };

  const handleReset = () => {
    pushState();
    setState({ ...defaultState });
    setZoom(100);
  };

  if (!file || !fileUrl) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] w-[95vw] h-[95vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-4 py-3 border-b border-border glass shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <DialogTitle className="text-base truncate">{file.name}</DialogTitle>
              <Badge variant="secondary" className="text-xs font-mono">IMAGE EDITOR</Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleReset} className="gap-1">
                <Undo2 className="h-3.5 w-3.5" /> Reset
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownload} className="gap-1">
                <Download className="h-3.5 w-3.5" /> Export
              </Button>
              <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
            </div>
          </div>
          <DialogDescription className="sr-only">Edit image: {file.name}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-1 min-h-0">
          {/* Image canvas */}
          <div className="flex-1 flex items-center justify-center bg-muted/20 overflow-hidden relative">
            <img
              src={fileUrl}
              alt={file.name}
              className="max-w-full max-h-full object-contain transition-all duration-300"
              style={{
                filter: getFilterString(),
                transform: getTransformString(),
              }}
            />
          </div>

          {/* Tools panel */}
          <div className="w-72 border-l border-border bg-card/50 glass overflow-y-auto shrink-0">
            <div className="p-4 space-y-6">
              {/* Transform tools */}
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Transform</h4>
                <div className="grid grid-cols-4 gap-1">
                  <Button variant="ghost" size="sm" onClick={() => updateState({ rotation: state.rotation - 90 })} title="Rotate Left">
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => updateState({ rotation: state.rotation + 90 })} title="Rotate Right">
                    <RotateCw className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => updateState({ flipH: !state.flipH })} title="Flip Horizontal">
                    <FlipHorizontal className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => updateState({ flipV: !state.flipV })} title="Flip Vertical">
                    <FlipVertical className="h-4 w-4" />
                  </Button>
                </div>

                {/* Zoom */}
                <div className="mt-3 flex items-center gap-2">
                  <ZoomOut className="h-3.5 w-3.5 text-muted-foreground" />
                  <Slider value={[zoom]} onValueChange={v => setZoom(v[0])} min={25} max={300} step={5} className="flex-1" />
                  <ZoomIn className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs tabular-nums w-10 text-right">{zoom}%</span>
                </div>
              </div>

              {/* Adjustments */}
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Adjustments</h4>
                <div className="space-y-3">
                  {[
                    { icon: Sun, label: 'Brightness', key: 'brightness' as const, min: 0, max: 200 },
                    { icon: Contrast, label: 'Contrast', key: 'contrast' as const, min: 0, max: 200 },
                    { icon: Droplets, label: 'Saturation', key: 'saturation' as const, min: 0, max: 200 },
                    { icon: Palette, label: 'Hue', key: 'hueRotate' as const, min: 0, max: 360 },
                  ].map(({ icon: Icon, label, key, min, max }) => (
                    <div key={key}>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <Icon className="h-3 w-3" /> {label}
                        </label>
                        <span className="text-xs text-primary tabular-nums">{state[key]}{key === 'hueRotate' ? '°' : '%'}</span>
                      </div>
                      <Slider
                        value={[state[key]]}
                        onValueChange={v => updateState({ [key]: v[0] })}
                        min={min} max={max} step={1}
                      />
                    </div>
                  ))}

                  {/* Blur */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs text-muted-foreground">Blur</label>
                      <span className="text-xs text-primary tabular-nums">{state.blur}px</span>
                    </div>
                    <Slider value={[state.blur]} onValueChange={v => updateState({ blur: v[0] })} min={0} max={20} step={0.5} />
                  </div>

                  {/* Sepia */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs text-muted-foreground">Sepia</label>
                      <span className="text-xs text-primary tabular-nums">{state.sepia}%</span>
                    </div>
                    <Slider value={[state.sepia]} onValueChange={v => updateState({ sepia: v[0] })} min={0} max={100} step={1} />
                  </div>
                </div>
              </div>

              {/* Presets */}
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Presets</h4>
                <div className="grid grid-cols-2 gap-1.5">
                  {PRESETS.map(preset => (
                    <Button
                      key={preset.name}
                      variant="outline"
                      size="sm"
                      className="text-xs justify-start"
                      onClick={() => {
                        pushState();
                        setState(prev => ({ ...prev, ...preset.state }));
                      }}
                    >
                      {preset.name}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Undo/Redo */}
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1 gap-1" onClick={handleUndo} disabled={undoStack.length === 0}>
                  <Undo2 className="h-3.5 w-3.5" /> Undo
                </Button>
                <Button variant="outline" size="sm" className="flex-1 gap-1" onClick={handleRedo} disabled={redoStack.length === 0}>
                  <Redo2 className="h-3.5 w-3.5" /> Redo
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

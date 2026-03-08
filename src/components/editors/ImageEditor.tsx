import { useState, useRef, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import {
  RotateCw, RotateCcw, FlipHorizontal, FlipVertical, Crop, Download, Upload,
  X, Save, Sun, Contrast, Droplets, Palette, Undo2, Redo2, ZoomIn, ZoomOut,
  Type, PenTool, Square, Loader2, MousePointer, Eraser,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useEditorSave } from '@/hooks/useEditorSave';

interface ImageEditorProps {
  file: { id: string; name: string; storage_path: string; user_id: string } | null;
  fileUrl: string | null;
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
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

interface DrawingItem {
  id: string;
  type: 'freehand' | 'text' | 'rect';
  color: string;
  points?: { x: number; y: number }[];
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  text?: string;
  fontSize?: number;
  lineWidth?: number;
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

type DrawTool = 'none' | 'freehand' | 'text' | 'rect' | 'eraser';

const DRAW_COLORS = ['#ef4444', '#22c55e', '#3b82f6', '#f59e0b', '#a855f7', '#ffffff', '#000000'];

export const ImageEditor = ({ file, fileUrl, open, onClose, onSaved }: ImageEditorProps) => {
  const [state, setState] = useState<ImageState>({ ...defaultState });
  const [undoStack, setUndoStack] = useState<ImageState[]>([]);
  const [redoStack, setRedoStack] = useState<ImageState[]>([]);
  const [zoom, setZoom] = useState(100);
  const [isCropping, setIsCropping] = useState(false);
  const [cropStart, setCropStart] = useState<{ x: number; y: number } | null>(null);
  const [cropEnd, setCropEnd] = useState<{ x: number; y: number } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // Drawing state
  const [drawTool, setDrawTool] = useState<DrawTool>('none');
  const [drawings, setDrawings] = useState<DrawingItem[]>([]);
  const [drawColor, setDrawColor] = useState('#ef4444');
  const [drawLineWidth, setDrawLineWidth] = useState(3);
  const [isDrawingActive, setIsDrawingActive] = useState(false);
  const [currentDrawPoints, setCurrentDrawPoints] = useState<{ x: number; y: number }[]>([]);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [textInput, setTextInput] = useState('');
  const [textPos, setTextPos] = useState<{ x: number; y: number } | null>(null);

  const { saveToCloud, downloadLocally, isSaving } = useEditorSave();

  useEffect(() => {
    if (open) {
      setState({ ...defaultState });
      setUndoStack([]);
      setRedoStack([]);
      setZoom(100);
      setDrawings([]);
      setDrawTool('none');
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

  const getOverlayPos = (e: React.MouseEvent) => {
    const overlay = overlayRef.current;
    if (!overlay) return { x: 0, y: 0 };
    const rect = overlay.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    };
  };

  const handleOverlayMouseDown = (e: React.MouseEvent) => {
    if (drawTool === 'none') return;
    const pos = getOverlayPos(e);
    if (drawTool === 'freehand') {
      setIsDrawingActive(true);
      setCurrentDrawPoints([pos]);
    } else if (drawTool === 'rect') {
      setIsDrawingActive(true);
      setDrawStart(pos);
    } else if (drawTool === 'text') {
      setTextPos(pos);
    } else if (drawTool === 'eraser') {
      setDrawings(prev => prev.filter(d => {
        if (d.type === 'freehand' && d.points) {
          return !d.points.some(p => Math.sqrt((p.x - pos.x) ** 2 + (p.y - pos.y) ** 2) < 5);
        }
        if (d.x !== undefined && d.y !== undefined) {
          return Math.sqrt((d.x - pos.x) ** 2 + (d.y - pos.y) ** 2) > 5;
        }
        return true;
      }));
    }
  };

  const handleOverlayMouseMove = (e: React.MouseEvent) => {
    if (!isDrawingActive) return;
    const pos = getOverlayPos(e);
    if (drawTool === 'freehand') {
      setCurrentDrawPoints(prev => [...prev, pos]);
    }
  };

  const handleOverlayMouseUp = (e: React.MouseEvent) => {
    if (!isDrawingActive) return;
    setIsDrawingActive(false);
    const pos = getOverlayPos(e);

    if (drawTool === 'freehand' && currentDrawPoints.length > 1) {
      setDrawings(prev => [...prev, {
        id: crypto.randomUUID(),
        type: 'freehand',
        color: drawColor,
        points: currentDrawPoints,
        lineWidth: drawLineWidth,
      }]);
      setCurrentDrawPoints([]);
    } else if (drawTool === 'rect' && drawStart) {
      setDrawings(prev => [...prev, {
        id: crypto.randomUUID(),
        type: 'rect',
        color: drawColor,
        x: Math.min(drawStart.x, pos.x),
        y: Math.min(drawStart.y, pos.y),
        width: Math.abs(pos.x - drawStart.x),
        height: Math.abs(pos.y - drawStart.y),
        lineWidth: drawLineWidth,
      }]);
      setDrawStart(null);
    }
  };

  const addTextDrawing = () => {
    if (!textPos || !textInput.trim()) return;
    setDrawings(prev => [...prev, {
      id: crypto.randomUUID(),
      type: 'text',
      color: drawColor,
      x: textPos.x,
      y: textPos.y,
      text: textInput,
      fontSize: 16,
    }]);
    setTextInput('');
    setTextPos(null);
  };

  const renderToCanvas = (): Promise<HTMLCanvasElement> => {
    return new Promise((resolve) => {
      const img = new window.Image();
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

        // Reset transform for drawings
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.filter = 'none';

        // Draw overlays
        for (const d of drawings) {
          if (d.type === 'freehand' && d.points && d.points.length > 1) {
            ctx.strokeStyle = d.color;
            ctx.lineWidth = d.lineWidth || 3;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.beginPath();
            ctx.moveTo((d.points[0].x / 100) * canvas.width, (d.points[0].y / 100) * canvas.height);
            for (let i = 1; i < d.points.length; i++) {
              ctx.lineTo((d.points[i].x / 100) * canvas.width, (d.points[i].y / 100) * canvas.height);
            }
            ctx.stroke();
          }
          if (d.type === 'rect' && d.x !== undefined && d.y !== undefined) {
            ctx.strokeStyle = d.color;
            ctx.lineWidth = d.lineWidth || 3;
            ctx.strokeRect(
              (d.x / 100) * canvas.width, (d.y / 100) * canvas.height,
              ((d.width || 0) / 100) * canvas.width, ((d.height || 0) / 100) * canvas.height
            );
          }
          if (d.type === 'text' && d.x !== undefined && d.y !== undefined) {
            ctx.fillStyle = d.color;
            ctx.font = `${d.fontSize || 16}px sans-serif`;
            ctx.fillText(d.text || '', (d.x / 100) * canvas.width, (d.y / 100) * canvas.height);
          }
        }

        resolve(canvas);
      };
      img.src = fileUrl!;
    });
  };

  const handleDownload = async () => {
    const canvas = await renderToCanvas();
    canvas.toBlob(blob => {
      if (blob) downloadLocally(blob, file?.name || 'image.png');
    }, 'image/png');
  };

  const handleSaveToCloud = async () => {
    if (!file) return;
    const canvas = await renderToCanvas();
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      await saveToCloud(blob, {
        fileId: file.id,
        fileName: file.name,
        storagePath: file.storage_path,
        userId: file.user_id,
      });
      onSaved?.();
    }, 'image/png');
  };

  const handleReset = () => {
    pushState();
    setState({ ...defaultState });
    setZoom(100);
    setDrawings([]);
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
              <Button variant="default" size="sm" onClick={handleSaveToCloud} className="gap-1" disabled={isSaving}>
                {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                Save to Cloud
              </Button>
              <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
            </div>
          </div>
          <DialogDescription className="sr-only">Edit image: {file.name}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-1 min-h-0">
          {/* Image canvas */}
          <div className="flex-1 flex items-center justify-center bg-muted/20 overflow-hidden relative">
            <div className="relative">
              <img
                src={fileUrl}
                alt={file.name}
                className="max-w-full max-h-full object-contain transition-all duration-300"
                style={{
                  filter: getFilterString(),
                  transform: getTransformString(),
                }}
              />
              {/* Drawing overlay */}
              <div
                ref={overlayRef}
                className="absolute inset-0"
                style={{ cursor: drawTool !== 'none' ? 'crosshair' : 'default' }}
                onMouseDown={handleOverlayMouseDown}
                onMouseMove={handleOverlayMouseMove}
                onMouseUp={handleOverlayMouseUp}
              >
                <svg className="w-full h-full absolute inset-0 pointer-events-none">
                  {drawings.map(d => {
                    if (d.type === 'freehand' && d.points && d.points.length > 1) {
                      return (
                        <path
                          key={d.id}
                          d={d.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x}% ${p.y}%`).join(' ')}
                          fill="none"
                          stroke={d.color}
                          strokeWidth={d.lineWidth || 3}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          vectorEffect="non-scaling-stroke"
                        />
                      );
                    }
                    if (d.type === 'rect') {
                      return (
                        <rect
                          key={d.id}
                          x={`${d.x}%`} y={`${d.y}%`}
                          width={`${d.width}%`} height={`${d.height}%`}
                          fill="none" stroke={d.color}
                          strokeWidth={d.lineWidth || 3}
                          vectorEffect="non-scaling-stroke"
                        />
                      );
                    }
                    if (d.type === 'text') {
                      return (
                        <text
                          key={d.id}
                          x={`${d.x}%`} y={`${d.y}%`}
                          fill={d.color}
                          fontSize={d.fontSize || 16}
                          fontFamily="sans-serif"
                        >
                          {d.text}
                        </text>
                      );
                    }
                    return null;
                  })}
                  {/* Current freehand drawing */}
                  {currentDrawPoints.length > 1 && (
                    <path
                      d={currentDrawPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x}% ${p.y}%`).join(' ')}
                      fill="none"
                      stroke={drawColor}
                      strokeWidth={drawLineWidth}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      vectorEffect="non-scaling-stroke"
                    />
                  )}
                </svg>
              </div>
            </div>

            {/* Text input popup */}
            {textPos && (
              <div className="absolute z-50 top-8 left-1/2 -translate-x-1/2 bg-card border border-border rounded-lg p-3 shadow-lg flex gap-2">
                <Input
                  value={textInput}
                  onChange={e => setTextInput(e.target.value)}
                  placeholder="Add text..."
                  className="w-48"
                  autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') addTextDrawing(); if (e.key === 'Escape') setTextPos(null); }}
                />
                <Button size="sm" onClick={addTextDrawing}>Add</Button>
                <Button size="sm" variant="ghost" onClick={() => setTextPos(null)}>✕</Button>
              </div>
            )}
          </div>

          {/* Tools panel */}
          <div className="w-72 border-l border-border bg-card/50 glass overflow-y-auto shrink-0">
            <div className="p-4 space-y-6">
              {/* Drawing tools */}
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Draw & Annotate</h4>
                <div className="grid grid-cols-5 gap-1">
                  <Button variant={drawTool === 'none' ? 'default' : 'ghost'} size="sm" onClick={() => setDrawTool('none')} title="None">
                    <MousePointer className="h-4 w-4" />
                  </Button>
                  <Button variant={drawTool === 'freehand' ? 'default' : 'ghost'} size="sm" onClick={() => setDrawTool('freehand')} title="Freehand">
                    <PenTool className="h-4 w-4" />
                  </Button>
                  <Button variant={drawTool === 'rect' ? 'default' : 'ghost'} size="sm" onClick={() => setDrawTool('rect')} title="Rectangle">
                    <Square className="h-4 w-4" />
                  </Button>
                  <Button variant={drawTool === 'text' ? 'default' : 'ghost'} size="sm" onClick={() => setDrawTool('text')} title="Text">
                    <Type className="h-4 w-4" />
                  </Button>
                  <Button variant={drawTool === 'eraser' ? 'default' : 'ghost'} size="sm" onClick={() => setDrawTool('eraser')} title="Eraser">
                    <Eraser className="h-4 w-4" />
                  </Button>
                </div>
                {drawTool !== 'none' && (
                  <div className="mt-2 space-y-2">
                    <div className="flex items-center gap-1">
                      {DRAW_COLORS.map(c => (
                        <button
                          key={c}
                          className={cn("h-5 w-5 rounded-full border-2", drawColor === c ? "border-primary ring-1 ring-primary" : "border-border")}
                          style={{ backgroundColor: c }}
                          onClick={() => setDrawColor(c)}
                        />
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Width</span>
                      <Slider value={[drawLineWidth]} onValueChange={v => setDrawLineWidth(v[0])} min={1} max={10} step={1} className="flex-1" />
                      <span className="text-xs tabular-nums">{drawLineWidth}</span>
                    </div>
                    {drawings.length > 0 && (
                      <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => setDrawings([])}>
                        Clear Drawings
                      </Button>
                    )}
                  </div>
                )}
              </div>

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

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs text-muted-foreground">Blur</label>
                      <span className="text-xs text-primary tabular-nums">{state.blur}px</span>
                    </div>
                    <Slider value={[state.blur]} onValueChange={v => updateState({ blur: v[0] })} min={0} max={20} step={0.5} />
                  </div>

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

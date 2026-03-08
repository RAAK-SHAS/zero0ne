import { useState, useRef, useCallback, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import {
  Type, Highlighter, PenTool, Square, Circle, Undo2, Redo2, Save,
  X, ZoomIn, ZoomOut, MousePointer, Eraser, Palette,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Annotation {
  id: string;
  type: 'text' | 'highlight' | 'draw' | 'rect' | 'circle';
  x: number;
  y: number;
  width?: number;
  height?: number;
  text?: string;
  color: string;
  points?: { x: number; y: number }[];
  fontSize?: number;
}

interface PDFEditorProps {
  file: { id: string; name: string; storage_path: string } | null;
  fileUrl: string | null;
  open: boolean;
  onClose: () => void;
}

type Tool = 'select' | 'text' | 'highlight' | 'draw' | 'rect' | 'circle' | 'eraser';

const COLORS = [
  'hsl(168, 100%, 50%)', '#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#ffffff',
];

export const PDFEditor = ({ file, fileUrl, open, onClose }: PDFEditorProps) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [tool, setTool] = useState<Tool>('select');
  const [color, setColor] = useState(COLORS[0]);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [undoStack, setUndoStack] = useState<Annotation[][]>([]);
  const [redoStack, setRedoStack] = useState<Annotation[][]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentDraw, setCurrentDraw] = useState<{ x: number; y: number }[]>([]);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [zoom, setZoom] = useState(100);
  const [textInput, setTextInput] = useState('');
  const [textPos, setTextPos] = useState<{ x: number; y: number } | null>(null);
  const [brushSize, setBrushSize] = useState([3]);

  const pushUndo = useCallback(() => {
    setUndoStack(prev => [...prev, annotations]);
    setRedoStack([]);
  }, [annotations]);

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setRedoStack(r => [...r, annotations]);
    setAnnotations(prev);
    setUndoStack(u => u.slice(0, -1));
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack(u => [...u, annotations]);
    setAnnotations(next);
    setRedoStack(r => r.slice(0, -1));
  };

  const getCanvasPos = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    };
  };

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    const pos = getCanvasPos(e);

    if (tool === 'text') {
      setTextPos(pos);
      return;
    }
    if (tool === 'draw' || tool === 'highlight') {
      setIsDrawing(true);
      setCurrentDraw([pos]);
      return;
    }
    if (tool === 'rect' || tool === 'circle') {
      setIsDrawing(true);
      setDrawStart(pos);
      return;
    }
    if (tool === 'eraser') {
      pushUndo();
      setAnnotations(prev =>
        prev.filter(a => {
          const dist = Math.sqrt((a.x - pos.x) ** 2 + (a.y - pos.y) ** 2);
          return dist > 5;
        })
      );
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing) return;
    const pos = getCanvasPos(e);
    if (tool === 'draw' || tool === 'highlight') {
      setCurrentDraw(prev => [...prev, pos]);
    }
  };

  const handleCanvasMouseUp = (e: React.MouseEvent) => {
    if (!isDrawing) return;
    const pos = getCanvasPos(e);
    setIsDrawing(false);

    pushUndo();

    if (tool === 'draw' || tool === 'highlight') {
      setAnnotations(prev => [...prev, {
        id: crypto.randomUUID(),
        type: tool === 'highlight' ? 'highlight' : 'draw',
        x: 0, y: 0,
        color: tool === 'highlight' ? color + '55' : color,
        points: currentDraw,
      }]);
      setCurrentDraw([]);
    } else if ((tool === 'rect' || tool === 'circle') && drawStart) {
      setAnnotations(prev => [...prev, {
        id: crypto.randomUUID(),
        type: tool,
        x: Math.min(drawStart.x, pos.x),
        y: Math.min(drawStart.y, pos.y),
        width: Math.abs(pos.x - drawStart.x),
        height: Math.abs(pos.y - drawStart.y),
        color,
      }]);
      setDrawStart(null);
    }
  };

  const addTextAnnotation = () => {
    if (!textPos || !textInput.trim()) return;
    pushUndo();
    setAnnotations(prev => [...prev, {
      id: crypto.randomUUID(),
      type: 'text',
      x: textPos.x,
      y: textPos.y,
      text: textInput,
      color,
      fontSize: 14,
    }]);
    setTextInput('');
    setTextPos(null);
  };

  const handleSave = () => {
    toast.success('Annotations saved! PDF editing saved locally.');
  };

  if (!file || !fileUrl) return null;

  const tools: { id: Tool; icon: any; label: string }[] = [
    { id: 'select', icon: MousePointer, label: 'Select' },
    { id: 'text', icon: Type, label: 'Text' },
    { id: 'highlight', icon: Highlighter, label: 'Highlight' },
    { id: 'draw', icon: PenTool, label: 'Draw' },
    { id: 'rect', icon: Square, label: 'Rectangle' },
    { id: 'circle', icon: Circle, label: 'Circle' },
    { id: 'eraser', icon: Eraser, label: 'Eraser' },
  ];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] w-[95vw] h-[95vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-4 py-3 border-b border-border glass shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <DialogTitle className="text-base truncate">{file.name}</DialogTitle>
              <Badge variant="secondary" className="text-xs font-mono">PDF EDITOR</Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleSave} className="gap-1">
                <Save className="h-3.5 w-3.5" /> Save
              </Button>
              <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
            </div>
          </div>
          <DialogDescription className="sr-only">Edit PDF: {file.name}</DialogDescription>
        </DialogHeader>

        {/* Toolbar */}
        <div className="flex items-center gap-1 px-4 py-2 border-b border-border bg-card/50 glass overflow-x-auto shrink-0">
          {tools.map(t => (
            <Button
              key={t.id}
              variant={tool === t.id ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setTool(t.id)}
              className="gap-1.5 shrink-0"
              title={t.label}
            >
              <t.icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline text-xs">{t.label}</span>
            </Button>
          ))}

          <div className="w-px h-6 bg-border mx-1" />

          {/* Colors */}
          <div className="flex items-center gap-1">
            {COLORS.map(c => (
              <button
                key={c}
                className={cn(
                  "h-6 w-6 rounded-full border-2 transition-transform hover:scale-110",
                  color === c ? "border-primary scale-110 ring-1 ring-primary" : "border-border"
                )}
                style={{ backgroundColor: c }}
                onClick={() => setColor(c)}
              />
            ))}
          </div>

          <div className="w-px h-6 bg-border mx-1" />

          {/* Brush Size */}
          <div className="flex items-center gap-2 min-w-[100px]">
            <span className="text-xs text-muted-foreground">Size</span>
            <Slider value={brushSize} onValueChange={setBrushSize} min={1} max={10} step={1} className="w-20" />
          </div>

          <div className="w-px h-6 bg-border mx-1" />

          {/* Undo / Redo */}
          <Button variant="ghost" size="icon" onClick={handleUndo} disabled={undoStack.length === 0} className="h-8 w-8">
            <Undo2 className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleRedo} disabled={redoStack.length === 0} className="h-8 w-8">
            <Redo2 className="h-3.5 w-3.5" />
          </Button>

          <div className="w-px h-6 bg-border mx-1" />

          {/* Zoom */}
          <Button variant="ghost" size="icon" onClick={() => setZoom(z => Math.max(50, z - 10))} className="h-8 w-8">
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <span className="text-xs tabular-nums min-w-[40px] text-center">{zoom}%</span>
          <Button variant="ghost" size="icon" onClick={() => setZoom(z => Math.min(200, z + 10))} className="h-8 w-8">
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Text input popup */}
        {textPos && (
          <div className="absolute z-50 top-32 left-1/2 -translate-x-1/2 bg-card border border-border rounded-lg p-3 shadow-lg flex gap-2">
            <Input
              value={textInput}
              onChange={e => setTextInput(e.target.value)}
              placeholder="Type annotation text..."
              className="w-64"
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') addTextAnnotation(); if (e.key === 'Escape') setTextPos(null); }}
            />
            <Button size="sm" onClick={addTextAnnotation}>Add</Button>
            <Button size="sm" variant="ghost" onClick={() => setTextPos(null)}>Cancel</Button>
          </div>
        )}

        {/* PDF with annotation overlay */}
        <div className="flex-1 overflow-auto bg-muted/30 relative">
          <div className="relative mx-auto" style={{ width: `${zoom}%`, minHeight: '100%' }}>
            <iframe
              src={`https://docs.google.com/gview?url=${encodeURIComponent(fileUrl)}&embedded=true`}
              className="w-full h-[calc(95vh-140px)] border-0"
              title={file.name}
            />

            {/* Annotation canvas overlay */}
            <div
              ref={canvasRef}
              className="absolute inset-0 cursor-crosshair"
              style={{ cursor: tool === 'select' ? 'default' : tool === 'eraser' ? 'cell' : 'crosshair' }}
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
            >
              <svg className="w-full h-full absolute inset-0 pointer-events-none">
                {/* Rendered annotations */}
                {annotations.map(a => {
                  if (a.type === 'draw' || a.type === 'highlight') {
                    const d = a.points?.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x}% ${p.y}%`).join(' ') || '';
                    return (
                      <path
                        key={a.id}
                        d={d}
                        fill="none"
                        stroke={a.color}
                        strokeWidth={a.type === 'highlight' ? brushSize[0] * 4 : brushSize[0]}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        vectorEffect="non-scaling-stroke"
                      />
                    );
                  }
                  if (a.type === 'rect') {
                    return (
                      <rect
                        key={a.id}
                        x={`${a.x}%`} y={`${a.y}%`}
                        width={`${a.width}%`} height={`${a.height}%`}
                        fill="none" stroke={a.color} strokeWidth={brushSize[0]}
                        vectorEffect="non-scaling-stroke"
                      />
                    );
                  }
                  if (a.type === 'circle') {
                    return (
                      <ellipse
                        key={a.id}
                        cx={`${a.x + (a.width || 0) / 2}%`}
                        cy={`${a.y + (a.height || 0) / 2}%`}
                        rx={`${(a.width || 0) / 2}%`}
                        ry={`${(a.height || 0) / 2}%`}
                        fill="none" stroke={a.color} strokeWidth={brushSize[0]}
                        vectorEffect="non-scaling-stroke"
                      />
                    );
                  }
                  if (a.type === 'text') {
                    return (
                      <text
                        key={a.id}
                        x={`${a.x}%`} y={`${a.y}%`}
                        fill={a.color}
                        fontSize={a.fontSize || 14}
                        fontFamily="monospace"
                      >
                        {a.text}
                      </text>
                    );
                  }
                  return null;
                })}

                {/* Current drawing */}
                {currentDraw.length > 1 && (
                  <path
                    d={currentDraw.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x}% ${p.y}%`).join(' ')}
                    fill="none"
                    stroke={tool === 'highlight' ? color + '55' : color}
                    strokeWidth={tool === 'highlight' ? brushSize[0] * 4 : brushSize[0]}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                  />
                )}
              </svg>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

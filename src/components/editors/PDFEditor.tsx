import { useState, useRef, useCallback, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Type, Highlighter, PenTool, Square, Circle, Undo2, Redo2, Save, Download,
  X, ZoomIn, ZoomOut, MousePointer, Eraser, Palette, Image, Upload, Loader2,
  ArrowUp, ArrowDown, Stamp, FileSignature, StickyNote, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useEditorSave } from '@/hooks/useEditorSave';

interface Annotation {
  id: string;
  type: 'text' | 'highlight' | 'draw' | 'rect' | 'circle' | 'image' | 'signature' | 'sticky';
  x: number;
  y: number;
  width?: number;
  height?: number;
  text?: string;
  color: string;
  points?: { x: number; y: number }[];
  fontSize?: number;
  imageData?: string;
  opacity?: number;
  page?: number;
}

interface PDFEditorProps {
  file: { id: string; name: string; storage_path: string; user_id: string } | null;
  fileUrl: string | null;
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

type Tool = 'select' | 'text' | 'highlight' | 'draw' | 'rect' | 'circle' | 'eraser' | 'image' | 'signature' | 'sticky';

const COLORS = [
  'hsl(168, 100%, 50%)', '#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#ffffff', '#000000',
];

const FONT_SIZES = [10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48];

export const PDFEditor = ({ file, fileUrl, open, onClose, onSaved }: PDFEditorProps) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const signatureCanvasRef = useRef<HTMLCanvasElement>(null);
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
  const [fontSize, setFontSize] = useState(14);
  const [opacity, setOpacity] = useState([100]);
  const [selectedAnnotation, setSelectedAnnotation] = useState<string | null>(null);
  const [isSignatureMode, setIsSignatureMode] = useState(false);
  const [isSignatureDrawing, setIsSignatureDrawing] = useState(false);
  const [stickyText, setStickyText] = useState('');
  const [stickyPos, setStickyPos] = useState<{ x: number; y: number } | null>(null);
  const [activeTab, setActiveTab] = useState('tools');
  const imageInputRef = useRef<HTMLInputElement>(null);

  const { saveToCloud, downloadLocally, isSaving } = useEditorSave();

  const pushUndo = useCallback(() => {
    setUndoStack(prev => [...prev, annotations]);
    setRedoStack([]);
  }, [annotations]);

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    setRedoStack(r => [...r, annotations]);
    setAnnotations(undoStack[undoStack.length - 1]);
    setUndoStack(u => u.slice(0, -1));
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    setUndoStack(u => [...u, annotations]);
    setAnnotations(redoStack[redoStack.length - 1]);
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
    if (tool === 'sticky') {
      setStickyPos(pos);
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
    if (tool === 'image') {
      imageInputRef.current?.click();
      return;
    }
    if (tool === 'signature') {
      setIsSignatureMode(true);
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
    if (tool === 'select') {
      // Check if clicking on an annotation
      const clicked = annotations.find(a => {
        const dist = Math.sqrt((a.x - pos.x) ** 2 + (a.y - pos.y) ** 2);
        return dist < 5;
      });
      setSelectedAnnotation(clicked?.id || null);
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
        opacity: opacity[0],
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
        opacity: opacity[0],
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
      fontSize,
      opacity: opacity[0],
    }]);
    setTextInput('');
    setTextPos(null);
  };

  const addStickyNote = () => {
    if (!stickyPos || !stickyText.trim()) return;
    pushUndo();
    setAnnotations(prev => [...prev, {
      id: crypto.randomUUID(),
      type: 'sticky',
      x: stickyPos.x,
      y: stickyPos.y,
      text: stickyText,
      color: '#fbbf24',
      width: 15,
      height: 10,
      opacity: 90,
    }]);
    setStickyText('');
    setStickyPos(null);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputFile = e.target.files?.[0];
    if (!inputFile) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      pushUndo();
      setAnnotations(prev => [...prev, {
        id: crypto.randomUUID(),
        type: 'image',
        x: 10,
        y: 10,
        width: 20,
        height: 20,
        color: 'transparent',
        imageData: ev.target?.result as string,
        opacity: opacity[0],
      }]);
      toast.success('Image added to PDF overlay');
    };
    reader.readAsDataURL(inputFile);
    e.target.value = '';
  };

  // Signature canvas
  const startSignature = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    setIsSignatureDrawing(true);
    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  };

  const drawSignature = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isSignatureDrawing) return;
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.lineWidth = 2;
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  };

  const endSignature = () => {
    setIsSignatureDrawing(false);
  };

  const applySignature = () => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    pushUndo();
    setAnnotations(prev => [...prev, {
      id: crypto.randomUUID(),
      type: 'signature',
      x: 50,
      y: 80,
      width: 20,
      height: 8,
      color: 'transparent',
      imageData: dataUrl,
      opacity: 100,
    }]);
    setIsSignatureMode(false);
    // Clear canvas
    const ctx = canvas.getContext('2d');
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
    toast.success('Signature added!');
  };

  const clearSignature = () => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
  };

  const deleteSelected = () => {
    if (!selectedAnnotation) return;
    pushUndo();
    setAnnotations(prev => prev.filter(a => a.id !== selectedAnnotation));
    setSelectedAnnotation(null);
  };

  const handleSaveToCloud = async () => {
    if (!file) return;
    // Export annotations as JSON alongside original PDF reference
    const annotationData = JSON.stringify({ annotations, originalFile: file.name });
    const blob = new Blob([annotationData], { type: 'application/json' });
    
    // Save annotations as a separate file  
    const annotationPath = file.storage_path.replace(/\.[^.]+$/, '_annotations.json');
    
    await saveToCloud(blob, {
      fileId: file.id,
      fileName: file.name,
      storagePath: annotationPath,
      userId: file.user_id,
    });
    onSaved?.();
  };

  const handleExport = () => {
    const annotationData = JSON.stringify({ annotations, originalFile: file?.name }, null, 2);
    const blob = new Blob([annotationData], { type: 'application/json' });
    downloadLocally(blob, `${file?.name || 'pdf'}_annotations.json`);
  };

  if (!file || !fileUrl) return null;

  const tools: { id: Tool; icon: any; label: string }[] = [
    { id: 'select', icon: MousePointer, label: 'Select' },
    { id: 'text', icon: Type, label: 'Text' },
    { id: 'highlight', icon: Highlighter, label: 'Highlight' },
    { id: 'draw', icon: PenTool, label: 'Draw' },
    { id: 'rect', icon: Square, label: 'Rectangle' },
    { id: 'circle', icon: Circle, label: 'Circle' },
    { id: 'sticky', icon: StickyNote, label: 'Sticky Note' },
    { id: 'image', icon: Image, label: 'Insert Image' },
    { id: 'signature', icon: FileSignature, label: 'Signature' },
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
              <Button variant="outline" size="sm" onClick={handleExport} className="gap-1" disabled={isSaving}>
                <Download className="h-3.5 w-3.5" /> Export
              </Button>
              <Button variant="default" size="sm" onClick={handleSaveToCloud} className="gap-1" disabled={isSaving}>
                {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                Save to Cloud
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
              <span className="hidden lg:inline text-xs">{t.label}</span>
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

          {/* Font size for text tool */}
          {(tool === 'text' || tool === 'sticky') && (
            <select
              value={fontSize}
              onChange={e => setFontSize(Number(e.target.value))}
              className="h-8 px-2 text-xs bg-background border border-border rounded"
            >
              {FONT_SIZES.map(s => (
                <option key={s} value={s}>{s}px</option>
              ))}
            </select>
          )}

          {/* Brush Size */}
          <div className="flex items-center gap-2 min-w-[100px]">
            <span className="text-xs text-muted-foreground">Size</span>
            <Slider value={brushSize} onValueChange={setBrushSize} min={1} max={10} step={1} className="w-20" />
          </div>

          {/* Opacity */}
          <div className="flex items-center gap-2 min-w-[100px]">
            <span className="text-xs text-muted-foreground">Opacity</span>
            <Slider value={opacity} onValueChange={setOpacity} min={10} max={100} step={5} className="w-20" />
            <span className="text-xs tabular-nums">{opacity[0]}%</span>
          </div>

          <div className="w-px h-6 bg-border mx-1" />

          {/* Undo / Redo / Delete */}
          <Button variant="ghost" size="icon" onClick={handleUndo} disabled={undoStack.length === 0} className="h-8 w-8">
            <Undo2 className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleRedo} disabled={redoStack.length === 0} className="h-8 w-8">
            <Redo2 className="h-3.5 w-3.5" />
          </Button>
          {selectedAnnotation && (
            <Button variant="destructive" size="sm" onClick={deleteSelected} className="text-xs">
              Delete
            </Button>
          )}

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

        {/* Hidden file input for image insertion */}
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageUpload}
        />

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

        {/* Sticky note input */}
        {stickyPos && (
          <div className="absolute z-50 top-32 left-1/2 -translate-x-1/2 bg-card border border-border rounded-lg p-3 shadow-lg flex flex-col gap-2 w-72">
            <span className="text-xs font-medium flex items-center gap-1"><StickyNote className="h-3 w-3" /> Add Sticky Note</span>
            <textarea
              value={stickyText}
              onChange={e => setStickyText(e.target.value)}
              placeholder="Note content..."
              className="w-full h-20 text-sm bg-background border border-border rounded p-2 resize-none"
              autoFocus
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={addStickyNote} className="flex-1">Add</Button>
              <Button size="sm" variant="ghost" onClick={() => setStickyPos(null)}>Cancel</Button>
            </div>
          </div>
        )}

        {/* Signature modal */}
        {isSignatureMode && (
          <div className="absolute z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-card border border-border rounded-xl p-4 shadow-2xl w-96">
            <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
              <FileSignature className="h-4 w-4 text-primary" /> Draw Your Signature
            </h3>
            <canvas
              ref={signatureCanvasRef}
              width={350}
              height={150}
              className="border border-border rounded-lg bg-background w-full cursor-crosshair"
              onMouseDown={startSignature}
              onMouseMove={drawSignature}
              onMouseUp={endSignature}
              onMouseLeave={endSignature}
            />
            <div className="flex gap-2 mt-3">
              <Button size="sm" onClick={applySignature} className="flex-1 gap-1">
                <Stamp className="h-3.5 w-3.5" /> Apply
              </Button>
              <Button size="sm" variant="outline" onClick={clearSignature}>Clear</Button>
              <Button size="sm" variant="ghost" onClick={() => setIsSignatureMode(false)}>Cancel</Button>
            </div>
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
              className="absolute inset-0"
              style={{ cursor: tool === 'select' ? 'default' : tool === 'eraser' ? 'cell' : 'crosshair' }}
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
            >
              <svg className="w-full h-full absolute inset-0 pointer-events-none">
                {annotations.map(a => {
                  const opacityStyle = (a.opacity || 100) / 100;

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
                        opacity={opacityStyle}
                        className={cn(selectedAnnotation === a.id && "outline outline-2 outline-primary")}
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
                        opacity={opacityStyle}
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
                        opacity={opacityStyle}
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
                        fontFamily="sans-serif"
                        opacity={opacityStyle}
                        className={cn(selectedAnnotation === a.id && "outline outline-2 outline-primary")}
                      >
                        {a.text}
                      </text>
                    );
                  }
                  if (a.type === 'sticky') {
                    return (
                      <g key={a.id} opacity={opacityStyle}>
                        <rect
                          x={`${a.x}%`} y={`${a.y}%`}
                          width={`${a.width || 15}%`} height={`${a.height || 10}%`}
                          fill="#fbbf24" rx="3"
                          className="drop-shadow-md"
                        />
                        <text
                          x={`${a.x + 1}%`} y={`${a.y + 3}%`}
                          fill="#1a1a1a"
                          fontSize={10}
                          fontFamily="sans-serif"
                        >
                          {a.text}
                        </text>
                      </g>
                    );
                  }
                  if ((a.type === 'image' || a.type === 'signature') && a.imageData) {
                    return (
                      <image
                        key={a.id}
                        href={a.imageData}
                        x={`${a.x}%`} y={`${a.y}%`}
                        width={`${a.width || 20}%`} height={`${a.height || 20}%`}
                        opacity={opacityStyle}
                        preserveAspectRatio="xMidYMid meet"
                      />
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

        {/* Annotation count */}
        <div className="px-4 py-2 border-t border-border bg-card/50 flex items-center justify-between text-xs text-muted-foreground">
          <span>{annotations.length} annotation{annotations.length !== 1 ? 's' : ''}</span>
          <span>Zoom: {zoom}% | Tool: {tool}</span>
        </div>
      </DialogContent>
    </Dialog>
  );
};

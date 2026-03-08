import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Bold, Italic, Strikethrough, List, ListOrdered, Link, Image, Code,
  Heading1, Heading2, X, Save, Eye, EyeOff, Quote, Download, Upload, Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { marked } from 'marked';
import { useEditorSave } from '@/hooks/useEditorSave';

interface MarkdownEditorProps {
  file: { id: string; name: string; storage_path: string; user_id: string } | null;
  fileUrl: string | null;
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export const MarkdownEditor = ({ file, fileUrl, open, onClose, onSaved }: MarkdownEditorProps) => {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [showPreview, setShowPreview] = useState(true);

  const { saveToCloud, downloadLocally, isSaving } = useEditorSave();

  useEffect(() => {
    if (!open || !fileUrl) return;
    setLoading(true);
    fetch(fileUrl)
      .then(res => res.text())
      .then(text => { setContent(text); setLoading(false); })
      .catch(() => { toast.error('Failed to load file'); setLoading(false); });
  }, [open, fileUrl]);

  const renderedHtml = useMemo(() => {
    try { return marked.parse(content, { async: false }) as string; }
    catch { return content; }
  }, [content]);

  const insertAtCursor = (before: string, after = '') => {
    const textarea = document.querySelector<HTMLTextAreaElement>('#md-editor');
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = content.substring(start, end);
    const newContent = content.substring(0, start) + before + selected + after + content.substring(end);
    setContent(newContent);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, start + before.length + selected.length);
    }, 0);
  };

  const toolbarActions = [
    { icon: Heading1, action: () => insertAtCursor('# '), label: 'H1' },
    { icon: Heading2, action: () => insertAtCursor('## '), label: 'H2' },
    { icon: Bold, action: () => insertAtCursor('**', '**'), label: 'Bold' },
    { icon: Italic, action: () => insertAtCursor('*', '*'), label: 'Italic' },
    { icon: Strikethrough, action: () => insertAtCursor('~~', '~~'), label: 'Strike' },
    { icon: Code, action: () => insertAtCursor('`', '`'), label: 'Code' },
    { icon: Quote, action: () => insertAtCursor('> '), label: 'Quote' },
    { icon: List, action: () => insertAtCursor('- '), label: 'UL' },
    { icon: ListOrdered, action: () => insertAtCursor('1. '), label: 'OL' },
    { icon: Link, action: () => insertAtCursor('[', '](url)'), label: 'Link' },
    { icon: Image, action: () => insertAtCursor('![alt](', ')'), label: 'Image' },
  ];

  const handleDownload = () => {
    const blob = new Blob([content], { type: 'text/plain' });
    downloadLocally(blob, file?.name || 'document.md');
  };

  const handleSaveToCloud = async () => {
    if (!file) return;
    const blob = new Blob([content], { type: 'text/plain' });
    await saveToCloud(blob, {
      fileId: file.id,
      fileName: file.name,
      storagePath: file.storage_path,
      userId: file.user_id,
    });
    onSaved?.();
  };

  if (!file || !fileUrl) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] w-[95vw] h-[95vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-4 py-3 border-b border-border glass shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <DialogTitle className="text-base truncate">{file.name}</DialogTitle>
              <Badge variant="secondary" className="text-xs font-mono">MARKDOWN EDITOR</Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button variant={showPreview ? 'default' : 'outline'} size="sm" onClick={() => setShowPreview(!showPreview)} className="gap-1">
                {showPreview ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                <span className="text-xs">Preview</span>
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
          <DialogDescription className="sr-only">Edit markdown: {file.name}</DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-0.5 px-4 py-2 border-b border-border bg-card/50 glass overflow-x-auto shrink-0">
          {toolbarActions.map((t, i) => (
            <Button key={i} variant="ghost" size="sm" onClick={t.action} title={t.label} className="h-8 w-8 p-0">
              <t.icon className="h-3.5 w-3.5" />
            </Button>
          ))}
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : (
          <div className={cn("flex-1 flex min-h-0", showPreview ? "divide-x divide-border" : "")}>
            <div className={cn("flex-1 min-h-0", showPreview ? "w-1/2" : "w-full")}>
              <Textarea
                id="md-editor"
                value={content}
                onChange={e => setContent(e.target.value)}
                className="h-full w-full resize-none rounded-none border-0 bg-background font-mono text-sm p-4 focus-visible:ring-0"
                placeholder="Start writing..."
              />
            </div>
            {showPreview && (
              <div className="flex-1 w-1/2 overflow-auto p-6 bg-card/20">
                <div
                  className="prose prose-invert prose-sm max-w-none prose-headings:text-foreground prose-p:text-foreground/90 prose-a:text-primary prose-code:text-primary prose-code:bg-primary/10 prose-code:rounded prose-code:px-1 prose-pre:bg-muted prose-pre:border prose-pre:border-border"
                  dangerouslySetInnerHTML={{ __html: renderedHtml }}
                />
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

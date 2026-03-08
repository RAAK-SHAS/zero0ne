import { useState, useRef, useEffect, useCallback, KeyboardEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal, X, Minus, Maximize2, Minimize2, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TerminalLine } from '@/hooks/useTerminal';

interface TerminalPanelProps {
  lines: TerminalLine[];
  isProcessing: boolean;
  onExecute: (command: string) => void;
  getAutocomplete: (input: string) => string[];
  commandHistory: string[];
  historyIndex: number;
  setHistoryIndex: (index: number) => void;
  isOpen: boolean;
  onToggle: () => void;
}

export const TerminalPanel = ({
  lines,
  isProcessing,
  onExecute,
  getAutocomplete,
  commandHistory,
  historyIndex,
  setHistoryIndex,
  isOpen,
  onToggle,
}: TerminalPanelProps) => {
  const [input, setInput] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState(-1);
  const [height, setHeight] = useState(350);
  const [isMaximized, setIsMaximized] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const resizeRef = useRef<{ startY: number; startHeight: number } | null>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Tab autocomplete
  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const completions = getAutocomplete(input);
      if (completions.length === 1) {
        const parts = input.split(/\s+/);
        if (parts.length <= 1) {
          setInput(completions[0] + ' ');
        } else {
          parts[parts.length - 1] = completions[0];
          setInput(parts.join(' '));
        }
        setSuggestions([]);
      } else if (completions.length > 1) {
        setSuggestions(completions);
        setSelectedSuggestion(-1);
      }
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (suggestions.length > 0) {
        setSelectedSuggestion(prev => Math.max(0, prev - 1));
      } else if (commandHistory.length > 0) {
        const newIndex = historyIndex === -1 ? commandHistory.length - 1 : Math.max(0, historyIndex - 1);
        setHistoryIndex(newIndex);
        setInput(commandHistory[newIndex]);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (suggestions.length > 0) {
        setSelectedSuggestion(prev => Math.min(suggestions.length - 1, prev + 1));
      } else if (historyIndex !== -1) {
        const newIndex = historyIndex + 1;
        if (newIndex >= commandHistory.length) {
          setHistoryIndex(-1);
          setInput('');
        } else {
          setHistoryIndex(newIndex);
          setInput(commandHistory[newIndex]);
        }
      }
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      if (suggestions.length > 0 && selectedSuggestion >= 0) {
        const parts = input.split(/\s+/);
        if (parts.length <= 1) {
          setInput(suggestions[selectedSuggestion] + ' ');
        } else {
          parts[parts.length - 1] = suggestions[selectedSuggestion];
          setInput(parts.join(' '));
        }
        setSuggestions([]);
        setSelectedSuggestion(-1);
        return;
      }

      if (input.trim() && !isProcessing) {
        onExecute(input);
        setInput('');
        setSuggestions([]);
      }
      return;
    }

    if (e.key === 'Escape') {
      if (suggestions.length > 0) {
        setSuggestions([]);
      } else {
        onToggle();
      }
    }
  }, [input, suggestions, selectedSuggestion, commandHistory, historyIndex, isProcessing, onExecute, onToggle, getAutocomplete, setHistoryIndex]);

  // Update suggestions on input change
  useEffect(() => {
    if (input.length > 0) {
      const completions = getAutocomplete(input);
      if (completions.length > 1 && completions.length <= 10) {
        setSuggestions(completions);
      } else {
        setSuggestions([]);
      }
    } else {
      setSuggestions([]);
    }
  }, [input, getAutocomplete]);

  // Resize handlers
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    resizeRef.current = { startY: e.clientY, startHeight: height };
    
    const handleMouseMove = (e: MouseEvent) => {
      if (resizeRef.current) {
        const delta = resizeRef.current.startY - e.clientY;
        const newHeight = Math.max(200, Math.min(window.innerHeight - 100, resizeRef.current.startHeight + delta));
        setHeight(newHeight);
      }
    };
    
    const handleMouseUp = () => {
      resizeRef.current = null;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [height]);

  const getLineColor = (type: TerminalLine['type']) => {
    switch (type) {
      case 'input': return 'text-primary';
      case 'error': return 'text-destructive';
      case 'success': return 'text-green-400';
      case 'info': return 'text-muted-foreground';
      case 'system': return 'text-primary/80';
      default: return 'text-foreground';
    }
  };

  const panelHeight = isMaximized ? 'calc(100vh - 60px)' : `${height}px`;

  return (
    <>
      {/* Toggle button (when closed) */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            onClick={onToggle}
            className="fixed bottom-4 right-4 z-50 flex items-center gap-2 px-3 py-2 rounded-lg bg-card border border-primary/30 shadow-lg shadow-primary/10 hover:border-primary/60 transition-all duration-200 group"
          >
            <Terminal className="h-4 w-4 text-primary" />
            <span className="text-xs font-mono text-muted-foreground group-hover:text-foreground">Terminal</span>
            <kbd className="text-[9px] font-mono text-muted-foreground/60 bg-muted/50 px-1 rounded">Ctrl+`</kbd>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Terminal Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50"
            style={{ height: panelHeight }}
          >
            {/* Resize handle */}
            <div
              className="h-1.5 cursor-ns-resize bg-transparent hover:bg-primary/20 transition-colors flex items-center justify-center group"
              onMouseDown={handleResizeStart}
            >
              <div className="w-12 h-0.5 rounded-full bg-border group-hover:bg-primary/50 transition-colors" />
            </div>

            <div className="h-full flex flex-col bg-[hsl(var(--card))] border-t border-primary/20 shadow-2xl shadow-primary/5">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-2 border-b border-border/50 bg-card/80 shrink-0">
                <div className="flex items-center gap-2">
                  <Terminal className="h-4 w-4 text-primary" />
                  <span className="text-xs font-mono font-semibold text-foreground">CloudStore Terminal</span>
                  <span className="text-[10px] font-mono text-muted-foreground/60">v2.0</span>
                  {isProcessing && (
                    <span className="text-[10px] font-mono text-primary animate-pulse">processing...</span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setIsMaximized(!isMaximized)}
                    className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {isMaximized ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
                  </button>
                  <button
                    onClick={onToggle}
                    className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {isMaximized ? <X className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                  </button>
                </div>
              </div>

              {/* Output */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-2 font-mono text-xs leading-relaxed">
                {lines.map(line => (
                  <div key={line.id} className={cn('whitespace-pre-wrap break-all', getLineColor(line.type))}>
                    {line.content}
                  </div>
                ))}
              </div>

              {/* Suggestions */}
              <AnimatePresence>
                {suggestions.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    className="px-4 py-1 border-t border-border/30"
                  >
                    <div className="flex flex-wrap gap-1">
                      {suggestions.map((s, i) => (
                        <button
                          key={s}
                          className={cn(
                            'px-2 py-0.5 rounded text-[10px] font-mono border transition-colors',
                            i === selectedSuggestion
                              ? 'bg-primary/20 text-primary border-primary/40'
                              : 'bg-muted/30 text-muted-foreground border-border/30 hover:bg-muted/50'
                          )}
                          onClick={() => {
                            const parts = input.split(/\s+/);
                            if (parts.length <= 1) {
                              setInput(s + ' ');
                            } else {
                              parts[parts.length - 1] = s;
                              setInput(parts.join(' '));
                            }
                            setSuggestions([]);
                            inputRef.current?.focus();
                          }}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Input */}
              <div className="flex items-center gap-2 px-4 py-2.5 border-t border-border/50 bg-card/50 shrink-0">
                <span className="text-primary font-mono text-xs font-bold select-none">$</span>
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={isProcessing ? 'Processing...' : 'Type a command...'}
                  disabled={isProcessing}
                  className="flex-1 bg-transparent border-none outline-none font-mono text-xs text-foreground placeholder:text-muted-foreground/40 caret-primary"
                  spellCheck={false}
                  autoComplete="off"
                />
                <span className="w-2 h-4 bg-primary/80 animate-pulse rounded-sm" />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

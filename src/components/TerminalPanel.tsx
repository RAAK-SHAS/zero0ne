import { useState, useRef, useEffect, useCallback, KeyboardEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal, X, Minus, Maximize2, Minimize2, Palette } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TerminalLine } from '@/hooks/useTerminal';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export type TerminalTheme = 'default' | 'matrix' | 'amber' | 'synthwave';

const TERMINAL_THEMES: Record<TerminalTheme, {
  label: string;
  bg: string;
  headerBg: string;
  border: string;
  text: string;
  inputText: string;
  prompt: string;
  cursor: string;
  success: string;
  error: string;
  info: string;
  system: string;
  inputLine: string;
  suggestion: string;
  suggestionActive: string;
  glow: string;
}> = {
  default: {
    label: '⚡ Default',
    bg: 'bg-[hsl(var(--card))]',
    headerBg: 'bg-card/80',
    border: 'border-primary/20',
    text: 'text-foreground',
    inputText: 'text-foreground',
    prompt: 'text-primary',
    cursor: 'bg-primary/80',
    success: 'text-green-400',
    error: 'text-destructive',
    info: 'text-muted-foreground',
    system: 'text-primary/80',
    inputLine: 'text-primary',
    suggestion: 'bg-muted/30 text-muted-foreground border-border/30',
    suggestionActive: 'bg-primary/20 text-primary border-primary/40',
    glow: '',
  },
  matrix: {
    label: '🟢 Matrix Green',
    bg: 'bg-[#0a0f0a]',
    headerBg: 'bg-[#0d140d]/90',
    border: 'border-green-500/30',
    text: 'text-green-400',
    inputText: 'text-green-300',
    prompt: 'text-green-500',
    cursor: 'bg-green-500/80',
    success: 'text-green-300',
    error: 'text-red-500',
    info: 'text-green-600',
    system: 'text-green-500/80',
    inputLine: 'text-green-500',
    suggestion: 'bg-green-900/30 text-green-500 border-green-700/30',
    suggestionActive: 'bg-green-700/30 text-green-300 border-green-500/50',
    glow: 'shadow-[0_0_30px_rgba(34,197,94,0.15)]',
  },
  amber: {
    label: '🟠 Amber CRT',
    bg: 'bg-[#1a1000]',
    headerBg: 'bg-[#1a1200]/90',
    border: 'border-amber-500/30',
    text: 'text-amber-400',
    inputText: 'text-amber-300',
    prompt: 'text-amber-500',
    cursor: 'bg-amber-500/80',
    success: 'text-amber-300',
    error: 'text-red-400',
    info: 'text-amber-600',
    system: 'text-amber-500/80',
    inputLine: 'text-amber-500',
    suggestion: 'bg-amber-900/30 text-amber-500 border-amber-700/30',
    suggestionActive: 'bg-amber-700/30 text-amber-300 border-amber-500/50',
    glow: 'shadow-[0_0_30px_rgba(245,158,11,0.15)]',
  },
  synthwave: {
    label: '🟣 Synthwave',
    bg: 'bg-[#1a0a2e]',
    headerBg: 'bg-[#1a0a2e]/90',
    border: 'border-fuchsia-500/30',
    text: 'text-fuchsia-300',
    inputText: 'text-fuchsia-200',
    prompt: 'text-cyan-400',
    cursor: 'bg-fuchsia-500/80',
    success: 'text-cyan-300',
    error: 'text-pink-500',
    info: 'text-fuchsia-500/70',
    system: 'text-cyan-400/80',
    inputLine: 'text-cyan-400',
    suggestion: 'bg-fuchsia-900/30 text-fuchsia-400 border-fuchsia-700/30',
    suggestionActive: 'bg-fuchsia-700/30 text-cyan-300 border-cyan-500/50',
    glow: 'shadow-[0_0_30px_rgba(217,70,239,0.15)]',
  },
};

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
  const [theme, setTheme] = useState<TerminalTheme>(() => {
    const saved = localStorage.getItem('terminal-theme');
    return (saved as TerminalTheme) || 'default';
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const resizeRef = useRef<{ startY: number; startHeight: number } | null>(null);

  const t = TERMINAL_THEMES[theme];

  const handleThemeChange = (newTheme: TerminalTheme) => {
    setTheme(newTheme);
    localStorage.setItem('terminal-theme', newTheme);
  };

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

  // Refocus input after a command finishes processing
  // (the input is disabled during processing which causes the browser to blur it)
  const wasProcessing = useRef(false);
  useEffect(() => {
    if (wasProcessing.current && !isProcessing && isOpen) {
      // Wait a tick so the disabled attribute is cleared in the DOM
      requestAnimationFrame(() => inputRef.current?.focus());
    }
    wasProcessing.current = isProcessing;
  }, [isProcessing, isOpen]);

  // Also refocus when new output lines arrive (covers fast commands)
  useEffect(() => {
    if (isOpen && document.activeElement !== inputRef.current) {
      const active = document.activeElement;
      // Don't steal focus from other interactive elements (buttons, dialogs, etc.)
      if (!active || active === document.body) {
        inputRef.current?.focus();
      }
    }
  }, [lines, isOpen]);

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
      case 'input': return t.inputLine;
      case 'error': return t.error;
      case 'success': return t.success;
      case 'info': return t.info;
      case 'system': return t.system;
      default: return t.text;
    }
  };

  const panelHeight = isMaximized ? 'calc(100vh - 60px)' : `${height}px`;

  // CRT scanline overlay for amber theme
  const showScanlines = theme === 'amber';

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

            <div className={cn(
              'h-full flex flex-col border-t shadow-2xl relative overflow-hidden',
              t.bg, t.border, t.glow
            )}>
              {/* CRT scanline effect for amber theme */}
              {showScanlines && (
                <div 
                  className="absolute inset-0 pointer-events-none z-10"
                  style={{
                    background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.1) 4px)',
                  }}
                />
              )}

              {/* Header */}
              <div className={cn(
                'flex items-center justify-between px-4 py-2 border-b border-border/50 shrink-0 relative z-20',
                t.headerBg
              )}>
                <div className="flex items-center gap-2">
                  <Terminal className={cn('h-4 w-4', t.prompt)} />
                  <span className={cn('text-xs font-mono font-semibold', t.text)}>CloudStore Terminal</span>
                  <span className={cn('text-[10px] font-mono', t.info)}>v2.0</span>
                  {isProcessing && (
                    <span className={cn('text-[10px] font-mono animate-pulse', t.prompt)}>processing...</span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {/* Theme selector */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className={cn(
                        'p-1 rounded hover:bg-muted/50 transition-colors',
                        t.info
                      )}>
                        <Palette className="h-3 w-3" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-[160px]">
                      {(Object.keys(TERMINAL_THEMES) as TerminalTheme[]).map(key => (
                        <DropdownMenuItem
                          key={key}
                          onClick={() => handleThemeChange(key)}
                          className={cn('font-mono text-xs', key === theme && 'bg-accent')}
                        >
                          {TERMINAL_THEMES[key].label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <button
                    onClick={() => setIsMaximized(!isMaximized)}
                    className={cn('p-1 rounded hover:bg-muted/50 transition-colors', t.info)}
                  >
                    {isMaximized ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
                  </button>
                  <button
                    onClick={onToggle}
                    className={cn('p-1 rounded hover:bg-muted/50 transition-colors', t.info)}
                  >
                    {isMaximized ? <X className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                  </button>
                </div>
              </div>

              {/* Output */}
              <div ref={scrollRef} className={cn(
                'flex-1 overflow-y-auto px-4 py-2 font-mono text-xs leading-relaxed relative z-20',
                t.text
              )}>
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
                    className="px-4 py-1 border-t border-border/30 relative z-20"
                  >
                    <div className="flex flex-wrap gap-1">
                      {suggestions.map((s, i) => (
                        <button
                          key={s}
                          className={cn(
                            'px-2 py-0.5 rounded text-[10px] font-mono border transition-colors',
                            i === selectedSuggestion ? t.suggestionActive : t.suggestion
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
              <div className={cn(
                'flex items-center gap-2 px-4 py-2.5 border-t border-border/50 shrink-0 relative z-20',
                t.headerBg
              )}>
                <span className={cn('font-mono text-xs font-bold select-none', t.prompt)}>$</span>
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={isProcessing ? 'Processing...' : 'Type a command... (use | to pipe)'}
                  disabled={isProcessing}
                  className={cn(
                    'flex-1 bg-transparent border-none outline-none font-mono text-xs placeholder:opacity-40',
                    t.inputText
                  )}
                  style={{ caretColor: 'inherit' }}
                  spellCheck={false}
                  autoComplete="off"
                />
                <span className={cn('w-2 h-4 animate-pulse rounded-sm', t.cursor)} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

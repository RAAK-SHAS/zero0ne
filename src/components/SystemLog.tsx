import { useState, useEffect, useCallback } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Terminal } from 'lucide-react';

interface LogEntry {
  id: string;
  timestamp: Date;
  type: 'SUCCESS' | 'INFO' | 'WARNING' | 'ERROR';
  message: string;
}

export const useSystemLog = () => {
  const [logs, setLogs] = useState<LogEntry[]>([
    { id: '0', timestamp: new Date(), type: 'INFO', message: 'System initialized. Welcome to CloudStore.' },
  ]);

  const addLog = useCallback((type: LogEntry['type'], message: string) => {
    setLogs(prev => [
      { id: Date.now().toString(), timestamp: new Date(), type, message },
      ...prev,
    ].slice(0, 50));
  }, []);

  return { logs, addLog };
};

interface SystemLogProps {
  logs: LogEntry[];
}

const typeColor: Record<string, string> = {
  SUCCESS: 'text-primary',
  INFO: 'text-muted-foreground',
  WARNING: 'text-destructive',
  ERROR: 'text-destructive',
};

export const SystemLog = ({ logs }: SystemLogProps) => {
  return (
    <div className="neon-border rounded-lg bg-card/30 glass overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border bg-accent/20">
        <Terminal className="h-3 w-3 text-primary" />
        <span className="terminal-text text-[10px]">&gt;_ SYSTEM LOG</span>
        <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary animate-pulse-neon" />
      </div>
      <ScrollArea className="h-[80px]">
        <div className="px-3 py-1.5 space-y-0.5">
          {logs.slice(0, 10).map(log => (
            <div key={log.id} className="flex items-start gap-2 text-[10px] font-mono leading-relaxed">
              <span className="text-muted-foreground/50 shrink-0 tabular-nums">
                {log.timestamp.toLocaleTimeString('en-US', { hour12: false })}
              </span>
              <span className={`shrink-0 ${typeColor[log.type] || 'text-muted-foreground'}`}>[{log.type}]</span>
              <span className="text-muted-foreground truncate">{log.message}</span>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};

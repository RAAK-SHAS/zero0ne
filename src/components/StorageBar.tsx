import { Progress } from '@/components/ui/progress';
import { formatBytes } from '@/lib/utils';
import { HardDrive, TrendingUp, Zap } from 'lucide-react';
import { useMemo } from 'react';

interface StorageBarProps {
  used: number;
  total: number;
  compact?: boolean;
}

export const StorageBar = ({ used, total, compact = false }: StorageBarProps) => {
  const percentage = useMemo(() => (used / total) * 100, [used, total]);

  const getStorageStatus = () => {
    if (percentage >= 90) return { color: 'text-destructive', label: 'Critical' };
    if (percentage >= 75) return { color: 'text-destructive', label: 'High' };
    if (percentage >= 50) return { color: 'text-primary', label: 'Moderate' };
    return { color: 'text-primary', label: 'Good' };
  };

  const status = getStorageStatus();

  if (compact) {
    return (
      <div className="space-y-2">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground flex items-center gap-1">
            <HardDrive className="h-3 w-3 text-primary" />
            Storage
          </span>
          <span className="font-mono text-primary tabular-nums text-[11px]">{percentage.toFixed(0)}%</span>
        </div>
        <div className="relative h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full power-cell transition-all duration-500"
            style={{ width: `${Math.max(percentage, 2)}%` }}
          />
        </div>
        <p className="text-[11px] font-mono text-muted-foreground">
          {formatBytes(used)} / {formatBytes(total)}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 neon-border">
            <HardDrive className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Storage Overview</h3>
            <p className="text-xs text-muted-foreground">{formatBytes(total - used)} available</p>
          </div>
        </div>
        <div className="text-right">
          <span className={`text-xs font-mono px-2 py-0.5 rounded-full bg-primary/10 ${status.color} neon-border`}>
            {status.label}
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Used Space</span>
          <span className="font-mono tabular-nums text-primary text-xs">
            {formatBytes(used)} / {formatBytes(total)}
          </span>
        </div>
        <div className="relative h-3 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full power-cell transition-all duration-500"
            style={{ width: `${Math.max(percentage, 2)}%` }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 transition-all duration-300"
            style={{ left: `${Math.min(percentage, 95)}%` }}
          >
            <TrendingUp className={`h-3 w-3 ${status.color} opacity-75`} />
          </div>
        </div>
        <div className="flex justify-between text-[11px] font-mono text-muted-foreground">
          <span>0%</span>
          <span className="text-primary">{percentage.toFixed(1)}%</span>
          <span>100%</span>
        </div>
      </div>
    </div>
  );
};

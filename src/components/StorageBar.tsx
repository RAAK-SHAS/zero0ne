import { Progress } from '@/components/ui/progress';
import { formatBytes } from '@/lib/utils';
import { HardDrive, TrendingUp } from 'lucide-react';
import { useMemo } from 'react';

interface StorageBarProps {
  used: number;
  total: number;
  compact?: boolean;
}

export const StorageBar = ({ used, total, compact = false }: StorageBarProps) => {
  const percentage = useMemo(() => (used / total) * 100, [used, total]);
  
  const getStorageStatus = () => {
    if (percentage >= 90) return { color: 'text-destructive', bg: 'bg-destructive', label: 'Critical' };
    if (percentage >= 75) return { color: 'text-orange-500', bg: 'bg-orange-500', label: 'High' };
    if (percentage >= 50) return { color: 'text-yellow-500', bg: 'bg-yellow-500', label: 'Moderate' };
    return { color: 'text-primary', bg: 'bg-primary', label: 'Good' };
  };

  const status = getStorageStatus();
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg bg-primary/10`}>
            <HardDrive className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Storage Overview</h3>
            <p className="text-xs text-muted-foreground">
              {formatBytes(total - used)} available
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${status.bg}/10 ${status.color}`}>
              {status.label}
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Used Space</span>
          <span className="font-medium tabular-nums">
            {formatBytes(used)} / {formatBytes(total)}
          </span>
        </div>
        <div className="relative">
          <Progress value={percentage} className="h-3 rounded-full" />
          <div 
            className="absolute top-1/2 -translate-y-1/2 transition-all duration-300"
            style={{ left: `${Math.min(percentage, 95)}%` }}
          >
            <TrendingUp className={`h-3 w-3 ${status.color} opacity-75`} />
          </div>
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>0%</span>
          <span className="font-medium">{percentage.toFixed(1)}% used</span>
          <span>100%</span>
        </div>
      </div>
    </div>
  );
};

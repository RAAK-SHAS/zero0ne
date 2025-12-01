import { Progress } from '@/components/ui/progress';
import { formatBytes } from '@/lib/utils';

interface StorageBarProps {
  used: number;
  total: number;
}

export const StorageBar = ({ used, total }: StorageBarProps) => {
  const percentage = (used / total) * 100;
  
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Storage Used</span>
        <span className="font-medium">
          {formatBytes(used)} / {formatBytes(total)}
        </span>
      </div>
      <Progress value={percentage} className="h-2" />
      <p className="text-xs text-muted-foreground text-right">
        {percentage.toFixed(1)}% used
      </p>
    </div>
  );
};
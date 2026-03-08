import { useMemo } from 'react';
import { SpeedDataPoint } from '@/contexts/UploadContext';
import { formatBytes } from '@/lib/utils';

interface UploadSpeedGraphProps {
  data: SpeedDataPoint[];
  height?: number;
  width?: number;
}

export const UploadSpeedGraph = ({ data, height = 40, width = 180 }: UploadSpeedGraphProps) => {
  const { points, maxSpeed, currentSpeed } = useMemo(() => {
    if (!data || data.length < 2) return { points: '', maxSpeed: 0, currentSpeed: 0 };

    const maxSpeed = Math.max(...data.map(d => d.speed), 1);
    const currentSpeed = data[data.length - 1]?.speed || 0;

    const padding = 2;
    const graphW = width - padding * 2;
    const graphH = height - padding * 2;

    const pts = data.map((d, i) => {
      const x = padding + (i / (data.length - 1)) * graphW;
      const y = padding + graphH - (d.speed / maxSpeed) * graphH;
      return `${x},${y}`;
    });

    // Create area fill path
    const firstX = padding;
    const lastX = padding + graphW;
    const bottomY = height - padding;
    const areaPoints = `${firstX},${bottomY} ${pts.join(' ')} ${lastX},${bottomY}`;

    return { points: pts.join(' '), maxSpeed, currentSpeed, areaPoints };
  }, [data, height, width]);

  if (!data || data.length < 2) {
    return (
      <div className="flex items-center justify-center text-xs text-muted-foreground" style={{ height, width }}>
        Collecting data...
      </div>
    );
  }

  const areaPath = (() => {
    const padding = 2;
    const graphW = width - padding * 2;
    const bottomY = height - padding;
    const firstX = padding;
    const lastX = padding + ((data.length - 1) / (data.length - 1)) * graphW;

    const pts = data.map((d, i) => {
      const x = padding + (i / (data.length - 1)) * graphW;
      const y = padding + (height - padding * 2) - (d.speed / maxSpeed) * (height - padding * 2);
      return `${x},${y}`;
    });

    return `${firstX},${bottomY} ${pts.join(' ')} ${lastX},${bottomY}`;
  })();

  return (
    <div className="relative" style={{ width, height }}>
      <svg width={width} height={height} className="overflow-visible">
        {/* Area fill */}
        <polygon
          points={areaPath}
          fill="hsl(var(--primary) / 0.1)"
        />
        {/* Speed line */}
        <polyline
          points={points}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Current speed dot */}
        {data.length > 0 && (() => {
          const padding = 2;
          const graphW = width - padding * 2;
          const graphH = height - padding * 2;
          const lastIdx = data.length - 1;
          const cx = padding + (lastIdx / (data.length - 1)) * graphW;
          const cy = padding + graphH - (data[lastIdx].speed / maxSpeed) * graphH;
          return <circle cx={cx} cy={cy} r="2.5" fill="hsl(var(--primary))" />;
        })()}
      </svg>
      <div className="absolute bottom-0 right-0 text-[10px] text-muted-foreground leading-none">
        {formatBytes(currentSpeed)}/s
      </div>
    </div>
  );
};

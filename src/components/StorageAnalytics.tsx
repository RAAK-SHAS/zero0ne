import { formatBytes } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useStorageAnalytics } from '@/hooks/useStorageAnalytics';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Legend,
  Tooltip 
} from 'recharts';
import { 
  HardDrive, 
  Files, 
  TrendingUp, 
  AlertTriangle,
  Loader2
} from 'lucide-react';

interface StorageAnalyticsProps {
  userId: string | undefined;
}

export const StorageAnalytics = ({ userId }: StorageAnalyticsProps) => {
  const { stats, loading, quotaWarning } = useStorageAnalytics(userId);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!stats) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Unable to load storage analytics
        </CardContent>
      </Card>
    );
  }

  const chartData = stats.breakdownByType.map(item => ({
    name: item.label,
    value: item.size,
    color: item.color,
    count: item.count,
  }));

  return (
    <div className="space-y-4">
      {quotaWarning && (
        <Alert variant={quotaWarning.level === 'critical' ? 'destructive' : 'default'}>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{quotaWarning.message}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Storage Used</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatBytes(stats.totalUsed)}</div>
            <div className="flex items-center gap-2 mt-2">
              <Progress value={stats.percentUsed} className="h-2" />
              <span className="text-xs text-muted-foreground">
                {stats.percentUsed.toFixed(1)}%
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              of {formatBytes(stats.totalQuota)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Files</CardTitle>
            <Files className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.fileCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Avg size: {formatBytes(stats.averageFileSize)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Largest File</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {stats.largestFile ? (
              <>
                <div className="text-2xl font-bold">
                  {formatBytes(stats.largestFile.size)}
                </div>
                <p className="text-xs text-muted-foreground mt-1 truncate">
                  {stats.largestFile.name}
                </p>
              </>
            ) : (
              <div className="text-muted-foreground">No files</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">File Types</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1">
              {stats.breakdownByType.slice(0, 3).map((type) => (
                <Badge key={type.type} variant="secondary" className="text-xs">
                  {type.label}: {type.count}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Storage Breakdown by Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-popover border rounded-md p-2 shadow-md">
                            <p className="font-medium">{data.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {formatBytes(data.value)} ({data.count} files)
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend
                    formatter={(value, entry: any) => (
                      <span className="text-xs">
                        {value} ({formatBytes(entry.payload.value)})
                      </span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

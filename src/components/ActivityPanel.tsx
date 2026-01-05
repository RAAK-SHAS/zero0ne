import { formatBytes } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useActivityLog, type ActivityLog } from '@/hooks/useActivityLog';
import { Activity, Loader2 } from 'lucide-react';

interface ActivityPanelProps {
  userId: string | undefined;
}

export const ActivityPanel = ({ userId }: ActivityPanelProps) => {
  const { activities, loading, getActionIcon, getActionLabel } = useActivityLog(userId);

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (activities.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            No recent activity
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Activity className="h-4 w-4" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[300px]">
          <div className="px-4 pb-4 space-y-3">
            {activities.map((activity) => (
              <ActivityItem 
                key={activity.id} 
                activity={activity}
                getActionIcon={getActionIcon}
                getActionLabel={getActionLabel}
              />
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

interface ActivityItemProps {
  activity: ActivityLog;
  getActionIcon: (action: string) => string;
  getActionLabel: (action: string) => string;
}

const ActivityItem = ({ activity, getActionIcon, getActionLabel }: ActivityItemProps) => {
  const timeAgo = formatDistanceToNow(new Date(activity.created_at), { addSuffix: true });
  
  return (
    <div className="flex items-start gap-3 text-sm">
      <span className="text-lg leading-none mt-0.5">{getActionIcon(activity.action)}</span>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">
          {getActionLabel(activity.action)}
          {activity.entity_name && (
            <span className="text-muted-foreground ml-1">
              "{activity.entity_name}"
            </span>
          )}
        </p>
        <p className="text-xs text-muted-foreground">{timeAgo}</p>
      </div>
    </div>
  );
};

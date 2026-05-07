import { Skeleton } from '@/components/ui/skeleton';

interface Props {
  view?: 'list' | 'grid';
  count?: number;
}

export const FileGridSkeleton = ({ view = 'list', count = 8 }: Props) => {
  if (view === 'grid') {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border/60 bg-card/40 p-3 space-y-3">
            <Skeleton className="h-24 w-full rounded-md" />
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-2 w-1/2" />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-lg border border-border/60 bg-card/40 px-4 py-3">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-2/5" />
            <Skeleton className="h-2 w-1/4" />
          </div>
          <Skeleton className="h-3 w-16" />
        </div>
      ))}
    </div>
  );
};

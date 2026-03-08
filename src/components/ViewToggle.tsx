import { Button } from '@/components/ui/button';
import { LayoutGrid, List } from 'lucide-react';
import { cn } from '@/lib/utils';

type ViewMode = 'grid' | 'list';

interface ViewToggleProps {
  view: ViewMode;
  onChange: (view: ViewMode) => void;
}

export const ViewToggle = ({ view, onChange }: ViewToggleProps) => {
  return (
    <div className="flex items-center bg-background/50 border border-border/50 rounded-lg p-0.5">
      <button
        onClick={() => onChange('list')}
        className={cn(
          "flex items-center justify-center h-7 w-7 rounded-md transition-all duration-200",
          view === 'list'
            ? "bg-primary/10 text-primary shadow-sm shadow-primary/10"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <List className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={() => onChange('grid')}
        className={cn(
          "flex items-center justify-center h-7 w-7 rounded-md transition-all duration-200",
          view === 'grid'
            ? "bg-primary/10 text-primary shadow-sm shadow-primary/10"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <LayoutGrid className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};

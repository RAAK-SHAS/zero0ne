import { Button } from '@/components/ui/button';
import { LayoutGrid, List } from 'lucide-react';

type ViewMode = 'grid' | 'list';

interface ViewToggleProps {
  view: ViewMode;
  onChange: (view: ViewMode) => void;
}

export const ViewToggle = ({ view, onChange }: ViewToggleProps) => {
  return (
    <div className="flex items-center border rounded-md">
      <Button
        variant={view === 'list' ? 'secondary' : 'ghost'}
        size="sm"
        className="rounded-r-none"
        onClick={() => onChange('list')}
      >
        <List className="h-4 w-4" />
      </Button>
      <Button
        variant={view === 'grid' ? 'secondary' : 'ghost'}
        size="sm"
        className="rounded-l-none"
        onClick={() => onChange('grid')}
      >
        <LayoutGrid className="h-4 w-4" />
      </Button>
    </div>
  );
};

import { ChevronRight, Home, Folder } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Folder as FolderType } from '@/hooks/useFolders';

interface FolderBreadcrumbProps {
  path: FolderType[];
  onNavigate: (folderId: string | null) => void;
}

export const FolderBreadcrumb = ({ path, onNavigate }: FolderBreadcrumbProps) => {
  return (
    <nav className="flex items-center gap-1 text-sm overflow-x-auto">
      <Button
        variant="ghost"
        size="sm"
        className="gap-1 shrink-0"
        onClick={() => onNavigate(null)}
      >
        <Home className="h-4 w-4" />
        <span className="hidden sm:inline">Root</span>
      </Button>
      
      {path.map((folder, index) => (
        <div key={folder.id} className="flex items-center gap-1">
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 shrink-0"
            onClick={() => onNavigate(folder.id)}
            disabled={index === path.length - 1}
          >
            <Folder className="h-4 w-4" />
            <span className="max-w-[100px] truncate">{folder.name}</span>
          </Button>
        </div>
      ))}
    </nav>
  );
};

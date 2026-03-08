import { ChevronRight, Home, Folder, Terminal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Folder as FolderType } from '@/hooks/useFolders';
import { cn } from '@/lib/utils';

interface FolderBreadcrumbProps {
  path: FolderType[];
  onNavigate: (folderId: string | null) => void;
}

export const FolderBreadcrumb = ({ path, onNavigate }: FolderBreadcrumbProps) => {
  return (
    <nav className="flex items-center gap-1.5 text-sm overflow-x-auto py-1">
      <button
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono transition-all duration-200",
          "hover:bg-primary/10 hover:text-primary",
          path.length === 0
            ? "text-primary bg-primary/5 border border-primary/20"
            : "text-muted-foreground"
        )}
        onClick={() => onNavigate(null)}
      >
        <Home className="h-3.5 w-3.5" />
        <span>Root</span>
      </button>

      {path.map((folder, index) => {
        const isLast = index === path.length - 1;
        return (
          <div key={folder.id} className="flex items-center gap-1.5">
            <ChevronRight className="h-3 w-3 text-primary/40 shrink-0" />
            <button
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono transition-all duration-200",
                isLast
                  ? "text-primary bg-primary/5 border border-primary/20"
                  : "text-muted-foreground hover:bg-primary/10 hover:text-primary"
              )}
              onClick={() => !isLast && onNavigate(folder.id)}
              disabled={isLast}
            >
              <Folder className="h-3.5 w-3.5" />
              <span className="max-w-[120px] truncate">{folder.name}</span>
            </button>
          </div>
        );
      })}
    </nav>
  );
};

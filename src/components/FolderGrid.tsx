import { Folder, MoreHorizontal, Trash2, Edit2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Folder as FolderType } from '@/hooks/useFolders';

interface FolderGridProps {
  folders: FolderType[];
  onOpen: (folderId: string) => void;
  onRename: (folderId: string) => void;
  onDelete: (folderId: string) => void;
}

export const FolderGrid = ({ folders, onOpen, onRename, onDelete }: FolderGridProps) => {
  if (folders.length === 0) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
      {folders.map((folder) => (
        <div
          key={folder.id}
          className="group relative bg-accent/50 hover:bg-accent rounded-lg p-4 cursor-pointer transition-colors"
          onDoubleClick={() => onOpen(folder.id)}
        >
          <div className="flex flex-col items-center gap-2">
            <Folder className="h-12 w-12 text-primary" />
            <span className="text-sm font-medium truncate w-full text-center">
              {folder.name}
            </span>
          </div>
          
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onOpen(folder.id)}>
                  <Folder className="h-4 w-4 mr-2" />
                  Open
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onRename(folder.id)}>
                  <Edit2 className="h-4 w-4 mr-2" />
                  Rename
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => onDelete(folder.id)}
                  className="text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      ))}
    </div>
  );
};

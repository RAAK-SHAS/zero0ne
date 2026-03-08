import { Folder, MoreHorizontal, Trash2, Edit2, EyeOff, Eye, Lock, Unlock, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import type { Folder as FolderType } from '@/hooks/useFolders';
import { cn } from '@/lib/utils';

interface FolderGridProps {
  folders: FolderType[];
  onOpen: (folderId: string) => void;
  onRename: (folderId: string) => void;
  onDelete: (folderId: string) => void;
  onToggleHidden?: (folderId: string, isHidden: boolean) => void;
  onLock?: (folderId: string) => void;
  onUnlock?: (folderId: string) => void;
  onRemoveLock?: (folderId: string) => void;
  onChangePassword?: (folderId: string) => void;
  isFolderUnlocked?: (folderId: string) => boolean;
}

export const FolderGrid = ({
  folders, onOpen, onRename, onDelete, onToggleHidden,
  onLock, onUnlock, onRemoveLock, onChangePassword, isFolderUnlocked,
}: FolderGridProps) => {
  if (folders.length === 0) return null;

  const handleOpen = (folder: FolderType) => {
    if (folder.is_locked && !(isFolderUnlocked?.(folder.id))) {
      onUnlock?.(folder.id);
    } else {
      onOpen(folder.id);
    }
  };

  const menuItems = (folder: FolderType) => (
    <>
      <ContextMenuItem onClick={() => handleOpen(folder)}>
        <Folder className="h-4 w-4 mr-2" /> Open
      </ContextMenuItem>
      <ContextMenuItem onClick={() => onRename(folder.id)}>
        <Edit2 className="h-4 w-4 mr-2" /> Rename
      </ContextMenuItem>
      <ContextMenuSeparator />
      {onToggleHidden && (
        <ContextMenuItem onClick={() => onToggleHidden(folder.id, folder.is_hidden)}>
          {folder.is_hidden ? <><Eye className="h-4 w-4 mr-2" /> Unhide</> : <><EyeOff className="h-4 w-4 mr-2" /> Hide</>}
        </ContextMenuItem>
      )}
      {!folder.is_locked && onLock && (
        <ContextMenuItem onClick={() => onLock(folder.id)}><Lock className="h-4 w-4 mr-2" /> Lock</ContextMenuItem>
      )}
      {folder.is_locked && (
        <>
          {onChangePassword && <ContextMenuItem onClick={() => onChangePassword(folder.id)}><KeyRound className="h-4 w-4 mr-2" /> Change Password</ContextMenuItem>}
          {onRemoveLock && <ContextMenuItem onClick={() => onRemoveLock(folder.id)}><Unlock className="h-4 w-4 mr-2" /> Remove Lock</ContextMenuItem>}
        </>
      )}
      <ContextMenuSeparator />
      <ContextMenuItem onClick={() => onDelete(folder.id)} className="text-destructive">
        <Trash2 className="h-4 w-4 mr-2" /> Delete
      </ContextMenuItem>
    </>
  );

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5 mb-6">
      {folders.map((folder) => (
        <ContextMenu key={folder.id}>
          <ContextMenuTrigger>
            <div
              className={cn(
                "group relative rounded-xl p-4 cursor-pointer transition-all duration-200 border border-transparent",
                folder.is_hidden
                  ? "bg-muted/30 hover:bg-muted/50 opacity-50"
                  : "bg-muted/50 hover:bg-muted hover:border-primary/20 hover:shadow-sm"
              )}
              onDoubleClick={() => handleOpen(folder)}
            >
              <div className="flex flex-col items-center gap-2">
                <div className="relative">
                  <div className={cn(
                    "h-12 w-12 rounded-xl flex items-center justify-center transition-colors",
                    folder.is_hidden ? "bg-muted-foreground/10" : "bg-primary/10"
                  )}>
                    <Folder className={cn(
                      "h-6 w-6",
                      folder.is_hidden ? "text-muted-foreground" : "text-primary"
                    )} />
                  </div>
                  {folder.is_locked && (
                    <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-destructive/10 flex items-center justify-center">
                      <Lock className="h-3 w-3 text-destructive" />
                    </div>
                  )}
                  {folder.is_hidden && (
                    <div className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-muted flex items-center justify-center">
                      <EyeOff className="h-2.5 w-2.5 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <span className="text-sm font-medium truncate w-full text-center">
                  {folder.name}
                </span>
              </div>

              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleOpen(folder)}><Folder className="h-4 w-4 mr-2" /> Open</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onRename(folder.id)}><Edit2 className="h-4 w-4 mr-2" /> Rename</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {onToggleHidden && (
                      <DropdownMenuItem onClick={() => onToggleHidden(folder.id, folder.is_hidden)}>
                        {folder.is_hidden ? <><Eye className="h-4 w-4 mr-2" /> Unhide</> : <><EyeOff className="h-4 w-4 mr-2" /> Hide</>}
                      </DropdownMenuItem>
                    )}
                    {!folder.is_locked && onLock && (
                      <DropdownMenuItem onClick={() => onLock(folder.id)}><Lock className="h-4 w-4 mr-2" /> Lock</DropdownMenuItem>
                    )}
                    {folder.is_locked && (
                      <>
                        {onChangePassword && <DropdownMenuItem onClick={() => onChangePassword(folder.id)}><KeyRound className="h-4 w-4 mr-2" /> Change Password</DropdownMenuItem>}
                        {onRemoveLock && <DropdownMenuItem onClick={() => onRemoveLock(folder.id)}><Unlock className="h-4 w-4 mr-2" /> Remove Lock</DropdownMenuItem>}
                      </>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => onDelete(folder.id)} className="text-destructive">
                      <Trash2 className="h-4 w-4 mr-2" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent>
            {menuItems(folder)}
          </ContextMenuContent>
        </ContextMenu>
      ))}
    </div>
  );
};

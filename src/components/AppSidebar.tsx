import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { StorageBar } from '@/components/StorageBar';
import { ThemeToggle } from '@/components/ThemeToggle';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Cloud,
  FolderOpen,
  Clock,
  Trash2,
  Settings,
  LogOut,
  Upload,
  Share2,
  Plus,
} from 'lucide-react';

interface AppSidebarProps {
  storageUsed: number;
  storageTotal: number;
  onUploadClick: () => void;
  onNewFolderClick: () => void;
}

interface NavItemProps {
  icon: React.ElementType;
  label: string;
  active?: boolean;
  onClick: () => void;
}

const NavItem = ({ icon: Icon, label, active, onClick }: NavItemProps) => (
  <button
    onClick={onClick}
    className={cn(
      'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200',
      active
        ? 'bg-primary/10 text-primary shadow-sm'
        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
    )}
  >
    <Icon className={cn("h-[18px] w-[18px] shrink-0", active && "text-primary")} />
    <span className="truncate">{label}</span>
  </button>
);

export const AppSidebar = ({ storageUsed, storageTotal, onUploadClick, onNewFolderClick }: AppSidebarProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut, user } = useAuth();

  const currentPath = location.pathname + location.search;
  const isActive = (path: string) => {
    if (path === '/dashboard') return location.pathname === '/dashboard' && !location.search.includes('view=');
    return currentPath.includes(path);
  };

  const initials = user?.email?.slice(0, 2).toUpperCase() || 'U';

  return (
    <aside className="hidden md:flex flex-col w-[260px] border-r border-border/60 bg-card h-screen sticky top-0">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 h-16 border-b border-border/60 shrink-0">
        <div className="h-8 w-8 rounded-lg gradient-bg flex items-center justify-center">
          <Cloud className="h-4 w-4 text-primary-foreground" />
        </div>
        <span className="text-base font-bold tracking-tight">CloudStore</span>
      </div>

      {/* Action buttons */}
      <div className="px-3 pt-4 pb-2 space-y-1.5 shrink-0">
        <Button onClick={onUploadClick} className="w-full justify-start gap-2.5 h-10 gradient-bg border-0 text-primary-foreground hover:opacity-90 font-medium shadow-sm">
          <Upload className="h-4 w-4" />
          Upload Files
        </Button>
        <Button variant="outline" onClick={onNewFolderClick} className="w-full justify-start gap-2.5 h-9 text-sm font-medium">
          <Plus className="h-4 w-4" />
          New Folder
        </Button>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 px-3 py-3">
        <div className="space-y-0.5">
          <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
            Browse
          </p>
          <NavItem
            icon={FolderOpen}
            label="My Files"
            active={isActive('/dashboard')}
            onClick={() => navigate('/dashboard')}
          />
          <NavItem
            icon={Clock}
            label="Recent"
            active={isActive('view=recent')}
            onClick={() => navigate('/dashboard?view=recent')}
          />
          <NavItem
            icon={Share2}
            label="Shared"
            active={isActive('view=shared')}
            onClick={() => navigate('/dashboard?view=shared')}
          />
          <NavItem
            icon={Trash2}
            label="Trash"
            active={isActive('/trash')}
            onClick={() => navigate('/trash')}
          />
        </div>

        <Separator className="my-4" />

        <div className="space-y-0.5">
          <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
            Account
          </p>
          <NavItem
            icon={Settings}
            label="Settings"
            active={isActive('/settings')}
            onClick={() => navigate('/settings')}
          />
        </div>
      </ScrollArea>

      {/* Storage + user */}
      <div className="border-t border-border/60 p-3 space-y-3 shrink-0">
        <div className="px-1">
          <StorageBar used={storageUsed} total={storageTotal} compact />
        </div>
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2.5 min-w-0">
            <Avatar className="h-7 w-7">
              <AvatarFallback className="text-[10px] font-semibold bg-primary/10 text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs text-muted-foreground truncate max-w-[120px]">
              {user?.email}
            </span>
          </div>
          <div className="flex items-center gap-0.5">
            <ThemeToggle />
            <Button variant="ghost" size="icon" onClick={signOut} title="Sign out" className="h-8 w-8">
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </aside>
  );
};

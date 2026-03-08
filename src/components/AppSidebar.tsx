import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { StorageBar } from '@/components/StorageBar';
import { ThemeToggle } from '@/components/ThemeToggle';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
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
      'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
      active
        ? 'bg-primary/10 text-primary'
        : 'text-muted-foreground hover:bg-accent hover:text-foreground'
    )}
  >
    <Icon className="h-5 w-5 shrink-0" />
    <span className="truncate">{label}</span>
  </button>
);

export const AppSidebar = ({ storageUsed, storageTotal, onUploadClick, onNewFolderClick }: AppSidebarProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut } = useAuth();

  const currentPath = location.pathname + location.search;
  const isActive = (path: string) => {
    if (path === '/dashboard') return location.pathname === '/dashboard' && !location.search.includes('view=');
    return currentPath.includes(path);
  };

  return (
    <aside className="hidden md:flex flex-col w-64 border-r bg-card/50 backdrop-blur-sm h-screen sticky top-0">
      {/* Logo */}
      <div className="flex items-center gap-2 px-5 py-4 border-b">
        <Cloud className="h-7 w-7 text-primary" />
        <h1 className="text-lg font-bold">CloudStore</h1>
      </div>

      {/* Action buttons */}
      <div className="px-3 pt-4 space-y-2">
        <Button onClick={onUploadClick} className="w-full justify-start gap-2">
          <Upload className="h-4 w-4" />
          Upload
        </Button>
        <Button variant="outline" onClick={onNewFolderClick} className="w-full justify-start gap-2">
          <Plus className="h-4 w-4" />
          New Folder
        </Button>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="space-y-1">
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
        </nav>

        <Separator className="my-4" />

        <nav className="space-y-1">
          <NavItem
            icon={Settings}
            label="Settings"
            active={isActive('/settings')}
            onClick={() => navigate('/settings')}
          />
        </nav>
      </ScrollArea>

      {/* Storage + footer */}
      <div className="px-4 py-4 border-t space-y-3">
        <StorageBar used={storageUsed} total={storageTotal} compact />
        <div className="flex items-center justify-between">
          <ThemeToggle />
          <Button variant="ghost" size="icon" onClick={signOut} title="Sign out">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </aside>
  );
};

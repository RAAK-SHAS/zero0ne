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
  Cloud, FolderOpen, Clock3, Trash2, Settings, LogOut, Upload, Share2, Plus, Image, FileText, Code2,
  Keyboard, ChevronLeft,
} from 'lucide-react';

interface AppSidebarProps {
  storageUsed: number;
  storageTotal: number;
  onUploadClick: () => void;
  onNewFolderClick: () => void;
  recentCount?: number;
  sharedCount?: number;
  typeCounts?: {
    images: number;
    documents: number;
    code: number;
  };
  onQuickFilterClick?: (filter: 'images' | 'documents' | 'code') => void;
  onCollapse?: () => void;
}

interface NavItemProps {
  icon: React.ElementType;
  label: string;
  count?: number;
  active?: boolean;
  onClick: () => void;
}

const NavItem = ({ icon: Icon, label, count, active, onClick }: NavItemProps) => (
  <button
    onClick={onClick}
    className={cn(
      'relative w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-all duration-200',
      active
        ? 'bg-primary/8 text-foreground border border-primary/25 shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.08)]'
        : 'text-muted-foreground hover:bg-accent/40 hover:text-foreground'
    )}
  >
    <span
      className={cn(
        'absolute left-0 top-2 bottom-2 w-1 rounded-r-full transition-all duration-200',
        active ? 'bg-primary opacity-100' : 'bg-transparent opacity-0'
      )}
    />
    <Icon className={cn("h-[18px] w-[18px] shrink-0", active && "text-primary")} />
    <span className="truncate">{label}</span>
    {typeof count === 'number' && (
      <span className={cn(
        'ml-auto rounded-full px-2 py-0.5 text-[11px] tabular-nums',
        active ? 'bg-primary/12 text-primary' : 'bg-muted text-muted-foreground'
      )}>
        {count}
      </span>
    )}
  </button>
);

export const AppSidebar = ({
  storageUsed,
  storageTotal,
  onUploadClick,
  onNewFolderClick,
  recentCount = 0,
  sharedCount = 0,
  typeCounts,
  onQuickFilterClick,
  onCollapse,
}: AppSidebarProps) => {
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
    <aside className="hidden md:flex flex-col w-[260px] border-r border-border/70 sidebar-gradient h-screen sticky top-0 backdrop-blur-xl animate-in slide-in-from-left duration-200">
      {/* Logo */}
      <div className="flex items-center justify-between px-5 h-16 border-b border-border/70 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg gradient-bg flex items-center justify-center shadow-md">
            <Cloud className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="text-base font-bold tracking-tight">CloudStore</span>
        </div>
        {onCollapse && (
          <Button variant="ghost" size="icon" onClick={onCollapse} className="h-7 w-7" title="Collapse sidebar">
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}
      </div>


      {/* Action buttons */}
      <div className="px-3 pt-3 pb-2 space-y-2 shrink-0">
        <Button onClick={onUploadClick} className="w-full justify-start gap-2.5 h-10 gradient-bg border-0 text-primary-foreground hover:opacity-90 font-medium shadow-lg shadow-primary/10">
          <Upload className="h-4 w-4" />
          Upload Files
        </Button>
        <Button variant="outline" onClick={onNewFolderClick} className="w-full justify-start gap-2.5 h-9 text-sm font-medium border-border/80 bg-card/30 hover:bg-accent/50">
          <Plus className="h-4 w-4" />
          New Folder
        </Button>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 px-3 py-3">
        <div className="space-y-1">
          <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
            Browse
          </p>
          <NavItem icon={FolderOpen} label="My Files" active={isActive('/dashboard')} onClick={() => navigate('/dashboard')} />
          <NavItem icon={Clock3} label="Recent" count={recentCount} active={isActive('view=recent')} onClick={() => navigate('/dashboard?view=recent')} />
          <NavItem icon={Share2} label="Shared" count={sharedCount} active={isActive('view=shared')} onClick={() => navigate('/dashboard?view=shared')} />
          <NavItem icon={Trash2} label="Trash" active={isActive('/trash')} onClick={() => navigate('/trash')} />
        </div>
        {typeCounts && onQuickFilterClick && (
          <>
            <Separator className="my-4 bg-border/70" />
            <div className="space-y-2">
              <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                Quick Filters
              </p>
              <div className="grid grid-cols-1 gap-1.5 px-1">
                <button onClick={() => onQuickFilterClick('images')} className="flex items-center justify-between rounded-lg border border-border/70 bg-card/30 px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground">
                  <span className="flex items-center gap-2"><Image className="h-3.5 w-3.5" />Images</span>
                  <span className="tabular-nums">{typeCounts.images}</span>
                </button>
                <button onClick={() => onQuickFilterClick('documents')} className="flex items-center justify-between rounded-lg border border-border/70 bg-card/30 px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground">
                  <span className="flex items-center gap-2"><FileText className="h-3.5 w-3.5" />Docs</span>
                  <span className="tabular-nums">{typeCounts.documents}</span>
                </button>
                <button onClick={() => onQuickFilterClick('code')} className="flex items-center justify-between rounded-lg border border-border/70 bg-card/30 px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground">
                  <span className="flex items-center gap-2"><Code2 className="h-3.5 w-3.5" />Code</span>
                  <span className="tabular-nums">{typeCounts.code}</span>
                </button>
              </div>
            </div>
          </>
        )}
        <Separator className="my-4 bg-border" />
        <div className="space-y-1">
          <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
            Account
          </p>
          <NavItem icon={Settings} label="Settings" active={isActive('/settings')} onClick={() => navigate('/settings')} />
        </div>
      </ScrollArea>

      {/* Storage + user */}
      <div className="border-t border-border p-3 space-y-3 shrink-0">
        <div className="px-1">
          <StorageBar used={storageUsed} total={storageTotal} compact />
        </div>
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2.5 min-w-0">
            <Avatar className="h-7 w-7 ring-1 ring-primary/30">
              <AvatarFallback className="text-[10px] font-semibold bg-primary/10 text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs text-muted-foreground truncate max-w-[120px]">
              {user?.email}
            </span>
          </div>
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => window.dispatchEvent(new CustomEvent('open-shortcuts'))}
              title="Keyboard shortcuts (?)"
              className="h-8 w-8"
            >
              <Keyboard className="h-3.5 w-3.5" />
            </Button>
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

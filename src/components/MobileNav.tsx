import { useNavigate, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { FolderOpen, Clock, Share2, Trash2, Settings } from 'lucide-react';

const items = [
  { icon: FolderOpen, label: 'Files', path: '/dashboard' },
  { icon: Clock, label: 'Recent', path: '/dashboard?view=recent' },
  { icon: Share2, label: 'Shared', path: '/dashboard?view=shared' },
  { icon: Trash2, label: 'Trash', path: '/trash' },
  { icon: Settings, label: 'Settings', path: '/settings' },
];

export const MobileNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname + location.search;

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t bg-card/95 backdrop-blur-sm">
      <div className="flex items-center justify-around py-2">
        {items.map(({ icon: Icon, label, path }) => {
          const active = path === '/dashboard'
            ? location.pathname === '/dashboard' && !location.search.includes('view=')
            : currentPath.includes(path.includes('?') ? path.split('?')[1] : path);

          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={cn(
                'flex flex-col items-center gap-0.5 px-3 py-1 rounded-md text-xs transition-colors',
                active ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <Icon className="h-5 w-5" />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

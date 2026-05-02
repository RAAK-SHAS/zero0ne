import { useRef } from 'react';
import { Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useUploadManager } from '@/contexts/UploadContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface CameraUploadButtonProps {
  currentFolderId?: string | null;
  variant?: 'default' | 'icon';
  className?: string;
}

/**
 * Mobile-friendly capture-from-camera button.
 * On mobile browsers the `capture` attribute opens the device camera directly.
 * On desktop it falls back to a normal file picker (still useful for webcam pics).
 */
export const CameraUploadButton = ({ currentFolderId, variant = 'default', className }: CameraUploadButtonProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const { addFiles } = useUploadManager();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0 || !user) return;
    addFiles(files, user.id, undefined, currentFolderId || undefined);
    toast.success(`Captured ${files.length} item${files.length > 1 ? 's' : ''} → uploading`);
    e.target.value = ''; // reset
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*"
        capture="environment"
        multiple
        className="hidden"
        onChange={handleChange}
      />
      {variant === 'icon' ? (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => inputRef.current?.click()}
          className={cn('h-9 w-9', className)}
          title="Capture photo or video"
        >
          <Camera className="h-4 w-4" />
        </Button>
      ) : (
        <Button
          variant="outline"
          onClick={() => inputRef.current?.click()}
          className={className}
        >
          <Camera className="h-4 w-4 mr-2" />
          Camera
        </Button>
      )}
    </>
  );
};

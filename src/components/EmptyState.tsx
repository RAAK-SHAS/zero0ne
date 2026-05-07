import { FolderOpen, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  title?: string;
  description?: string;
  onUpload?: () => void;
}

export const EmptyState = ({
  title = 'No files yet',
  description = 'Upload your first file to get started, or drag and drop files anywhere.',
  onUpload,
}: Props) => {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-card/40 py-16 px-6 text-center">
      <div className="relative mb-5">
        <div className="absolute inset-0 rounded-3xl bg-primary/10 blur-2xl" />
        <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/20 to-primary/5">
          <FolderOpen className="h-9 w-9 text-primary" />
        </div>
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{description}</p>
      {onUpload && (
        <Button onClick={onUpload} className="mt-5 gap-2" size="sm">
          <Upload className="h-4 w-4" />
          Upload files
        </Button>
      )}
    </div>
  );
};

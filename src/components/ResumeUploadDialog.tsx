import { useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RefreshCw, FileIcon } from 'lucide-react';

interface ResumeUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  uploadId: string;
  fileName: string;
  onFileSelected: (uploadId: string, file: File) => void;
  onCancel: () => void;
}

export const ResumeUploadDialog = ({
  open,
  onOpenChange,
  uploadId,
  fileName,
  onFileSelected,
  onCancel,
}: ResumeUploadDialogProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelected(uploadId, file);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Resume Upload
          </DialogTitle>
          <DialogDescription>
            To resume this upload, please reselect the original file. Your progress will be preserved.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex items-center gap-3 p-4 bg-accent/50 rounded-lg">
          <FileIcon className="h-8 w-8 text-primary flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-medium truncate">{fileName}</p>
            <p className="text-sm text-muted-foreground">
              Select this exact file to continue the upload
            </p>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileChange}
        />

        <DialogFooter className="flex gap-2 sm:gap-0">
          <Button variant="outline" onClick={onCancel}>
            Cancel Upload
          </Button>
          <Button onClick={() => fileInputRef.current?.click()}>
            <FileIcon className="h-4 w-4 mr-2" />
            Select File
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

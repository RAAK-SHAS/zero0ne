import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

interface RenameDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentName: string;
  onRename: (newName: string) => Promise<void>;
}

export const RenameDialog = ({ open, onOpenChange, currentName, onRename }: RenameDialogProps) => {
  const [newName, setNewName] = useState(currentName);
  const [renaming, setRenaming] = useState(false);

  useEffect(() => {
    setNewName(currentName);
  }, [currentName]);

  const handleRename = async () => {
    if (!newName.trim() || newName === currentName) {
      onOpenChange(false);
      return;
    }

    setRenaming(true);
    try {
      await onRename(newName.trim());
      onOpenChange(false);
    } catch (error) {
      // Error handled by parent
    } finally {
      setRenaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRename();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rename File</DialogTitle>
          <DialogDescription>
            Enter a new name for your file
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-2">
          <Label htmlFor="filename">File Name</Label>
          <Input
            id="filename"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter file name"
            autoFocus
          />
        </div>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            disabled={renaming}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleRename}
            disabled={renaming || !newName.trim()}
          >
            {renaming ? 'Renaming...' : 'Rename'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
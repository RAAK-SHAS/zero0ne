import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Lock, Unlock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface EncryptionDialogProps {
  fileId: string | null;
  fileName: string;
  isEncrypted: boolean;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const EncryptionDialog = ({
  fileId,
  fileName,
  isEncrypted,
  open,
  onClose,
  onSuccess,
}: EncryptionDialogProps) => {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!fileId || !password) return;

    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke('encrypt-file', {
        body: {
          fileId,
          password,
          action: isEncrypted ? 'decrypt' : 'encrypt'
        }
      });

      if (error) throw error;

      toast.success(isEncrypted ? 'File decrypted successfully' : 'File encrypted successfully');
      onSuccess();
      onClose();
      setPassword('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Encryption operation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isEncrypted ? <Unlock className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
            {isEncrypted ? 'Decrypt' : 'Encrypt'} File
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">
            {isEncrypted 
              ? `Enter password to decrypt "${fileName}"`
              : `Set a password to encrypt "${fileName}"`
            }
          </p>
          
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter encryption password"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!password || loading}>
            {loading ? 'Processing...' : (isEncrypted ? 'Decrypt' : 'Encrypt')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

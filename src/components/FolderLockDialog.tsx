import { useState } from 'react';
import { Lock, Unlock, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type LockAction = 'lock' | 'unlock' | 'remove_lock' | 'change_password';

interface FolderLockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folderId: string | null;
  folderName: string;
  isLocked: boolean;
  action: LockAction;
  onSuccess: () => void;
}

export const FolderLockDialog = ({
  open,
  onOpenChange,
  folderId,
  folderName,
  isLocked,
  action,
  onSuccess,
}: FolderLockDialogProps) => {
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const reset = () => {
    setPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setError('');
  };

  const handleClose = (val: boolean) => {
    if (!val) reset();
    onOpenChange(val);
  };

  const handleSubmit = async () => {
    if (!folderId) return;
    setError('');

    if (action === 'lock') {
      if (password.length < 4) {
        setError('Password must be at least 4 characters');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }
    }

    if (action === 'change_password') {
      if (newPassword.length < 4) {
        setError('New password must be at least 4 characters');
        return;
      }
      if (newPassword !== confirmPassword) {
        setError('New passwords do not match');
        return;
      }
    }

    setLoading(true);
    try {
      const body: Record<string, string> = { action, folderId, password };
      if (action === 'change_password') {
        body.newPassword = newPassword;
      }

      const { data, error: fnError } = await supabase.functions.invoke('folder-lock', { body });

      if (fnError) throw fnError;
      if (data?.error) {
        setError(data.error);
        return;
      }

      const messages: Record<LockAction, string> = {
        lock: 'Folder locked',
        unlock: 'Folder unlocked',
        remove_lock: 'Lock removed',
        change_password: 'Password changed',
      };
      toast.success(messages[action]);
      onSuccess();
      handleClose(false);
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const titles: Record<LockAction, string> = {
    lock: 'Lock Folder',
    unlock: 'Unlock Folder',
    remove_lock: 'Remove Lock',
    change_password: 'Change Password',
  };

  const descriptions: Record<LockAction, string> = {
    lock: `Set a password to lock "${folderName}".`,
    unlock: `Enter password to open "${folderName}".`,
    remove_lock: `Enter current password to remove the lock from "${folderName}".`,
    change_password: `Change the password for "${folderName}".`,
  };

  const icons: Record<LockAction, React.ReactNode> = {
    lock: <Lock className="h-5 w-5 text-primary" />,
    unlock: <Unlock className="h-5 w-5 text-primary" />,
    remove_lock: <Unlock className="h-5 w-5 text-destructive" />,
    change_password: <KeyRound className="h-5 w-5 text-primary" />,
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {icons[action]}
            {titles[action]}
          </DialogTitle>
          <DialogDescription>{descriptions[action]}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {(action === 'lock') && (
            <>
              <div className="space-y-2">
                <Label htmlFor="lock-password">Password</Label>
                <Input
                  id="lock-password"
                  type="password"
                  placeholder="Enter password (min 4 chars)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lock-confirm">Confirm Password</Label>
                <Input
                  id="lock-confirm"
                  type="password"
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                />
              </div>
            </>
          )}

          {(action === 'unlock' || action === 'remove_lock') && (
            <div className="space-y-2">
              <Label htmlFor="unlock-password">Password</Label>
              <Input
                id="unlock-password"
                type="password"
                placeholder="Enter folder password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                autoFocus
              />
            </div>
          )}

          {action === 'change_password' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="current-password">Current Password</Label>
                <Input
                  id="current-password"
                  type="password"
                  placeholder="Enter current password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="Enter new password (min 4 chars)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-new-password">Confirm New Password</Label>
                <Input
                  id="confirm-new-password"
                  type="password"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                />
              </div>
            </>
          )}

          {error && (
            <p className="text-sm text-destructive font-medium">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Processing...' : titles[action]}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

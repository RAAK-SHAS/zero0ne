import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Lock, Unlock, ShieldCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { encryptBlob, decryptBlob } from '@/lib/crypto';

interface EncryptionDialogProps {
  fileId: string | null;
  fileName: string;
  storagePath?: string;
  isEncrypted: boolean;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const EncryptionDialog = ({
  fileId,
  fileName,
  storagePath,
  isEncrypted,
  open,
  onClose,
  onSuccess,
}: EncryptionDialogProps) => {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');

  const reset = () => {
    setPassword('');
    setConfirm('');
    setProgress('');
  };

  const handleSubmit = async () => {
    if (!fileId || !password || !storagePath) return;

    if (!isEncrypted && password !== confirm) {
      toast.error('Passwords do not match');
      return;
    }
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      // 1. Download current bytes
      setProgress('Downloading file…');
      const { data: signed, error: urlErr } = await supabase.storage
        .from('user-files')
        .createSignedUrl(storagePath, 120);
      if (urlErr || !signed) throw urlErr || new Error('Could not access file');

      const res = await fetch(signed.signedUrl);
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();

      // 2. Encrypt or decrypt
      setProgress(isEncrypted ? 'Decrypting…' : 'Encrypting…');
      const newBlob = isEncrypted
        ? await decryptBlob(blob, password)
        : await encryptBlob(blob, password);

      // 3. Upload back to same storage path (overwrite)
      setProgress('Uploading…');
      const { error: upErr } = await supabase.storage
        .from('user-files')
        .update(storagePath, newBlob, { cacheControl: '3600', upsert: true });
      if (upErr) throw upErr;

      // 4. Update DB metadata
      const { error: dbErr } = await supabase
        .from('files')
        .update({
          is_encrypted: !isEncrypted,
          encryption_algorithm: !isEncrypted ? 'AES-GCM-256+PBKDF2' : null,
          size_bytes: newBlob.size,
          encryption_metadata: !isEncrypted
            ? { encrypted_at: new Date().toISOString(), kdf: 'PBKDF2-SHA256', iterations: 250_000 }
            : null,
        })
        .eq('id', fileId);
      if (dbErr) throw dbErr;

      toast.success(isEncrypted ? 'File decrypted' : 'File encrypted end-to-end');
      reset();
      onSuccess();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Operation failed');
    } finally {
      setLoading(false);
      setProgress('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onClose(); } }}>
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
              ? `Enter the passphrase used to encrypt "${fileName}".`
              : `Set a passphrase to encrypt "${fileName}" end-to-end.`}
          </p>

          <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-xs flex gap-2 items-start">
            <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <div>
              <strong>End-to-end:</strong> Encryption happens entirely in your browser
              with AES-GCM-256 + PBKDF2 (250k iters). The passphrase never leaves your device.
              <strong className="block mt-1 text-destructive">If you forget it, the file is unrecoverable.</strong>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Passphrase</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              autoFocus
            />
          </div>

          {!isEncrypted && (
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirm passphrase</Label>
              <Input
                id="confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Re-enter passphrase"
              />
            </div>
          )}

          {progress && (
            <p className="text-xs text-muted-foreground font-mono animate-pulse">{progress}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onClose(); }} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!password || loading}>
            {loading ? 'Working…' : (isEncrypted ? 'Decrypt' : 'Encrypt')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

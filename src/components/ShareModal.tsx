import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Copy, Lock } from 'lucide-react';

interface ShareModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shareLink: string;
  onUpdateShare?: (expirationDays: number | null, password: string | null) => Promise<void>;
}

export const ShareModal = ({ open, onOpenChange, shareLink, onUpdateShare }: ShareModalProps) => {
  const [expiration, setExpiration] = useState<string>('never');
  const [password, setPassword] = useState('');
  const [updating, setUpdating] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(shareLink);
    toast.success('Link copied to clipboard!');
  };

  const handleUpdateShare = async () => {
    if (!onUpdateShare) return;
    
    setUpdating(true);
    try {
      const expirationDays = expiration === 'never' ? null : parseInt(expiration);
      await onUpdateShare(expirationDays, password || null);
      toast.success('Share settings updated!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update share settings');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share File</DialogTitle>
          <DialogDescription>
            Anyone with this link can access the file
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Share Link</Label>
            <div className="flex gap-2">
              <Input 
                value={shareLink} 
                readOnly 
                onClick={(e) => e.currentTarget.select()} 
                className="flex-1"
              />
              <Button variant="outline" size="icon" onClick={copyToClipboard}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="expiration">Link Expiration</Label>
            <Select value={expiration} onValueChange={setExpiration}>
              <SelectTrigger id="expiration">
                <SelectValue placeholder="Select expiration" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 Day</SelectItem>
                <SelectItem value="7">7 Days</SelectItem>
                <SelectItem value="30">30 Days</SelectItem>
                <SelectItem value="never">Never</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password Protection (Optional)</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="password"
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-9"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Leave empty for no password protection
            </p>
          </div>

          {onUpdateShare && (
            <Button 
              onClick={handleUpdateShare} 
              disabled={updating}
              className="w-full"
            >
              {updating ? 'Updating...' : 'Update Settings'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
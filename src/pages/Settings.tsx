import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { StorageBar } from '@/components/StorageBar';
import { ThemeToggle } from '@/components/ThemeToggle';
import { AppSidebar } from '@/components/AppSidebar';
import { MobileNav } from '@/components/MobileNav';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { User, Shield, HardDrive, Palette, Mail } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const Settings = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<{ email: string; name?: string; storage_used_bytes: number; storage_quota_bytes: number; created_at: string } | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [savingName, setSavingName] = useState(false);

  useEffect(() => {
    if (user) {
      supabase.from('profiles').select('*').eq('id', user.id).single().then(({ data }) => {
        if (data) {
          setProfile(data as any);
          setDisplayName((data as any).name || '');
        }
      });
    }
  }, [user]);

  const handleSaveName = async () => {
    if (!user) return;
    const trimmed = displayName.trim();
    if (trimmed.length > 100) { toast.error('Name must be under 100 characters'); return; }
    setSavingName(true);
    const { error } = await supabase.from('profiles').update({ name: trimmed } as any).eq('id', user.id);
    setSavingName(false);
    if (error) { toast.error(error.message); } else {
      toast.success('Name updated');
      setProfile(prev => prev ? { ...prev, name: trimmed } : prev);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) { toast.error('Passwords do not match'); return; }
    if (newPassword.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);
    if (error) { toast.error(error.message); } else {
      toast.success('Password updated'); setNewPassword(''); setConfirmPassword('');
    }
  };

  const initials = (profile?.name || user?.email)?.slice(0, 2).toUpperCase() || 'U';

  return (
    <div className="flex h-screen bg-background">
      <AppSidebar
        storageUsed={profile?.storage_used_bytes || 0}
        storageTotal={profile?.storage_quota_bytes || 109951162777600}
        onUploadClick={() => navigate('/upload')}
        onNewFolderClick={() => navigate('/dashboard')}
      />

      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <header className="md:hidden border-b border-border/60 bg-card/95 glass px-4 py-3">
          <h1 className="text-lg font-semibold">Settings</h1>
        </header>
        <header className="hidden md:flex border-b border-border/60 bg-card/50 glass h-14 items-center px-6">
          <h2 className="text-lg font-semibold">Settings</h2>
        </header>

        <main className="flex-1 overflow-y-auto pb-20 md:pb-6">
          <div className="max-w-2xl mx-auto px-4 md:px-6 py-6 space-y-6">
            {/* Profile */}
            <Card className="border-border/60">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-base"><User className="h-4 w-4 text-primary" /> Profile</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 mb-4">
                  <Avatar className="h-14 w-14">
                    <AvatarFallback className="text-lg font-semibold bg-primary/10 text-primary">{initials}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{profile?.name || profile?.email || user?.email}</p>
                    <p className="text-xs text-muted-foreground">
                      Member since {profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long' }) : '—'}
                    </p>
                  </div>
                </div>
                <Separator className="my-4" />
                <div className="space-y-1.5">
                  <Label htmlFor="displayName" className="text-xs">Display Name</Label>
                  <div className="flex gap-2">
                    <Input
                      id="displayName"
                      placeholder="Enter your name"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      maxLength={100}
                    />
                    <Button size="sm" onClick={handleSaveName} disabled={savingName || displayName.trim() === (profile?.name || '')}>
                      {savingName ? 'Saving...' : 'Save'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Storage */}
            <Card className="border-border/60">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-base"><HardDrive className="h-4 w-4 text-primary" /> Storage</CardTitle>
              </CardHeader>
              <CardContent>
                <StorageBar used={profile?.storage_used_bytes || 0} total={profile?.storage_quota_bytes || 109951162777600} />
              </CardContent>
            </Card>

            {/* Appearance */}
            <Card className="border-border/60">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-base"><Palette className="h-4 w-4 text-primary" /> Appearance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Theme</p>
                    <p className="text-xs text-muted-foreground">Switch between light and dark mode</p>
                  </div>
                  <ThemeToggle />
                </div>
              </CardContent>
            </Card>

            {/* Security */}
            <Card className="border-border/60">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-base"><Shield className="h-4 w-4 text-primary" /> Security</CardTitle>
                <CardDescription className="text-xs">Change your password</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleChangePassword} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="newPassword" className="text-xs">New Password</Label>
                    <Input id="newPassword" type="password" placeholder="••••••••" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="confirmNewPassword" className="text-xs">Confirm Password</Label>
                    <Input id="confirmNewPassword" type="password" placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
                  </div>
                  <Button type="submit" disabled={loading || !newPassword} size="sm">
                    {loading ? 'Updating...' : 'Update Password'}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Separator />

            <div className="flex justify-end">
              <Button variant="destructive" size="sm" onClick={signOut}>Sign Out</Button>
            </div>
          </div>
        </main>

        <MobileNav />
      </div>
    </div>
  );
};

export default Settings;

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Cloud, Upload, Share2, Lock } from 'lucide-react';

const Index = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-accent/20">
      <header className="border-b bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cloud className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold">CloudStore</h1>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="ghost" onClick={() => navigate('/auth/login')}>
              Sign In
            </Button>
            <Button onClick={() => navigate('/auth/register')}>
              Get Started
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <div className="space-y-4">
            <h2 className="text-5xl font-bold tracking-tight">
              Your Files, Anywhere
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Secure cloud storage with 10GB free space. Upload, manage, and share your files with ease.
            </p>
          </div>

          <div className="flex justify-center gap-4">
            <Button size="lg" onClick={() => navigate('/auth/register')}>
              Start Free
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate('/auth/login')}>
              Sign In
            </Button>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mt-16">
            <div className="bg-card rounded-lg p-6 shadow-lg">
              <Upload className="h-10 w-10 text-primary mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Easy Upload</h3>
              <p className="text-muted-foreground">
                Drag and drop files or browse to upload. Support for large files with chunked uploads.
              </p>
            </div>

            <div className="bg-card rounded-lg p-6 shadow-lg">
              <Share2 className="h-10 w-10 text-primary mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Simple Sharing</h3>
              <p className="text-muted-foreground">
                Generate secure share links for your files. Control access with expiration dates.
              </p>
            </div>

            <div className="bg-card rounded-lg p-6 shadow-lg">
              <Lock className="h-10 w-10 text-primary mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Secure Storage</h3>
              <p className="text-muted-foreground">
                Your files are encrypted and stored securely. Access them from anywhere, anytime.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;

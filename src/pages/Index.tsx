import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Cloud, Upload, Share2, Lock, Shield, Zap, Globe, ArrowRight, Check } from 'lucide-react';

const Index = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 glass">
        <div className="container mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl gradient-bg flex items-center justify-center">
              <Cloud className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold tracking-tight">CloudStore</span>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Button variant="ghost" size="sm" onClick={() => navigate('/auth/login')}>
              Sign In
            </Button>
            <Button size="sm" onClick={() => navigate('/auth/register')} className="gradient-bg border-0 text-primary-foreground hover:opacity-90">
              Get Started
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-32 pb-20 px-4 sm:px-6 relative overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'var(--gradient-hero)' }} />
        <div className="absolute top-20 left-1/4 w-72 h-72 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute bottom-10 right-1/4 w-96 h-96 rounded-full bg-accent-foreground/5 blur-3xl" />

        <div className="relative max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-8 animate-fade-up opacity-0">
            <Zap className="h-3.5 w-3.5" />
            100TB free storage for everyone
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-7xl font-extrabold tracking-tight leading-[1.08] mb-6 animate-fade-up opacity-0 stagger-1">
            Your files.<br />
            <span className="gradient-text">Anywhere. Secure.</span>
          </h1>

          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed animate-fade-up opacity-0 stagger-2">
            Enterprise-grade cloud storage with end-to-end encryption, instant sharing, 
            and blazing-fast uploads. Built for people who care about their data.
          </p>

          <div className="flex flex-col sm:flex-row justify-center gap-4 animate-fade-up opacity-0 stagger-3">
            <Button
              size="lg"
              onClick={() => navigate('/auth/register')}
              className="gradient-bg border-0 text-primary-foreground hover:opacity-90 h-12 px-8 text-base font-semibold shadow-lg"
            >
              Start Free — No Card Required
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => navigate('/auth/login')}
              className="h-12 px-8 text-base font-semibold"
            >
              Sign In
            </Button>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-12 border-y border-border/50 bg-card/50">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { value: '100 TB', label: 'Free Storage' },
              { value: '10 GB+', label: 'Max File Size' },
              { value: '256-bit', label: 'AES Encryption' },
              { value: '99.9%', label: 'Uptime SLA' },
            ].map((stat) => (
              <div key={stat.label}>
                <p className="text-2xl sm:text-3xl font-bold gradient-text">{stat.value}</p>
                <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 sm:py-28 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
              Everything you need, <span className="gradient-text">nothing you don't</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              A complete cloud storage solution designed for speed, security, and simplicity.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: Upload,
                title: 'Resumable Uploads',
                description: 'Upload files up to 10GB+ with pause, resume, and automatic retry. Never lose progress.',
                gradient: 'from-primary/10 to-primary/5',
              },
              {
                icon: Share2,
                title: 'Secure Sharing',
                description: 'Generate password-protected links with custom expiration. Full control over who sees what.',
                gradient: 'from-accent-foreground/10 to-accent-foreground/5',
              },
              {
                icon: Shield,
                title: 'End-to-End Encryption',
                description: 'Military-grade AES-256 encryption. Your files are unreadable without your key.',
                gradient: 'from-chart-4/10 to-chart-4/5',
              },
              {
                icon: Zap,
                title: 'Blazing Performance',
                description: 'CDN-accelerated downloads, chunked uploads, and real-time sync across all devices.',
                gradient: 'from-chart-5/10 to-chart-5/5',
              },
              {
                icon: Lock,
                title: 'Folder Protection',
                description: 'Lock folders with passwords and hide them from view. Session-based access for convenience.',
                gradient: 'from-destructive/10 to-destructive/5',
              },
              {
                icon: Globe,
                title: 'Access Anywhere',
                description: 'Responsive design that works perfectly on desktop, tablet, and mobile. Your files follow you.',
                gradient: 'from-chart-3/10 to-chart-3/5',
              },
            ].map(({ icon: Icon, title, description, gradient }) => (
              <div
                key={title}
                className="group relative bg-card rounded-2xl p-6 border border-border/50 hover:border-primary/30 transition-all duration-300 hover:shadow-lg"
              >
                <div className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${gradient} mb-4`}>
                  <Icon className="h-6 w-6 text-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'var(--gradient-hero)' }} />
        <div className="relative max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
            Ready to take control of your files?
          </h2>
          <p className="text-muted-foreground text-lg mb-8">
            Join thousands of users who trust CloudStore with their most important data.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-10">
            {['100 TB free storage', 'No credit card required', 'Cancel anytime'].map((item) => (
              <div key={item} className="flex items-center gap-2 text-sm">
                <Check className="h-4 w-4 text-primary" />
                <span>{item}</span>
              </div>
            ))}
          </div>
          <Button
            size="lg"
            onClick={() => navigate('/auth/register')}
            className="gradient-bg border-0 text-primary-foreground hover:opacity-90 h-12 px-10 text-base font-semibold shadow-lg"
          >
            Get Started Free
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 px-4 sm:px-6">
        <div className="container mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg gradient-bg flex items-center justify-center">
              <Cloud className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-sm font-semibold">CloudStore</span>
          </div>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} CloudStore. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;

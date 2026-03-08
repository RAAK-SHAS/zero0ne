import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Cloud, Upload, Share2, Lock, Shield, Zap, Globe, ArrowRight, Check, Terminal } from 'lucide-react';

const GeometricShape = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let time = 0;

    const resize = () => {
      canvas.width = canvas.offsetWidth * 2;
      canvas.height = canvas.offsetHeight * 2;
      ctx.scale(2, 2);
    };
    resize();
    window.addEventListener('resize', resize);

    const draw = () => {
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      ctx.clearRect(0, 0, w, h);
      time += 0.008;

      const cx = w / 2;
      const cy = h / 2;
      const size = Math.min(w, h) * 0.28;

      // Draw rotating geometric wireframe
      for (let ring = 0; ring < 3; ring++) {
        const ringSize = size * (0.6 + ring * 0.25);
        const sides = 6 + ring * 2;
        const rotOffset = time * (1 - ring * 0.3) + (ring * Math.PI / 4);
        const alpha = 0.15 + ring * 0.08;

        ctx.beginPath();
        ctx.strokeStyle = `hsla(168, 100%, 50%, ${alpha})`;
        ctx.lineWidth = 1;
        ctx.shadowColor = 'hsla(168, 100%, 50%, 0.3)';
        ctx.shadowBlur = 10;

        for (let i = 0; i <= sides; i++) {
          const angle = (i / sides) * Math.PI * 2 + rotOffset;
          const wobble = Math.sin(time * 2 + i) * ringSize * 0.05;
          const x = cx + Math.cos(angle) * (ringSize + wobble);
          const y = cy + Math.sin(angle) * (ringSize + wobble);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // Center dot
      ctx.beginPath();
      ctx.arc(cx, cy, 3, 0, Math.PI * 2);
      ctx.fillStyle = 'hsl(168, 100%, 50%)';
      ctx.shadowColor = 'hsl(168, 100%, 50%)';
      ctx.shadowBlur = 15;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Floating particles
      for (let i = 0; i < 8; i++) {
        const angle = time * 0.5 + (i * Math.PI * 2) / 8;
        const dist = size * 1.2 + Math.sin(time * 2 + i) * 15;
        const px = cx + Math.cos(angle) * dist;
        const py = cy + Math.sin(angle) * dist;
        ctx.beginPath();
        ctx.arc(px, py, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(168, 100%, 50%, ${0.3 + Math.sin(time + i) * 0.2})`;
        ctx.fill();
      }

      animationId = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ opacity: 0.8 }}
    />
  );
};

const Index = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate('/dashboard');
  }, [user, navigate]);

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Grid background */}
      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: `linear-gradient(hsl(168 100% 50% / 0.03) 1px, transparent 1px), linear-gradient(90deg, hsl(168 100% 50% / 0.03) 1px, transparent 1px)`,
        backgroundSize: '60px 60px',
      }} />

      {/* Nav */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border glass">
        <div className="container mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl gradient-bg flex items-center justify-center neon-glow">
              <Cloud className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold tracking-tight">CloudStore</span>
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-accent/50 border border-border">
              <Terminal className="h-3 w-3 text-primary" />
              <span className="terminal-text text-[11px]">&gt;_ SYS.READY</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate('/auth/login')} className="text-muted-foreground hover:text-foreground">
              Sign In
            </Button>
            <Button size="sm" onClick={() => navigate('/auth/register')} className="gradient-bg border-0 text-primary-foreground hover:opacity-90 neon-glow">
              Get Started
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-32 pb-20 px-4 sm:px-6 relative">
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'var(--gradient-hero)' }} />
        
        {/* 3D Geometric Shape */}
        <div className="absolute inset-0 pointer-events-none">
          <GeometricShape />
        </div>

        <div className="relative max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full neon-border text-primary text-sm font-medium mb-8 animate-fade-up opacity-0">
            <Zap className="h-3.5 w-3.5" />
            <span className="terminal-text text-xs">100TB FREE STORAGE</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-7xl font-black tracking-tight leading-[1.08] mb-6 animate-fade-up opacity-0 stagger-1">
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
              className="gradient-bg border-0 text-primary-foreground hover:opacity-90 h-12 px-8 text-base font-semibold neon-glow"
            >
              Start Free — No Card Required
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => navigate('/auth/login')}
              className="h-12 px-8 text-base font-semibold neon-border hover:bg-accent/50"
            >
              Sign In
            </Button>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-12 border-y border-border glass">
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
      <section className="py-20 sm:py-28 px-4 sm:px-6 relative">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
              Everything you need, <span className="gradient-text">nothing you don't</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              A complete cloud storage solution designed for speed, security, and simplicity.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: Upload, title: 'Resumable Uploads', description: 'Upload files up to 10GB+ with pause, resume, and automatic retry. Never lose progress.' },
              { icon: Share2, title: 'Secure Sharing', description: 'Generate password-protected links with custom expiration. Full control over who sees what.' },
              { icon: Shield, title: 'End-to-End Encryption', description: 'Military-grade AES-256 encryption. Your files are unreadable without your key.' },
              { icon: Zap, title: 'Blazing Performance', description: 'CDN-accelerated downloads, chunked uploads, and real-time sync across all devices.' },
              { icon: Lock, title: 'Folder Protection', description: 'Lock folders with passwords and hide them from view. Session-based access for convenience.' },
              { icon: Globe, title: 'Access Anywhere', description: 'Responsive design that works perfectly on desktop, tablet, and mobile. Your files follow you.' },
            ].map(({ icon: Icon, title, description }) => (
              <div
                key={title}
                className="group relative rounded-2xl p-6 neon-border bg-card/50 hover:bg-card transition-all duration-300 hover:neon-glow"
              >
                <div className="inline-flex p-3 rounded-xl bg-primary/10 mb-4 group-hover:bg-primary/15 transition-colors">
                  <Icon className="h-6 w-6 text-primary" />
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
            className="gradient-bg border-0 text-primary-foreground hover:opacity-90 h-12 px-10 text-base font-semibold neon-glow"
          >
            Get Started Free
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-4 sm:px-6">
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

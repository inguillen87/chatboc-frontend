import React, { useMemo, useState } from 'react';
import ChatWidget from './ChatWidget';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Smartphone, Monitor } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WidgetPreviewProps {
  tenantSlug: string;
  className?: string;
  defaultOpen?: boolean;
  primaryColor?: string;
  accentColor?: string;
  userMsgColor?: string;
  chatBackground?: string;
  borderRadius?: number;
  ctaMessage?: string;
  botName?: string;
  logoUrl?: string;
  welcomeMessage?: string;
  logoAnimation?: string;
  fontFamily?: string;
}

class PreviewErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("WidgetPreview error:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80">
          <div className="h-10 w-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      );
    }

    return this.props.children;
  }
}

const WidgetPreview: React.FC<WidgetPreviewProps> = ({
  tenantSlug,
  className,
  defaultOpen = true,
  primaryColor,
  accentColor,
  userMsgColor,
  chatBackground,
  borderRadius,
  ctaMessage,
  botName,
  logoUrl,
  welcomeMessage,
  logoAnimation,
  fontFamily,
}) => {
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');

  const previewSrc = useMemo(() => {
    if (typeof window === 'undefined') return '';
    const params = new URLSearchParams();
    params.set('tenant', tenantSlug);
    params.set('tenantSlug', tenantSlug);
    if (defaultOpen) {
      params.set('defaultOpen', 'true');
    }
    return `${window.location.origin}/iframe?${params.toString()}`;
  }, [defaultOpen, tenantSlug]);

  return (
    <div className={cn("flex flex-col items-center gap-4", className)}>
      {/* Device Toggle */}
      <div className="flex items-center gap-2 bg-muted p-1 rounded-lg">
        <Button
          variant={device === 'desktop' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => setDevice('desktop')}
        >
          <Monitor className="h-4 w-4 mr-2" /> Desktop
        </Button>
        <Button
          variant={device === 'mobile' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => setDevice('mobile')}
        >
          <Smartphone className="h-4 w-4 mr-2" /> Mobile
        </Button>
      </div>

      {/* Preview Container */}
      <div className={cn(
        "relative transition-all duration-300 ease-in-out border-2 border-muted shadow-2xl bg-white dark:bg-slate-950 overflow-hidden",
        device === 'mobile' ? "w-[375px] h-[667px] rounded-[3rem] border-8 border-slate-900" : "w-full h-[600px] rounded-xl"
      )}>
        {/* Mobile Notch (only visible in mobile mode) */}
        {device === 'mobile' && (
          <div className="absolute top-0 left-1/2 -translate-x-1/2 h-6 w-32 bg-slate-900 rounded-b-xl z-20" />
        )}

        {/* Background / Content Mock */}
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1557683316-973673baf926?auto=format&fit=crop&q=80')] bg-cover bg-center opacity-5" />

        {/* Actual Widget Component */}
        <div className="relative w-full h-full p-4">
          {/* pointer-events-none prevents interacting with the widget logic but lets us see it.
              If we want interaction, we remove it. */}
          <PreviewErrorBoundary>
            {previewSrc ? (
              <iframe
                title="Widget preview"
                className="absolute inset-0 h-full w-full border-0 bg-transparent"
                src={previewSrc}
                allow="clipboard-read; clipboard-write; autoplay; geolocation; microphone; camera"
              />
            ) : (
              <ChatWidget
                mode="preview"
                tenantSlug={tenantSlug}
                defaultOpen={defaultOpen}
                primaryColor={primaryColor}
                accentColor={accentColor}
                userMsgColor={userMsgColor}
                chatBackground={chatBackground}
                borderRadius={borderRadius}
                ctaMessage={ctaMessage}
                botName={botName}
                headerLogoUrl={logoUrl}
                welcomeTitle={botName}
                welcomeSubtitle={welcomeMessage}
                logoAnimation={logoAnimation}
                fontFamily={fontFamily}
              />
            )}
          </PreviewErrorBoundary>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Vista previa en tiempo real.
      </p>
    </div>
  );
};

export default WidgetPreview;

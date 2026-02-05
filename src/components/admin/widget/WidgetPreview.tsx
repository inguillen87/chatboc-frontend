import React, { useMemo, useState } from 'react';
import ChatWidget from '@/components/chat/ChatWidget';
import { Button } from '@/components/ui/button';
import { Smartphone, Monitor, Tablet } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WidgetPreviewProps {
  config: any;
  tenantSlug: string;
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

const WidgetPreview: React.FC<WidgetPreviewProps> = ({ config, tenantSlug }) => {
  const [device, setDevice] = useState<'desktop' | 'mobile' | 'tablet'>('desktop');

  const { brand, behavior, ui, copy, launcher } = config || {};

  return (
    <div className="flex flex-col items-center gap-4 h-full">
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
          variant={device === 'tablet' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => setDevice('tablet')}
        >
          <Tablet className="h-4 w-4 mr-2" /> Tablet
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
        "relative transition-all duration-300 ease-in-out border border-muted shadow-xl bg-background overflow-hidden",
        device === 'mobile' && "w-[375px] h-[667px] rounded-[3rem] border-[8px] border-slate-900",
        device === 'tablet' && "w-[768px] h-[1024px] rounded-[2rem] border-[8px] border-slate-900 scale-[0.6] origin-top",
        device === 'desktop' && "w-full h-full rounded-xl border-2"
      )}>
        {/* Mobile Notch (only visible in mobile mode) */}
        {device === 'mobile' && (
          <div className="absolute top-0 left-1/2 -translate-x-1/2 h-6 w-32 bg-slate-900 rounded-b-xl z-20 pointer-events-none" />
        )}

        {/* Background / Content Mock */}
        <div className="absolute inset-0 bg-slate-50 dark:bg-slate-950 overflow-y-auto">
           {/* Mock website content */}
           <div className="h-16 bg-white dark:bg-slate-900 border-b flex items-center px-6">
              <div className="w-24 h-6 bg-slate-200 dark:bg-slate-800 rounded"></div>
              <div className="ml-auto flex gap-4">
                 <div className="w-16 h-4 bg-slate-200 dark:bg-slate-800 rounded"></div>
                 <div className="w-16 h-4 bg-slate-200 dark:bg-slate-800 rounded"></div>
              </div>
           </div>
           <div className="p-8 space-y-4">
              <div className="w-2/3 h-12 bg-slate-200 dark:bg-slate-800 rounded"></div>
              <div className="w-full h-32 bg-slate-200 dark:bg-slate-800 rounded"></div>
              <div className="w-full h-32 bg-slate-200 dark:bg-slate-800 rounded"></div>
           </div>
        </div>

        {/* Actual Widget Component */}
        <div className="absolute inset-0 pointer-events-auto">
          <PreviewErrorBoundary>
             <ChatWidget
                mode="preview" // Important: tells ChatWidget it's in preview (maybe disable some tracking)
                tenantSlug={tenantSlug}

                // Branding
                primaryColor={brand?.primaryColor}
                accentColor={brand?.accentColor}
                headerLogoUrl={brand?.logoUrl}
                customLauncherLogoUrl={brand?.logoUrl}
                botName={brand?.name}

                // Content
                welcomeTitle={copy?.welcomeTitle}
                welcomeSubtitle={copy?.welcomeSubtitle}

                // UI
                borderRadius={ui?.borderRadius}
                logoAnimation={ui?.animations ? "bounce" : undefined}

                // Behavior
                defaultOpen={behavior?.startOpen}
                tipoChat={behavior?.mode === 'municipio' ? 'municipio' : 'pyme'}

                // Launcher overrides
                initialPosition={launcher?.position === 'left' ? { bottom: launcher?.offsetY || 20, right: undefined as any } : { bottom: launcher?.offsetY || 20, right: launcher?.offsetX || 20 }}

                // Config injection for preview (if ChatWidget supports it directly)
                // If ChatWidget fetches config itself, we might fight it.
                // Ideally ChatWidget accepts all these props to override internal fetch.
             />
          </PreviewErrorBoundary>
        </div>
      </div>
    </div>
  );
};

export default WidgetPreview;

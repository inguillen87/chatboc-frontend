import React, { useState } from 'react';
import ChatWidget from './ChatWidget';
import { Button } from '@/components/ui/button';
import { Smartphone, Monitor, Sun, Moon, ArrowUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

export interface WidgetPreviewProps {
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
  // New props
  autoOpenDelay?: number;
  position?: 'left' | 'right';
  sideOffset?: number;
  bottomOffset?: number;
  zIndex?: number;
  simulateState?: 'loading' | 'offline' | 'error' | null;
  faqSuggestions?: string[];
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

const FakeWebsite = ({ mode, scrollable }: { mode: 'light' | 'dark'; scrollable: boolean }) => {
  const bgClass = mode === 'light' ? 'bg-white' : 'bg-slate-950';
  const textClass = mode === 'light' ? 'text-slate-900' : 'text-slate-50';
  const mutedClass = mode === 'light' ? 'bg-slate-100' : 'bg-slate-900';
  const borderClass = mode === 'light' ? 'border-slate-200' : 'border-slate-800';

  return (
    <div className={cn("w-full flex flex-col transition-colors duration-300", bgClass, textClass, scrollable ? "min-h-[200%]" : "h-full")}>
      {/* Fake Header */}
      <header className={cn("h-14 border-b flex items-center px-6 sticky top-0 z-10 backdrop-blur-sm bg-opacity-90", borderClass, bgClass)}>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-primary/20" />
          <div className="w-24 h-3 rounded-md bg-slate-200/50 dark:bg-slate-800/50" />
        </div>
        <div className="ml-auto flex gap-3">
            <div className="w-16 h-2 rounded-md bg-slate-200/50 dark:bg-slate-800/50 hidden sm:block" />
            <div className="w-16 h-2 rounded-md bg-slate-200/50 dark:bg-slate-800/50 hidden sm:block" />
        </div>
      </header>

      {/* Fake Hero */}
      <div className={cn("p-8 md:p-12 flex flex-col items-center text-center gap-4", mutedClass)}>
         <div className="w-32 h-4 rounded-lg bg-slate-300/50 dark:bg-slate-700/50 mb-2" />
         <div className="w-3/4 h-8 rounded-xl bg-slate-300/50 dark:bg-slate-700/50" />
         <div className="w-1/2 h-8 rounded-xl bg-slate-300/50 dark:bg-slate-700/50" />
         <div className="w-24 h-8 rounded-lg bg-primary/20 mt-4" />
      </div>

      {/* Fake Content Grid */}
      <div className="p-6 md:p-8 grid grid-cols-1 md:grid-cols-3 gap-6">
         {[1, 2, 3, 4, 5, 6].map((i) => (
             <div key={i} className={cn("rounded-xl border p-4 space-y-3", borderClass)}>
                 <div className={cn("w-full h-32 rounded-lg mb-2", mutedClass)} />
                 <div className="w-3/4 h-3 rounded bg-slate-200/50 dark:bg-slate-800/50" />
                 <div className="w-1/2 h-3 rounded bg-slate-200/50 dark:bg-slate-800/50" />
             </div>
         ))}
      </div>

       {/* Extra Content for Scrolling */}
       {scrollable && (
           <div className="p-6 md:p-8 space-y-6">
               <div className={cn("h-64 rounded-xl border flex items-center justify-center", borderClass, mutedClass)}>
                   <span className="text-sm opacity-50">Más contenido...</span>
               </div>
                <div className={cn("h-64 rounded-xl border flex items-center justify-center", borderClass, mutedClass)}>
                   <span className="text-sm opacity-50">Footer</span>
               </div>
           </div>
       )}
    </div>
  );
};

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
  // New props
  autoOpenDelay,
  position = 'right',
  sideOffset = 20,
  bottomOffset = 20,
  zIndex,
  simulateState,
  faqSuggestions
}) => {
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [siteMode, setSiteMode] = useState<'light' | 'dark'>('light');
  const [scrollable, setScrollable] = useState(false);

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {/* Controls Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-muted/40 p-2 rounded-xl border">
        <div className="flex items-center gap-1 bg-background rounded-lg border p-1">
          <Button
            variant={device === 'desktop' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => setDevice('desktop')}
          >
            <Monitor className="h-3.5 w-3.5 mr-1.5" /> Desktop
          </Button>
          <Button
            variant={device === 'mobile' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => setDevice('mobile')}
          >
            <Smartphone className="h-3.5 w-3.5 mr-1.5" /> Mobile
          </Button>
        </div>

        <div className="flex items-center gap-4 px-2">
             <div className="flex items-center gap-2">
                <Button
                    variant="ghost"
                    size="icon"
                    className={cn("h-7 w-7", siteMode === 'light' && "bg-background shadow-sm")}
                    onClick={() => setSiteMode('light')}
                    title="Sitio Claro"
                >
                    <Sun className="h-3.5 w-3.5" />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    className={cn("h-7 w-7", siteMode === 'dark' && "bg-background shadow-sm")}
                    onClick={() => setSiteMode('dark')}
                    title="Sitio Oscuro"
                >
                    <Moon className="h-3.5 w-3.5" />
                </Button>
             </div>

             <div className="h-4 w-px bg-border" />

             <div className="flex items-center gap-2">
                <Switch
                    id="scroll-toggle"
                    checked={scrollable}
                    onCheckedChange={setScrollable}
                    className="scale-75"
                />
                <Label htmlFor="scroll-toggle" className="text-xs cursor-pointer flex items-center gap-1">
                    <ArrowUpDown className="h-3 w-3" /> Scroll
                </Label>
             </div>
        </div>
      </div>

      {/* Preview Container */}
      <div className={cn(
        "relative transition-all duration-500 border shadow-2xl overflow-hidden mx-auto",
        device === 'mobile'
            ? "w-[375px] h-[700px] rounded-[2.5rem] border-[8px] border-slate-900 bg-slate-950 ring-1 ring-white/10"
            : "w-full h-[600px] rounded-xl border-border bg-background"
      )}
      style={{ transitionTimingFunction: 'cubic-bezier(0.32,0.72,0,1)' }}>
        {/* Mobile Notch */}
        {device === 'mobile' && (
          <div className="absolute top-0 left-1/2 -translate-x-1/2 h-6 w-28 bg-slate-900 rounded-b-xl z-30 pointer-events-none" />
        )}

        {/* Scrollable Viewport */}
        <div className="absolute inset-0 overflow-y-auto scrollbar-hide">
            <FakeWebsite mode={siteMode} scrollable={scrollable} />
        </div>

        {/* Widget Layer */}
        {/* We use absolute positioning inside this container to simulate 'fixed' behavior relative to the fake viewport */}
        <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden">
             {/* The widget itself needs pointer-events-auto */}
             <div className="w-full h-full pointer-events-auto">
                 <PreviewErrorBoundary>
                    <ChatWidget
                        mode="preview" // We use 'preview' mode which typically means 'absolute/contained'
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
                        // We will pass these via style/props in Step 4, but for now we pass them
                        // Note: TypeScript might complain if ChatWidget doesn't have these props yet,
                        // but since I'm writing this file and ChatWidget is imported,
                        // I might need to cast or just ignore until Step 4.
                        // However, ChatWidgetProps is imported in ChatWidget.tsx from types.ts or inline.
                        // I will update types in Step 4. For now, React ignores extra props.
                        {...({
                            autoOpenDelay,
                            position,
                            sideOffset,
                            bottomOffset,
                            zIndex,
                            simulateState,
                            faqSuggestions
                        } as any)}
                    />
                 </PreviewErrorBoundary>
             </div>
        </div>
      </div>
    </div>
  );
};

export default WidgetPreview;

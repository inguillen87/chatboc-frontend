import React, { useState, useMemo } from 'react';
import ChatWidgetInner from './ChatWidgetInner'; // Use Inner directly for preview to bypass loader
import { Button } from '@/components/ui/button';
import { Smartphone, Monitor, Sun, Moon, ArrowUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

// --- TYPES ---
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
  headerLogoUrl?: string;
  welcomeTitle?: string;
  welcomeSubtitle?: string;
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
  welcomeMessage?: string; // Alias for subtitle
}

class PreviewErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("Error inside WidgetPreview:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full w-full items-center justify-center bg-red-50 p-4 text-center text-red-600">
          <p>Error al renderizar la vista previa del widget.</p>
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
    <div className={cn("w-full flex flex-col transition-colors duration-300 origin-top", bgClass, textClass, scrollable ? "min-h-[200%]" : "h-full")}>
      {/* Fake Header */}
      <header className={cn("h-14 border-b flex items-center px-6 sticky top-0 z-10 backdrop-blur-sm bg-opacity-90", borderClass, bgClass)}>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-blue-600/20" />
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
         <div className="w-24 h-8 rounded-lg bg-blue-600/20 mt-4" />
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
  defaultOpen,
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
  autoOpenDelay,
  position = 'right',
  sideOffset,
  bottomOffset,
  zIndex,
  simulateState,
  faqSuggestions
}) => {
  const [device, setDevice] = useState<'desktop' | 'mobile'>('mobile');
  const [siteMode, setSiteMode] = useState<'light' | 'dark'>('light');
  const [scrollable, setScrollable] = useState(false);

  // We construct the iframe src if needed, or render the component directly
  // Rendering component directly is faster for immediate feedback

  return (
    <div className={cn("flex flex-col gap-4 items-center w-full", className)}>
      {/* Controls Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-muted/40 p-2 rounded-xl border w-full max-w-[720px]">
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

        <div className="flex items-center gap-2 px-2">
             <div className="flex items-center gap-1 bg-background rounded-lg border p-1">
                <Button
                    variant={siteMode === 'light' ? 'secondary' : 'ghost'}
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setSiteMode('light')}
                    title="Sitio Claro"
                >
                    <Sun className="h-3.5 w-3.5" />
                </Button>
                <Button
                    variant={siteMode === 'dark' ? 'secondary' : 'ghost'}
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setSiteMode('dark')}
                    title="Sitio Oscuro"
                >
                    <Moon className="h-3.5 w-3.5" />
                </Button>
             </div>

             <div className="h-4 w-px bg-border mx-1" />

             <div className="flex items-center gap-2">
                <Label htmlFor="scroll-toggle" className="text-xs cursor-pointer flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors">
                    <ArrowUpDown className="h-3 w-3" /> Scroll
                </Label>
                <Switch
                    id="scroll-toggle"
                    checked={scrollable}
                    onCheckedChange={setScrollable}
                    className="scale-75 origin-left"
                />
             </div>
        </div>
      </div>

      {/* Preview Container */}
      <div className={cn(
        "relative transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] border shadow-2xl overflow-hidden mx-auto bg-background",
        device === 'mobile'
            ? "w-[375px] h-[700px] rounded-[3rem] border-[8px] border-slate-900 ring-1 ring-black/5"
            : "w-full max-w-[900px] h-[600px] rounded-xl border-border"
      )}>
        {/* Mobile Notch (only visible in mobile mode) */}
        {device === 'mobile' && (
          <>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 h-6 w-32 bg-slate-900 rounded-b-xl z-30 pointer-events-none" />
            <div className="absolute top-0 right-5 h-6 flex items-center gap-1 z-30 pointer-events-none">
                <div className="w-4 h-2.5 border border-slate-600 rounded-[1px] relative"><div className="absolute inset-0.5 bg-white rounded-[0.5px]"></div></div>
            </div>
          </>
        )}

        {/* Scrollable Viewport */}
        <div className="absolute inset-0 overflow-y-auto scrollbar-hide bg-zinc-50 dark:bg-zinc-950">
            <FakeWebsite mode={siteMode} scrollable={scrollable} />
        </div>

        {/* Widget Layer */}
        {/* We use absolute positioning inside this container to simulate 'fixed' behavior relative to the fake viewport */}
        <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden">
             {/* The widget itself needs pointer-events-auto */}
             <div className="w-full h-full pointer-events-auto relative">
                 <PreviewErrorBoundary>
                    <ChatWidgetInner
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
                        headerLogoUrl={logoUrl} // Mapping prop
                        welcomeTitle={botName}
                        welcomeSubtitle={welcomeMessage}
                        logoAnimation={logoAnimation}
                        fontFamily={fontFamily}
                        autoOpenDelay={autoOpenDelay}
                        position={position}
                        sideOffset={sideOffset}
                        bottomOffset={bottomOffset}
                        zIndex={zIndex}
                        simulateState={simulateState}
                        faqSuggestions={faqSuggestions}
                    />
                 </PreviewErrorBoundary>
             </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Interactúa con la vista previa para probar el comportamiento real.
      </p>
    </div>
  );
};

export default WidgetPreview;

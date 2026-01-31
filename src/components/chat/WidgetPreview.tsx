import React from 'react';
import ChatWidget from './ChatWidget';
import { Card } from '@/components/ui/card';
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
  return (
    <Card className={cn("relative overflow-hidden border-2 border-muted shadow-xl bg-slate-50 dark:bg-slate-900", className)}>
      <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1557683316-973673baf926?auto=format&fit=crop&q=80')] bg-cover bg-center opacity-5" />

      <div className="relative w-full h-full">
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
      </div>
    </Card>
  );
};

export default WidgetPreview;

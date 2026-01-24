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
  ctaMessage?: string;
}

const WidgetPreview: React.FC<WidgetPreviewProps> = ({
  tenantSlug,
  className,
  defaultOpen = true,
  primaryColor,
  accentColor,
  ctaMessage
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
            ctaMessage={ctaMessage}
         />
      </div>
    </Card>
  );
};

export default WidgetPreview;

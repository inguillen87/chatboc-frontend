import React, { useEffect, useMemo, useState } from 'react';
import { Paperclip, Smile } from 'lucide-react';
import { tenantService } from '@/services/tenantService';
import { useTenant } from '@/context/TenantContext';
import { useUser } from '@/hooks/useUser';
import { safeLocalStorage } from '@/utils/safeLocalStorage';

type WidgetPreviewConfig = {
  title?: string;
  subtitle?: string;
  logoUrl?: string;
  primaryColor?: string;
  bubbleColor?: string;
  ctaMessages?: { text?: string }[];
};

const DEFAULT_LOGO = '/chatboc_widget_64x64.webp';

const MiniChatWidgetPreview: React.FC = () => {
  const { currentSlug } = useTenant();
  const { user } = useUser();
  const [config, setConfig] = useState<WidgetPreviewConfig | null>(null);

  const effectiveSlug = useMemo(() => {
    const storedSlug = safeLocalStorage.getItem('tenantSlug');
    const userSlug = user?.tenantSlug;
    if (currentSlug?.startsWith('admin-') && userSlug) {
      return userSlug;
    }
    return userSlug || currentSlug || storedSlug;
  }, [currentSlug, user?.tenantSlug]);

  useEffect(() => {
    let isMounted = true;

    const loadConfig = async () => {
      if (!effectiveSlug) return;
      try {
        const publicConfig = await tenantService.getPublicWidgetConfig(effectiveSlug);
        if (!isMounted) return;
        const themeConfig = (publicConfig as any)?.theme_config ?? {};
        const previewConfig: WidgetPreviewConfig = {
          title:
            (publicConfig as any)?.welcome_title ||
            (publicConfig as any)?.tenant_name ||
            (publicConfig as any)?.name ||
            (publicConfig as any)?.nombre,
          subtitle: (publicConfig as any)?.welcome_subtitle,
          logoUrl:
            (publicConfig as any)?.logo_url ||
            (publicConfig as any)?.avatar_url,
          primaryColor:
            themeConfig?.primary ||
            themeConfig?.light?.primary ||
            (publicConfig as any)?.primary_color,
          bubbleColor:
            themeConfig?.secondary ||
            themeConfig?.light?.secondary ||
            (publicConfig as any)?.secondary_color,
          ctaMessages: (publicConfig as any)?.cta_messages,
        };
        setConfig(previewConfig);
      } catch (error) {
        if (isMounted) {
          setConfig(null);
        }
      }
    };

    loadConfig();
    return () => {
      isMounted = false;
    };
  }, [effectiveSlug]);

  const logoUrl = config?.logoUrl || DEFAULT_LOGO;
  const headerTitle = config?.title || 'Asistente Virtual';
  const headerSubtitle = config?.subtitle || 'En línea';
  const primaryColor = config?.primaryColor || 'hsl(var(--primary))';
  const bubbleColor = config?.bubbleColor || 'hsl(var(--primary))';
  const ctaMessages = config?.ctaMessages?.filter((msg) => msg?.text) ?? [];
  const previewMessages =
    ctaMessages.length > 0
      ? ctaMessages.slice(0, 2).map((msg) => msg.text as string)
      : [
          '¡Hola! 👋 ¿En qué puedo ayudarte hoy?',
          'También te permite integrar el widget directamente en tu sitio web.',
        ];

  return (
    <div className="bg-card p-3 rounded-lg shadow-md border border-border w-full h-full flex flex-col max-w-[280px] mx-auto min-h-[380px]">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-border">
        <div className="flex items-center">
          <img
            src={logoUrl}
            alt="Widget Icon"
            className="w-7 h-7 mr-2 rounded-full border border-border"
          />
          <div>
            <p className="text-sm font-semibold text-primary">{headerTitle}</p>
            <p className="text-xs text-green-500">{headerSubtitle}</p>
          </div>
        </div>
      </div>

      {/* Chat Messages Area */}
      <div className="flex-grow space-y-2.5 overflow-y-auto p-1 text-sm pr-2">
        {/* Bot Message */}
        <div className="flex items-start space-x-2">
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-primary-foreground text-xs flex-shrink-0 mt-1"
            style={{ backgroundColor: primaryColor }}
          >
            <img src={logoUrl} alt="B" className="w-4 h-4 rounded-full" />
          </div>
          <div className="bg-muted p-2 rounded-lg rounded-bl-none max-w-[80%] shadow-sm">
            <p className="text-foreground">{previewMessages[0]}</p>
          </div>
        </div>

        {/* User Message */}
        <div className="flex items-start justify-end space-x-2">
          <div
            className="text-primary-foreground p-2 rounded-lg rounded-br-none max-w-[80%] shadow-sm"
            style={{ backgroundColor: bubbleColor }}
          >
            <p>Quisiera información sobre el Plan PRO.</p>
          </div>
        </div>

        {/* Bot Message */}
        <div className="flex items-start space-x-2">
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-primary-foreground text-xs flex-shrink-0 mt-1"
            style={{ backgroundColor: primaryColor }}
          >
            <img src={logoUrl} alt="B" className="w-4 h-4 rounded-full" />
          </div>
          <div className="bg-muted p-2 rounded-lg rounded-bl-none max-w-[80%] shadow-sm">
            <p className="text-foreground">
              {previewMessages[1] || '¡Excelente elección! El Plan PRO incluye...'}
            </p>
          </div>
        </div>

        {/* Example of a slightly longer message */}
        <div className="flex items-start space-x-2">
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-primary-foreground text-xs flex-shrink-0 mt-1"
            style={{ backgroundColor: primaryColor }}
          >
            <img src={logoUrl} alt="B" className="w-4 h-4 rounded-full" />
          </div>
          <div className="bg-muted p-2 rounded-lg rounded-bl-none max-w-[80%] shadow-sm">
            <p className="text-foreground">
              {previewMessages[2] || 'También te permite integrar el widget directamente en tu sitio web.'}
            </p>
          </div>
        </div>
      </div>

      {/* Input Area */}
      <div className="pt-2 mt-auto">
        <div className="flex items-center bg-background rounded-md p-1.5 border border-input shadow-sm">
          <button
            aria-label="Adjuntar archivo"
            className="p-1 text-muted-foreground hover:text-primary focus:outline-none focus:ring-1 focus:ring-primary rounded"
          >
            <Paperclip size={18} />
          </button>
          <input
            type="text"
            placeholder="Escribe tu mensaje..."
            className="flex-grow bg-transparent text-sm focus:outline-none px-1 text-foreground placeholder-muted-foreground"
            disabled
          />
          <button
            aria-label="Insertar emoji"
            className="p-1 text-muted-foreground hover:text-primary focus:outline-none focus:ring-1 focus:ring-primary rounded"
          >
            <Smile size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default MiniChatWidgetPreview;

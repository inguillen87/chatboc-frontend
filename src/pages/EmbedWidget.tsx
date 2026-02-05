import React, { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

const EmbedWidget: React.FC = () => {
  const [searchParams] = useSearchParams();
  const tenantSlug = searchParams.get('tenant') || searchParams.get('tenantSlug') || 'demo';
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Cleanup any existing widget
    if ((window as any).chatbocDestroyWidget) {
        (window as any).chatbocDestroyWidget();
    }

    const script = document.createElement('script');
    // Use env var or fallback to root relative path which should be correct for most setups
    const widgetUrl = import.meta.env.VITE_APP_WIDGET_URL
        ? `${import.meta.env.VITE_APP_WIDGET_URL}/widget.js`
        : '/widget.js';

    script.src = widgetUrl;
    script.async = true;
    script.dataset.tenant = tenantSlug;

    // Copy all other params as data attributes
    searchParams.forEach((value, key) => {
        if (!['tenant', 'tenantSlug'].includes(key)) {
            script.dataset[key] = value;
        }
    });

    document.body.appendChild(script);

    return () => {
      // Cleanup on unmount
      if ((window as any).chatbocDestroyWidget) {
          (window as any).chatbocDestroyWidget();
      }
      if (document.body.contains(script)) {
          document.body.removeChild(script);
      }
    };
  }, [tenantSlug, searchParams]);

  return (
    <div ref={containerRef} className="w-full h-full flex items-center justify-center bg-slate-50">
      <div className="text-center p-8 max-w-md">
        <h1 className="text-2xl font-bold text-slate-800 mb-2">Widget Embed Preview</h1>
        <p className="text-slate-600 mb-6">
          Esta página simula un sitio web externo embebiendo el widget para el tenant <strong>{tenantSlug}</strong>.
        </p>
        <div className="p-4 bg-white rounded-lg shadow border text-left text-sm text-slate-500 font-mono overflow-auto max-h-48">
            {Array.from(searchParams.entries()).map(([key, val]) => (
                <div key={key}>
                    <span className="text-slate-400">data-{key}=</span>
                    <span className="text-blue-600">"{val}"</span>
                </div>
            ))}
        </div>
      </div>
    </div>
  );
};

export default EmbedWidget;

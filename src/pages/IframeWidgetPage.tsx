import { useEffect, useMemo, useState } from "react";
import ChatWidget from "@/components/chat/ChatWidget";

type WidgetConfigResponse = { tenant_slug: string; config: any };

function qs(name: string) {
  if (typeof window === "undefined") return "";
  const url = new URL(window.location.href);
  return url.searchParams.get(name) || "";
}

export default function IframeWidgetPage() {
  const tenant = qs("tenant");
  const entityToken = qs("entityToken");
  const origin = qs("origin"); // dominio host que embebe

  const [cfg, setCfg] = useState<any>(null);
  const [error, setError] = useState<string>("");

  // Default API base if not in config
  const apiBase = useMemo(() => (cfg?.runtime?.apiBase || "https://api.chatboc.ar"), [cfg]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const url = `${apiBase}/api/public/tenants/${encodeURIComponent(tenant)}/widget-config`;
        const res = await fetch(url, {
          headers: {
            "Content-Type": "application/json",
            "X-Entity-Token": entityToken || "",
            // "Origin": origin // Browsers override Origin. We can send X-Origin-Override if needed, or rely on Referer/Origin
          } as any
        });

        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j?.error?.message || `HTTP ${res.status}`);
        }
        const data = (await res.json()) as WidgetConfigResponse;
        if (!cancelled) setCfg(data.config);
      } catch (e: any) {
        if (!cancelled) {
          console.warn("Failed to load widget config", e);
          // Fallback minimal config to allow render even if config fetch fails
          setCfg({});
        }
      }
    }

    if (!tenant) setError("Falta tenant");
    else load();

    return () => { cancelled = true; };
  }, [tenant, entityToken, origin, apiBase]);

  if (error) return <div style={{ padding: 16, fontFamily: "system-ui" }}>❌ {error}</div>;
  if (!cfg) return <div className="flex items-center justify-center h-screen"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div style={{ height: "100vh", width: "100%", fontFamily: "system-ui" }}>
      <WidgetRuntime tenant={tenant} entityToken={entityToken} config={cfg} />
    </div>
  );
}

/** Widget real embebido */
function WidgetRuntime({ tenant, entityToken, config }: { tenant: string; entityToken: string; config: any }) {
  const { brand, behavior, ui, copy, launcher } = config || {};

  return (
    <ChatWidget
      mode="iframe"
      tenantSlug={tenant}
      ownerToken={entityToken}

      // Branding
      primaryColor={brand?.primaryColor}
      accentColor={brand?.accentColor}
      headerLogoUrl={brand?.logoUrl}
      customLauncherLogoUrl={brand?.logoUrl}

      // Content
      welcomeTitle={copy?.welcomeTitle}
      welcomeSubtitle={copy?.welcomeSubtitle}
      botName={brand?.name}

      // UI
      borderRadius={ui?.borderRadius}
      logoAnimation={ui?.animations ? "bounce" : undefined} // Map boolean to string if needed

      // Behavior
      defaultOpen={behavior?.startOpen}
      tipoChat={behavior?.mode === 'municipio' ? 'municipio' : 'pyme'} // Fallback logic

      // Launcher overrides
      initialPosition={launcher?.position === 'left' ? { bottom: launcher?.offsetY || 20, right: undefined as any } : { bottom: launcher?.offsetY || 20, right: launcher?.offsetX || 20 }}
    />
  );
}

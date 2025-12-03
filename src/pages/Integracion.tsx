// src/pages/Integracion.tsx

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { apiFetch } from "@/utils/api";
import {
  getStoredEntityToken,
  persistEntityToken,
  resolveOwnerToken,
} from "@/utils/entityToken";
import { useUser } from "@/hooks/useUser";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Copy,
  Check,
  Code,
  HelpCircle,
  AlertTriangle,
  Settings,
  Info,
  Eye,
  RefreshCw,
  ShieldCheck,
  Wand2,
  Layout,
} from "lucide-react";

const slugify = (value?: string | null) => {
  if (!value) return null;
  const normalized = value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || null;
};

interface User {
  id?: number;
  name?: string;
  email?: string;
  token?: string;
  entityToken?: string;
  plan?: string;
  tipo_chat?: "pyme" | "municipio";
  widget_icon_url?: string;
  widget_animation?: string;
  nombre_empresa?: string;
  slug?: string;
  tenantSlug?: string;
  endpoint?: string;
  tenant?: string;
  tenant_slug?: string;
  municipio?: string;
  empresa?: string;
}

const Integracion = () => {
  const navigate = useNavigate();
  const { user, refreshUser, loading: userLoading } = useUser();
  const [copiado, setCopiado] = useState<"iframe" | "script" | null>(null);
  const [isGeneratingToken, setIsGeneratingToken] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [primaryColor, setPrimaryColor] = useState("#007aff");
  const [accentColor, setAccentColor] = useState("#007aff");
  const [logoUrl, setLogoUrl] = useState("");
  const [logoAnimation, setLogoAnimation] = useState("");
  const [headerLogoUrl, setHeaderLogoUrl] = useState("");
  const [welcomeTitle, setWelcomeTitle] = useState("");
  const [welcomeSubtitle, setWelcomeSubtitle] = useState("");
  const [defaultOpen, setDefaultOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark" | "auto">("auto");
  const [allowAttachments, setAllowAttachments] = useState(true);
  const [allowLocation, setAllowLocation] = useState(true);
  const [allowAudio, setAllowAudio] = useState(true);
  const [zIndex, setZIndex] = useState("100000");
  const [widgetDomain, setWidgetDomain] = useState<string>(() =>
    typeof window !== "undefined" ? window.location.origin : ""
  );
  const [widgetId, setWidgetId] = useState(() =>
    typeof window !== "undefined" ? `chatboc-${window.crypto?.randomUUID?.() || Date.now()}` : "chatboc-widget"
  );
  const [openWidth, setOpenWidth] = useState("460px");
  const [openHeight, setOpenHeight] = useState("680px");
  const [closedWidth, setClosedWidth] = useState("112px");
  const [closedHeight, setClosedHeight] = useState("112px");
  const [offsetBottom, setOffsetBottom] = useState("20px");
  const [offsetRight, setOffsetRight] = useState("20px");
  const [enableCatalog, setEnableCatalog] = useState(false);
  const [requireLoginForCatalog, setRequireLoginForCatalog] = useState(false);
  const [enableFloatingPreview, setEnableFloatingPreview] = useState(false);
  const [ownerToken, setOwnerToken] = useState<string | null>(() => getStoredEntityToken());
  const tokenAlertShown = useRef(false);
  const catalogTouched = useRef(false);
  const settingsLoaded = useRef(false);

  // Garantiza que el widget global no aparezca en esta página, incluso si quedó montado de otra ruta.
  useEffect(() => {
    const destroyWidget = (window as any).chatbocDestroyWidget;
    destroyWidget?.();

    const hideGlobalStyles = document.createElement('style');
    hideGlobalStyles.dataset.chatbocHideGlobal = 'true';
    hideGlobalStyles.textContent = `
      #chatboc-launcher,
      .chatboc-launcher,
      .chatboc-widget-container,
      .chatboc-widget-root {
        display: none !important;
        visibility: hidden !important;
        pointer-events: none !important;
      }
    `;

    document.head.appendChild(hideGlobalStyles);

    return () => {
      destroyWidget?.();
      hideGlobalStyles.remove();
    };
  }, []);

  const validarAcceso = useCallback((currentUser: User | null) => {
    if (!currentUser) {
      navigate("/login");
      return false;
    }
    const plan = (currentUser.plan || "").toLowerCase();
    if (plan !== "pro" && plan !== "full") {
      toast.error("Acceso restringido. Esta función requiere un plan PRO o FULL.", {
        icon: <AlertTriangle className="text-destructive" />,
      });
      navigate("/perfil");
      return false;
    }
    return true;
  }, [navigate]);

  useEffect(() => {
    if (!user && !userLoading) {
      refreshUser().catch((err) => console.warn("No se pudo refrescar el usuario", err));
    }
  }, [refreshUser, user, userLoading]);

  useEffect(() => {
    if (!userLoading && !user) {
      navigate("/login");
    }
  }, [navigate, user, userLoading]);

  useEffect(() => {
    if (userLoading) return;
    if (!user) return;

    if (!validarAcceso(user)) {
      return;
    }

    setLogoUrl(user.widget_icon_url || "");
    setLogoAnimation(user.widget_animation || "");
  }, [user, userLoading, validarAcceso]);

  const applyWidgetSettings = useCallback(
    (data: Record<string, any> | null | undefined) => {
      if (!data || typeof data !== "object") return;

      const pick = <T,>(value: unknown, fallback: T): T => {
        if (value === undefined || value === null) return fallback;
        return value as T;
      };

      setPrimaryColor(pick<string>(data.primary_color ?? data.primaryColor, "#007aff"));
      setAccentColor(pick<string>(data.accent_color ?? data.accentColor, "#007aff"));
      setLogoUrl(pick<string>(data.logo_url ?? data.logoUrl, ""));
      setHeaderLogoUrl(pick<string>(data.header_logo_url ?? data.headerLogoUrl ?? data.logo_url, ""));
      setLogoAnimation(pick<string>(data.logo_animation ?? data.logoAnimation, ""));
      setWelcomeTitle(pick<string>(data.welcome_title ?? data.welcomeTitle, ""));
      setWelcomeSubtitle(pick<string>(data.welcome_subtitle ?? data.welcomeSubtitle, ""));
      setDefaultOpen(Boolean(data.default_open ?? data.defaultOpen));
      setTheme(pick<"light" | "dark" | "auto">(data.theme ?? "auto", "auto"));
      setAllowAttachments(Boolean(data.allow_attachments ?? data.allowAttachments ?? true));
      setAllowLocation(Boolean(data.allow_location ?? data.allowLocation ?? true));
      setAllowAudio(Boolean(data.allow_audio ?? data.allowAudio ?? true));
      setZIndex(pick<string>(data.z_index ?? data.zIndex ?? "100000", "100000"));
      setWidgetDomain(
        pick<string>(
          data.domain ?? data.widget_domain ?? data.widgetDomain ?? widgetDomain,
          typeof window !== "undefined" ? window.location.origin : "",
        ),
      );
      setWidgetId(pick<string>(data.widget_id ?? data.widgetId ?? widgetId, widgetId));
      setOpenWidth(pick<string>(data.open_width ?? data.openWidth ?? "460px", "460px"));
      setOpenHeight(pick<string>(data.open_height ?? data.openHeight ?? "680px", "680px"));
      setClosedWidth(pick<string>(data.closed_width ?? data.closedWidth ?? "112px", "112px"));
      setClosedHeight(pick<string>(data.closed_height ?? data.closedHeight ?? "112px", "112px"));
      setOffsetBottom(pick<string>(data.offset_bottom ?? data.offsetBottom ?? "20px", "20px"));
      setOffsetRight(pick<string>(data.offset_right ?? data.offsetRight ?? "20px", "20px"));
      setEnableCatalog(Boolean(data.show_catalog ?? data.showCatalog ?? data.enable_catalog));
      setRequireLoginForCatalog(Boolean(data.require_login_for_catalog ?? data.requireLoginForCatalog));
      setEnableFloatingPreview(Boolean(data.floating_preview ?? data.enableFloatingPreview));

      settingsLoaded.current = true;
    },
    [widgetDomain, widgetId],
  );


  const endpoint = useMemo(() => {
    if (!user?.tipo_chat) return "pyme"; // Default or handle error
    return user.tipo_chat === "municipio" ? "municipio" : "pyme";
  }, [user?.tipo_chat]);
  const isMunicipal = endpoint === "municipio";

  useEffect(() => {
    if (!user?.tipo_chat || catalogTouched.current) return;
    if (user.tipo_chat === "municipio") {
      setEnableCatalog(false);
      setRequireLoginForCatalog(false);
      return;
    }
    setEnableCatalog(true);
  }, [user?.tipo_chat]);

  useEffect(() => {
    if (!user) return;

    const token = resolveOwnerToken(user);

    if (token) {
      setOwnerToken(token);
      return;
    }

    setOwnerToken(null);
    if (!tokenAlertShown.current) {
      tokenAlertShown.current = true;
      toast.error("No encontramos tu token de integración. Reingresá o generá uno nuevo.", {
        icon: <AlertTriangle className="text-destructive" />,
      });
    }
  }, [user]);

  useEffect(() => {
    if (userLoading || !user || settingsLoaded.current) return;

    setLoadingSettings(true);
    apiFetch<Record<string, any>>("/integracion/widget-settings")
      .then(applyWidgetSettings)
      .catch((err) => {
        console.warn("No se pudieron cargar los ajustes del widget", err);
        toast.error("No pudimos cargar tus ajustes del widget", {
          icon: <AlertTriangle className="text-destructive" />,
        });
      })
      .finally(() => setLoadingSettings(false));
  }, [applyWidgetSettings, user, userLoading]);

  const handleGenerateIntegrationToken = useCallback(async () => {
    setIsGeneratingToken(true);
    try {
      const response = await apiFetch<{ entityToken: string }>("/integracion/regenerar-token", {
        method: "POST",
      });
      const normalized = persistEntityToken(response?.entityToken);
      setOwnerToken(normalized);
      toast.success("Token de integración actualizado", {
        icon: <Check className="text-green-500" />,
        description: "Guardamos un token estable para tu widget.",
      });
    } catch (err) {
      console.error("No se pudo generar el token de integración", err);
      toast.error("No pudimos generar el token", {
        icon: <AlertTriangle className="text-destructive" />,
      });
    } finally {
      setIsGeneratingToken(false);
    }
  }, []);

  const effectiveOwnerToken = ownerToken || "";
  const tenantSlug = useMemo(() => {
    const base =
      slugify((user as any)?.slug) ||
      slugify((user as any)?.tenantSlug) ||
      slugify((user as any)?.endpoint) ||
      slugify((user as any)?.tenant) ||
      slugify((user as any)?.tenant_slug) ||
      slugify((user as any)?.municipio) ||
      slugify((user as any)?.empresa) ||
      slugify((user as any)?.nombre_empresa) ||
      slugify(user?.name || null) ||
      slugify(user?.email?.split("@")[0] || null);

    if (base) return base;
    return user?.id ? `entidad-${user.id}` : null;
  }, [user]);
  const apiBase = (import.meta.env.VITE_WIDGET_API_BASE || "https://chatboc.ar").replace(/\/+$/, "");
  const defaultWidgetScriptUrl = `${apiBase}/widget.js`;
  const widgetScriptUrl = import.meta.env.VITE_WIDGET_SCRIPT_URL || defaultWidgetScriptUrl;
  const iframeBase = window.location.origin;
  
  const widgetAttributes = useMemo(() => {
    const attrs: Record<string, string> = {
      "data-api-base": apiBase,
      "data-owner-token": effectiveOwnerToken,
      "data-default-open": defaultOpen ? "true" : "false",
      "data-width": openWidth,
      "data-height": openHeight,
      "data-closed-width": closedWidth,
      "data-closed-height": closedHeight,
      "data-bottom": offsetBottom,
      "data-right": offsetRight,
      "data-endpoint": endpoint,
      "data-z-index": zIndex,
      "data-allow-attachments": allowAttachments ? "true" : "false",
      "data-allow-location": allowLocation ? "true" : "false",
      "data-allow-audio": allowAudio ? "true" : "false",
    };

    if (tenantSlug) {
      attrs["data-tenant"] = tenantSlug;
      attrs["data-tenant-slug"] = tenantSlug;
    }
    if (primaryColor) attrs["data-primary-color"] = primaryColor;
    if (accentColor) attrs["data-accent-color"] = accentColor;
    if (logoUrl) attrs["data-logo-url"] = logoUrl;
    if (headerLogoUrl) attrs["data-header-logo-url"] = headerLogoUrl;
    if (logoAnimation) attrs["data-logo-animation"] = logoAnimation;
    if (welcomeTitle) attrs["data-welcome-title"] = welcomeTitle;
    if (welcomeSubtitle) attrs["data-welcome-subtitle"] = welcomeSubtitle;
    if (widgetDomain) attrs["data-domain"] = widgetDomain;
    if (widgetId) attrs["data-widget-id"] = widgetId;
    if (theme !== "auto") attrs["data-theme"] = theme;

    attrs["data-show-catalog"] = enableCatalog ? "true" : "false";
    attrs["data-require-login-for-catalog"] = requireLoginForCatalog ? "true" : "false";

    return attrs;
  }, [
    accentColor,
    allowAttachments,
    allowAudio,
    allowLocation,
    apiBase,
    closedHeight,
    closedWidth,
    defaultOpen,
    effectiveOwnerToken,
    enableCatalog,
    endpoint,
    headerLogoUrl,
    logoAnimation,
    logoUrl,
    offsetBottom,
    offsetRight,
    openHeight,
    openWidth,
    primaryColor,
    requireLoginForCatalog,
    tenantSlug,
    theme,
    welcomeSubtitle,
    welcomeTitle,
    widgetDomain,
    zIndex,
  ]);

  const widgetAttributeLines = useMemo(
    () =>
      Object.entries(widgetAttributes)
        .filter(([, value]) => value !== undefined && value !== null && value !== "")
        .map(([key, value]) => `  ${key}="${value}"`)
        .join("\n"),
    [widgetAttributes]
  );

  const codeScript = useMemo(
    () =>
      `<script async src="${widgetScriptUrl}"\n${widgetAttributeLines}\n></script>`,
    [widgetAttributeLines, widgetScriptUrl]
  );

  const settingsPayload = useMemo(
    () => ({
      primary_color: primaryColor,
      accent_color: accentColor,
      logo_url: logoUrl,
      header_logo_url: headerLogoUrl,
      logo_animation: logoAnimation,
      welcome_title: welcomeTitle,
      welcome_subtitle: welcomeSubtitle,
      default_open: defaultOpen,
      theme,
      allow_attachments: allowAttachments,
      allow_location: allowLocation,
      allow_audio: allowAudio,
      z_index: zIndex,
      domain: widgetDomain,
      widget_id: widgetId,
      open_width: openWidth,
      open_height: openHeight,
      closed_width: closedWidth,
      closed_height: closedHeight,
      offset_bottom: offsetBottom,
      offset_right: offsetRight,
      show_catalog: enableCatalog,
      require_login_for_catalog: requireLoginForCatalog,
      floating_preview: enableFloatingPreview,
      endpoint,
    }),
    [
      accentColor,
      allowAttachments,
      allowAudio,
      allowLocation,
      closedHeight,
      closedWidth,
      defaultOpen,
      enableCatalog,
      enableFloatingPreview,
      endpoint,
      headerLogoUrl,
      logoAnimation,
      logoUrl,
      offsetBottom,
      offsetRight,
      openHeight,
      openWidth,
      primaryColor,
      requireLoginForCatalog,
      theme,
      welcomeSubtitle,
      welcomeTitle,
      widgetDomain,
      widgetId,
      zIndex,
    ],
  );

  const iframeSrcUrl = useMemo(() => {
    const url = new URL(`${apiBase}/iframe`);
    url.searchParams.set("entityToken", effectiveOwnerToken);
    url.searchParams.set("tipo_chat", endpoint);
    url.searchParams.set("defaultOpen", defaultOpen ? "true" : "false");
    url.searchParams.set("allowAttachments", allowAttachments ? "true" : "false");
    url.searchParams.set("allowLocation", allowLocation ? "true" : "false");
    url.searchParams.set("allowAudio", allowAudio ? "true" : "false");
    if (primaryColor) url.searchParams.set("primaryColor", primaryColor);
    if (accentColor) url.searchParams.set("accentColor", accentColor);
    if (logoUrl) url.searchParams.set("logoUrl", logoUrl);
    if (headerLogoUrl) url.searchParams.set("headerLogoUrl", headerLogoUrl);
    if (logoAnimation) url.searchParams.set("logoAnimation", logoAnimation);
    if (welcomeTitle) url.searchParams.set("welcomeTitle", welcomeTitle);
    if (welcomeSubtitle) url.searchParams.set("welcomeSubtitle", welcomeSubtitle);
    if (theme !== "auto") url.searchParams.set("theme", theme);
    url.searchParams.set("showCatalog", enableCatalog ? "true" : "false");
    url.searchParams.set("requireLoginForCatalog", requireLoginForCatalog ? "true" : "false");
    return url.toString();
  }, [
    accentColor,
    allowAttachments,
    allowAudio,
    allowLocation,
    apiBase,
    defaultOpen,
    effectiveOwnerToken,
    enableCatalog,
    endpoint,
    headerLogoUrl,
    logoAnimation,
    logoUrl,
    primaryColor,
    requireLoginForCatalog,
    theme,
    welcomeSubtitle,
    welcomeTitle,
  ]);

  const previewIframeUrl = useMemo(() => {
    const url = new URL(`${iframeBase}/iframe`);
    url.searchParams.set("entityToken", effectiveOwnerToken);
    url.searchParams.set("tipo_chat", endpoint);
    url.searchParams.set("defaultOpen", defaultOpen ? "true" : "false");
    url.searchParams.set("allowAttachments", allowAttachments ? "true" : "false");
    url.searchParams.set("allowLocation", allowLocation ? "true" : "false");
    url.searchParams.set("allowAudio", allowAudio ? "true" : "false");
    if (primaryColor) url.searchParams.set("primaryColor", primaryColor);
    if (accentColor) url.searchParams.set("accentColor", accentColor);
    if (logoUrl) url.searchParams.set("logoUrl", logoUrl);
    if (headerLogoUrl) url.searchParams.set("headerLogoUrl", headerLogoUrl);
    if (logoAnimation) url.searchParams.set("logoAnimation", logoAnimation);
    if (welcomeTitle) url.searchParams.set("welcomeTitle", welcomeTitle);
    if (welcomeSubtitle) url.searchParams.set("welcomeSubtitle", welcomeSubtitle);
    if (theme !== "auto") url.searchParams.set("theme", theme);
    url.searchParams.set("showCatalog", enableCatalog ? "true" : "false");
    url.searchParams.set("requireLoginForCatalog", requireLoginForCatalog ? "true" : "false");
    return url.toString();
  }, [
    accentColor,
    allowAttachments,
    allowAudio,
    allowLocation,
    defaultOpen,
    effectiveOwnerToken,
    enableCatalog,
    endpoint,
    headerLogoUrl,
    iframeBase,
    logoAnimation,
    logoUrl,
    primaryColor,
    requireLoginForCatalog,
    theme,
    welcomeSubtitle,
    welcomeTitle,
  ]);

  const codeIframe = useMemo(() => `<iframe
    id="chatboc-iframe"
    src="${iframeSrcUrl}"
    style="position:fixed; bottom:${offsetBottom}; right:${offsetRight}; border:none; border-radius:50%; z-index:${zIndex}; box-shadow:0 4px 32px rgba(0,0,0,0.2); background:transparent; overflow:hidden; width:${closedWidth}; height:${closedHeight}; display:block; transition: width 0.3s ease, height 0.3s ease, border-radius 0.3s ease;"
    allow="clipboard-write; geolocation; microphone; camera"
    loading="lazy"
    title="Chatboc Widget"
  ></iframe>
  <script>
  document.addEventListener('DOMContentLoaded', function () {
    var chatIframe = document.getElementById('chatboc-iframe');

    // Es crucial que si este código de iframe se inserta dentro de OTRO iframe en tu sitio,
    // ese iframe contenedor también debe tener 'allow="clipboard-write; geolocation; microphone; camera"'.
    // Ejemplo: <iframe src="pagina_con_este_codigo.html" allow="clipboard-write; geolocation; microphone; camera"></iframe>

    // Comunicación con el iframe para ajustar tamaño y forma
    window.addEventListener('message', function (event) {
      if (event.origin !== '${apiBase}') return; // Seguridad: aceptar mensajes solo del origen del iframe

      if (event.data && event.data.type === 'chatboc-state-change') {
        if (event.data.dimensions) {
          chatIframe.style.width = event.data.dimensions.width || '${openWidth}';
          chatIframe.style.height = event.data.dimensions.height || '${openHeight}';
        }
        chatIframe.style.borderRadius = event.data.isOpen ? '16px' : '50%'; // Más suave la transición
      }
    });

    // Opcional: Enviar un mensaje al iframe una vez cargado para configuraciones iniciales si es necesario
    // chatIframe.onload = function() {
    //   chatIframe.contentWindow.postMessage({ type: 'chatboc-init', settings: { exampleSetting: true } }, '${apiBase}');
    // };
  });
  </script>`, [
    apiBase,
    closedHeight,
    closedWidth,
    iframeSrcUrl,
    offsetBottom,
    offsetRight,
    openHeight,
    openWidth,
    zIndex,
  ]);

  const handleSaveSettings = useCallback(async () => {
    setSavingSettings(true);
    try {
      await apiFetch("/integracion/widget-settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(settingsPayload),
      });
      toast.success("Ajustes del widget guardados", {
        icon: <Check className="text-green-500" />,
      });
    } catch (err) {
      console.error("Error al guardar los ajustes del widget", err);
      toast.error("No pudimos guardar los ajustes", {
        icon: <AlertTriangle className="text-destructive" />,
      });
    } finally {
      setSavingSettings(false);
    }
  }, [settingsPayload]);

  useEffect(() => {
    if (!effectiveOwnerToken || !enableFloatingPreview) return;
    let scriptEl: HTMLScriptElement | null = null;

    const destroyWidget = () => (window as any).chatbocDestroyWidget?.(effectiveOwnerToken);
    const removePreviewScripts = () => {
      document
        .querySelectorAll('script[data-chatboc-preview="true"]')
        .forEach((node) => node.remove());
    };

    const buildScript = (src: string) => {
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.dataset.chatbocPreview = 'true';
      Object.entries(widgetAttributes).forEach(([key, value]) => {
        s.setAttribute(key, value);
      });
      return s;
    };

    const inject = () => {
      removePreviewScripts();
      destroyWidget();
      const s = buildScript(widgetScriptUrl);
      s.onerror = () => {
        if (widgetScriptUrl !== defaultWidgetScriptUrl) {
          const fallback = buildScript(defaultWidgetScriptUrl);
          document.body.appendChild(fallback);
          scriptEl = fallback;
        }
      };
      document.body.appendChild(s);
      scriptEl = s;
    };

    inject();
    return () => {
      removePreviewScripts();
      destroyWidget();
      if (scriptEl) scriptEl.remove();
    };
  }, [
    defaultWidgetScriptUrl,
    effectiveOwnerToken,
    enableFloatingPreview,
    widgetAttributes,
    widgetScriptUrl,
  ]);


  const copiarCodigo = async (tipo: "iframe" | "script") => {
    const textoACopiar = tipo === "iframe" ? codeIframe : codeScript;
    try {
      await navigator.clipboard.writeText(textoACopiar);
      setCopiado(tipo);
      toast.success("¡Código copiado!", {
        icon: <Check className="text-green-500" />,
        description: `El código de ${tipo} se ha copiado a tu portapapeles.`,
      });
      setTimeout(() => setCopiado(null), 2500);
    } catch (e) {
      console.error("Error al copiar al portapapeles:", e);
      toast.error("Error al copiar", {
        icon: <AlertTriangle className="text-destructive" />,
        description: "No se pudo copiar automáticamente. Intenta copiarlo manualmente.",
      });
      // Fallback por si navigator.clipboard no está disponible o falla (e.g. HTTP)
      window.prompt(`Copia manualmente (Ctrl+C / Cmd+C):\n${tipo === "iframe" ? "Código Iframe" : "Código Script"}`, textoACopiar);
    }
  };

  const handleCatalogToggle = (value: boolean) => {
    catalogTouched.current = true;
    setEnableCatalog(value);
  };

  const handleRequireLoginToggle = (value: boolean) => {
    catalogTouched.current = true;
    setRequireLoginForCatalog(value);
  };

  if (userLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen text-foreground bg-background p-4">
        <div className="flex flex-col items-center">
          <svg className="animate-spin h-10 w-10 text-primary mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-lg font-medium">Cargando datos de integración...</p>
          <p className="text-sm text-muted-foreground">Esto tomará solo un momento.</p>
        </div>
      </div>
    );
  }

  if (!user) {
    // Esto no debería ocurrir si userLoading es false y el useEffect de auth funciona,
    // pero es una salvaguarda. La navegación a /login ya se gestiona en useEffect.
    return null;
  }
  
  if (!user.tipo_chat) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-destructive bg-background p-6 text-center">
        <AlertTriangle size={48} className="mb-4" />
        <h1 className="text-2xl font-bold mb-2">Configuración Incompleta</h1>
        <p className="mb-4 text-muted-foreground">
          Tu perfil no tiene un tipo de chat (Pyme o Municipio) definido.
          Por favor, completa esta información en tu perfil para poder integrar el chatbot.
        </p>
        <Button onClick={() => navigate("/perfil")}>Ir a Mi Perfil</Button>
      </div>
    );
  }
  
  const renderCodeBlock = (title: string, type: "script" | "iframe", code: string, recommended?: boolean) => (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-lg">
          <div className="flex items-center">
            <Code size={20} className="mr-2 text-primary" />
            {title}
            {recommended && <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full dark:bg-green-700 dark:text-green-100">Recomendado</span>}
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => copiarCodigo(type)}
                  aria-label={`Copiar código ${type}`}
                >
                  {copiado === type ? <Check size={18} className="text-green-500" /> : <Copy size={18} />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Copiar código {type}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <pre className="bg-muted/50 dark:bg-muted/30 p-4 text-xs overflow-x-auto max-h-80 relative">
          <code className="language-html" style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
            {code}
          </code>
        </pre>
      </CardContent>
      <CardFooter className="p-4 bg-muted/20 dark:bg-muted/10">
         <Button
            className="w-full"
            onClick={() => copiarCodigo(type)}
            variant="secondary"
          >
            {copiado === type ? <Check size={18} className="mr-2 text-green-500" /> : <Copy size={18} className="mr-2" />}
            {copiado === type ? `¡Código ${type} Copiado!` : `Copiar Código ${type}`}
          </Button>
      </CardFooter>
    </Card>
  );


  return (
    <div className="container mx-auto max-w-5xl p-4 sm:p-6 md:p-8">
      <header className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-primary flex items-center">
          <Settings size={36} className="mr-3" />
          Integración del Chatbot Chatboc
        </h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Integra fácilmente el chatbot en tu sitio web o plataforma. Elige el método que mejor se adapte a tus necesidades.
        </p>
      </header>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          {loadingSettings
            ? "Cargando ajustes guardados del widget..."
            : "Personaliza el widget, guarda los cambios y reutiliza el mismo script en todos tus dominios autorizados."}
        </div>
        <div className="flex items-center gap-2">
          {loadingSettings && <RefreshCw className="h-4 w-4 animate-spin text-primary" />}
          <Button
            type="button"
            variant="secondary"
            onClick={handleSaveSettings}
            disabled={savingSettings || loadingSettings}
            className="flex items-center gap-2"
          >
            {savingSettings ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {savingSettings ? "Guardando ajustes..." : "Guardar ajustes del widget"}
          </Button>
        </div>
      </div>

      <Card className="mb-8 bg-blue-50 border-blue-200 dark:bg-blue-900/30 dark:border-blue-700">
        <CardHeader>
          <CardTitle className="flex items-center text-blue-700 dark:text-blue-300">
            <Info size={20} className="mr-2" />
            Información Importante
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-blue-600 dark:text-blue-200 space-y-2">
          <p>
            Pega el código elegido justo antes de la etiqueta de cierre <code>&lt;/body&gt;</code> en tu página web.
            Esto asegura que tu asistente virtual aparezca correctamente y pueda interactuar con los datos de tu empresa y catálogo.
          </p>
          <p>
            Ambos métodos de integración (Script y Iframe) están diseñados para ser seguros y eficientes. El método de Script es generalmente más flexible y recomendado.
          </p>
            <p>
              <strong>Token del Widget:</strong>{" "}
              {effectiveOwnerToken ? (
                <>
                  Tu token de integración es <code>{effectiveOwnerToken.substring(0, 8)}...</code>. Ya está incluido en los códigos de abajo.
                  <div className="mt-3 flex flex-wrap gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleGenerateIntegrationToken}
                      disabled={isGeneratingToken}
                      className="flex items-center gap-2"
                    >
                      <RefreshCw className="h-4 w-4" />
                      {isGeneratingToken ? "Actualizando token..." : "Regenerar token"}
                    </Button>
                  </div>
                </>
              ) : (
                <span className="text-yellow-700 dark:text-yellow-300">
                  No pudimos localizar el token de integración. Reingresá a tu cuenta o genera uno nuevo.
                </span>
              )}
            </p>
            {!effectiveOwnerToken && (
              <div className="mt-3 flex flex-wrap gap-3">
                <Button
                  type="button"
                  onClick={handleGenerateIntegrationToken}
                  disabled={isGeneratingToken}
                  className="flex items-center gap-2"
                >
                  <Check className="h-4 w-4" />
                  {isGeneratingToken ? "Creando token..." : "Generar token de integración"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="mb-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Layout className="h-5 w-5 text-primary" /> Resumen de la experiencia
            </CardTitle>
            <CardDescription>Revisa de un vistazo cómo quedará tu widget antes de copiar el código.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border p-3 flex flex-col gap-1">
              <p className="text-xs text-muted-foreground">Tipo de chat</p>
              <p className="font-semibold">{endpoint === "pyme" ? "Comercial / Pyme" : "Institucional"}</p>
              <p className="text-xs text-muted-foreground">El endpoint determina menús y tono de conversación.</p>
            </div>
            <div className="rounded-lg border p-3 flex flex-col gap-1">
              <p className="text-xs text-muted-foreground">Marketplace</p>
              <p className="font-semibold">{enableCatalog && !isMunicipal ? "Catálogo visible" : "Catálogo oculto"}</p>
              <p className="text-xs text-muted-foreground">{requireLoginForCatalog ? "Se pedirá login antes de comprar o canjear." : "Acceso directo al catálogo cuando esté activo."}</p>
            </div>
            <div className="rounded-lg border p-3 flex flex-col gap-1">
              <p className="text-xs text-muted-foreground">Dominio y seguridad</p>
              <p className="font-semibold break-words">{widgetDomain || "Dominio no establecido"}</p>
              <p className="text-xs text-muted-foreground">Mantiene coherencia de sesión y evita widgets duplicados.</p>
            </div>
            <div className="rounded-lg border p-3 flex flex-col gap-1">
              <p className="text-xs text-muted-foreground">Identificador del widget</p>
              <p className="font-semibold break-words">{widgetId}</p>
              <p className="text-xs text-muted-foreground">Úsalo para diferenciar lanzadores en tu sitio.</p>
            </div>
          </CardContent>
        </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Wand2 className="h-5 w-5 text-primary" /> Personalización visual
            </CardTitle>
            <CardDescription>Colores, logos y mensajes de bienvenida en un solo lugar.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col space-y-2">
              <Label htmlFor="primaryColor">Color primario</Label>
              <Input
                id="primaryColor"
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
              />
            </div>
            <div className="flex flex-col space-y-2">
              <Label htmlFor="accentColor">Color de acento</Label>
              <Input
                id="accentColor"
                type="color"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
              />
            </div>
            <div className="flex flex-col space-y-2">
              <Label htmlFor="logoUrl">URL del logo del lanzador</Label>
              <Input
                id="logoUrl"
                placeholder="https://..."
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
              />
            </div>
            <div className="flex flex-col space-y-2">
              <Label htmlFor="headerLogoUrl">URL del logo del encabezado</Label>
              <Input
                id="headerLogoUrl"
                placeholder="https://..."
                value={headerLogoUrl}
                onChange={(e) => setHeaderLogoUrl(e.target.value)}
              />
            </div>
            <div className="flex flex-col space-y-2">
              <Label htmlFor="logoAnimation">Animación del logo</Label>
              <Select value={logoAnimation} onValueChange={setLogoAnimation}>
                <SelectTrigger id="logoAnimation">
                  <SelectValue placeholder="Sin animación" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Sin animación</SelectItem>
                  <SelectItem value="bounce 2s infinite">Bounce</SelectItem>
                  <SelectItem value="spin 2s linear infinite">Spin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col space-y-2">
              <Label htmlFor="theme">Tema</Label>
              <Select value={theme} onValueChange={(value: "light" | "dark" | "auto") => setTheme(value)}>
                <SelectTrigger id="theme">
                  <SelectValue placeholder="Automático" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Automático</SelectItem>
                  <SelectItem value="light">Claro</SelectItem>
                  <SelectItem value="dark">Oscuro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col space-y-2 sm:col-span-2">
              <Label htmlFor="welcomeTitle">Título de bienvenida</Label>
              <Input
                id="welcomeTitle"
                placeholder="Hola, soy tu asistente virtual"
                value={welcomeTitle}
                onChange={(e) => setWelcomeTitle(e.target.value)}
              />
            </div>
            <div className="flex flex-col space-y-2 sm:col-span-2">
              <Label htmlFor="welcomeSubtitle">Subtítulo de bienvenida</Label>
              <Input
                id="welcomeSubtitle"
                placeholder="Puedo ayudarte con consultas, trámites y pedidos"
                value={welcomeSubtitle}
                onChange={(e) => setWelcomeSubtitle(e.target.value)}
              />
            </div>
            <div className="flex flex-col space-y-2 sm:col-span-2">
              <Label htmlFor="widgetDomain">Dominio permitido (data-domain)</Label>
              <Input
                id="widgetDomain"
                placeholder="https://tu-dominio.com"
                value={widgetDomain}
                onChange={(e) => setWidgetDomain(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Usamos este dominio para evitar duplicados y mantener la sesión en el mismo origen.</p>
            </div>
            <div className="flex flex-col space-y-2 sm:col-span-2">
              <Label htmlFor="widgetId">Identificador único del widget</Label>
              <Input
                id="widgetId"
                placeholder="chatboc-widget-principal"
                value={widgetId}
                onChange={(e) => setWidgetId(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Sirve para distinguir múltiples instancias en pruebas A/B y prevenir lanzadores duplicados.</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" /> Permisos y acceso
            </CardTitle>
            <CardDescription>Define cómo se abre el widget y qué permisos puede usar.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label htmlFor="defaultOpen">Abrir el chat al cargar</Label>
                <p className="text-xs text-muted-foreground">Útil para campañas específicas. Manténlo apagado para no molestar.</p>
              </div>
              <Switch id="defaultOpen" checked={defaultOpen} onCheckedChange={setDefaultOpen} />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label htmlFor="allowAttachments">Archivos y fotos</Label>
                <p className="text-xs text-muted-foreground">Habilita carga de adjuntos dentro del chat.</p>
              </div>
              <Switch id="allowAttachments" checked={allowAttachments} onCheckedChange={setAllowAttachments} />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label htmlFor="allowLocation">Ubicación y GPS</Label>
                <p className="text-xs text-muted-foreground">Recomendado para reportes y entregas.</p>
              </div>
              <Switch id="allowLocation" checked={allowLocation} onCheckedChange={setAllowLocation} />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label htmlFor="allowAudio">Audio y notas de voz</Label>
                <p className="text-xs text-muted-foreground">Permite grabar audios desde el widget.</p>
              </div>
              <Switch id="allowAudio" checked={allowAudio} onCheckedChange={setAllowAudio} />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label htmlFor="floatingPreview">Mostrar widget flotante aquí</Label>
                <p className="text-xs text-muted-foreground">Activa una vista real en esta página sin duplicar lanzadores.</p>
              </div>
              <Switch id="floatingPreview" checked={enableFloatingPreview} onCheckedChange={setEnableFloatingPreview} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Layout className="h-5 w-5 text-primary" /> Tamaño y posicionamiento
            </CardTitle>
            <CardDescription>Controla las dimensiones del estado abierto y cerrado.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col space-y-2">
              <Label htmlFor="openWidth">Ancho abierto</Label>
              <Input id="openWidth" value={openWidth} onChange={(e) => setOpenWidth(e.target.value)} />
            </div>
            <div className="flex flex-col space-y-2">
              <Label htmlFor="openHeight">Alto abierto</Label>
              <Input id="openHeight" value={openHeight} onChange={(e) => setOpenHeight(e.target.value)} />
            </div>
            <div className="flex flex-col space-y-2">
              <Label htmlFor="closedWidth">Ancho cerrado</Label>
              <Input id="closedWidth" value={closedWidth} onChange={(e) => setClosedWidth(e.target.value)} />
            </div>
            <div className="flex flex-col space-y-2">
              <Label htmlFor="closedHeight">Alto cerrado</Label>
              <Input id="closedHeight" value={closedHeight} onChange={(e) => setClosedHeight(e.target.value)} />
            </div>
            <div className="flex flex-col space-y-2">
              <Label htmlFor="offsetBottom">Separación inferior</Label>
              <Input id="offsetBottom" value={offsetBottom} onChange={(e) => setOffsetBottom(e.target.value)} />
            </div>
            <div className="flex flex-col space-y-2">
              <Label htmlFor="offsetRight">Separación derecha</Label>
              <Input id="offsetRight" value={offsetRight} onChange={(e) => setOffsetRight(e.target.value)} />
            </div>
            <div className="flex flex-col space-y-2 sm:col-span-2">
              <Label htmlFor="zIndex">Z-index</Label>
              <Input id="zIndex" value={zIndex} onChange={(e) => setZIndex(e.target.value)} />
              <p className="text-xs text-muted-foreground">Ajusta esta cifra si tu sitio tiene overlays o barras fijas.</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" /> Catálogo y login
            </CardTitle>
            <CardDescription>
              Usa estas opciones para activar el marketplace en rubros que lo necesiten. Desactívalo para experiencias formales.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label htmlFor="enableCatalog">Mostrar catálogo en el widget</Label>
                <p className="text-xs text-muted-foreground">
                  Ideal para experiencias con marketplace. Se desactiva automáticamente en entornos formales.
                </p>
              </div>
              <Switch
                id="enableCatalog"
                checked={enableCatalog}
                onCheckedChange={(value) => handleCatalogToggle(Boolean(value))}
                disabled={isMunicipal}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label htmlFor="requireLogin">Solicitar login antes de comprar o canjear</Label>
                <p className="text-xs text-muted-foreground">Útil para mostrar puntos, donaciones o pedidos vinculados al usuario.</p>
              </div>
              <Switch
                id="requireLogin"
                checked={requireLoginForCatalog}
                onCheckedChange={(value) => handleRequireLoginToggle(Boolean(value))}
                disabled={!enableCatalog}
              />
            </div>
            {isMunicipal && (
              <p className="text-xs text-muted-foreground pl-1">
                Este perfil es institucional, por lo que ocultamos catálogo y login comercial para mantener la experiencia formal.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="script" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="script" className="text-base py-2.5">
            <Code size={18} className="mr-2" /> Método &lt;script&gt; (Recomendado)
          </TabsTrigger>
          <TabsTrigger value="iframe" className="text-base py-2.5">
            <Code size={18} className="mr-2" /> Método &lt;iframe&gt; (Alternativo)
          </TabsTrigger>
        </TabsList>

        <TabsContent value="script">
          {renderCodeBlock("Widget con <script>", "script", codeScript, true)}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-lg flex items-center"><HelpCircle size={20} className="mr-2 text-primary"/>Notas para el método &lt;script&gt;</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <p><strong>Ventajas:</strong> Mayor flexibilidad, actualizaciones automáticas del widget, mejor integración con la página anfitriona.</p>
              <p><strong>Geolocalización, micrófono y portapapeles:</strong> Si tu página (donde pegas este script) ya está dentro de un iframe, asegúrate de que ese iframe contenedor tenga el atributo <code>allow="clipboard-write; geolocation; microphone; camera"</code> para que estas funciones del chatbot operen correctamente.</p>
              <p><strong>Personalización:</strong> Puedes modificar los atributos <code>data-*</code> en el script para ajustar la apariencia y comportamiento iniciales del widget. Por ejemplo, <code>data-default-open="true"</code> para que el chat se abra al cargar la página.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="iframe">
          {renderCodeBlock("Widget con <iframe>", "iframe", codeIframe)}
           <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-lg flex items-center"><HelpCircle size={20} className="mr-2 text-primary"/>Notas para el método &lt;iframe&gt;</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <p><strong>Ventajas:</strong> Aislamiento completo del contenido del widget, puede ser más simple de implementar en algunas plataformas con restricciones de scripts.</p>
              <p><strong>Geolocalización, micrófono y portapapeles:</strong> Similar al método script, si la página donde insertas este iframe está a su vez dentro de otro iframe, el iframe más externo debe incluir <code>allow="clipboard-write; geolocation; microphone; camera"</code>.</p>
              <p><strong>Limitaciones:</strong> Menos flexibilidad para la comunicación directa con la página anfitriona en comparación con el método script. Las actualizaciones del widget se manejan dentro del iframe.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <section className="mt-12">
        <h2 className="text-2xl font-semibold mb-4 flex items-center">
          <Eye size={28} className="mr-3 text-primary" />
          Vista Previa en Vivo
        </h2>
        <Card className="overflow-hidden shadow-xl">
          <CardContent className="p-0">
            <div
              className="bg-slate-100 dark:bg-slate-800 flex items-center justify-center"
              style={{ minHeight: '720px' }}
            >
              <div
                style={{
                  width: openWidth,
                  height: openHeight,
                  border: "1px solid #ccc",
                  borderRadius: "16px",
                  overflow: "hidden",
                  background: "#ffffff",
                  boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                  {user && effectiveOwnerToken && user.tipo_chat ? (
                    <iframe
                      src={previewIframeUrl}
                    width={openWidth}
                    height={openHeight}
                    style={{
                      border: "none",
                      width: "100%",
                      height: "100%",
                      borderRadius: "16px",
                      background: "transparent",
                      display: "block",
                    }}
                    loading="lazy"
                    title="Vista previa del Chatbot Chatboc"
                    allow="clipboard-write; geolocation; microphone; camera"
                  />
                ) : (
                  <div className="p-4 text-center text-muted-foreground">
                    <AlertTriangle size={32} className="mx-auto mb-2" />
                    La vista previa no está disponible. Verifica la configuración del usuario.
                  </div>
                )}
              </div>
            </div>
          </CardContent>
          <CardFooter className="p-4 bg-muted/20 dark:bg-muted/10 flex items-center justify-center">
            <p className="text-xs text-muted-foreground text-center">
              Esta es una simulación de cómo se verá el widget en tu sitio. <br/>
              Las dimensiones y la posición pueden variar según tu implementación.
            </p>
          </CardFooter>
        </Card>
      </section>

      <section className="mt-12">
        <h2 className="text-2xl font-semibold mb-4 flex items-center">
          <HelpCircle size={28} className="mr-3 text-primary" />
          Solución de Problemas y Soporte
        </h2>
        <Card>
          <CardContent className="pt-6 text-sm space-y-3">
            <p>
              <strong>¿No ves el widget?</strong>
              Verifica que el código esté correctamente pegado antes de la etiqueta <code>&lt;/body&gt;</code>.
              Asegúrate de que tu plataforma (Tiendanube, Shopify, etc.) permita la inserción de scripts o iframes de terceros.
              En Tiendanube, por ejemplo, puedes necesitar usar la opción de "Editar Código Avanzado".
            </p>
            <p>
              <strong>Problemas de Geolocalización, micrófono o Portapapeles:</strong>
              Asegúrate de que tu sitio se sirva a través de <strong>HTTPS</strong>, ya que muchas funciones del navegador, incluida la geolocalización y el acceso al micrófono, lo requieren.
              Si tu página está incrustada en otro iframe, el iframe contenedor DEBE tener el atributo <code>allow="clipboard-write; geolocation; microphone; camera"</code>.
            </p>
             <p>
              <strong>Conflictos de Estilos o Scripts:</strong>
              El widget está diseñado para minimizar conflictos. Si experimentas problemas, intenta cargar el script del widget al final del <code>&lt;body&gt;</code>.
              Si usas el método iframe, los estilos están completamente aislados.
            </p>
            <p>
              <strong>¿Aún necesitas ayuda?</strong> No dudes en{" "}
              <a href="mailto:info@chatboc.ar" className="underline text-primary hover:text-primary/80 font-medium">
                contactar a nuestro equipo de soporte
              </a>.
              Estamos aquí para ayudarte a integrar Chatboc exitosamente.
            </p>
          </CardContent>
        </Card>
      </section>

    </div>
  );
};

export default Integracion;

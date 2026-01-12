(function () {
  "use strict";

  if (typeof window !== "undefined") {
    if (window.__chatbocWidgetLoaded) return;
    window.__chatbocWidgetLoaded = true;
  }

  const KNOWN_EXTENSION_PATTERNS = [
    /Cannot assign to read only property '(ethereum|tronLink)' of object '#<Window>'/i,
    /Cannot assign to read only property '(ethereum|tronLink)'/i,
    /This document requires 'TrustedScript' assignment/i,
  ];

  function extractMessage(value) {
    if (typeof value === "string") return value;
    if (
      value &&
      typeof value === "object" &&
      "message" in value &&
      typeof value.message === "string"
    ) {
      return value.message;
    }
    if (value instanceof Error) {
      return value.message;
    }
    return "";
  }

  function shouldIgnore(message) {
    if (!message) return false;
    return KNOWN_EXTENSION_PATTERNS.some((pattern) => pattern.test(message));
  }

  function registerExtensionNoiseFilters() {
    if (typeof window === "undefined") {
      return () => {};
    }

    const win = window;
    if (typeof win.__chatbocExtensionNoiseCleanup === "function") {
      return win.__chatbocExtensionNoiseCleanup;
    }

    const handleError = (event) => {
      const errorMessage = extractMessage((event?.error ?? event?.message) || "");
      if (shouldIgnore(errorMessage)) {
        event?.preventDefault?.();
        event?.stopImmediatePropagation?.();
        return false;
      }
      return undefined;
    };

    const handleRejection = (event) => {
      const reasonMessage = extractMessage(event?.reason);
      if (shouldIgnore(reasonMessage)) {
        event?.preventDefault?.();
        event?.stopImmediatePropagation?.();
      }
    };

    window.addEventListener("error", handleError, { capture: true });
    window.addEventListener("unhandledrejection", handleRejection, { capture: true });

    const cleanup = () => {
      window.removeEventListener("error", handleError, { capture: true });
      window.removeEventListener("unhandledrejection", handleRejection, { capture: true });
      delete win.__chatbocExtensionNoiseCleanup;
    };

    win.__chatbocExtensionNoiseCleanup = cleanup;
    return cleanup;
  }

  registerExtensionNoiseFilters();

  const TOKEN_EVENT_NAME = "chatboc-token";
  const TOKEN_MANAGER_REGISTRY_KEY = "__chatbocTokenManagers";
  const INITIAL_RETRY_DELAY_MS = 15000;
  const MAX_RETRY_DELAY_MS = 600000;
  const REFRESH_BUFFER_SECONDS = 120;
  const MIN_REFRESH_SECONDS = 15;
  const FALLBACK_REFRESH_SECONDS = 600;

  function normalizeBase(url) {
    return (url || "").replace(/\/+$/, "");
  }

  function decodeJwtPayload(token) {
    if (!token) return {};
    const parts = token.split(".");
    if (parts.length < 2) return {};
    try {
      const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
      return JSON.parse(atob(payload));
    } catch (err) {
      console.warn("Chatboc widget: unable to decode JWT payload", err);
      return {};
    }
  }

  function getTokenRegistry() {
    if (!window[TOKEN_MANAGER_REGISTRY_KEY]) {
      window[TOKEN_MANAGER_REGISTRY_KEY] = {};
    }
    return window[TOKEN_MANAGER_REGISTRY_KEY];
  }

  function createTokenManager(ownerToken, apiBase, tenantSlug) {
    let activeToken = null;
    let refreshTimer = null;
    let retryDelay = INITIAL_RETRY_DELAY_MS;
    const subscribers = new Set();

    async function fetchJson(url, options) {
      const response = await fetch(url, options);
      let payload = {};
      try {
        payload = await response.json();
      } catch (err) {
        // Ignore JSON parse errors; payload stays empty.
      }
      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}`);
        error.payload = payload;
        throw error;
      }
      return payload;
    }

    async function mintWithOwner() {
      const payload = await fetchJson(`${apiBase}/auth/widget-token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: ownerToken,
        },
        body: "{}",
      });
      if (!payload?.token) {
        throw new Error("mint_missing_token");
      }
      return payload.token;
    }

    async function mintWithTenant() {
      if (!tenantSlug) {
        throw new Error("mint_missing_identifier");
      }
      const payload = await fetchJson(`${apiBase}/auth/widget-token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ tenant: tenantSlug }),
      });
      if (!payload?.token) {
        throw new Error("mint_missing_token");
      }
      return payload.token;
    }

    async function mint() {
      if (ownerToken) {
        try {
          return await mintWithOwner();
        } catch (err) {
          if (!tenantSlug) throw err;
          console.warn(
            "Chatboc widget: owner token mint failed, retrying with tenant slug",
            err
          );
        }
      }

      if (tenantSlug) {
        return await mintWithTenant();
      }

      throw new Error("mint_missing_token");
    }

    async function refreshToken(current) {
      const payload = await fetchJson(`${apiBase}/auth/widget-refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: current }),
      });
      if (!payload?.token) {
        throw new Error("refresh_missing_token");
      }
      return payload.token;
    }

    function notify(token) {
      subscribers.forEach((listener) => {
        try {
          listener(token);
        } catch (err) {
          console.error("Chatboc widget: token subscriber failed", err);
        }
      });

      try {
        window.dispatchEvent(
          new CustomEvent(TOKEN_EVENT_NAME, {
            detail: { token, ownerToken, apiBase },
          })
        );
      } catch (err) {
        console.error("Chatboc widget: failed to dispatch token event", err);
      }
    }

    function scheduleNext(token) {
      if (!token) return;
      notify(token);
      const { exp } = decodeJwtPayload(token);
      const now = Math.floor(Date.now() / 1000);
      const secondsUntilExpiry = exp ? exp - now : FALLBACK_REFRESH_SECONDS;
      const waitSeconds = Math.max(
        secondsUntilExpiry - REFRESH_BUFFER_SECONDS,
        MIN_REFRESH_SECONDS
      );

      clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(async () => {
        try {
          activeToken = await refreshToken(activeToken);
          retryDelay = INITIAL_RETRY_DELAY_MS;
        } catch (refreshError) {
          console.warn(
            "Chatboc widget: token refresh failed, attempting mint",
            refreshError
          );
          try {
            activeToken = await mint();
            retryDelay = INITIAL_RETRY_DELAY_MS;
          } catch (mintError) {
            console.error(
              "Chatboc widget: unable to mint widget token",
              mintError
            );
            refreshTimer = window.setTimeout(
              () => scheduleNext(activeToken),
              retryDelay
            );
            retryDelay = Math.min(retryDelay * 2, MAX_RETRY_DELAY_MS);
            return;
          }
        }
        scheduleNext(activeToken);
      }, waitSeconds * 1000);
    }

    async function ensureToken() {
      if (activeToken) return activeToken;
      try {
        activeToken = await mint();
      } catch (err) {
        activeToken = null;
        throw err;
      }
      retryDelay = INITIAL_RETRY_DELAY_MS;
      scheduleNext(activeToken);
      return activeToken;
    }

    async function apiFetch(url, init) {
      const token = await ensureToken();
      const headers = Object.assign({}, init?.headers || {}, {
        Authorization: `Bearer ${token}`,
      });
      return fetch(url, Object.assign({}, init || {}, { headers }));
    }

    function subscribe(listener) {
      if (typeof listener !== "function") {
        return () => {};
      }
      subscribers.add(listener);
      if (activeToken) {
        try {
          listener(activeToken);
        } catch (err) {
          console.error("Chatboc widget: token subscriber failed", err);
        }
      }
      return () => subscribers.delete(listener);
    }

    function destroy() {
      clearTimeout(refreshTimer);
      refreshTimer = null;
      subscribers.clear();
      activeToken = null;
    }

    return { ensureToken, apiFetch, subscribe, destroy };
  }

  function getTokenManager(ownerToken, apiBase, tenantSlug) {
    const registry = getTokenRegistry();
    const normalizedBase = normalizeBase(apiBase);
    const key = `${normalizedBase}::${ownerToken || tenantSlug || "tenantless"}`;
    if (!registry[key]) {
      registry[key] = createTokenManager(ownerToken, normalizedBase, tenantSlug);
    }
    return registry[key];
  }

  async function init() {
    const SCRIPT_CONFIG = {
      WIDGET_JS_FILENAME: "widget.js",
      DEFAULT_TOKEN: "demo-anon",
      DEFAULT_Z_INDEX: "9999",
      DEFAULT_INITIAL_BOTTOM: "24px",
      DEFAULT_INITIAL_RIGHT: "24px",
      DEFAULT_OPEN_WIDTH: "380px",
      DEFAULT_OPEN_HEIGHT: "680px",
      DEFAULT_CLOSED_WIDTH: "56px",
      DEFAULT_CLOSED_HEIGHT: "56px",
      MOBILE_BREAKPOINT_PX: 640,
      LOADER_TIMEOUT_MS: 10000,
      DEFAULT_CHATBOC_DOMAIN: "https://chatboc.ar",
      DEFAULT_API_DOMAIN: "https://api.chatboc.ar",
    };

    const script =
      document.currentScript ||
      Array.from(document.getElementsByTagName("script")).find(
        (s) => s.src && s.src.includes(SCRIPT_CONFIG.WIDGET_JS_FILENAME)
      );

    if (!script) {
      console.error("Chatboc widget.js FATAL: script tag not found.");
      return;
    }

    const ownerTokenAttr =
      script.getAttribute("data-owner-token") || script.getAttribute("data-entity-token");
    const ownerToken = (ownerTokenAttr || "").trim();
    const tenantSlug =
      (script.getAttribute("data-tenant") ||
        script.getAttribute("data-tenant-slug") ||
        script.getAttribute("data-endpoint") ||
        "")
        .trim() || null;

    if (!ownerToken && !tenantSlug) {
      console.error(
        "Chatboc widget: Missing required data-owner-token or data-tenant attribute. Aborting widget initialization."
      );
      return;
    }

    if (ownerToken === SCRIPT_CONFIG.DEFAULT_TOKEN) {
      console.warn(
        "Chatboc widget: using demo token 'demo-anon'. Do not use this value in production embeds."
      );
    }

    const entityTokenAttr = script.getAttribute("data-entity-token");
    const entityToken = (entityTokenAttr || ownerToken).trim();
    const forceLoad = script.getAttribute("data-force") === "true";
    const widgetIdAttr = (script.getAttribute("data-widget-id") || "").trim();
    const domainAttr = (script.getAttribute("data-domain") || "").trim();
    const shadowDomAttr = (script.getAttribute("data-shadow-dom") || "").trim().toLowerCase();
    const useShadowDom = shadowDomAttr === "true" || shadowDomAttr === "1" || shadowDomAttr === "yes";

    let allowedDomainOrigin = "";
    if (domainAttr) {
      try {
        allowedDomainOrigin = new URL(domainAttr, window.location.href).origin;
      } catch (err) {
        console.warn("Chatboc widget: domain inválido", err);
      }
    }

    const currentOrigin = window.location.origin;
    if (allowedDomainOrigin && currentOrigin !== allowedDomainOrigin) {
      console.warn(
        `Chatboc widget: dominio actual (${currentOrigin}) distinto al permitido (${allowedDomainOrigin}). Se omite la carga.`
      );
      return;
    }

    const resolvedWidgetId =
      widgetIdAttr || tenantSlug || ownerToken || script.getAttribute("data-tenant") || "chatboc-widget";

    const registry = (window.__chatbocWidgets = window.__chatbocWidgets || {});
    const baseRegistryKey = ownerToken || tenantSlug || "tenantless";
    const registryKey = `${baseRegistryKey}::${resolvedWidgetId}`;
    const existingEntry = registry[registryKey] || registry[baseRegistryKey];

    if (existingEntry) {
      if (forceLoad && typeof existingEntry.destroy === "function") {
        existingEntry.destroy();
      } else if (!forceLoad) {
        console.warn(
          `Chatboc widget already loaded for token ${baseRegistryKey}. Skipping.`
        );
        return;
      }
    }

    const existingContainer = document.querySelector(".chatboc-widget-container");
    const existingById = resolvedWidgetId
      ? document.querySelector(
          `[data-chatboc-widget-id="${resolvedWidgetId.replace(/"/g, "\\\"")}"]`
        )
      : null;
    const existingShadowHost = resolvedWidgetId
      ? document.querySelector(
          `[data-chatboc-widget-host="${resolvedWidgetId.replace(/"/g, "\\\"")}"]`
        )
      : null;

    if ((existingById || existingContainer || existingShadowHost) && !forceLoad) {
      console.warn("Chatboc widget: ya existe un widget montado en la página. Se evita duplicar.");
      return;
    }

    if (forceLoad && typeof window.chatbocDestroyWidget === "function") {
      window.chatbocDestroyWidget();
    }

    const scriptOrigin =
      (script.src && new URL(script.src, window.location.href).origin) ||
      SCRIPT_CONFIG.DEFAULT_CHATBOC_DOMAIN;
    const defaultApiBase = (() => {
      try {
        const originUrl = new URL(scriptOrigin);
        const host = originUrl.hostname.toLowerCase();
        if (host === "chatboc.ar" || host === "www.chatboc.ar") {
          return SCRIPT_CONFIG.DEFAULT_API_DOMAIN;
        }
      } catch (err) {
        console.warn("Chatboc widget: unable to parse script origin", err);
      }
      return scriptOrigin;
    })();
    const apiBase = normalizeBase(
      script.getAttribute("data-api-base") || defaultApiBase
    );

    const authManager = getTokenManager(ownerToken, apiBase, tenantSlug);
    window.chatbocAuth = authManager;

    let latestToken;
    try {
      latestToken = await authManager.ensureToken();
    } catch (err) {
      console.error("Chatboc widget: unable to obtain widget token", err);
      return;
    }

    const tokenEventHandler = (event) => {
      const detail = event.detail;
      if (!detail) return;
      const incomingToken =
        typeof detail === "string" ? detail : detail.token || detail.authToken;
      const incomingOwner =
        typeof detail === "string"
          ? ownerToken
          : detail.ownerToken || detail.entityToken || detail.owner;
      const incomingApiBase =
        typeof detail === "object" && detail
          ? normalizeBase(detail.apiBase || detail.baseUrl || detail.domain || "")
          : "";

      if (!incomingToken) return;
      if (ownerToken && incomingOwner && incomingOwner !== ownerToken) return;
      if (incomingApiBase && incomingApiBase !== apiBase) return;

      latestToken = incomingToken;
      const reg = registry[registryKey];
      if (reg && typeof reg.post === "function") {
        reg.post({ type: "AUTH", token: latestToken });
      }
    };

    window.addEventListener(TOKEN_EVENT_NAME, tokenEventHandler);

    const WIDGET_DIMENSIONS = {
      OPEN: {
        width: script.getAttribute("data-width") || SCRIPT_CONFIG.DEFAULT_OPEN_WIDTH,
        height: script.getAttribute("data-height") || SCRIPT_CONFIG.DEFAULT_OPEN_HEIGHT,
      },
      CLOSED: {
        width: script.getAttribute("data-closed-width") || SCRIPT_CONFIG.DEFAULT_CLOSED_WIDTH,
        height: script.getAttribute("data-closed-height") || SCRIPT_CONFIG.DEFAULT_CLOSED_HEIGHT,
      },
    };

    const positionAttr = (script.getAttribute("data-position") || "bottom-right").toLowerCase();
    const isBottom = !positionAttr.includes("top");
    const isLeft = positionAttr.includes("left");

    const initialBottom = isBottom
      ? script.getAttribute("data-bottom") || SCRIPT_CONFIG.DEFAULT_INITIAL_BOTTOM
      : "";
    const initialTop = !isBottom
      ? script.getAttribute("data-top") || SCRIPT_CONFIG.DEFAULT_INITIAL_BOTTOM
      : "";
    const initialRight = !isLeft
      ? script.getAttribute("data-right") || SCRIPT_CONFIG.DEFAULT_INITIAL_RIGHT
      : "";
    const initialLeft = isLeft
      ? script.getAttribute("data-left") || SCRIPT_CONFIG.DEFAULT_INITIAL_RIGHT
      : "";
    const defaultOpen = script.getAttribute("data-default-open") === "true";
    const theme = script.getAttribute("data-theme") || "";
    const rubroAttr = script.getAttribute("data-rubro") || "";
    const ctaMessageAttr = script.getAttribute("data-cta-message") || "";
    const langAttr = script.getAttribute("data-lang") || "";
    const primaryColor = script.getAttribute("data-primary-color") || "#007aff";
    const accentColor = script.getAttribute("data-accent-color") || "";
    const logoUrlAttr = script.getAttribute("data-logo-url");
    const headerLogoUrlAttr = script.getAttribute("data-header-logo-url");
    const logoAnimationAttr = script.getAttribute("data-logo-animation") || "";
    const welcomeTitleAttr = script.getAttribute("data-welcome-title") || "";
    const welcomeSubtitleAttr = script.getAttribute("data-welcome-subtitle") || "";
    const logoUrl = logoUrlAttr || `${apiBase}/chatboc_widget_64x64.webp`;
    const headerLogoUrl = headerLogoUrlAttr || logoUrl;
    const endpointAttr = script.getAttribute("data-endpoint");
    const tipoChat =
      endpointAttr === "municipio" || endpointAttr === "pyme" ? endpointAttr : "pyme";

    function buildWidget(finalCta) {
      const registryKeys = [registryKey, baseRegistryKey];
      const zIndexBase = parseInt(script.getAttribute("data-z") || SCRIPT_CONFIG.DEFAULT_Z_INDEX, 10);
      const iframeId = `chatboc-dynamic-iframe-${Math.random().toString(36).substring(2, 9)}`;
      let iframeIsCurrentlyOpen = defaultOpen;

      let unsubscribeAuth = null;

      const parsePx = (val) => parseInt(val, 10) || 0;

      function computeResponsiveDims(base, isOpen) {
        const isMobile = window.innerWidth < SCRIPT_CONFIG.MOBILE_BREAKPOINT_PX;
        if (isOpen && isMobile) {
          return {
            width: "100vw",
            height: "calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom))",
          };
        }
        if (isMobile) {
          // Closed on mobile
          return WIDGET_DIMENSIONS.CLOSED;
        }
        // Desktop: ensure widget fits within viewport when open
        if (isOpen) {
          const desiredWidth = parsePx(base.width);
          const desiredHeight = parsePx(base.height);
          const maxWidth = window.innerWidth - parsePx(initialRight) - 16;
          const maxHeight =
            window.innerHeight - parsePx(initialBottom) - 16;
          const finalWidth = !isNaN(desiredWidth)
            ? Math.min(desiredWidth, maxWidth) + "px"
            : base.width;
          const finalHeight = !isNaN(desiredHeight)
            ? Math.min(desiredHeight, maxHeight) + "px"
            : base.height;
          return { width: finalWidth, height: finalHeight };
        }
        return base;
      }

      let currentDims = iframeIsCurrentlyOpen
        ? computeResponsiveDims(WIDGET_DIMENSIONS.OPEN, true)
        : WIDGET_DIMENSIONS.CLOSED;

      const widgetContainer = document.createElement("div");
      widgetContainer.id = `chatboc-widget-container-${iframeId}`;
      widgetContainer.className = "chatboc-widget-container";
      widgetContainer.setAttribute("data-chatboc-token", ownerToken);
      widgetContainer.setAttribute("data-chatboc-widget-id", resolvedWidgetId);
      if (allowedDomainOrigin) {
        widgetContainer.setAttribute("data-chatboc-domain", allowedDomainOrigin);
      }
      Object.assign(widgetContainer.style, {
        position: "fixed",
        bottom: initialBottom,
        top: initialTop,
        right: initialRight,
        left: initialLeft,
        width: currentDims.width,
        height: currentDims.height,
        zIndex: zIndexBase.toString(),
        borderRadius: "50%",
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        transition: "transform 0.2s ease, box-shadow 0.2s ease, width 0.3s ease, height 0.3s ease, border-radius 0.3s ease",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: defaultOpen ? "white" : primaryColor,
        cursor: defaultOpen ? "default" : "pointer",
      });

      widgetContainer.addEventListener("mouseenter", () => {
        if (!iframeIsCurrentlyOpen) {
          widgetContainer.style.transform = "scale(1.05)";
          widgetContainer.style.boxShadow = "0 6px 18px rgba(0,0,0,0.2)";
        }
      });

      widgetContainer.addEventListener("mouseleave", () => {
        if (!iframeIsCurrentlyOpen) {
          widgetContainer.style.transform = "scale(1)";
          widgetContainer.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
        }
      });
      let shadowHost = null;
      const supportsShadowDom =
        typeof HTMLElement !== "undefined" &&
        typeof HTMLElement.prototype.attachShadow === "function";

      if (useShadowDom && !supportsShadowDom) {
        console.warn("Chatboc widget: Shadow DOM no soportado en este navegador, se usa DOM normal.");
      }

      if (useShadowDom && supportsShadowDom) {
        shadowHost = document.createElement("div");
        shadowHost.className = "chatboc-widget-host";
        shadowHost.setAttribute("data-chatboc-widget-host", resolvedWidgetId);
        shadowHost.style.all = "initial";
        document.body.appendChild(shadowHost);
        const shadowRoot = shadowHost.attachShadow({ mode: "open" });
        shadowRoot.appendChild(widgetContainer);
      } else {
        document.body.appendChild(widgetContainer);
      }

      const logoImg = document.createElement("img");
      logoImg.id = `chatboc-logo-${iframeId}`;
      logoImg.src = logoUrl;
      logoImg.alt = "Abrir chat";
      Object.assign(logoImg.style, {
        width: "70%",
        height: "70%",
        objectFit: "contain",
        pointerEvents: "none",
        transition: "opacity 0.3s ease",
        opacity: iframeIsCurrentlyOpen ? "0" : "1",
      });
      if (logoAnimationAttr) logoImg.style.animation = logoAnimationAttr;
      widgetContainer.appendChild(logoImg);

      const loader = document.createElement("div");
      loader.id = `chatboc-loader-${iframeId}`;
      Object.assign(loader.style, {
        position: "absolute",
        inset: "0",
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: primaryColor,
        borderRadius: "inherit",
        transition: "opacity 0.3s ease-out 0.1s",
        zIndex: "2",
      });
      loader.innerHTML = `<img src="${apiBase}/favicon/favicon-96x96.png" alt="Cargando Chatboc..." style="width: 60%; height: 60%; max-width: 96px; max-height: 96px; filter: drop-shadow(0 2px 3px rgba(0,0,0,0.2));"/>`;
      widgetContainer.appendChild(loader);

      const iframe = document.createElement("iframe");
      iframe.id = iframeId;
      // Use explicit .html path so integrations without rewrite rules work
      const iframeSrc = new URL(`${apiBase}/iframe.html`);
      iframeSrc.searchParams.set("token", latestToken);
      iframeSrc.searchParams.set("entityToken", entityToken);
      iframeSrc.searchParams.set("ownerToken", ownerToken);
      iframeSrc.searchParams.set("widgetId", iframeId);
      iframeSrc.searchParams.set("defaultOpen", String(defaultOpen));
      iframeSrc.searchParams.set("tipo_chat", tipoChat);
      iframeSrc.searchParams.set("openWidth", WIDGET_DIMENSIONS.OPEN.width);
      iframeSrc.searchParams.set("openHeight", WIDGET_DIMENSIONS.OPEN.height);
      iframeSrc.searchParams.set("closedWidth", WIDGET_DIMENSIONS.CLOSED.width);
      iframeSrc.searchParams.set("closedHeight", WIDGET_DIMENSIONS.CLOSED.height);
      if (theme) iframeSrc.searchParams.set("theme", theme);
      if (rubroAttr) iframeSrc.searchParams.set("rubro", rubroAttr);
      if (finalCta) iframeSrc.searchParams.set("ctaMessage", finalCta);
      if (langAttr) iframeSrc.searchParams.set("lang", langAttr);
      if (primaryColor) iframeSrc.searchParams.set("primaryColor", primaryColor);
      if (accentColor) iframeSrc.searchParams.set("accentColor", accentColor);
      if (logoUrlAttr) iframeSrc.searchParams.set("logoUrl", logoUrlAttr);
      if (headerLogoUrlAttr) iframeSrc.searchParams.set("headerLogoUrl", headerLogoUrlAttr);
      if (logoAnimationAttr) iframeSrc.searchParams.set("logoAnimation", logoAnimationAttr);
      if (welcomeTitleAttr) iframeSrc.searchParams.set("welcomeTitle", welcomeTitleAttr);
      if (welcomeSubtitleAttr) iframeSrc.searchParams.set("welcomeSubtitle", welcomeSubtitleAttr);
      iframe.src = iframeSrc.toString();

      if (langAttr) iframe.setAttribute("lang", langAttr);

      Object.assign(iframe.style, {
        border: "none",
        width: "100%",
        height: "100%",
        backgroundColor: "transparent",
        display: "block",
        opacity: "0",
        transition: "opacity 0.4s ease-in",
        zIndex: "1",
      });
      iframe.setAttribute("width", "100%");
      iframe.setAttribute("height", "100%");
      iframe.setAttribute("frameborder", "0");
      iframe.allow = "clipboard-write; geolocation; microphone; camera";
      iframe.setAttribute("title", "Chatboc Asistente Virtual");
      widgetContainer.appendChild(iframe);

      let iframeHasLoaded = false;
      const loadTimeout = setTimeout(() => {
        if (iframeHasLoaded) return;
        loader.innerHTML = `<div style="font-family: system-ui, sans-serif; color: white; font-size: 14px; text-align: center; padding: 10px;">Servicio no disponible</div>`;
        loader.style.backgroundColor = "hsl(var(--destructive, 0 84.2% 60.2%))";
      }, SCRIPT_CONFIG.LOADER_TIMEOUT_MS);

      iframe.onload = () => {
        iframeHasLoaded = true;
        clearTimeout(loadTimeout);
        loader.style.opacity = "0";
        setTimeout(() => loader.remove(), 300);
        iframe.style.opacity = "1";
      };

      let attemptedFallback = false;
      iframe.onerror = () => {
        if (!attemptedFallback) {
          attemptedFallback = true;
          iframe.style.display = "none";
          iframe.src = `${apiBase}/iframe`;
          iframe.style.display = "block";
          return;
        }
        iframeHasLoaded = true;
        clearTimeout(loadTimeout);
        loader.innerHTML = `<div style="font-family: system-ui, sans-serif; color: white; font-size: 14px; text-align: center; padding: 10px;">Error al cargar. Intente de nuevo.</div>`;
        loader.style.backgroundColor = "hsl(var(--destructive, 0 84.2% 60.2%))";
        iframe.style.display = "none";
      };

      function messageHandler(event) {
        const isSafeOrigin = event.origin === apiBase || apiBase.startsWith("http://localhost");
        if (!isSafeOrigin) {
          if (event.data?.type?.startsWith('chatboc-')) {
            console.warn(`Chatboc widget: Ignored message from unsafe origin: ${event.origin}`);
          }
          return;
        }

        if (event.data?.type === "chatboc-ready" && event.data.widgetId === iframeId) {
          loader.style.opacity = "0";
          setTimeout(() => loader.remove(), 300);
          iframe.style.opacity = "1";
          postToIframe({ type: "AUTH", token: latestToken });
          return;
        }

        if (event.data?.type === "chatboc-state-change" && event.data.widgetId === iframeId) {
          iframeIsCurrentlyOpen = event.data.isOpen;
          const newDims = computeResponsiveDims(
            iframeIsCurrentlyOpen ? WIDGET_DIMENSIONS.OPEN : WIDGET_DIMENSIONS.CLOSED,
            iframeIsCurrentlyOpen
          );
          const isMobile = window.innerWidth <= SCRIPT_CONFIG.MOBILE_BREAKPOINT_PX;
          if (iframeIsCurrentlyOpen) {
            const style = {
              width: newDims.width,
              height: newDims.height,
              borderRadius: isMobile ? "16px 16px 0 0" : "16px",
              boxShadow: "0 8px 40px rgba(0, 0, 0, 0.2)",
              background: "white",
              transform: "scale(1)",
              cursor: "default",
              right: isMobile ? "0" : initialRight,
              left: isMobile ? "0" : "auto",
            };
            if (isMobile) {
              style.bottom = "env(safe-area-inset-bottom)";
              style.top = "env(safe-area-inset-top)";
            } else {
              style.bottom = initialBottom;
              style.top = "auto";
            }
            Object.assign(widgetContainer.style, style);
            logoImg.style.opacity = "0";
          } else {
            Object.assign(widgetContainer.style, {
              width: newDims.width,
              height: newDims.height,
              borderRadius: "50%",
              boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
              background: primaryColor,
              cursor: "pointer",
              bottom:
                window.innerWidth <= SCRIPT_CONFIG.MOBILE_BREAKPOINT_PX
                  ? "env(safe-area-inset-bottom)"
                  : initialBottom,
              right: initialRight,
              top: "auto",
              left: "auto",
            });
            logoImg.style.opacity = "1";
          }
        }
      }
      window.addEventListener("message", messageHandler);

      function resizeHandler() {
        if (!iframeIsCurrentlyOpen) return;
        const newDims = computeResponsiveDims(WIDGET_DIMENSIONS.OPEN, true);
        const isMobile = window.innerWidth < SCRIPT_CONFIG.MOBILE_BREAKPOINT_PX;
        const style = {
          width: newDims.width,
          height: newDims.height,
          borderRadius: isMobile ? "0" : "16px",
          right: isMobile ? "0" : initialRight,
          left: isMobile ? "0" : "auto",
        };
        if (isMobile) {
          style.bottom = "env(safe-area-inset-bottom)";
          style.top = "env(safe-area-inset-top)";
        } else {
          style.bottom = initialBottom;
          style.top = "auto";
        }
        Object.assign(widgetContainer.style, style);
      }
      window.addEventListener("resize", resizeHandler);
      if (iframeIsCurrentlyOpen) resizeHandler();

      // Fallback click listener
      widgetContainer.addEventListener("click", () => {
        if (iframeIsCurrentlyOpen) return;
        postToIframe({ type: "TOGGLE_CHAT", isOpen: true });
      });


      function postToIframe(msg) {
        iframe?.contentWindow?.postMessage({ ...msg, widgetId: iframeId }, apiBase);
      }

      function destroy() {
        window.removeEventListener("message", messageHandler);
        window.removeEventListener("resize", resizeHandler);
        widgetContainer.removeEventListener("mousedown", dragStart);
        widgetContainer.removeEventListener("touchstart", dragStart);
        widgetContainer?.remove();
        shadowHost?.remove();
        registryKeys.forEach((key) => delete registry[key]);
        unsubscribeAuth?.();
        window.removeEventListener(TOKEN_EVENT_NAME, tokenEventHandler);
      }

      const registryEntry = {
        destroy,
        container: widgetContainer,
        post: postToIframe,
        widgetId: resolvedWidgetId,
        baseKey: baseRegistryKey,
      };
      registry[registryKey] = registryEntry;
      registry[baseRegistryKey] = registryEntry;

      unsubscribeAuth = authManager.subscribe((token) => {
        latestToken = token;
        postToIframe({ type: "AUTH", token: latestToken });
      });

      // Global API
      if (!window.Chatboc) window.Chatboc = {};
      window.Chatboc.setView = (view) => postToIframe({ type: "SET_VIEW", view });
      window.Chatboc.open = () => postToIframe({ type: "TOGGLE_CHAT", isOpen: true });
      window.Chatboc.close = () => postToIframe({ type: "TOGGLE_CHAT", isOpen: false });
      window.Chatboc.toggle = () => postToIframe({ type: "TOGGLE_CHAT", isOpen: !iframeIsCurrentlyOpen });

      if (!window.chatbocDestroyWidget) {
        window.chatbocDestroyWidget = (identifier) => {
          Object.entries(registry).forEach(([key, entry]) => {
            if (
              !identifier ||
              key === identifier ||
              entry?.widgetId === identifier ||
              entry?.baseKey === identifier
            ) {
              entry?.destroy?.();
            }
          });
        };
      }
    }

    // Fetch CTA message and then build the widget
    if (ctaMessageAttr) {
      buildWidget(ctaMessageAttr);
    } else {
      authManager
        .apiFetch(`${apiBase}/widget/attention`)
        .then((r) => (r.ok ? r.json() : {}))
        .then((d) => buildWidget(d.message || ""))
        .catch(() => buildWidget("")); // Always build widget, even if fetch fails
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

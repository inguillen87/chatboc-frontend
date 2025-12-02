(function () {
  const internals =
    (typeof ChatbocWidgetInternals !== "undefined" && ChatbocWidgetInternals) ||
    (typeof window !== "undefined" && window.ChatbocWidgetInternals) ||
    (() => {
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

      function createTokenManager(ownerToken, apiBase) {
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

        async function mint() {
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

      function getTokenManager(ownerToken, apiBase) {
        const registry = getTokenRegistry();
        const normalizedBase = normalizeBase(apiBase);
        const key = `${normalizedBase}::${ownerToken}`;
        if (!registry[key]) {
          registry[key] = createTokenManager(ownerToken, normalizedBase);
        }
        return registry[key];
      }

      return {
        TOKEN_EVENT_NAME,
        normalizeBase,
        getTokenManager,
        DEFAULT_OWNER_TOKEN: "demo-anon",
      };
    })();

  if (typeof window !== "undefined") {
    window.ChatbocWidgetInternals = internals;
  }

  const { normalizeBase, getTokenManager, DEFAULT_OWNER_TOKEN } = internals;

  const script =
    document.currentScript ||
    Array.from(document.getElementsByTagName("script")).find((s) =>
      s.src && s.src.includes("widget.js")
    );

  if (!script) {
    console.error("Chatboc widget: script tag not found for token manager setup.");
    return;
  }

  const apiBase = normalizeBase(
    script.getAttribute("data-api-base") || "https://chatboc.ar"
  );
  const ownerAttr =
    (script.getAttribute("data-owner-token") ||
      script.getAttribute("data-entity-token") ||
      "")
      .trim();

  if (!ownerAttr) {
    console.error(
      "Chatboc widget: Missing required data-owner-token attribute. Token manager not initialized."
    );
    return;
  }

  if (ownerAttr === DEFAULT_OWNER_TOKEN) {
    console.warn(
      "Chatboc widget: using demo token 'demo-anon'. Do not use this value in production embeds."
    );
  }

  const authManager = getTokenManager(ownerAttr, apiBase);
  window.chatbocAuth = authManager;
})();

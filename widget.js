(function () {
  "use strict";

  function init() {
    const script =
      document.currentScript ||
      Array.from(document.getElementsByTagName("script")).find((s) =>
        s.src && s.src.includes("widget.js")
      );
    if (!script) {
      console.error("Chatboc widget.js FATAL: script tag not found.");
      return;
    }

    const token = script.getAttribute("data-token") || "demo-anon";
    const registry = (window.__chatbocWidgets = window.__chatbocWidgets || {});
    if (registry[token]) {
      if (script.getAttribute("data-force") === "true") {
        if (typeof registry[token].destroy === "function") {
          registry[token].destroy();
        }
        delete registry[token];
      } else {
        console.warn(
          "Chatboc widget already loaded for token " + token + ". Skipping."
        );
        return;
      }
    }
    const endpointAttr = script.getAttribute("data-endpoint");
    const tipoChat =
      endpointAttr === "municipio" || endpointAttr === "pyme"
        ? endpointAttr
        : (typeof window !== "undefined" && window.APP_TARGET === "municipio"
            ? "municipio"
            : "pyme");
    const initialBottom = script.getAttribute("data-bottom") || "20px";
    const initialRight = script.getAttribute("data-right") || "20px";
    const defaultOpen = script.getAttribute("data-default-open") === "true";
    const theme = script.getAttribute("data-theme") || "";
    const rubroAttr = script.getAttribute("data-rubro") || "";
    const ctaMessageAttr = script.getAttribute("data-cta-message") || "";
    const scriptOrigin = (script.getAttribute("src") && new URL(script.getAttribute("src"), window.location.href).origin) || "https://www.chatboc.ar";
    const chatbocDomain = script.getAttribute("data-domain") || scriptOrigin;

    function buildWidget(finalCta) {
      const zIndexBase = parseInt(script.getAttribute("data-z") || "999990", 10);
      const iframeId = "chatboc-dynamic-iframe-" + Math.random().toString(36).substring(2, 9);

      const WIDGET_DIMENSIONS_JS = {
        OPEN: {
          width: script.getAttribute("data-width") || "460px",
          height: script.getAttribute("data-height") || "680px",
        },
        CLOSED: {
          width: script.getAttribute("data-closed-width") || "96px",
          height: script.getAttribute("data-closed-height") || "96px",
        },
      };

      // Modified computeResponsiveDims to accept isOpen
      function computeResponsiveDims(base, isOpen) {
        const widthNum = parseInt(base.width, 10);
        const heightNum = parseInt(base.height, 10);

        if (isOpen && window.innerWidth < 640) {
          // Open and on mobile: force full screen
          return {
            width: "100vw",
            height: "calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom))",
          };
        } else if (!isOpen && window.innerWidth < 640) {
          // Closed and on mobile: use exact small dimensions (e.g., 72px from ChatWidget.tsx)
          return {
            width: widthNum + "px",
            height: heightNum + "px",
          };
        } else {
          // Desktop (open or closed): use base dimensions, constrained by viewport size.
          // For "closed" state on desktop, Math.min won't typically have an effect.
          const constrainedWidth = Math.min(widthNum, window.innerWidth - 20);
          const constrainedHeight = Math.min(heightNum, window.innerHeight - 20);
          return { width: constrainedWidth + "px", height: constrainedHeight + "px" };
        }
      }

      let iframeIsCurrentlyOpen = defaultOpen;
      // Initial dimensions calculation using the modified computeResponsiveDims
      let currentDims = defaultOpen
        ? computeResponsiveDims(WIDGET_DIMENSIONS_JS.OPEN, true) // isOpen is true if defaultOpen
        : WIDGET_DIMENSIONS_JS.CLOSED; // CLOSED dimensions are already small and non-responsive


      // --- Contenedor principal del widget (loader y iframe) ---
      const widgetContainer = document.createElement("div");
      widgetContainer.id = "chatboc-widget-container-" + iframeId;
      widgetContainer.setAttribute("data-chatboc-token", token);
      Object.assign(widgetContainer.style, {
        position: "fixed",
        bottom: initialBottom,
        right: initialRight,
        width: currentDims.width,
        height: currentDims.height,
        zIndex: zIndexBase.toString(),
        borderRadius: iframeIsCurrentlyOpen && window.innerWidth < 640 ? "0px" : iframeIsCurrentlyOpen ? "16px" : "50%",
        boxShadow: iframeIsCurrentlyOpen ? "0 6px 20px rgba(0,0,0,0.2)" : "0 4px 12px rgba(0,0,0,0.15)",
        // width, height, and border-radius will be controlled by the iframe's content animations.
        // Only transition boxShadow and background.
        transition: "box-shadow 0.25s ease-in-out, background-color 0.25s ease-in-out",
        overflow: "hidden", // Keep hidden to clip content during framer-motion animation
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        // Background is transparent if open, primary color if closed.
        background: iframeIsCurrentlyOpen ? "transparent" : "hsl(var(--primary, 218 92% 41%))",
      });
      document.body.appendChild(widgetContainer);

      // --- Loader ---
      const loader = document.createElement("div");
      loader.id = "chatboc-loader-" + iframeId;
      Object.assign(loader.style, {
        position: "absolute",
        top: "0",
        left: "0",
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "hsl(var(--primary, 218 92% 41%))", // Loader BG matches closed button
        borderRadius: "inherit",
        transition: "opacity 0.3s ease-out",
        pointerEvents: "auto", // Allow click if iframe fails to load to trigger open attempt
        zIndex: "2",
      });
      loader.innerHTML = `<img src="${chatbocDomain}/favicon/favicon-96x96.png" alt="Chatboc" style="width:96px;height:96px; filter: invert(100%);"/>`;
      widgetContainer.appendChild(loader);

      // --- Iframe ---
      const iframe = document.createElement("iframe");
      iframe.id = iframeId;
      iframe.src = `${chatbocDomain}/iframe?token=${encodeURIComponent(token)}&widgetId=${iframeId}&defaultOpen=${defaultOpen}&tipo_chat=${tipoChat}&openWidth=${encodeURIComponent(WIDGET_DIMENSIONS_JS.OPEN.width)}&openHeight=${encodeURIComponent(WIDGET_DIMENSIONS_JS.OPEN.height)}&closedWidth=${encodeURIComponent(WIDGET_DIMENSIONS_JS.CLOSED.width)}&closedHeight=${encodeURIComponent(WIDGET_DIMENSIONS_JS.CLOSED.height)}${theme ? `&theme=${encodeURIComponent(theme)}` : ""}${rubroAttr ? `&rubro=${encodeURIComponent(rubroAttr)}` : ""}${finalCta ? `&ctaMessage=${encodeURIComponent(finalCta)}` : ""}`;
      Object.assign(iframe.style, {
        border: "none",
        width: "100%",
        height: "100%",
        backgroundColor: "transparent",
        display: "block",
        opacity: "0", // Hidden initially
        transition: "opacity 0.3s ease-in",
        zIndex: "1" // Below loader initially
      });
      iframe.allow = "clipboard-write; geolocation";
      try {
        if (window.frameElement && window.frameElement.setAttribute) {
          const allowAttr = window.frameElement.getAttribute("allow") || "";
          if (!allowAttr.includes("geolocation")) {
            const parts = allowAttr.split(/\s*;\s*/).filter(p => p && p !== "clipboard-write" && p !== "geolocation");
            parts.push("clipboard-write", "geolocation");
            window.frameElement.setAttribute("allow", parts.join("; "));
          }
        }
      } catch (e) { /* Might be cross-origin; ignore */ }
      iframe.setAttribute("title", "Chatboc Chatbot");
      widgetContainer.appendChild(iframe);

      let iframeHasLoaded = false;
      const loadTimeout = setTimeout(() => {
        if (!iframeHasLoaded) {
          loader.innerHTML = '<div style="font-family: Arial, sans-serif; color: white; font-size:12px; text-align:center;">Servicio no disponible</div>';
          loader.style.backgroundColor = "hsl(var(--destructive, 0 84.2% 60.2%))";
        }
      }, 10000);

      iframe.onload = function () {
        iframeHasLoaded = true;
        clearTimeout(loadTimeout);
        loader.style.opacity = "0"; // Fade out loader
        setTimeout(() => loader.remove(), 250); // Remove after transition
        iframe.style.opacity = "1"; // Fade in iframe
      };

      iframe.onerror = function () {
        iframeHasLoaded = true;
        clearTimeout(loadTimeout);
        loader.innerHTML = '<div style="font-family: Arial, sans-serif; color: white; font-size:12px; text-align:center;">Servicio no disponible</div>';
        loader.style.backgroundColor = "hsl(var(--destructive, 0 84.2% 60.2%))";
        iframe.style.display = "none"; // Hide broken iframe
      };

      function messageHandler(event) {
        const isLocalDev = chatbocDomain.startsWith("http://localhost") || chatbocDomain.startsWith("http://127.0.0.1");
        if (event.origin !== chatbocDomain && !isLocalDev) {
            if (event.data && typeof event.data.type === 'string' && event.data.type.startsWith('chatboc-')) {
              console.warn("Chatboc widget: Received a message from an unexpected origin.", "\nMessage origin:", event.origin, "\nExpected origin (chatbocDomain):", chatbocDomain);
            }
            return;
        }

        if (event.data && event.data.type === "chatboc-state-change" && event.data.widgetId === iframeId) {
          iframeIsCurrentlyOpen = event.data.isOpen;
          if (event.data.dimensions) {
            currentDims = computeResponsiveDims(event.data.dimensions, iframeIsCurrentlyOpen);
          } else if (iframeIsCurrentlyOpen) {
            currentDims = computeResponsiveDims(WIDGET_DIMENSIONS_JS.OPEN, iframeIsCurrentlyOpen);
          } else {
            currentDims = WIDGET_DIMENSIONS_JS.CLOSED;
          }

          Object.assign(widgetContainer.style, {
            width: currentDims.width,
            height: currentDims.height,
            borderRadius: iframeIsCurrentlyOpen && window.innerWidth < 640 ? "0" : iframeIsCurrentlyOpen ? "16px" : "50%",
            boxShadow: iframeIsCurrentlyOpen ? "0 6px 20px rgba(0,0,0,0.2)" : "0 4px 12px rgba(0,0,0,0.15)",
            background: iframeIsCurrentlyOpen ? "transparent" : "hsl(var(--primary, 218 92% 41%))",
          });
        }
      }
      window.addEventListener("message", messageHandler);

      function adjustOpenDimensions() {
        if (!iframeIsCurrentlyOpen) return;
        currentDims = computeResponsiveDims(WIDGET_DIMENSIONS_JS.OPEN, iframeIsCurrentlyOpen); // isOpen is true here
        Object.assign(widgetContainer.style, {
          width: currentDims.width,
          height: currentDims.height,
          borderRadius: window.innerWidth < 640 ? "0" : "16px", // Specific for open state
        });
      }
      window.addEventListener("resize", adjustOpenDimensions);

      widgetContainer.addEventListener("click", function () {
        // This click listener is primarily a fallback if the iframe fails to load or post messages,
        // or if the loader itself is clicked.
        if (!iframeIsCurrentlyOpen) {
          if (iframe && iframe.contentWindow) {
            iframe.contentWindow.postMessage({ type: "TOGGLE_CHAT", widgetId: iframeId, isOpen: true }, "*");
          }
          // Apply styles for open state immediately as a fallback
          iframeIsCurrentlyOpen = true;
          currentDims = computeResponsiveDims(WIDGET_DIMENSIONS_JS.OPEN, true); // isOpen is true
          Object.assign(widgetContainer.style, {
            width: currentDims.width,
            height: currentDims.height,
            borderRadius: window.innerWidth < 640 ? "0" : "16px",
            boxShadow: "0 6px 20px rgba(0,0,0,0.2)",
            background: "transparent",
          });
           // Hide loader if it's still visible and we are forcing open
          if (loader && loader.parentElement) {
            loader.style.opacity = "0";
            setTimeout(() => loader.remove(), 250);
          }
          if(iframe) iframe.style.opacity = "1";
        }
      });

      let isDragging = false, dragStartX, dragStartY, containerStartLeft, containerStartTop;
      widgetContainer.addEventListener("mousedown", dragStart);
      widgetContainer.addEventListener("touchstart", dragStart, { passive: false });

      function dragStart(e) {
        if (iframeIsCurrentlyOpen) return; // Don't drag if open
        isDragging = true;
        const rect = widgetContainer.getBoundingClientRect();
        containerStartLeft = rect.left;
        containerStartTop = rect.top;
        dragStartX = e.touches ? e.touches[0].clientX : e.clientX;
        dragStartY = e.touches ? e.touches[0].clientY : e.clientY;
        widgetContainer.style.transition = "none"; // Disable transitions during drag
        widgetContainer.style.userSelect = "none";
        document.body.style.cursor = "move";
        document.addEventListener("mousemove", dragMove);
        document.addEventListener("mouseup", dragEnd);
        document.addEventListener("touchmove", dragMove, { passive: false });
        document.addEventListener("touchend", dragEnd);
        if (e.type === "touchstart" && e.cancelable) e.preventDefault();
      }

      function dragMove(e) {
        if (!isDragging) return;
        if (e.type === "touchmove" && e.cancelable) e.preventDefault();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        let newLeft = containerStartLeft + (clientX - dragStartX);
        let newTop = containerStartTop + (clientY - dragStartY);
        const currentContainerWidth = parseInt(currentDims.width); // Use currentDims for accuracy
        const currentContainerHeight = parseInt(currentDims.height);
        newLeft = Math.max(0, Math.min(window.innerWidth - currentContainerWidth, newLeft));
        newTop = Math.max(0, Math.min(window.innerHeight - currentContainerHeight, newTop));
        widgetContainer.style.left = newLeft + "px";
        widgetContainer.style.top = newTop + "px";
        widgetContainer.style.right = "auto"; // Important when dragging
        widgetContainer.style.bottom = "auto"; // Important when dragging
      }

      function dragEnd() {
        if (!isDragging) return;
        isDragging = false;
        widgetContainer.style.userSelect = "";
        document.body.style.cursor = "default";
        // Restore only relevant transitions
        setTimeout(() => {
            widgetContainer.style.transition = "box-shadow 0.25s ease-in-out, background-color 0.25s ease-in-out";
        }, 50);
        document.removeEventListener("mousemove", dragMove);
        document.removeEventListener("mouseup", dragEnd);
        document.removeEventListener("touchmove", dragMove);
        document.removeEventListener("touchend", dragEnd);
      }

      function postToIframe(msg) {
        if (iframe && iframe.contentWindow) {
          iframe.contentWindow.postMessage({ ...msg, widgetId: iframeId }, "*");
        }
      }

      function destroy() {
        window.removeEventListener("message", messageHandler);
        window.removeEventListener("resize", adjustOpenDimensions);
        widgetContainer.removeEventListener("mousedown", dragStart);
        widgetContainer.removeEventListener("touchstart", dragStart);
        if (widgetContainer.parentElement) {
            widgetContainer.remove();
        }
        if (loader && loader.parentElement) {
            loader.remove();
        }
        if (iframe && iframe.parentElement) {
            iframe.remove();
        }
        clearTimeout(loadTimeout);
      }

      registry[token] = { destroy, container: widgetContainer, post: postToIframe };

      if (!window.Chatboc) window.Chatboc = {};
      window.Chatboc.setView = function (view) { postToIframe({ type: "SET_VIEW", view }); };
      window.Chatboc.open = function () { postToIframe({ type: "TOGGLE_CHAT", isOpen: true }); };
      window.Chatboc.close = function () { postToIframe({ type: "TOGGLE_CHAT", isOpen: false }); };
      window.Chatboc.toggle = function () { postToIframe({ type: "TOGGLE_CHAT", isOpen: !iframeIsCurrentlyOpen }); };
      if (!window.chatbocDestroyWidget) {
        window.chatbocDestroyWidget = function (tok) {
          if (registry[tok] && typeof registry[tok].destroy === "function") {
            registry[tok].destroy();
            delete registry[tok];
          }
        };
      }
    } // End of buildWidget

    if (ctaMessageAttr) {
      buildWidget(ctaMessageAttr);
    } else {
      fetch(`${chatbocDomain}/widget/attention`)
        .then((r) => (r.ok ? r.json() : {}))
        .then((d) => buildWidget(d.message || ""))
        .catch(() => buildWidget("")); // Ensure buildWidget is always called
    }
  } // End of init

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

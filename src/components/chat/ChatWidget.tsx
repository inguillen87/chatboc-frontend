import React, { useState, useEffect, useCallback, Suspense } from "react";
import ChatbocLogoAnimated from "./ChatbocLogoAnimated";
import { getCurrentTipoChat } from "@/utils/tipoChat";
// import { Button } from "@/components/ui/button"; // No se usa directamente Button aquí
// import { MessageCircle } from "lucide-react"; // No se usa directamente MessageCircle aquí
import { cn } from "@/lib/utils";
import { safeLocalStorage } from "@/utils/safeLocalStorage";
import { motion, AnimatePresence } from "framer-motion";
import { useUser } from "@/hooks/useUser";
import { apiFetch } from "@/utils/api";
import { playOpenSound, playProactiveSound } from "@/utils/sounds"; // Importar playProactiveSound
import ProactiveBubble from "./ProactiveBubble"; // Importar ProactiveBubble

import ChatUserRegisterPanel from "./ChatUserRegisterPanel";
import ChatUserLoginPanel from "./ChatUserLoginPanel";
import ChatUserPanel from "./ChatUserPanel";
import ChatHeader from "./ChatHeader";
import EntityInfoPanel from "./EntityInfoPanel";

const ChatPanel = React.lazy(() => import("./ChatPanel"));

interface ChatWidgetProps {
  mode?: "standalone" | "iframe" | "script";
  initialPosition?: { bottom: number; right: number };
  defaultOpen?: boolean;
  initialView?: 'chat' | 'register' | 'login' | 'user' | 'info';
  widgetId?: string;
  entityToken?: string;
  initialRubro?: string;
  openWidth?: string;
  openHeight?: string;
  closedWidth?: string;
  closedHeight?: string;
  tipoChat?: "pyme" | "municipio";
  ctaMessage?: string; // Este es el CTA existente
}

const PROACTIVE_MESSAGES = [
  "¿Necesitas ayuda para encontrar algo?",
  "¡Hola! Estoy aquí para asistirte.",
  "¿Tienes alguna consulta? ¡Pregúntame!",
  "Explora nuestros servicios, ¡te ayudo!",
];

let proactiveMessageTimeout: NodeJS.Timeout | null = null;
let hideProactiveBubbleTimeout: NodeJS.Timeout | null = null;

const ChatWidget: React.FC<ChatWidgetProps> = ({
  mode = "standalone",
  defaultOpen = false,
  initialView = 'chat',
  widgetId = "chatboc-widget-iframe",
  entityToken,
  initialRubro,
  openWidth = "460px",
  openHeight = "680px",
  closedWidth = "96px",
  closedHeight = "96px",
  tipoChat = getCurrentTipoChat(),
  initialPosition = { bottom: 32, right: 32 },
  ctaMessage,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [muted, setMuted] = useState(() => {
    if (typeof window === 'undefined') return false;
    return safeLocalStorage.getItem('chatboc_muted') === '1';
  });
  const [view, setView] = useState<'chat' | 'register' | 'login' | 'user' | 'info'>(initialView);
  const { user } = useUser();
  const [resolvedTipoChat, setResolvedTipoChat] = useState<'pyme' | 'municipio'>(tipoChat);
  const [entityInfo, setEntityInfo] = useState<any | null>(null);
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" && window.innerWidth < 640
  );

  // Para el CTA existente
  const [showCta, setShowCta] = useState(false);

  // Nuevos estados para burbujas proactivas
  const [proactiveMessage, setProactiveMessage] = useState<string | null>(null);
  const [showProactiveBubble, setShowProactiveBubble] = useState(false);
  const [proactiveCycle, setProactiveCycle] = useState(0); // Para rotar mensajes


  const openUserPanel = useCallback(() => {
    if (user) {
      if (user.rol && user.rol !== 'usuario') {
        window.location.href = '/perfil';
      } else {
        setView('user');
      }
    } else if (entityInfo) {
      setView('info');
    } else {
      setView('login');
    }
  }, [user, entityInfo]);

  const openCart = useCallback(() => {
    window.open('/cart', '_blank');
  }, []);

  const toggleMuted = useCallback(() => {
    setMuted((m) => {
      const nv = !m;
      safeLocalStorage.setItem('chatboc_muted', nv ? '1' : '0');
      return nv;
    });
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (typeof window !== "undefined") {
        setIsMobile(window.innerWidth < 640);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const finalOpenWidth = openWidth;
  const finalOpenHeight = openHeight;
  const finalClosedWidth = closedWidth;
  const finalClosedHeight = closedHeight;

  const commonPanelAndButtonAbsoluteClasses = cn("absolute bottom-0 right-0");
  const commonPanelStyles = cn("bg-card border shadow-lg", "flex flex-col overflow-hidden");
  const commonButtonStyles = cn(
    "rounded-full flex items-center justify-center",
    "bg-primary text-primary-foreground hover:bg-primary/90",
    "shadow-lg"
  );

  const sendStateMessageToParent = useCallback(
    (open: boolean) => {
      if (mode === "iframe" && typeof window !== "undefined" && window.parent !== window && widgetId) {
        const dims = open
          ? { width: finalOpenWidth, height: finalOpenHeight }
          : { width: finalClosedWidth, height: finalClosedHeight };
        window.parent.postMessage(
          { type: "chatboc-state-change", widgetId, dimensions: dims, isOpen: open },
          "*"
        );
      }
    },
    [mode, widgetId, finalOpenWidth, finalOpenHeight, finalClosedWidth, finalClosedHeight]
  );

  useEffect(() => {
    sendStateMessageToParent(isOpen);
    if (isOpen) { // Si se abre el chat, ocultar cualquier burbuja proactiva
      setShowProactiveBubble(false);
      if (proactiveMessageTimeout) clearTimeout(proactiveMessageTimeout);
      if (hideProactiveBubbleTimeout) clearTimeout(hideProactiveBubbleTimeout);
    }
  }, [isOpen, sendStateMessageToParent]);


  // Lógica para mostrar burbujas proactivas
  useEffect(() => {
    if (isOpen || mode === 'standalone') { // No mostrar en standalone o si ya está abierto
      if (proactiveMessageTimeout) clearTimeout(proactiveMessageTimeout);
      if (hideProactiveBubbleTimeout) clearTimeout(hideProactiveBubbleTimeout);
      setShowProactiveBubble(false);
      return;
    }

    // Limpiar timeouts anteriores si existen
    if (proactiveMessageTimeout) clearTimeout(proactiveMessageTimeout);
    if (hideProactiveBubbleTimeout) clearTimeout(hideProactiveBubbleTimeout);
    
    const alreadyShownProactive = safeLocalStorage.getItem("proactive_bubble_session_shown") === "1";

    if (alreadyShownProactive) return; // Mostrar solo una vez por sesión (o ajustar esta lógica)

    proactiveMessageTimeout = setTimeout(() => {
      const nextMessage = PROACTIVE_MESSAGES[proactiveCycle % PROACTIVE_MESSAGES.length];
      setProactiveMessage(nextMessage);
      setShowProactiveBubble(true);
      if (!muted) playProactiveSound();
      
      safeLocalStorage.setItem("proactive_bubble_session_shown", "1"); // Marcar como mostrado en esta sesión

      hideProactiveBubbleTimeout = setTimeout(() => {
        setShowProactiveBubble(false);
        setProactiveCycle(prev => prev + 1); // Preparar para el siguiente mensaje si se reabre la lógica
      }, 7000); // Ocultar después de 7 segundos

    }, 10000); // Mostrar después de 10 segundos de inactividad/carga

    return () => {
      if (proactiveMessageTimeout) clearTimeout(proactiveMessageTimeout);
      if (hideProactiveBubbleTimeout) clearTimeout(hideProactiveBubbleTimeout);
    };
  }, [isOpen, muted, proactiveCycle, mode]);


  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!event.data || event.data.widgetId !== widgetId) return;
      if (event.data.type === "TOGGLE_CHAT") {
        setIsOpen(event.data.isOpen);
      } else if (event.data.type === "SET_VIEW") {
        const v = event.data.view;
        if (['chat', 'register', 'login', 'user', 'info'].includes(v)) {
          setView(v as any);
        }
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [widgetId]);

  const toggleChat = useCallback(() => {
    setIsOpen((open) => {
      const next = !open;
      if (next && !muted) playOpenSound();
      if (next) { // Si se va a abrir, ocultar burbuja proactiva
        setShowProactiveBubble(false);
        if (proactiveMessageTimeout) clearTimeout(proactiveMessageTimeout);
        if (hideProactiveBubbleTimeout) clearTimeout(hideProactiveBubbleTimeout);
      }
      return next;
    });
  }, [muted]);

  // CTA Existente (puede coexistir o ser reemplazado por las burbujas proactivas)
  useEffect(() => {
    if (!ctaMessage || isOpen || showProactiveBubble) { // No mostrar si hay burbuja proactiva
      setShowCta(false);
      return;
    }
    if (safeLocalStorage.getItem("cta_seen") === "1") return;
    const delay = setTimeout(() => {
      setShowCta(true);
      const hide = setTimeout(() => setShowCta(false), 8000);
      safeLocalStorage.setItem("cta_seen", "1");
      return () => clearTimeout(hide);
    }, 2500);
    return () => clearTimeout(delay);
  }, [ctaMessage, isOpen, showProactiveBubble]);

  useEffect(() => {
    if (mode === "iframe" && entityToken) {
      safeLocalStorage.setItem("entityToken", entityToken);
    } else if (mode === "iframe" && !entityToken) {
      safeLocalStorage.removeItem("entityToken");
    }
  }, [mode, entityToken]);

  useEffect(() => {
    async function fetchEntityProfile() {
      if (!entityToken) return;
      try {
        const data = await apiFetch<any>("/perfil", {
          sendEntityToken: true,
          skipAuth: true,
        });
        if (data && typeof data.esPublico === "boolean") {
          setResolvedTipoChat(data.esPublico ? "municipio" : "pyme");
        } else if (data && data.tipo_chat) {
          setResolvedTipoChat(data.tipo_chat === "municipio" ? "municipio" : "pyme");
        }
        setEntityInfo(data);
      } catch (e) { /* Silenciar */ }
    }
    fetchEntityProfile();
  }, [entityToken]);


  const panelAnimation = {
    initial: { opacity: 0, scale: 0.90, y: 30 },
    animate: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 0.90, y: 20 },
    transition: { type: "spring", stiffness: 300, damping: 25, duration: 0.2 }
  };
  
  const buttonAnimation = {
    initial: { opacity: 0, scale: 0.85, rotate: -15 },
    animate: { opacity: 1, scale: [1, 1.04, 1], rotate: 0 }, // Pulso añadido aquí
    exit: { opacity: 0, scale: 0.85, rotate: 15 },
    transition: {
      default: { type: "spring", stiffness: 350, damping: 20 },
      scale: { // Transición específica para la animación de pulso
        duration: 2,
        repeat: Infinity,
        ease: "easeInOut",
        delay: 2, // Retraso antes de que el pulso comience
        repeatDelay: 4 // Tiempo entre cada pulso
      }
    }
  };


  if (mode === "standalone") {
    return (
      <div
        className={cn("chatboc-container-standalone fixed z-[999999]")}
        style={{
          bottom: isOpen && isMobile ? 0 : `calc(${initialPosition.bottom}px + env(safe-area-inset-bottom))`,
          right: isOpen && isMobile ? 0 : `calc(${initialPosition.right}px + env(safe-area-inset-right))`,
          left: isOpen && isMobile ? 0 : "auto",
          top: isOpen && isMobile ? "env(safe-area-inset-top)" : "auto",
          width: isOpen ? (isMobile ? "100vw" : finalOpenWidth) : finalClosedWidth,
          height: isOpen ? (isMobile ? "calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom))" : finalOpenHeight) : finalClosedHeight,
          minWidth: isOpen ? "320px" : finalClosedWidth,
          minHeight: isOpen ? "64px" : finalClosedHeight,
          maxWidth: "100vw",
          maxHeight: "calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom))",
          borderRadius: isOpen ? (isMobile ? "0" : "16px") : "50%",
          overflow: isOpen ? "hidden" : "visible", // Visible para ProactiveBubble
          boxShadow: "0 8px 32px 0 rgba(0,0,0,0.20)",
          background: isOpen ? "transparent" : "var(--primary, #2563eb)", // El botón tiene fondo primario
          transition: "all 0.25s cubic-bezier(.42,0,.58,1)", // Transición CSS de widget.js
          padding: 0,
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "flex-end",
        }}
      >
        <Suspense fallback={null}>
          <AnimatePresence mode="popLayout">
            {isOpen ? (
              <motion.div
                key="chatboc-panel-standalone"
                className={cn(commonPanelStyles, "w-full h-full")}
                style={{ borderRadius: isMobile ? "0" : "16px", background: "hsl(var(--card))" }}
                {...panelAnimation}
              >
                {/* ... Vistas internas (login, register, chatpanel etc) ... */}
                {(view === "register" || view === "login" || view === "user" || view === "info") && (
                  <ChatHeader onClose={toggleChat} onBack={() => setView("chat")} showProfile={false} muted={muted} onToggleSound={toggleMuted} onCart={openCart} />
                )}
                {view === "register" ? <ChatUserRegisterPanel onSuccess={() => setView("chat")} onShowLogin={() => setView("login")} />
                  : view === "login" ? <ChatUserLoginPanel onSuccess={() => setView("chat")} onShowRegister={() => setView("register")} />
                  : view === "user" ? <ChatUserPanel onClose={() => setView("chat")} />
                  : view === "info" ? <EntityInfoPanel info={entityInfo} onClose={() => setView("chat")} />
                  : <ChatPanel mode={mode} widgetId={widgetId} entityToken={entityToken} initialRubro={initialRubro} openWidth={finalOpenWidth} openHeight={finalOpenHeight} onClose={toggleChat} tipoChat={resolvedTipoChat} onRequireAuth={() => setView("register")} onShowLogin={() => setView("login")} onShowRegister={() => setView("register")} onOpenUserPanel={openUserPanel} muted={muted} onToggleSound={toggleMuted} onCart={openCart} />}
              </motion.div>
            ) : (
              // Contenedor para el botón y la burbuja proactiva
<<<<<<< feat/widget-ux-animations-phase1
              <div key="chatboc-closed-widget-standalone" className="relative w-full h-full">
=======
              <div key="chatboc-closed-widget-standalone" className="relative w-full h-full"> 
>>>>>>> main
                <ProactiveBubble
                  message={proactiveMessage || ""}
                  onClick={toggleChat}
                  visible={showProactiveBubble && !showCta} // No mostrar si el CTA original está activo
                />
                {/* CTA Original (si ctaMessage existe y no hay burbuja proactiva) */}
                {showCta && ctaMessage && !showProactiveBubble && (
                  <motion.div
                    key="chatboc-cta-standalone"
                    className="absolute right-0 text-sm bg-background border rounded-lg shadow-lg px-3 py-2"
                    style={{ bottom: "calc(100% + 8px)" }} // Posicionado arriba del botón
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ duration: 0.3 }}
                  >
                    {ctaMessage}
                  </motion.div>
                )}
                <motion.button
                  key="chatboc-btn-standalone"
                  className={cn(commonButtonStyles, "w-[96px] h-[96px] absolute bottom-0 right-0 border-none shadow-xl")}
                  style={{ borderRadius: "50%", background: "var(--primary, #2563eb)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 24px 0 rgba(0,0,0,0.15)"}}
                  {...buttonAnimation}
                  whileHover={{ scale: 1.1, transition: { type: "spring", stiffness: 400, damping: 15 } }}
                  whileTap={{ scale: 0.95 }}
                  onClick={toggleChat}
                  aria-label="Abrir chat"
                >
                  <motion.span /* Animación del logo interno */ animate={{ y: [0, -7, 0], rotate: [0, 8, -8, 0] }} transition={{ repeat: Infinity, duration: 1.2, repeatDelay: 3.5, ease: "easeInOut" } } >
                    <ChatbocLogoAnimated size={isMobile ? 42 : 62} blinking floating pulsing />
                  </motion.span>
                </motion.button>
              </div>
            )}
          </AnimatePresence>
        </Suspense>
      </div>
    );
  }

  // Modo IFRAME / SCRIPT
  return (
    <div className={cn("fixed bottom-0 right-0", "flex flex-col items-end justify-end")} style={{ overflow: "visible" }}>
      <Suspense fallback={null}>
        <AnimatePresence mode="popLayout">
          {isOpen ? (
            <motion.div
              key="chatboc-panel-iframe"
              className={cn(commonPanelStyles, commonPanelAndButtonAbsoluteClasses)}
              style={{
                width: isMobile ? "100vw" : finalOpenWidth,
                height: isMobile ? "calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom))" : finalOpenHeight,
                borderRadius: isMobile ? "0" : "16px",
                background: "hsl(var(--card))",
                opacity: 1, zIndex: 10, boxShadow: "0 12px 40px 0 rgba(0,0,0,0.18)",
              }}
              {...panelAnimation}
            >
              {/* ... Vistas internas (login, register, chatpanel etc) ... */}
              {(view === "register" || view === "login" || view === "user" || view === "info") && (
                <ChatHeader onClose={toggleChat} onBack={() => setView("chat")} showProfile={false} muted={muted} onToggleSound={toggleMuted} onCart={openCart} />
              )}
              {view === "register" ? <ChatUserRegisterPanel onSuccess={() => setView("chat")} onShowLogin={() => setView("login")} />
                : view === "login" ? <ChatUserLoginPanel onSuccess={() => setView("chat")} onShowRegister={() => setView("register")} />
                : view === "user" ? <ChatUserPanel onClose={() => setView("chat")} />
                : view === "info" ? <EntityInfoPanel info={entityInfo} onClose={() => setView("chat")} />
                : <ChatPanel mode={mode} widgetId={widgetId} entityToken={entityToken} initialRubro={initialRubro} openWidth={finalOpenWidth} openHeight={finalOpenHeight} onClose={toggleChat} tipoChat={resolvedTipoChat} onRequireAuth={() => setView("register")} onShowLogin={() => setView("login")} onShowRegister={() => setView("register")} onOpenUserPanel={openUserPanel} muted={muted} onToggleSound={toggleMuted} onCart={openCart} />}
            </motion.div>
          ) : (
            // Contenedor para el botón y la burbuja proactiva
             <div key="chatboc-closed-widget-iframe" className="relative w-full h-full">
                <ProactiveBubble
                  message={proactiveMessage || ""}
                  onClick={toggleChat}
                  visible={showProactiveBubble && !showCta}
                />
                {/* CTA Original (si ctaMessage existe y no hay burbuja proactiva) */}
                {showCta && ctaMessage && !showProactiveBubble && (
                  <motion.div
                    key="chatboc-cta-iframe"
                    className="absolute right-0 text-sm bg-background border rounded-lg shadow-lg px-3 py-2"
                    style={{ bottom: "calc(100% + 8px)" }}
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ duration: 0.3 }}
                  >
                    {ctaMessage}
                  </motion.div>
                )}
                <motion.button
                  key="chatboc-btn-iframe"
                  className={cn(commonButtonStyles, commonPanelAndButtonAbsoluteClasses, "w-[96px] h-[96px] border-none shadow-xl")}
                  style={{ borderRadius: "50%", background: "var(--primary, #2563eb)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 20 }}
                  {...buttonAnimation}
                  whileHover={{ scale: 1.1, transition: { type: "spring", stiffness: 400, damping: 15 } }}
                  whileTap={{ scale: 0.95 }}
                  onClick={toggleChat}
                  aria-label="Abrir chat"
                >
                   <motion.span animate={{ y: [0, -7, 0], rotate: [0, 8, -8, 0] }} transition={{ repeat: Infinity, duration: 1.2, repeatDelay: 3.5, ease: "easeInOut" } } >
                    <ChatbocLogoAnimated size={62} blinking floating pulsing />
                  </motion.span>
                </motion.button>
              </div>
          )}
        </AnimatePresence>
      </Suspense>
    </div>
  );
}

export default ChatWidget;

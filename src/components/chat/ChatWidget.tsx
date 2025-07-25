import React, { useState, useEffect, useCallback, Suspense } from "react";
import ChatbocLogoAnimated from "./ChatbocLogoAnimated";
import { getCurrentTipoChat } from "@/utils/tipoChat";
import { cn } from "@/lib/utils";
import { safeLocalStorage } from "@/utils/safeLocalStorage";
import { motion, AnimatePresence } from "framer-motion";
import { useUser } from "@/hooks/useUser";
import { apiFetch } from "@/utils/api";
import { playOpenSound, playProactiveSound } from "@/utils/sounds";
import ProactiveBubble from "./ProactiveBubble";
import ChatUserRegisterPanel from "./ChatUserRegisterPanel";
import ChatUserLoginPanel from "./ChatUserLoginPanel";
import ChatUserPanel from "./ChatUserPanel";
import ChatHeader from "./ChatHeader";
import EntityInfoPanel from "./EntityInfoPanel";
import { Skeleton } from "@/components/ui/skeleton";

const ChatWidget = ({ primaryColor = '#007bff', logoUrl = '', position = 'right', user }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chatBodyRef = useRef(null);

  useEffect(() => {
    const channel = pusher.subscribe('chat');

const PROACTIVE_MESSAGES = [
  "¿Necesitas ayuda para encontrar algo?",
  "¡Hola! Estoy aquí para asistirte.",
  "¿Tienes alguna consulta? ¡Pregúntame!",
  "Explora nuestros servicios, ¡te ayudo!",
];

    channel.bind('typing', () => {
      setIsTyping(true);
    });

    channel.bind('stop-typing', () => {
      setIsTyping(false);
    });

    if (chatBodyRef.current) {
      chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
    }

    return () => {
      pusher.unsubscribe('chat');
    };
  }, [messages]);

  useEffect(() => {
    if (isOpen || mode === 'standalone') {
      if (proactiveMessageTimeout) clearTimeout(proactiveMessageTimeout);
      if (hideProactiveBubbleTimeout) clearTimeout(hideProactiveBubbleTimeout);
      setShowProactiveBubble(false);
      return;
    }
    if (proactiveMessageTimeout) clearTimeout(proactiveMessageTimeout);
    if (hideProactiveBubbleTimeout) clearTimeout(hideProactiveBubbleTimeout);

  const handleInputChange = (e) => {
    setInputValue(e.target.value);
    pusher.trigger('chat', 'typing', { user });
  };

  const handleInputBlur = () => {
    pusher.trigger('chat', 'stop-typing', { user });
  };

  const handleSendMessage = () => {
    if (inputValue.trim() === '') return;
    const newMessage = {
      text: inputValue,
      sender: 'user',
      timestamp: new Date(),
    };
    setMessages([...messages, newMessage]);
    setInputValue('');
  };

  const handleSendLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        const { latitude, longitude } = position.coords;
        const newMessage = {
          text: `Mi ubicación: ${latitude}, ${longitude}`,
          sender: 'user',
          timestamp: new Date(),
        };
        setMessages([...messages, newMessage]);
      });
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

  const openSpring = { type: "spring", stiffness: 280, damping: 28 };
  const closeSpring = { type: "spring", stiffness: 300, damping: 30 };

  const panelAnimation = {
    initial: { opacity: 0, y: 50, scale: 0.9, borderRadius: "50%" },
    animate: {
      opacity: 1,
      y: 0,
      scale: 1,
      borderRadius: isMobileView ? "0px" : "16px",
      transition: { type: "tween", duration: 0.4, ease: "easeOut" }
    },
    exit: {
      opacity: 0,
      y: 50,
      scale: 0.9,
      borderRadius: "50%",
      transition: { type: "tween", duration: 0.3, ease: "easeIn" }
    }
  };

  const buttonAnimation = {
    initial: { opacity: 0, scale: 0.7, rotate: 0 },
    animate: {
      opacity: 1,
      scale: 1,
      rotate: 0,
      transition: { ...openSpring, delay: 0.1 }
    },
    exit: {
      opacity: 0,
      scale: 0.8,
      rotate: 30,
      transition: { ...closeSpring, duration: 0.15 }
    },
  };

  return (
    <div className="fixed bottom-5 z-50" style={widgetStyle}>
      <div
        className={`chat-widget-launcher w-16 h-16 rounded-full flex items-center justify-center cursor-pointer shadow-lg transform transition-transform duration-300 ${isOpen ? 'scale-0' : 'scale-100'}`}
        onClick={togglePanel}
        style={launcherStyle}
      >
        {logoUrl ? (
          <img src={logoUrl} alt="logo" className="w-10 h-10 rounded-full" />
        ) : (
          <svg className="w-8 h-8 text-white" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
        )}
      </div>
      <div className={`chat-widget-panel w-96 h-[600px] bg-white rounded-lg shadow-xl flex flex-col transform transition-transform duration-300 ${isOpen ? 'scale-100' : 'scale-0'}`}>
        <div className="chat-widget-header p-4 bg-gray-100 rounded-t-lg flex justify-between items-center" style={{ backgroundColor: primaryColor, color: 'white' }}>
          <h2 className="text-lg font-semibold">Chatboc</h2>
          <button onClick={togglePanel}>
            <svg className="w-6 h-6 text-white" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        <div ref={chatBodyRef} className="chat-widget-body flex-grow p-4 overflow-y-auto">
          {messages.map((message, index) => (
            <div key={index} className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'} mb-2`}>
              <div className={`p-2 rounded-lg ${message.sender === 'user' ? 'text-white' : 'bg-gray-200'}`} style={{ backgroundColor: message.sender === 'user' ? primaryColor : '#f3f4f6' }}>
                {message.text}
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex justify-start mb-2">
              <div className="p-2 rounded-lg bg-gray-200">
                ...
              </div>
            </div>
          )}
        </div>
        <div className="chat-widget-footer p-4 bg-gray-100 rounded-b-lg">
          <div className="flex items-center">
            <input
              className="w-full p-2 border border-gray-300 rounded-lg"
              type="text"
              placeholder="Escribe un mensaje..."
              value={inputValue}
              onChange={handleInputChange}
              onBlur={handleInputBlur}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            />
            <button className="p-2 text-gray-600 hover:text-blue-600">
              <Paperclip />
            </button>
            <button className="p-2 text-gray-600 hover:text-blue-600">
              <Mic />
            </button>
            <button onClick={handleSendLocation} className="p-2 text-gray-600 hover:text-blue-600">
              <MapPin />
            </button>
            <button onClick={handleSendMessage} className="p-2 text-white rounded-full ml-2" style={{ backgroundColor: primaryColor }}>
              <Send />
            </button>
          </div>
        </div>
      }>
        <AnimatePresence mode="wait" initial={false}>
          {isOpen ? (
            <motion.div
              key="chatboc-panel-open"
              className={cn(commonPanelStyles, commonPanelAndButtonAbsoluteClasses, "shadow-xl")}
              style={{
                width: isMobileView ? "100vw" : finalOpenWidth,
                height: isMobileView ? "calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom))" : finalOpenHeight,
                borderRadius: isMobileView ? "0" : "16px",
                background: "hsl(var(--card))",
              }}
              {...panelAnimation}
            >
              {(view === "register" || view === "login" || view === "user" || view === "info") && (
                <ChatHeader onClose={toggleChat} onBack={() => setView("chat")} showProfile={false} muted={muted} onToggleSound={toggleMuted} onCart={openCart} />
              )}
              {view === "register" ? <ChatUserRegisterPanel onSuccess={() => setView("chat")} onShowLogin={() => setView("login")} entityToken={entityToken} />
                : view === "login" ? <ChatUserLoginPanel onSuccess={() => setView("chat")} onShowRegister={() => setView("register")} />
                : view === "user" ? <ChatUserPanel onClose={() => setView("chat")} />
                : view === "info" ? <EntityInfoPanel info={entityInfo} onClose={() => setView("chat")} />
                : <ChatPanel mode={mode} widgetId={widgetId} entityToken={entityToken} initialRubro={initialRubro} openWidth={finalOpenWidth} openHeight={finalOpenHeight} onClose={toggleChat} tipoChat={resolvedTipoChat} onRequireAuth={() => setView("register")} onShowLogin={() => setView("login")} onShowRegister={() => setView("register")} onOpenUserPanel={openUserPanel} muted={muted} onToggleSound={toggleMuted} onCart={openCart} />}
            </motion.div>
          ) : (
            <motion.div
              key="chatboc-panel-closed"
              className={cn("relative", commonPanelAndButtonAbsoluteClasses)}
              style={{
                width: finalClosedWidth,
                height: finalClosedHeight,
              }}
            >
              <ProactiveBubble
                message={proactiveMessage || ""}
                onClick={toggleChat}
                visible={showProactiveBubble && !showCta}
              />
              {showCta && ctaMessage && !showProactiveBubble && (
                <motion.div
                  key="chatboc-cta"
                  className="absolute right-0 text-sm bg-background border rounded-lg shadow-lg px-3 py-2 dark:bg-slate-800 dark:border-slate-700"
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
                key="chatboc-toggle-btn"
                className={cn(
                  commonButtonStyles,
                  commonPanelAndButtonAbsoluteClasses,
                  "border-none shadow-xl"
                )}
                style={{
                  width: finalClosedWidth,
                  height: finalClosedHeight,
                  borderRadius: "50%",
                  background: "var(--primary, #2563eb)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
zIndex: 20
                }}
                {...buttonAnimation}
                whileHover={{ scale: 1.1, transition: { type: "spring", stiffness: 400, damping: 15 } }}
                whileTap={{ scale: 0.95 }}
                onClick={toggleChat}
                aria-label="Abrir chat"
              >
                <motion.div
                  variants={iconAnimation}
                  animate={isOpen ? "open" : "closed"}
                  transition={isOpen ? closeSpring : openSpring}
                >
                  <ChatbocLogoAnimated
                    size={calculatedLogoSize}
                    blinking={!isOpen && !showProactiveBubble && !showCta}
                    floating={!isOpen && !showProactiveBubble && !showCta}
                    pulsing={!isOpen && !showProactiveBubble && !showCta}
                  />
                </motion.div>
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </Suspense>
    </div>
  );
}

export default ChatWidget;

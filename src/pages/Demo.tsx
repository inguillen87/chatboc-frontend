import React, { useState, useEffect, useRef, useCallback } from "react";
import { safeLocalStorage } from "@/utils/safeLocalStorage";
import { AnimatePresence, motion } from "framer-motion";
import ChatInput from "@/components/chat/ChatInput";
import TypingIndicator from "@/components/chat/TypingIndicator";
import ChatMessage from "@/components/chat/ChatMessage";
import { Message } from "@/types/chat";
import { apiFetch } from "@/utils/api";
import { getCurrentTipoChat, enforceTipoChatForRubro, parseRubro } from "@/utils/tipoChat";
import { getAskEndpoint, esRubroPublico } from "@/utils/chatEndpoints";
import { parseChatResponse } from "@/utils/parseChatResponse";

function getOrCreateAnonId() {
  if (typeof window === "undefined") return "";
  try {
    let anon = safeLocalStorage.getItem("anon_id");
    if (!anon) {
      anon =
        window.crypto?.randomUUID?.() ||
        `anon-${Math.random().toString(36).slice(2, 9)}-${Date.now()}`;
      safeLocalStorage.setItem("anon_id", anon);
    }
    return anon;
  } catch {
    return `anon-${Math.random().toString(36).slice(2, 9)}-${Date.now()}`;
  }
}

const Demo = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [preguntasUsadas, setPreguntasUsadas] = useState(0);
  const [rubroSeleccionado, setRubroSeleccionado] = useState<string | null>(() => {
    return typeof window !== "undefined" ? safeLocalStorage.getItem("rubroSeleccionado") : null;
  });
  const [rubrosDisponibles, setRubrosDisponibles] = useState<{ id: number; nombre: string }[]>([]);
  const [esperandoRubro, setEsperandoRubro] = useState(!rubroSeleccionado);
  const [anonId, setAnonId] = useState<string>("");
  const [contexto, setContexto] = useState({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const rubroNormalizado = parseRubro(rubroSeleccionado);
  const isMunicipioRubro = esRubroPublico(rubroNormalizado || undefined);

  useEffect(() => {
    setAnonId(getOrCreateAnonId());
  }, []);

  useEffect(() => {
    if (!rubroSeleccionado) {
      setEsperandoRubro(true);
      apiFetch<any[]>("/rubros/", { skipAuth: true })
        .then((data) => setRubrosDisponibles(Array.isArray(data) ? data : []))
        .catch(() => setRubrosDisponibles([]));
    } else if (messages.length === 0) {
      setMessages([{ id: Date.now(), text: `¡Hola! Soy Chatboc, tu asistente para ${rubroSeleccionado.toLowerCase()}. ¿En qué puedo ayudarte hoy?`, isBot: true, timestamp: new Date() }]);
      setEsperandoRubro(false);
    }
  }, [rubroSeleccionado, messages.length]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const handleSendMessage = useCallback(async (text: string) => {
    if (!text.trim() || !rubroSeleccionado) return;
    if (preguntasUsadas >= 15) {
      setMessages((prev) => [...prev, { id: Date.now(), text: `🔒 Límite de 15 preguntas en la demo alcanzado.`, isBot: true, timestamp: new Date() }]);
      return;
    }

    const userMessage: Message = { id: Date.now(), text, isBot: false, timestamp: new Date() };
    setMessages(prev => [...prev, userMessage]);
    setIsTyping(true);

    try {
      const currentTipo = getCurrentTipoChat();
      const adjustedTipo = enforceTipoChatForRubro(currentTipo, rubroSeleccionado);
      const payload = {
        pregunta: text,
        rubro_clave: rubroSeleccionado,
        contexto_previo: contexto,
        anon_id: anonId,
        tipo_chat: adjustedTipo,
      };

      const endpoint = getAskEndpoint({ tipoChat: adjustedTipo, rubro: rubroNormalizado || undefined });
      const esPublico = isMunicipioRubro;
      const response = await apiFetch<any>(endpoint, {
        method: 'POST',
        body: payload,
        headers: { 'Content-Type': 'application/json' },
        skipAuth: true,
      });

      setContexto(response.contexto_actualizado || {});
      const { text: respuestaText, botones } = parseChatResponse(response);
      const botMessage: Message = {
        id: Date.now(),
        text: respuestaText || "⚠️ No se pudo generar una respuesta.",
        isBot: true,
        timestamp: new Date(),
        botones,
      };

      setMessages((prev) => [...prev, botMessage]);
      setPreguntasUsadas((prev) => prev + 1);
    } catch (error: any) {
      let errorMsg = "⚠️ No se pudo conectar con el servidor.";
      if (error?.body?.error) {
        errorMsg = error.body.error;
      } else if (error?.message) {
        errorMsg = error.message;
      }
      const errorMessage: Message = { id: Date.now(), text: errorMsg, isBot: true, timestamp: new Date() };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  }, [contexto, rubroSeleccionado, anonId, preguntasUsadas]);

  // ESCUCHA PARA BOTONES EXTERNOS (por si usás custom events, opcional)
  useEffect(() => {
    const handleButtonSendMessage = (event: Event) => {
      const customEvent = event as CustomEvent<string>;
      if (customEvent.detail) {
        handleSendMessage(customEvent.detail);
      }
    };
    window.addEventListener('sendChatMessage', handleButtonSendMessage);
    return () => {
      window.removeEventListener('sendChatMessage', handleButtonSendMessage);
    };
  }, [handleSendMessage]);

  if (esperandoRubro) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center bg-background dark:bg-gradient-to-b dark:from-[#10141b] dark:to-[#181d24] text-foreground">
        <div className="w-full max-w-md p-6 rounded-3xl shadow-2xl border bg-card dark:bg-[#181d24]">
          <h2 className="text-2xl font-bold mb-3 text-primary">👋 ¡Bienvenido a Chatboc!</h2>
          <p className="mb-4 text-sm text-center text-muted-foreground">
            Para darte una mejor experiencia, contanos a qué rubro pertenece tu negocio:
          </p>
          <div className="flex flex-wrap justify-center gap-2 mt-3">
            {rubrosDisponibles.map((rubro) => (
              <button
                key={rubro.id}
                onClick={() => {
                  safeLocalStorage.setItem("rubroSeleccionado", rubro.nombre);
                  setRubroSeleccionado(rubro.nombre);
                  setEsperandoRubro(false);
                  setMessages([{ id: Date.now(), text: `¡Hola! Soy Chatboc, tu asistente para ${rubro.nombre.toLowerCase()}. ¿En qué puedo ayudarte hoy?`, isBot: true, timestamp: new Date() }]);
                }}
                className="px-5 py-3 rounded-full font-semibold text-base bg-primary text-primary-foreground hover:bg-primary/90 shadow-md focus:outline-none transition-all"
              >
                {rubro.nombre}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto bg-card dark:bg-[#1e1e1e] rounded-3xl shadow-2xl border border-border dark:border-gray-700 flex flex-col h-[90vh] sm:h-[84vh] mt-6 overflow-hidden relative">
      <div className="bg-primary text-primary-foreground py-3 px-4 flex items-center justify-between shadow-lg sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <img src="/chatboc_widget_white_outline.webp" alt="Chatboc" className="w-7 h-7" />
          <span className="font-semibold text-base sm:text-lg tracking-tight">Chatboc · Demo Gratuita</span>
        </div>
        <span className="hidden sm:inline-block text-xs opacity-70 text-primary-foreground/70">{rubroSeleccionado}</span>
      </div>
      <div className="flex-1 overflow-y-auto px-2 sm:px-5 py-5 bg-background dark:bg-gradient-to-b dark:from-[#1b2532] dark:to-[#242b33] transition-colors space-y-3 custom-scroll">
        <AnimatePresence>
          {messages.map((msg) => (
            <motion.div key={msg.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 14 }} transition={{ duration: 0.18 }}>
              <ChatMessage
                message={msg}
                isTyping={isTyping}
                onButtonClick={handleSendMessage}
                tipoChat={isMunicipioRubro ? "municipio" : "pyme"}
              />
            </motion.div>
          ))}
        </AnimatePresence>
        {isTyping && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>
      <div className="border-t border-border p-2 bg-card sticky bottom-0 z-10">
        <ChatInput onSendMessage={handleSendMessage} isTyping={isTyping} />
      </div>
    </div>
  );
};

export default Demo;

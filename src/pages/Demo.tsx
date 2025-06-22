import React, { useState, useEffect, useRef, useCallback } from "react";
import { safeLocalStorage } from "@/utils/safeLocalStorage";
import getOrCreateAnonId from "@/utils/anonId";
import { AnimatePresence, motion } from "framer-motion";
import ChatInput from "@/components/chat/ChatInput";
import TypingIndicator from "@/components/chat/TypingIndicator";
import ChatMessage from "@/components/chat/ChatMessage";
import { Message } from "@/types/chat";
import { apiFetch } from "@/utils/api";
import { getCurrentTipoChat, enforceTipoChatForRubro, parseRubro } from "@/utils/tipoChat";
import { getAskEndpoint, esRubroPublico } from "@/utils/chatEndpoints";
import { parseChatResponse } from "@/utils/parseChatResponse";

const MAX_PREGUNTAS = 15;

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
  const lastQueryRef = useRef<string | null>(null);

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
      setMessages([
        {
          id: Date.now(),
          text: `¡Hola! Soy Chatboc, tu asistente para ${rubroSeleccionado.toLowerCase()}. ¿En qué puedo ayudarte hoy?`,
          isBot: true,
          timestamp: new Date(),
          query: undefined,
        },
      ]);
      setEsperandoRubro(false);
    }
  }, [rubroSeleccionado, messages.length]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const handleSendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || !rubroSeleccionado) return;
      if (preguntasUsadas >= MAX_PREGUNTAS) {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now(),
            text:
              "🔒 Límite de 15 preguntas en la demo alcanzado.<br><span class='block mt-2'><a href='/register' class='underline text-primary hover:text-primary/80'>Registrate para usar Chatboc sin límites</a> o <a href='https://wa.me/5492613168608?text=Hola! Estoy probando Chatboc y quiero implementarlo en mi empresa.' class='underline text-primary hover:text-primary/80' target='_blank'>contactanos</a> para planes comerciales.</span>",
            isBot: true,
            timestamp: new Date(),
            query: undefined,
          },
        ]);
        return;
      }

      const userMessage: Message = {
        id: Date.now(),
        text,
        isBot: false,
        timestamp: new Date(),
        query: undefined,
      };
      setMessages((prev) => [...prev, userMessage]);
      lastQueryRef.current = text;
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

        const endpoint = getAskEndpoint({
          tipoChat: adjustedTipo,
          rubro: rubroNormalizado || undefined,
        });
        const response = await apiFetch<any>(endpoint, {
          method: "POST",
          body: payload,
          headers: { "Content-Type": "application/json" },
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
          query: lastQueryRef.current || undefined,
        };

        setMessages((prev) => [...prev, botMessage]);
        lastQueryRef.current = null;
        setPreguntasUsadas((prev) => prev + 1);
      } catch (error: any) {
        let errorMsg = "⚠️ No se pudo conectar con el servidor.";
        if (error?.body?.error) {
          errorMsg = error.body.error;
        } else if (error?.message) {
          errorMsg = error.message;
        }
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now(),
            text: errorMsg,
            isBot: true,
            timestamp: new Date(),
            query: undefined,
          },
        ]);
      } finally {
        setIsTyping(false);
      }
    },
    [contexto, rubroSeleccionado, anonId, preguntasUsadas]
  );

  // Rubros selector UI
  if (esperandoRubro) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center bg-background dark:bg-gradient-to-b dark:from-[#10141b] dark:to-[#181d24] text-foreground">
        <div className="w-full max-w-md p-7 rounded-3xl shadow-xl border border-border bg-card/90 dark:bg-[#191f2b]">
          <img
            src="/chatboc_logo_clean_transparent.png"
            alt="Chatboc"
            className="mx-auto w-14 h-14 mb-3"
            style={{ filter: "drop-shadow(0 4px 16px #1d69e0cc)" }}
            onError={(e) => {
              (e.target as HTMLImageElement).src = "/favicon/favicon-48x48.png";
            }}
          />
          <h2 className="text-2xl font-bold mb-2 text-primary">¡Bienvenido a Chatboc!</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Seleccioná el rubro que más se parece a tu negocio:
          </p>
          <div className="flex flex-wrap justify-center gap-3 mt-4">
            {rubrosDisponibles.map((rubro) => (
              <button
                key={rubro.id}
                onClick={() => {
                  safeLocalStorage.setItem("rubroSeleccionado", rubro.nombre);
                  setRubroSeleccionado(rubro.nombre);
                  setEsperandoRubro(false);
                  setMessages([
                    {
                      id: Date.now(),
                      text: `¡Hola! Soy Chatboc, tu asistente para ${rubro.nombre.toLowerCase()}. ¿En qué puedo ayudarte hoy?`,
                      isBot: true,
                      timestamp: new Date(),
                    },
                  ]);
                }}
                className="px-5 py-3 rounded-2xl font-semibold text-base bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg focus:outline-none transition-all"
                style={{ minWidth: 120 }}
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
    <div className="w-full max-w-2xl mx-auto bg-card/95 dark:bg-[#1e1e1e]/90 rounded-3xl shadow-2xl border border-border dark:border-gray-700 flex flex-col h-[90vh] sm:h-[84vh] mt-6 overflow-hidden relative">
      {/* HEADER */}
      <div className="bg-primary text-primary-foreground py-3 px-4 flex items-center justify-between shadow sticky top-0 z-10 rounded-t-3xl">
        <div className="flex items-center gap-3">
          <img
            src="/chatboc_logo_clean_transparent.png"
            alt="Chatboc"
            className="w-8 h-8 rounded-full"
            style={{ background: "#2462a6" }}
            onError={(e) => {
              (e.target as HTMLImageElement).src = "/favicon/favicon-48x48.png";
            }}
          />
          <span className="font-semibold text-lg tracking-tight">
            Chatboc <span className="text-primary-foreground/70">· Demo Gratuita</span>
          </span>
        </div>
        <span className="hidden sm:inline-block text-xs opacity-70 text-primary-foreground/70">
          {rubroSeleccionado}
        </span>
      </div>
      {/* MENSAJES */}
      <div className="flex-1 overflow-y-auto px-2 sm:px-5 py-5 bg-background dark:bg-gradient-to-b dark:from-[#1b2532] dark:to-[#242b33] transition-colors space-y-3 custom-scroll">
        <AnimatePresence>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 18 }}
              transition={{ duration: 0.20 }}
            >
              <ChatMessage
                message={msg}
                isTyping={isTyping}
                onButtonClick={handleSendMessage}
                tipoChat={isMunicipioRubro ? "municipio" : "pyme"}
                query={msg.query}
              />
            </motion.div>
          ))}
        </AnimatePresence>
        {isTyping && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>
      {/* INPUT */}
      <div className="border-t border-border p-3 bg-card/95 sticky bottom-0 z-20">
        <ChatInput onSendMessage={handleSendMessage} isTyping={isTyping} />
      </div>
      {/* PIE/CTA */}
      <div className="text-center text-xs text-muted-foreground py-2 bg-transparent font-medium">
        Chatboc &copy; {new Date().getFullYear()} &mdash; Versión Demo
      </div>
    </div>
  );
};

export default Demo;

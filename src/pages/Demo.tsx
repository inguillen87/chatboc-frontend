import React, { useState, useEffect, useRef, useCallback } from "react";
import { safeLocalStorage } from "@/utils/safeLocalStorage";
import getOrCreateAnonId from "@/utils/anonId";
import ChatInput from "@/components/chat/ChatInput";
import TypingIndicator from "@/components/chat/TypingIndicator";
import ChatMessage from "@/components/chat/ChatMessage";
import RubroSelector, { Rubro } from "@/components/chat/RubroSelector";
import { Message, SendPayload } from "@/types/chat";
import { apiFetch, getErrorMessage } from "@/utils/api";
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
  const [rubrosDisponibles, setRubrosDisponibles] = useState<Rubro[]>([]);
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

  const welcomeRef = useRef(false);

  useEffect(() => {
    if (!rubroSeleccionado) {
      setEsperandoRubro(true);
      apiFetch<any[]>("/rubros/", { skipAuth: true })
        .then((data) => setRubrosDisponibles(Array.isArray(data) ? data : []))
        .catch(() => setRubrosDisponibles([]));
    } else if (!welcomeRef.current && messages.length === 0) {
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
      welcomeRef.current = true;
    }
  }, [rubroSeleccionado]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const handleSendMessage = useCallback(
    async (payload: SendPayload | string) => {
      const text = typeof payload === "string" ? payload : payload.text;
      const extras = typeof payload === "string" ? {} : payload;
      if (!text.trim() && !extras.action && !extras.archivo_url && !extras.ubicacion_usuario) return;
      if (!rubroSeleccionado) return;
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
        mediaUrl: extras.es_foto ? extras.archivo_url : undefined,
        locationData: extras.es_ubicacion ? extras.ubicacion_usuario : undefined,
      };
      setMessages((prev) => [...prev, userMessage]);
      lastQueryRef.current = text;
      setIsTyping(true);

      try {
        const currentTipo = getCurrentTipoChat();
        const adjustedTipo = enforceTipoChatForRubro(currentTipo, rubroSeleccionado);
        const payloadBody: Record<string, any> = {
          pregunta: text,
          rubro_clave: rubroSeleccionado,
          contexto_previo: contexto,
          anon_id: anonId,
          tipo_chat: adjustedTipo,
          ...(extras.es_foto && { es_foto: true, archivo_url: extras.archivo_url }),
          ...(extras.es_ubicacion && { es_ubicacion: true, ubicacion_usuario: extras.ubicacion_usuario }),
          ...(extras.action && { action: extras.action }),
        };

        const endpoint = getAskEndpoint({
          tipoChat: adjustedTipo,
          rubro: rubroNormalizado || undefined,
        });
        const response = await apiFetch<any>(endpoint, {
          method: "POST",
          body: payloadBody,
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
        const errorMsg = getErrorMessage(
          error,
          '⚠️ No se pudo conectar con el servidor.'
        );
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
    [contexto, rubroSeleccionado, anonId, preguntasUsadas, rubroNormalizado]
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
          <RubroSelector
            rubros={rubrosDisponibles}
            onSelect={(rubro) => {
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
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center w-full min-h-screen bg-gradient-to-br from-[#0d223a] to-[#151a26] text-foreground">
      {/* HEADER */}
      <div className="w-full max-w-lg mx-auto py-3 px-4 flex items-center justify-between shadow sticky top-0 z-10">
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
      <div className="w-full max-w-lg flex flex-col flex-1 px-2 sm:px-5 py-5 space-y-3 overflow-y-auto custom-scroll">
        {messages.map((msg) => (
          <ChatMessage
            key={msg.id}
            message={msg}
            isTyping={isTyping}
            onButtonClick={handleSendMessage}
            tipoChat={isMunicipioRubro ? "municipio" : "pyme"}
            query={msg.query}
          />
        ))}
        {isTyping && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>
      {/* INPUT */}
      <div className="border-t border-border p-3 bg-transparent sticky bottom-0 z-20">
        <ChatInput
          onSendMessage={handleSendMessage}
          isTyping={isTyping}
        />
      </div>
      {/* PIE/CTA */}
      <div className="text-center text-xs text-muted-foreground py-2 bg-transparent font-medium">
        Chatboc &copy; {new Date().getFullYear()} &mdash; Versión Demo
      </div>
    </div>
  );
};

export default Demo;

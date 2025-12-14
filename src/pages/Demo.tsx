import React, { useState, useEffect, useRef, useCallback } from "react";
import { safeLocalStorage } from "@/utils/safeLocalStorage";
import { resetChatSessionId } from "@/utils/chatSessionId";
import getOrCreateAnonId from "@/utils/anonId";
import ChatInput from "@/components/chat/ChatInput";
import TypingIndicator from "@/components/chat/TypingIndicator";
import ChatMessage from "@/components/chat/ChatMessage";
import RubroSelector, { Rubro } from "@/components/chat/RubroSelector";
import { Message, SendPayload } from "@/types/chat";
import { apiFetch, getErrorMessage } from "@/utils/api";
import { getRubrosHierarchy } from "@/api/rubros";
import { getCurrentTipoChat, enforceTipoChatForRubro, parseRubro } from "@/utils/tipoChat";
import { getAskEndpoint, esRubroPublico } from "@/utils/chatEndpoints";
import { extractRubroKey, extractRubroLabel } from "@/utils/rubros";
import { extractButtonsFromResponse } from "@/utils/chatButtons";
import { ShoppingCart } from "lucide-react";

const MAX_PREGUNTAS = 15;

const Demo = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [preguntasUsadas, setPreguntasUsadas] = useState(0);
  const [rubroSeleccionado, setRubroSeleccionado] = useState<string | null>(null);
  const [rubroClaveSeleccionado, setRubroClaveSeleccionado] = useState<string | null>(null);
  const [rubrosDisponibles, setRubrosDisponibles] = useState<Rubro[]>([]);
  const [esperandoRubro, setEsperandoRubro] = useState(true); // Initialize to true
  const [anonId, setAnonId] = useState<string>("");
  const [contexto, setContexto] = useState({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastQueryRef = useRef<string | null>(null);

  const rubroClave = rubroClaveSeleccionado || extractRubroKey(rubroSeleccionado);
  const rubroNormalizado = parseRubro(rubroClave);
  const isMunicipioRubro = esRubroPublico(rubroNormalizado || undefined);

  // Actions like openCart, changeRubro
  const openCart = useCallback(() => {
    window.open('/cart', '_blank');
  }, []);

  const handleChangeRubro = () => {
    safeLocalStorage.removeItem("rubroSeleccionado");
    safeLocalStorage.removeItem("rubroSeleccionado_label");
    resetChatSessionId();
    setRubroSeleccionado(null);
    setRubroClaveSeleccionado(null);
    setEsperandoRubro(true);
    setMessages([]);
    setPreguntasUsadas(0);
    setContexto({});
    lastQueryRef.current = null;
    // The useEffect for loading rubros will trigger again due to rubroSeleccionado being null
    // or rather, we explicitly set esperandoRubro to true and then the rubro loading logic runs
    getRubrosHierarchy()
        .then((data) => setRubrosDisponibles(Array.isArray(data) ? data : []))
        .catch(() => {
          setRubrosDisponibles([]);
        });
  };


  const startDemoConversation = useCallback(
    async (rubroNombre: string) => {
      const normalized = parseRubro(rubroNombre);
      const baseTipo = getCurrentTipoChat();
      const adjustedTipo = enforceTipoChatForRubro(baseTipo, normalized);
      const endpoint = getAskEndpoint({ tipoChat: adjustedTipo, rubro: normalized || undefined });

      const currentAnonId = anonId || getOrCreateAnonId();
      if (!anonId) {
        setAnonId(currentAnonId);
      }

      setIsTyping(true);
      setMessages([]);
      setPreguntasUsadas(0);
      setContexto({});
      lastQueryRef.current = null;

      try {
        const response = await apiFetch<any>(endpoint, {
          method: "POST",
          body: {
            pregunta: "",
            action: "initial_greeting",
            contexto_previo: {},
            anon_id: currentAnonId,
            tipo_chat: adjustedTipo,
            ...(adjustedTipo === "pyme" && rubroNombre
              ? { rubro_clave: rubroNombre }
              : {}),
          },
          headers: { "Content-Type": "application/json" },
          skipAuth: true,
        });

        setContexto(response.contexto_actualizado || {});
        const respuestaText = response.respuesta_usuario || "⚠️ No se pudo generar una respuesta.";
        const botones = extractButtonsFromResponse(response);

        const botMessage: Message = {
          id: Date.now(),
          text: respuestaText,
          isBot: true,
          timestamp: new Date(),
          botones,
        };

        setMessages([botMessage]);
      } catch (error: any) {
        const errorMsg = getErrorMessage(error, "⚠️ No se pudo cargar el menú inicial.");
        setMessages([
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
    [anonId, setAnonId, setContexto, setIsTyping, setMessages, setPreguntasUsadas]
  );


  // Set Anon ID on mount
  useEffect(() => {
    setAnonId(getOrCreateAnonId());
  }, []);

  // Load rubros and handle initial welcome message
  useEffect(() => {
    const storedClave = safeLocalStorage.getItem("rubroSeleccionado");
    const storedLabel = safeLocalStorage.getItem("rubroSeleccionado_label");

    if (storedClave && !rubroClaveSeleccionado) {
      const normalizedClave = extractRubroKey(storedClave) ?? storedClave;
      setRubroClaveSeleccionado(normalizedClave);
      if (!rubroSeleccionado) {
        setRubroSeleccionado(storedLabel || storedClave);
      }
      setEsperandoRubro(false);
      void startDemoConversation(normalizedClave);
    } else if (!storedClave) {
      setEsperandoRubro(true);
      setMessages([]);
      getRubrosHierarchy()
        .then((data) => setRubrosDisponibles(Array.isArray(data) ? data : []))
        .catch(() => {
          setRubrosDisponibles([]);
        });
    }
  }, [rubroClaveSeleccionado, rubroSeleccionado, startDemoConversation]);

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
        const rubroParaTipo = rubroClave ?? rubroSeleccionado;
        const adjustedTipo = enforceTipoChatForRubro(currentTipo, rubroParaTipo);
        const payloadBody: Record<string, any> = {
          pregunta: text,
          rubro_clave: rubroClave ?? rubroSeleccionado,
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

        const respuestaText = response.respuesta_usuario || "⚠️ No se pudo generar una respuesta.";
        const botones = extractButtonsFromResponse(response);

        const botMessage: Message = {
          id: Date.now(),
          text: respuestaText,
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
              const clave = extractRubroKey(rubro);
              const etiqueta = extractRubroLabel(rubro) || rubro.nombre;

              if (!clave && !etiqueta) {
                console.warn('Demo: rubro recibido sin datos suficientes', rubro);
                return;
              }

              if (clave) {
                safeLocalStorage.setItem("rubroSeleccionado", clave);
              } else {
                safeLocalStorage.removeItem("rubroSeleccionado");
              }

              if (etiqueta) {
                safeLocalStorage.setItem("rubroSeleccionado_label", etiqueta);
              } else {
                safeLocalStorage.removeItem("rubroSeleccionado_label");
              }

              setRubroSeleccionado(etiqueta || clave || null);
              setRubroClaveSeleccionado(clave ?? null);
              setEsperandoRubro(false);
              void startDemoConversation(clave ?? etiqueta ?? rubro.nombre);
            }}
          />
        </div>
      </div>
    );
  }

  return (
    // Use background from index.css for consistency with theme light/dark
    <div className="flex flex-col items-center w-full min-h-screen bg-background text-foreground">
      {/* HEADER */}
      {/* Applying a more modern header style */}
      <header className="w-full bg-card/80 backdrop-blur-md shadow-sm sticky top-0 z-20 border-b border-border">
        <div className="max-w-3xl mx-auto py-3 px-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/chatboc_logo_clean_transparent.png" // Consider a theme-adaptive logo if possible
              alt="Chatboc"
              className="w-9 h-9 rounded-full p-0.5 bg-primary/20 dark:bg-primary/30 border border-primary/30"
              onError={(e) => { (e.target as HTMLImageElement).src = "/favicon/favicon-48x48.png"; }}
            />
            <span className="font-semibold text-xl tracking-tight text-foreground">
              Chatboc <span className="text-muted-foreground text-lg">· Demo</span>
            </span>
          </div>
          <div className="flex items-center gap-4">
            {rubroSeleccionado && (
              <button
                onClick={handleChangeRubro}
                className="text-xs sm:text-sm text-muted-foreground hover:text-primary transition-colors underline underline-offset-2"
                title="Cambiar Rubro"
              >
                Rubro: {rubroSeleccionado} (Cambiar)
              </button>
            )}
            {/* Removing Cart icon as it might not be relevant for all demos or could be confusing */}
            {/* <button
              onClick={openCart}
              aria-label="Ver carrito"
              className="text-muted-foreground hover:text-primary transition-colors"
            >
              <ShoppingCart size={22} />
            </button> */}
          </div>
        </div>
      </header>

      {/* CHAT AREA */}
      {/* Increased max-w for chat content area for better desktop view, maintains padding */}
      <main className="w-full max-w-3xl flex flex-col flex-1 px-4 sm:px-6 py-5 space-y-4 overflow-y-auto custom-scroll">
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
      </main>

      {/* INPUT AREA */}
      {/* Consistent padding and background, sticky to bottom */}
      <footer className="w-full bg-card/80 backdrop-blur-md border-t border-border p-3 sm:p-4 sticky bottom-0 z-10">
        <div className="max-w-3xl mx-auto">
          <ChatInput
            onSendMessage={handleSendMessage}
            isTyping={isTyping}
          />
           <p className="text-center text-xs text-muted-foreground pt-2">
            Chatboc Demo &copy; {new Date().getFullYear()}.
            {preguntasUsadas >= MAX_PREGUNTAS
              ? <span className="text-destructive-foreground"> Límite de mensajes alcanzado.</span>
              : ` ${MAX_PREGUNTAS - preguntasUsadas} mensajes restantes.`
            }
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Demo;

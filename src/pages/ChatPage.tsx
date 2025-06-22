import React, { useState, useEffect, useRef, useCallback } from "react";
import { Message } from "@/types/chat";
import ChatMessage from "@/components/chat/ChatMessage";
import { getCurrentTipoChat, enforceTipoChatForRubro, parseRubro as parseRubroUtil } from "@/utils/tipoChat";
import ChatInput from "@/components/chat/ChatInput";
import TypingIndicator from "@/components/chat/TypingIndicator";
import Navbar from "@/components/layout/Navbar";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch } from "@/utils/api";
import { getAskEndpoint, esRubroPublico } from "@/utils/chatEndpoints";
import AddressAutocomplete from "@/components/ui/AddressAutocomplete";
import { safeLocalStorage } from "@/utils/safeLocalStorage";
import getOrCreateAnonId from "@/utils/anonId";
import TicketMap from "@/components/TicketMap";
import { useUser } from "@/hooks/useUser";
import { toast } from "@/components/ui/use-toast";

// Frases para detectar pedido de dirección
const FRASES_DIRECCION = [
  "indicame la dirección",
  "necesito la dirección",
  "ingresa la dirección",
  "especificá la dirección",
  "decime la dirección",
  "dirección exacta",
  "¿cuál es la dirección?",
  "por favor indique la dirección",
  "por favor ingrese su dirección",
  "dirección completa",
];
const FRASES_EXITO = [
  "Tu reclamo fue generado",
  "¡Muchas gracias por tu calificación!",
  "Dejaré el ticket abierto",
  "El curso de seguridad vial es online",
  "He abierto una sala de chat directa",
  "Tu número de chat es",
  "ticket **M-",
];

function shouldShowAutocomplete(messages: Message[], contexto: any) {
  const lastBotMsg = [...messages].reverse().find((m) => m.isBot && m.text);
  if (!lastBotMsg) return false;
  const contenido =
    typeof lastBotMsg.text === "string" ? lastBotMsg.text.toLowerCase() : "";
  if (FRASES_DIRECCION.some((frase) => contenido.includes(frase))) return true;
  if (
    contexto &&
    contexto.contexto_municipio &&
    (contexto.contexto_municipio.estado_conversacion ===
      "ESPERANDO_DIRECCION_RECLAMO" ||
      contexto.contexto_municipio.estado_conversacion === 4)
  ) {
    return true;
  }
  return false;
}

function checkCierreExito(messages: Message[]) {
  const lastBotMsg = [...messages].reverse().find((m) => m.isBot && m.text);
  if (!lastBotMsg) return null;
  const contenido =
    typeof lastBotMsg.text === "string" ? lastBotMsg.text.toLowerCase() : "";
  if (FRASES_EXITO.some((frase) => contenido.includes(frase))) {
    // Detectar número de ticket
    const match = contenido.match(/ticket \*\*m-(\d+)/i);
    if (match) {
      return {
        show: true,
        text: `✅ ¡Listo! Tu ticket fue generado exitosamente. Número: M-${match[1]}.\nUn agente municipal te va a contactar para seguimiento.`,
      };
    }
    return { show: true, text: lastBotMsg.text };
  }
  return null;
}

// Mobile detection
function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < breakpoint : false,
  );
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < breakpoint);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [breakpoint]);
  return isMobile;
}


const ChatPage = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatMessagesContainerRef = useRef<HTMLDivElement>(null);
  const lastQueryRef = useRef<string | null>(null);

  const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const tipoChatParam = urlParams?.get('tipo_chat');
  const demoRubroIdParam = urlParams?.get('rubroId');
  const demoRubroNameParam = urlParams?.get('rubroName'); // Este es tu rubro_clave para la demo

  // Usamos el hook useUser para obtener el usuario autenticado
  const { user, refreshUser, loading } = useUser();
  const authToken = safeLocalStorage.getItem("authToken");
  const anonId = getOrCreateAnonId();
  const isAnonimo = !authToken; // Determina si el usuario no está autenticado

  // Lógica para determinar el rubro del usuario, priorizando autenticado
  const rubroActualFromUser = user?.rubro ? parseRubroUtil(user.rubro) : null;
  const rubroActualFromStorage = typeof window !== 'undefined'
    ? parseRubroUtil(safeLocalStorage.getItem('rubroSeleccionado') || 'null') // rubroSeleccionado podría ser un ID o nombre
    : null;
  
  // El rubro "normalizado" que usaremos para determinar el tipo de bot.
  // Para demos anónimas, el rubro viene de la URL.
  const rubroNormalizadoFinal = (isAnonimo && demoRubroNameParam) 
    ? parseRubroUtil(demoRubroNameParam) // Priorizar rubro de URL para demo anónima
    : rubroActualFromUser || rubroActualFromStorage;


  // Determinar el tipo de chat principal (pyme/municipio)
  let currentEffectiveChatType: 'pyme' | 'municipio';
  
  if (esRubroPublico(rubroNormalizadoFinal)) {
    currentEffectiveChatType = 'municipio';
  } else {
    // Si no es un rubro público, por defecto es PYME.
    // También, si el `tipoChatParam` es 'pyme', lo respetamos.
    currentEffectiveChatType = 'pyme'; 
  }

  // Si hay un tipoChatParam explícito en la URL, lo podemos usar para anular el default si es necesario
  // PERO la lógica de `getAskEndpoint` y `esRubroPublico` es más fuerte.
  // Si tipoChatParam fuera 'municipio' y el rubro no es público, la llamada a getAskEndpoint lo corregirá.

  // APLICAR enforceTipoChatForRubro para asegurar consistencia
  const adjustedTipoForEndpoint = enforceTipoChatForRubro(currentEffectiveChatType, rubroNormalizadoFinal);

  // console.log para depuración avanzada:
  console.log('ChatPage - DEBUG Variables Iniciales:', {
    userFromHook: user,
    rubroActualFromUser,
    rubroActualFromStorage,
    rubroNormalizadoFinal,
    isAnonimo,
    demoRubroIdParam,
    demoRubroNameParam,
    currentEffectiveChatType, // Tipo de chat inicial
    adjustedTipoForEndpoint,  // Tipo de chat ajustado para el endpoint
  });


  useEffect(() => {
    // Si no está autenticado y no hay datos de usuario, intenta refrescar.
    // Esto es útil si el token está presente pero el `user` object no se cargó aún.
    if (!isAnonimo && (!user || !user.rubro) && !loading) {
      refreshUser();
    }
  }, [isAnonimo, user, refreshUser, loading]);

  const [contexto, setContexto] = useState({});
  const [activeTicketId, setActiveTicketId] = useState<number | null>(null);
  const [ticketInfo, setTicketInfo] = useState<{
    direccion?: string | null;
    latitud?: number | null;
    longitud?: number | null;
    municipio_nombre?: string | null;
  } | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const ultimoMensajeIdRef = useRef<number>(0);
  const isMobile = useIsMobile();

  // Estado de input dirección / cierre éxito
  const [esperandoDireccion, setEsperandoDireccion] = useState(false);
  const [forzarDireccion, setForzarDireccion] = useState(false);
  const [direccionGuardada, setDireccionGuardada] = useState<string | null>(null);
  const [showCierre, setShowCierre] = useState<{
    show: boolean;
    text: string;
  } | null>(null);

  const fetchTicketInfo = useCallback(async () => {
    if (!activeTicketId) return;
    try {
      const data = await apiFetch<{
        direccion?: string | null;
        latitud?: number | string | null;
        longitud?: number | string | null;
        municipio_nombre?: string | null;
      }>(
        // Asegúrate de que el backend pueda manejar anon_id para tickets si es un ticket anónimo
        `/tickets/municipio/${activeTicketId}`, // apiFetch se encargará de anon_id en headers
        { 
            sendAnonId: isAnonimo // apiFetch lo manejará
        },
      );
      const normalized = {
        ...data,
        latitud:
          data.latitud !== null && data.latitud !== undefined
            ? Number(data.latitud)
            : null,
        longitud:
          data.longitud !== null && data.longitud !== undefined
            ? Number(data.longitud)
            : null,
      };
      setTicketInfo(normalized);
    } catch (e) {
      console.error('Error al refrescar ticket:', e);
    }
  }, [activeTicketId, isAnonimo]); // Añadir dependencias

  useEffect(() => {
    fetchTicketInfo();
  }, [activeTicketId, fetchTicketInfo]);

  const scrollToBottom = useCallback(() => {
    const container = chatMessagesContainerRef.current;
    if (container) {
      const atBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight < 100;
      if (atBottom) {
        container.scrollTop = container.scrollHeight;
      }
    }
  }, []);

  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: Date.now(),
          text: "¡Hola! Soy Chatboc. ¿En qué puedo ayudarte hoy?",
          isBot: true,
          timestamp: new Date(),
          query: undefined,
        },
      ]);
    }
    const stored = safeLocalStorage.getItem("ultima_direccion");
    if (stored) {
      setDireccionGuardada(stored);
    }
  }, []);

  // Scroll y cierre UX
  useEffect(() => {
    const needsAddress =
      shouldShowAutocomplete(messages, contexto) || forzarDireccion;
    setEsperandoDireccion(needsAddress);
    if (!needsAddress) {
      setShowCierre(checkCierreExito(messages));
    } else {
      setShowCierre(null);
    }
    const timer = setTimeout(() => scrollToBottom(), 150);
    return () => clearTimeout(timer);
  }, [messages, isTyping, scrollToBottom, contexto, forzarDireccion, ticketInfo]);

  const handleShareGps = useCallback(() => {
    if (!activeTicketId || !navigator.geolocation) {
      toast({
        title: "Ubicación no disponible",
        description: "Tu navegador no soporta la geolocalización o el ticket no está activo.",
        variant: "destructive",
        duration: 3000,
      });
      return;
    }
    
    // Si ya estamos en un flujo de un ticket municipal, intentamos obtener GPS
    // Y si el tipo de chat es municipio, tiene más sentido esta funcionalidad.
    if (currentEffectiveChatType === 'municipio') { // Usar currentEffectiveChatType
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const coords = {
            latitud: pos.coords.latitude,
            longitud: pos.coords.longitude,
          };
          try {
            // Envía la ubicación al ticket de chat, si existe
            try {
              await apiFetch(
                `/tickets/chat/${activeTicketId}/ubicacion`,
                {
                  method: 'PUT',
                  body: coords,
                  sendAnonId: isAnonimo,
                },
              );
            } catch (e) {
              console.warn('Ticket de chat no encontrado:', e);
            }
            // También intenta actualizar el ticket municipal
            await apiFetch(
              `/tickets/municipio/${activeTicketId}/ubicacion`,
              {
                method: 'PUT',
                body: coords,
                sendAnonId: isAnonimo,
              },
            );
            setForzarDireccion(false);
            fetchTicketInfo(); // Refresca info del ticket
            toast({
                title: "Ubicación enviada",
                description: "Tu ubicación ha sido compartida con el agente.",
                duration: 3000,
            });
          } catch (e) {
            console.error('Error al enviar ubicación por GPS:', e);
            toast({
                title: "Error al enviar ubicación",
                description: "Hubo un problema al enviar tu ubicación. Inténtalo de nuevo.",
                variant: "destructive",
                duration: 3000,
            });
          }
        },
        (error) => {
          console.error("Error obteniendo ubicación:", error);
          setForzarDireccion(true);
          setEsperandoDireccion(true);
          setMessages((prev) => [
            ...prev,
            {
              id: Date.now(),
              text:
                'No pudimos acceder a tu ubicación por GPS (error de permisos o configuración). Ingresá la dirección manualmente para continuar.',
              isBot: true,
              timestamp: new Date(),
              query: undefined,
            },
          ]);
          toast({
            title: "Ubicación no autorizada",
            description: "Por favor, permite el acceso a la ubicación en tu navegador.",
            variant: "destructive",
            duration: 5000,
          });
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 } // Opciones para precisión
      );
    } else {
        toast({
            title: "Función no aplicable",
            description: "La función de ubicación por GPS está disponible solo para reclamos municipales en vivo.",
            duration: 4000,
        });
    }
  }, [activeTicketId, fetchTicketInfo, currentEffectiveChatType, isAnonimo]);


  // Solicitar GPS automáticamente al iniciar chat en vivo
  useEffect(() => {
    if (!activeTicketId || currentEffectiveChatType !== 'municipio') return; // Solo para tickets municipales
    
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const coords = {
            latitud: pos.coords.latitude,
            longitud: pos.coords.longitude,
          };
          try {
            try {
              await apiFetch(
                `/tickets/chat/${activeTicketId}/ubicacion`,
                { method: 'PUT', body: coords, sendAnonId: isAnonimo },
              );
            } catch (e) {
              console.warn('Ticket de chat no encontrado:', e);
            }
            await apiFetch(
              `/tickets/municipio/${activeTicketId}/ubicacion`,
              { method: 'PUT', body: coords, sendAnonId: isAnonimo },
            );
            fetchTicketInfo();
            toast({ title: "Ubicación enviada automáticamente", duration: 2000 });
          } catch (e) {
            console.error('Error al enviar ubicación automática:', e);
          }
        },
        (error) => {
          console.warn("Permiso de ubicación denegado o error automático:", error);
          setForzarDireccion(true); // Solicitar dirección manual
          setEsperandoDireccion(true);
          setMessages((prev) => [
            ...prev,
            {
              id: Date.now(),
              text:
                'No pudimos acceder a tu ubicación automáticamente. Por favor, ingresa la dirección para tu reclamo.',
              isBot: true,
              timestamp: new Date(),
              query: undefined,
            },
          ]);
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    } else {
      setForzarDireccion(true);
      setEsperandoDireccion(true);
    }
  }, [activeTicketId, fetchTicketInfo, currentEffectiveChatType, isAnonimo]);


  // Maneja envío de mensaje O dirección seleccionada
  const handleSend = useCallback(
    async (text: string) => {
      if (!text.trim()) return;

      if (esperandoDireccion) {
        setEsperandoDireccion(false);
        setForzarDireccion(false);
        safeLocalStorage.setItem("ultima_direccion", text);
        setDireccionGuardada(text);
        if (activeTicketId) {
          try {
            try {
              await apiFetch(
                `/tickets/chat/${activeTicketId}/ubicacion`,
                {
                  method: 'PUT',
                  body: { direccion: text },
                  sendAnonId: isAnonimo
                },
              );
            } catch (e) {
              console.warn('Ticket de chat no encontrado:', e);
            }
            await apiFetch(
              `/tickets/municipio/${activeTicketId}/ubicacion`,
              {
                method: 'PUT',
                body: { direccion: text },
                sendAnonId: isAnonimo
              },
            );
            fetchTicketInfo();
            toast({ title: "Dirección enviada", duration: 2000 });
          } catch (e) {
            console.error('Error al enviar dirección manual:', e);
            toast({ title: "Error enviando dirección", variant: "destructive" });
          }
        }
      }
      setShowCierre(null);

      const userMessage: Message = {
        id: Date.now(),
        text,
        isBot: false,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMessage]);
      lastQueryRef.current = text;
      setIsTyping(true);

      try {
        if (activeTicketId) {
          // Caso: chat en vivo con ticket activo
          await apiFetch(
            `/tickets/chat/${activeTicketId}/responder_ciudadano`,
            {
              method: "POST",
              body: { comentario: text },
              sendAnonId: isAnonimo // Importante para anónimos
            },
          );
        } else {
          // Caso: todavía con el bot (llamada a /ask/pyme o /ask/municipio)
          const payload: Record<string, any> = {
            pregunta: text,
            contexto_previo: contexto,
          };

          // Definir rubro_clave y rubro_id para el payload (para el backend)
          let rubroClaveParaPayload: string | undefined = undefined;
          let rubroIdParaPayload: number | undefined = undefined;

          if (currentEffectiveChatType === 'pyme') {
              if (user?.rubro?.clave) { // Usuario autenticado
                  rubroClaveParaPayload = parseRubroUtil(user.rubro) || undefined;
                  rubroIdParaPayload = user.rubro.id;
              } else if (isAnonimo && demoRubroNameParam) { // Demo anónima
                  rubroClaveParaPayload = demoRubroNameParam;
                  rubroIdParaPayload = demoRubroIdParam ? Number(demoRubroIdParam) : undefined;
              }
          } else if (currentEffectiveChatType === 'municipio') {
              rubroClaveParaPayload = "municipios"; // Clave fija para el bot municipal
              // Si tienes un ID fijo para el rubro "municipios", también puedes enviarlo aquí
              // rubroIdParaPayload = ID_FIJO_MUNICIPIOS; 
          }
          
          if (rubroClaveParaPayload) {
              payload.rubro_clave = rubroClaveParaPayload;
          }
          if (rubroIdParaPayload) {
              payload.rubro_id = rubroIdParaPayload;
          }

          // **Asegurarnos de que el tipo de chat en el payload refleje el actual**
          payload.tipo_chat = currentEffectiveChatType;
          // PATCH CRÍTICO: agrega anon_id si es usuario anónimo
          if (isAnonimo && anonId) {
            payload.anon_id = anonId;
          }

          // Determinar el endpoint final utilizando la función de chatEndpoints
          const endpoint = getAskEndpoint({
            tipoChat: adjustedTipoForEndpoint, // Usar el tipo de chat ajustado
            rubro: rubroClaveParaPayload // Pasamos el rubro clave (ya normalizado)
          });

          // --- ¡CLAVE PARA DEPURAR! ---
          console.log("DEBUG - user (hook):", user); // Para ver el objeto completo del usuario
          console.log("DEBUG - rubroNormalizadoFinal (derivado):", rubroNormalizadoFinal);
          console.log("DEBUG - currentEffectiveChatType (determinado):", currentEffectiveChatType);
          console.log("DEBUG - adjustedTipoForEndpoint (final para endpoint):", adjustedTipoForEndpoint);
          console.log("DEBUG - rubroClaveParaPayload (en payload):", rubroClaveParaPayload);
          console.log("DEBUG - rubroIdParaPayload (en payload):", rubroIdParaPayload);
          console.log("DEBUG - Endpoint a llamar:", endpoint);
          console.log("DEBUG - Payload a enviar:", payload);


          const data = await apiFetch<any>(endpoint, {
            method: "POST",
            body: payload,
          });

          setContexto(data.contexto_actualizado || {});

          const botMessage: Message = {
            id: Date.now(),
            text: data?.respuesta || "⚠️ No se pudo generar una respuesta.",
            isBot: true,
            timestamp: new Date(),
            botones: data?.botones || [],
            query: lastQueryRef.current || undefined,
          };
          setMessages((prev) => [...prev, botMessage]);
          lastQueryRef.current = null;

          if (data.ticket_id) {
            setActiveTicketId(data.ticket_id);
            ultimoMensajeIdRef.current = 0;
          }
          if (!isAnonimo) {
            await refreshUser();
          }
        }
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
        toast({
            title: "Error de comunicación",
            description: errorMsg,
            variant: "destructive",
            duration: 5000,
        });
      } finally {
        setIsTyping(false);
      }
    },
    [
      contexto, activeTicketId, esperandoDireccion, user,
      anonId, currentEffectiveChatType, demoRubroIdParam, demoRubroNameParam,
      fetchTicketInfo, rubroNormalizadoFinal, adjustedTipoForEndpoint // Añadir dependencias relevantes
    ],
  );

  // Polling para chat en vivo
  useEffect(() => {
    const fetchNewMessages = async () => {
      if (!activeTicketId) return;
      try {
        const base = `/tickets/chat/${activeTicketId}/mensajes`;
        // apiFetch ya manejará el anon_id en los headers
        const query = `?ultimo_mensaje_id=${ultimoMensajeIdRef.current}`; 
        const data = await apiFetch<{ estado_chat: string; mensajes: any[] }>(
          `${base}${query}`,
          { sendAnonId: isAnonimo }, // Enviar anonId si no autenticado
        );
        if (data.mensajes && data.mensajes.length > 0) {
          const nuevosMensajes: Message[] = data.mensajes.map((msg) => ({
            id: msg.id,
            text: msg.texto,
            isBot: msg.es_admin,
            timestamp: new Date(msg.fecha),
            query: undefined,
          }));
          setMessages((prev) => [...prev, ...nuevosMensajes]);
          ultimoMensajeIdRef.current =
            data.mensajes[data.mensajes.length - 1].id;
        }
        if (data.estado_chat === "resuelto" || data.estado_chat === "cerrado") {
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
          }
          setMessages((prev) => [
            ...prev,
            {
              id: Date.now(),
              text: "Un agente ha finalizado esta conversación.",
              isBot: true,
              timestamp: new Date(),
              query: undefined,
            },
          ]);
        }
        await fetchTicketInfo();
      } catch (error) {
        console.error("Error durante el polling:", error);
      }
    };
    if (activeTicketId) {
      fetchNewMessages();
      pollingIntervalRef.current = setInterval(fetchNewMessages, 10000);
    }
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [activeTicketId, fetchTicketInfo, isAnonimo]); // Añadir isAnonimo a dependencias
  
  const isTicketLocationValid =
  !!ticketInfo &&
  typeof ticketInfo.latitud === "number" &&
  typeof ticketInfo.longitud === "number" &&
  !isNaN(ticketInfo.latitud) &&
  !isNaN(ticketInfo.longitud) &&
  currentEffectiveChatType === "municipio";

   return (
    <div className="min-h-screen flex flex-col bg-background dark:bg-gradient-to-b dark:from-[#0d1014] dark:to-[#161b22] text-foreground">
      <Navbar />

      <main
        className={`
          flex-grow flex flex-col items-center justify-center
          pt-3 sm:pt-10 pb-2 sm:pb-6
          transition-all
        `}
      >
        <motion.div
          layout
          className={`
            w-full max-w-[99vw] ${isMobile ? "h-[100svh]" : "sm:w-[480px] h-[83vh]"}
            flex flex-col
            rounded-none sm:rounded-3xl 
            border-0 sm:border border-border
            shadow-none sm:shadow-2xl
            bg-card dark:bg-[#20232b]/95
            backdrop-blur-0 sm:backdrop-blur-xl
            relative
            overflow-hidden
            transition-all
          `}
          style={{
            boxShadow: isMobile
              ? undefined
              : "0 8px 64px 0 rgba(30,40,90,0.10)",
          }}
        >
          {/* Mensajes */}
          <div
            ref={chatMessagesContainerRef}
            className={`
              flex-1 overflow-y-auto
              p-2 sm:p-4 space-y-3
              custom-scroll
              scrollbar-thin scrollbar-thumb-[#90caf9] scrollbar-track-transparent
              bg-background dark:bg-[#22262b]
              transition-all
            `}
            style={{ minHeight: 0 }}
          >
            <AnimatePresence>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 14 }}
                  transition={{ duration: 0.18 }}
                >
                  <ChatMessage
                    message={msg}
                    isTyping={isTyping}
                    onButtonClick={handleSend}
                    tipoChat={adjustedTipoForEndpoint}
                    query={msg.query}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
            {isTyping && <TypingIndicator />}
            {/* Solo muestra el mapa si la ubicación es válida */}
            {isTicketLocationValid && <TicketMap ticket={{ ...ticketInfo, tipo: 'municipio' }} />}
            <div ref={chatEndRef} />
            {showCierre && showCierre.show && (
              <div className="my-3 p-3 rounded-lg bg-green-100 text-green-800 text-center font-bold shadow">
                {showCierre.text}
              </div>
            )}
          </div>

          {/* Input o Autocomplete según corresponda */}
          <div
            className={`
              bg-gradient-to-t from-background via-card/60 to-transparent dark:from-card dark:via-card/80
              border-t border-border
              p-2 sm:p-4
              flex-shrink-0
              sticky bottom-0
              z-20
              shadow-inner
              backdrop-blur
            `}
          >
            {esperandoDireccion ? (
              <div>
                <AddressAutocomplete
                  onSelect={handleSend}
                  autoFocus
                  placeholder="Ej: Av. Principal 123"
                  value={
                    direccionGuardada
                      ? { label: direccionGuardada, value: direccionGuardada }
                      : undefined
                  }
                  onChange={(opt) =>
                    setDireccionGuardada(
                      opt
                        ? typeof opt.value === "string"
                          ? opt.value
                          : opt.value?.description ?? null
                        : null
                    )
                  }
                  persistKey="ultima_direccion"
                />
                <button
                  onClick={handleShareGps}
                  className="mt-2 text-sm text-primary underline"
                  type="button"
                >
                  Compartir ubicación por GPS
                </button>
                <div className="text-xs mt-2 text-muted-foreground">
                  Escribí o seleccioná tu dirección para el reclamo.
                </div>
              </div>
            ) : !showCierre || !showCierre.show ? (
              <ChatInput onSendMessage={handleSend} isTyping={isTyping} />
            ) : null}
          </div>
        </motion.div>
      </main>
    </div>
  );
};

export default ChatPage;
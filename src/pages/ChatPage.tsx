// src/pages/ChatPage.tsx
import React, { useState, useEffect, useRef, useCallback } from "react";
import { Message } from "@/types/chat";
import ChatMessage from "@/components/chat/ChatMessage";
import ChatInput from "@/components/chat/ChatInput";
import TypingIndicator from "@/components/chat/TypingIndicator";
import Navbar from "@/components/layout/Navbar";
import { apiFetch, getErrorMessage } from "@/utils/api";
import { getAskEndpoint, esRubroPublico, parseRubro } from "@/utils/chatEndpoints";
import { safeLocalStorage } from "@/utils/safeLocalStorage";
import { useUser } from "@/hooks/useUser";
import { useDarkMode } from "@/hooks/useDarkMode";
import AddressAutocomplete from "@/components/ui/AddressAutocomplete";
import TicketMap from "@/components/TicketMap";
import TicketTimeline from "@/components/tickets/TicketTimeline";
import getOrCreateAnonId from "@/utils/anonId";
import { toast } from "@/components/ui/use-toast";
import { requestLocation } from "@/utils/geolocation";
import { fmtAR } from "@/utils/date";
import { getContactPhone } from "@/utils/ticket";
import {
  getTicketTimeline,
  requestTicketHistoryEmail,
  type TicketHistoryDeliveryResult,
  isTicketHistoryDeliveryErrorResult,
  formatTicketHistoryDeliveryErrorMessage,
} from "@/services/ticketService";
import { TicketHistoryEvent, Message as TicketMessage } from "@/types/tickets";
import { extractButtonsFromResponse } from "@/utils/chatButtons";
// Importar AttachmentInfo y SendPayload desde @/types/chat o un lugar centralizado
// Asegúrate de que SendPayload en @/types/chat.ts incluya attachmentInfo
import { AttachmentInfo, SendPayload as TypeSendPayload } from "@/types/chat";
import { v4 as uuidv4 } from 'uuid'; // <--- IMPORTAR uuid
import { useIsMobile } from "@/hooks/use-mobile";

// Si SendPayload no está en @/types/chat.ts o necesita ser específico aquí:
// interface SendPayload {
//   text: string;
//   es_foto?: boolean;
//   archivo_url?: string;
//   es_ubicacion?: boolean;
//   ubicacion_usuario?: { lat: number; lon: number; };
//   action?: string;
//   attachmentInfo?: AttachmentInfo;
// }

const FRASES_DIRECCION = [
  "indicame la dirección", "necesito la dirección", "ingresa la dirección",
  "especificá la dirección", "decime la dirección", "dirección exacta",
  "¿cuál es la dirección?", "por favor indique la dirección",
  "por favor ingrese su dirección", "dirección completa"
];
const FRASES_EXITO = [
  "Tu reclamo fue generado", "¡Muchas gracias por tu calificación!", "Dejaré el ticket abierto",
  "El curso de seguridad vial es online", "He abierto una sala de chat directa",
  "Tu número de chat es", "ticket **M-",
];

const ChatPage = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [contexto, setContexto] = useState({});
  const [esperandoDireccion, setEsperandoDireccion] = useState(false);
  const [forzarDireccion, setForzarDireccion] = useState(false);
  const [direccionGuardada, setDireccionGuardada] = useState<string | null>(null);
  const [showCierre, setShowCierre] = useState<{ show: boolean; text: string } | null>(null);
  const [activeTicketId, setActiveTicketId] = useState<number | null>(null);
  const [ticketInfo, setTicketInfo] = useState<any>(null);
  const [timelineHistory, setTimelineHistory] = useState<TicketHistoryEvent[]>([]);
  const [timelineMessages, setTimelineMessages] = useState<TicketMessage[]>([]);
  const [estadoChat, setEstadoChat] = useState('');
  const chatMessagesContainerRef = useRef<HTMLDivElement>(null);
  const lastQueryRef = useRef<string | null>(null);
  const ultimoMensajeIdRef = useRef<number>(0);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const { user, refreshUser, loading } = useUser();
  const isDarkMode = useDarkMode();
  const authToken = safeLocalStorage.getItem("authToken");
  const isAnonimo = !authToken;
  const anonId = getOrCreateAnonId();

  const notifyCitizenDeliveryIssue = useCallback(
    (result: TicketHistoryDeliveryResult, contextMessage: string) => {
      if (isTicketHistoryDeliveryErrorResult(result)) {
        toast({
          title: 'Aviso: entrega parcial',
          description: formatTicketHistoryDeliveryErrorMessage(
            result,
            contextMessage,
          ),
          variant: 'destructive',
          duration: 6000,
        });
      }
    },
    [],
  );

  const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const demoRubroNameParam = urlParams?.get('rubroName');
  const rubroFromUser = user?.rubro ? parseRubro(user.rubro) : null;
  const rubroFromStorage = typeof window !== 'undefined'
    ? (() => {
        const stored = safeLocalStorage.getItem('rubroSeleccionado');
        return stored ? parseRubro(stored) : null;
      })()
    : null;
  const rubroNormalizado = (isAnonimo && demoRubroNameParam)
    ? parseRubro(demoRubroNameParam)
    : rubroFromUser || rubroFromStorage;

  const tipoChat: "pyme" | "municipio" = esRubroPublico(rubroNormalizado) ? "municipio" : "pyme";
  const isMobile = useIsMobile();
  const welcomeRef = useRef(false);

  useEffect(() => {
    if (!welcomeRef.current && messages.length === 0) {
      setMessages([{ id: Date.now(), text: "¡Hola! Soy Chatboc. ¿En qué puedo ayudarte hoy?", isBot: true, timestamp: new Date(), query: undefined }]);
      welcomeRef.current = true;
    }
    const stored = safeLocalStorage.getItem("ultima_direccion");
    if (stored) setDireccionGuardada(stored);
  }, []);

  useEffect(() => {
    if (!isAnonimo && (!user || !user.rubro) && !loading) {
      refreshUser();
    }
  }, [isAnonimo, user, refreshUser, loading]);

  const scrollToBottom = useCallback(() => {
    const container = chatMessagesContainerRef.current;
    if (container) {
      const atBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight < 100;
      if (atBottom) container.scrollTop = container.scrollHeight;
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => scrollToBottom(), 150);
    return () => clearTimeout(timer);
  }, [messages, isTyping, scrollToBottom]);

  useEffect(() => {
    const lastBotMsg = [...messages].reverse().find((m) => m.isBot && m.text);
    const needsAddress = lastBotMsg &&
      FRASES_DIRECCION.some((frase) => (lastBotMsg.text as string).toLowerCase().includes(frase)) || forzarDireccion;
    setEsperandoDireccion(Boolean(needsAddress));
    if (!needsAddress) {
      const contenido = lastBotMsg && typeof lastBotMsg.text === "string" ? lastBotMsg.text.toLowerCase() : "";
      const exito = FRASES_EXITO.some(f => contenido.includes(f));
      if (exito) {
        const match = contenido.match(/ticket \*\*m-(\d+)/i);
        setShowCierre({
          show: true,
          text: match
            ? `✅ ¡Listo! Tu ticket fue generado exitosamente. Número: M-${match[1]}.\nUn agente municipal te va a contactar para seguimiento.`
            : lastBotMsg.text as string
        });
      } else setShowCierre(null);
    } else setShowCierre(null);
  }, [messages, forzarDireccion]);

  const fetchTicketInfo = useCallback(async () => {
    if (!activeTicketId) return;
    try {
      const data = await apiFetch<any>(
        `/tickets/municipio/${activeTicketId}`,
        { sendAnonId: isAnonimo, sendEntityToken: true }
      );
      const normalized = {
        ...data,
        latitud: data.latitud != null ? Number(data.latitud) : null,
        longitud: data.longitud != null ? Number(data.longitud) : null,
      };
      setTicketInfo(normalized);
      try {
        const timeline = await getTicketTimeline(normalized.id, normalized.tipo || 'municipio', { public: true });
        setTimelineHistory(timeline.history);
        setTimelineMessages(timeline.messages);
        setEstadoChat(timeline.estado_chat);
      } catch (msgErr) {
        console.error('Error fetching timeline for ticket', msgErr);
      }
    } catch (error) {
        console.error("Error fetching ticket info:", error);
    }
  }, [activeTicketId, isAnonimo]);

  useEffect(() => { fetchTicketInfo(); }, [activeTicketId, fetchTicketInfo]);

  const handleShareGps = useCallback(() => {
    if (!activeTicketId) {
      toast({ title: "Ubicación no disponible", description: "El ticket no está activo.", variant: "destructive", duration: 3000 });
      return;
    }
    if (tipoChat === "municipio") {
      requestLocation({ enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }).then(async (coords) => {
        if (!coords) {
          setForzarDireccion(true);
          setEsperandoDireccion(true);
          setMessages((prev) => [...prev, {
            id: Date.now(),
            text: 'No pudimos acceder a tu ubicación por GPS. Verificá los permisos y que estés usando una conexión segura (https). Ingresá la dirección manualmente para continuar.',
            isBot: true, timestamp: new Date(), query: undefined
          }]);
          return;
        }
        try {
          await apiFetch(`/tickets/chat/${activeTicketId}/ubicacion`, { method: 'PUT', body: { lat: coords.latitud, lon: coords.longitud }, sendAnonId: isAnonimo, sendEntityToken: true });
          await apiFetch(`/tickets/municipio/${activeTicketId}/ubicacion`, { method: 'PUT', body: { lat: coords.latitud, lon: coords.longitud }, sendAnonId: isAnonimo, sendEntityToken: true });
          setForzarDireccion(false);
          fetchTicketInfo();
          toast({ title: "Ubicación enviada", description: "Tu ubicación ha sido compartida con el agente.", duration: 3000 });
        } catch (error) {
          console.error("Error al enviar ubicación:", error);
          toast({ title: "Error al enviar ubicación", description: "Hubo un problema al enviar tu ubicación.", variant: "destructive", duration: 3000 });
        }
      });
    }
  }, [activeTicketId, fetchTicketInfo, tipoChat, isAnonimo]);

  useEffect(() => {
    const fetchNewMessages = async () => {
      if (!activeTicketId) return;
      try {
        const base = `/tickets/chat/${activeTicketId}/mensajes`;
        const query = `?ultimo_mensaje_id=${ultimoMensajeIdRef.current}`;
        const data = await apiFetch<{ estado_chat: string; mensajes: any[] }>(
          `${base}${query}`, { sendAnonId: isAnonimo, sendEntityToken: true }
        );
        if (data.mensajes && data.mensajes.length > 0) {
          const nuevosMensajes: Message[] = data.mensajes.map((msg) => ({
            id: msg.id, text: msg.texto, isBot: msg.es_admin, timestamp: new Date(msg.fecha), query: undefined,
            // Asegurarse de que el backend de tickets también devuelva attachmentInfo si es necesario
            attachmentInfo: msg.attachment_info, // Asumiendo que el backend lo devuelve como attachment_info
          }));
          setMessages((prev) => [...prev, ...nuevosMensajes]);
          ultimoMensajeIdRef.current = data.mensajes[data.mensajes.length - 1].id;
        }
        if (["resuelto", "cerrado"].includes(data.estado_chat)) {
          if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
          setMessages((prev) => [...prev, {
            id: Date.now(),
            text: "Un agente ha finalizado esta conversación.",
            isBot: true, timestamp: new Date(), query: undefined,
          }]);
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
    return () => { if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current); };
  }, [activeTicketId, fetchTicketInfo, isAnonimo]);

  const handleSend = useCallback(
    async (payload: TypeSendPayload) => {
      const userMessageText = payload.text.trim();

      // No enviar si es solo un texto vacío y no hay adjunto ni acción
      if (!userMessageText && !payload.attachmentInfo && !payload.action && !payload.ubicacion_usuario) {
        // Si hay archivo_url legado pero no attachmentInfo, aún podría ser un adjunto
        if (!payload.archivo_url) return;
      }
      
      if (esperandoDireccion && !payload.attachmentInfo) { // No procesar como dirección si es un adjunto
        setEsperandoDireccion(false);
        setForzarDireccion(false);
        safeLocalStorage.setItem("ultima_direccion", userMessageText);
        setDireccionGuardada(userMessageText);
        if (activeTicketId) {
          try {
            await apiFetch(`/tickets/chat/${activeTicketId}/ubicacion`, { method: 'PUT', body: { direccion: userMessageText }, sendAnonId: isAnonimo, sendEntityToken: true });
            await apiFetch(`/tickets/municipio/${activeTicketId}/ubicacion`, { method: 'PUT', body: { direccion: userMessageText }, sendAnonId: isAnonimo, sendEntityToken: true });
            fetchTicketInfo();
            toast({ title: "Dirección enviada", duration: 2000 });
          } catch (error) {
            console.error("Error enviando dirección:", error);
            toast({ title: "Error enviando dirección", variant: "destructive" });
          }
        }
      }
      setShowCierre(null);

      const userMessageObject: Message = {
        id: Date.now(),
        text: userMessageText,
        isBot: false,
        timestamp: new Date(),
        attachmentInfo: payload.attachmentInfo, 
      };
      setMessages((prev) => [...prev, userMessageObject]);
      lastQueryRef.current = userMessageText; 
      setIsTyping(true);

      try {
        if (activeTicketId) {
          const body: any = {
            comentario: userMessageText,
          };
          if (payload.ubicacion_usuario) body.ubicacion = payload.ubicacion_usuario;
          // Para el chat en vivo, decidir si se envía attachmentInfo o los campos legados
          if (payload.attachmentInfo) {
            body.attachment_info = payload.attachmentInfo; // Preferido
          } else if (payload.es_foto && payload.archivo_url) {
            body.foto_url = payload.archivo_url; // Legado
          }

          await apiFetch(`/tickets/chat/${activeTicketId}/responder_ciudadano`, {
            method: "POST",
            body: body,
            sendAnonId: isAnonimo,
            sendEntityToken: true,
          });
          requestTicketHistoryEmail({
            tipo: tipoChat,
            ticketId: activeTicketId,
            options: {
              reason: 'message_update',
              actor: 'user',
            },
          })
            .then((result) => {
              notifyCitizenDeliveryIssue(
                result,
                'Tu mensaje llegó al municipio, pero el correo automático no se pudo entregar.',
              );
            })
            .catch((error) => {
              console.error('Error triggering ticket email after citizen response:', error);
            });
        } else {
          const requestPayload: Record<string, any> = { 
            pregunta: userMessageText, 
            contexto_previo: contexto,
            ...(payload.attachmentInfo && { attachment_info: payload.attachmentInfo }),
            ...(payload.es_ubicacion && { es_ubicacion: true, ubicacion_usuario: payload.ubicacion_usuario }),
            ...(payload.action && { action: payload.action }),
            ...(payload.payload !== undefined && { payload: payload.payload }),
            // Mantener campos legados si el bot los necesita para transición
            ...(payload.archivo_url && !payload.attachmentInfo && { archivo_url: payload.archivo_url }),
            ...(payload.es_foto && !payload.attachmentInfo && { es_foto: payload.es_foto }),
          };
          
          let rubroClave: string | undefined = undefined;
          if (tipoChat === 'pyme') {
            rubroClave = rubroNormalizado;
          } else if (tipoChat === 'municipio') {
            rubroClave = "municipios";
          }
          if (rubroClave) requestPayload.rubro_clave = rubroClave;
          requestPayload.tipo_chat = tipoChat;
          if (isAnonimo && anonId) requestPayload.anon_id = anonId;
          
          const endpoint = getAskEndpoint({ tipoChat, rubro: rubroClave });
          const data = await apiFetch<any>(endpoint, {
            method: "POST",
            body: requestPayload,
            skipAuth: !authToken,
            sendEntityToken: true,
          });

          setContexto(data.contexto_actualizado || {});

          const respuestaText = data.respuesta_usuario || "⚠️ No se pudo generar una respuesta.";
          const botones = extractButtonsFromResponse(data);

          // Mensaje de respuesta del Bot
          const botMessage: Message = {
            id: Date.now(),
            text: respuestaText,
            isBot: true,
            timestamp: new Date(),
            botones,
            query: lastQueryRef.current || undefined,
            mediaUrl: data.media_url,
            locationData: data.location_data,
            attachmentInfo: data.attachment_info, // Asumir que el bot devuelve 'attachment_info'
          };
          setMessages((prev) => [...prev, botMessage]);
          lastQueryRef.current = null;

          if (data.ticket_id) {
            const wasNewTicket = !activeTicketId;
            setActiveTicketId(data.ticket_id);
            ultimoMensajeIdRef.current = 0;
            if (wasNewTicket) {
              requestTicketHistoryEmail({
                tipo: tipoChat,
                ticketId: data.ticket_id,
                options: {
                  reason: 'ticket_created',
                  actor: 'user',
                },
              })
                .then((result) => {
                  notifyCitizenDeliveryIssue(
                    result,
                    'El ticket se creó correctamente, pero el correo de confirmación falló.',
                  );
                })
                .catch((error) => {
                  console.error('Error triggering ticket creation email:', error);
                });
            }
          }
          if (!isAnonimo) await refreshUser();
        }
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
        toast({
          title: 'Error de comunicación',
          description: errorMsg,
          variant: 'destructive',
          duration: 5000,
        });
      } finally {
        setIsTyping(false);
      }
    },
    [esperandoDireccion, activeTicketId, isAnonimo, anonId, contexto, tipoChat, rubroNormalizado, authToken, fetchTicketInfo, refreshUser]
  );

  // Esta función handleFileUploaded es para un flujo donde la subida NO viene de ChatInput,
  // sino de otra parte de ChatPage. Si ChatInput es la única fuente de subidas, esta podría ser redundante.
  // Por ahora, la dejamos pero aseguramos que use el SendPayload correcto.
  const handleFileUploaded = useCallback((data: { url: string; filename: string; mimeType?: string; size?: number; }) => {
    // Asumimos que 'data' aquí es la respuesta ya procesada similar a lo que /archivos/subir debería devolver.
    if (data?.url && data?.filename) {
        const fileAttachmentInfo: AttachmentInfo = {
            name: data.filename, // Usar filename como name
            url: data.url,
            mimeType: data.mimeType, // Será undefined si no se provee
            size: data.size          // Será undefined si no se provee
        };
        handleSend({ 
            text: `Archivo adjunto: ${data.filename}`,
            // es_foto: data.mimeType?.startsWith('image/'), // Podría deducirse si mimeType está
            archivo_url: data.url, // Legado
            attachmentInfo: fileAttachmentInfo 
        });
    }
  }, [handleSend]);

  return (
    <div className="min-h-screen flex flex-col w-full bg-background text-foreground">
      <Navbar />
      <main className="flex-grow flex flex-col items-center justify-center py-4 sm:py-6 md:py-8">
        <div
          className={`
            w-full max-w-2xl lg:max-w-3xl
            h-[calc(100vh-100px)] sm:h-[calc(100vh-120px)] md:h-[calc(100vh-140px)]
            md:max-h-[700px] lg:max-h-[800px]
            flex flex-col
            bg-card shadow-xl rounded-lg border border-border
            overflow-hidden
          `}
        >
          <header className="p-3 sm:p-4 border-b border-border bg-card/95 backdrop-blur-sm flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img
                src={isDarkMode ? "/chatbocar.png" : "/chatbocar2.png"}
                alt="Chat Icon"
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-primary/10 p-1"
              />
              <div>
                <h1 className="text-base sm:text-lg font-semibold text-foreground">
                  {rubroNormalizado ? `Asistente ${rubroNormalizado}` : "Chat de Soporte"}
                </h1>
                <p className="text-xs text-green-500">En línea</p>
              </div>
            </div>
          </header>

          <div
            ref={chatMessagesContainerRef}
            className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 custom-scroll scrollbar-thin scrollbar-thumb-muted-foreground/30 hover:scrollbar-thumb-muted-foreground/50 scrollbar-track-transparent"
            style={{ minHeight: 0 }}
          >
            {messages.map((msg) => (
              <ChatMessage
                key={msg.id}
                message={msg}
                isTyping={isTyping}
                onButtonClick={handleSend}
                tipoChat={tipoChat}
                query={msg.query}
              />
            ))}
            {isTyping && <TypingIndicator />}
            {ticketInfo && (
              <div className="border rounded-xl p-4 sm:p-6 bg-card shadow-lg space-y-6">
                <div>
                  <p className="text-sm text-muted-foreground">Ticket #{ticketInfo.nro_ticket}</p>
                  <h2 className="text-2xl font-semibold">{ticketInfo.asunto}</h2>
                  <p className="pt-1">
                    <span className="font-medium">Estado actual:</span>{' '}
                    <span className="text-primary font-semibold">{estadoChat || ticketInfo.estado}</span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Creado el: {fmtAR(ticketInfo.fecha)}
                  </p>
                  {ticketInfo.direccion && (
                    <p className="text-sm text-muted-foreground mt-1">Dirección: {ticketInfo.direccion}</p>
                  )}
                  {(getContactPhone(ticketInfo) || ticketInfo.email || ticketInfo.dni || ticketInfo.informacion_personal_vecino) && (
                    <div className="mt-4 text-sm space-y-1">
                      {(ticketInfo.informacion_personal_vecino?.nombre || ticketInfo.display_name) && (
                        <p>Nombre: {ticketInfo.informacion_personal_vecino?.nombre || ticketInfo.display_name}</p>
                      )}
                      {(ticketInfo.informacion_personal_vecino?.email || ticketInfo.email) && (
                        <p>Email: {ticketInfo.informacion_personal_vecino?.email || ticketInfo.email}</p>
                      )}
                      {getContactPhone(ticketInfo) && (
                        <p>Teléfono: {getContactPhone(ticketInfo)}</p>
                      )}
                    </div>
                  )}

                  <TicketMap ticket={{ ...ticketInfo, tipo: 'municipio' }} />
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-4">Historial del Reclamo</h3>
                  <TicketTimeline history={timelineHistory} messages={timelineMessages} />
                </div>
              </div>
            )}
            {showCierre && showCierre.show && (
              <div className="my-3 p-3 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-center font-medium shadow-sm border border-green-200 dark:border-green-700">
                {showCierre.text}
              </div>
            )}
            <div style={{ height: '1px' }} />
          </div>

          <footer className="bg-card/95 backdrop-blur-sm p-3 sm:p-4 border-t border-border min-w-0">
            {esperandoDireccion ? (
              <div>
                <AddressAutocomplete
                  onSelect={(addressText: string) => handleSend({ text: addressText })}
                  autoFocus
                  placeholder="Ej: Av. Principal 123, Ciudad"
                  value={direccionGuardada ? { label: direccionGuardada, value: direccionGuardada } : undefined}
                  onChange={(opt) => setDireccionGuardada(opt ? (typeof opt.value === "string" ? opt.value : opt.value?.description ?? null) : null)}
                  persistKey="ultima_direccion"
                />
                {direccionGuardada && <TicketMap ticket={{ direccion: direccionGuardada }} />}
                <button
                  onClick={handleShareGps}
                  className="mt-2 text-sm text-primary hover:underline"
                  type="button"
                >
                  Compartir ubicación por GPS
                </button>
                <p className="text-xs mt-1.5 text-muted-foreground">
                  Ingresá tu dirección o compartí tu ubicación GPS para continuar.
                </p>
              </div>
            ) : !showCierre || !showCierre.show ? (
              <ChatInput
                onSendMessage={handleSend} // handleSend se pasa a ChatInput
                isTyping={isTyping}
              />
            ) : (
              <p className="text-center text-sm text-muted-foreground py-2">Conversación finalizada.</p>
            )}
          </footer>
        </div>
      </main>
    </div>
  );
};

export default ChatPage;
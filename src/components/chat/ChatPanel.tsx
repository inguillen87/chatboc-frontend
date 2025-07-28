  import React, { useState, useRef, useEffect, useCallback, Suspense } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import ChatHeader from "./ChatHeader"; 
import ChatMessage from "./ChatMessage"; // Usa el ChatMessage refactorizado
import { motion } from "framer-motion";
import TypingIndicator from "./TypingIndicator";
import UserTypingIndicator from "./UserTypingIndicator";
import ChatInput from "./ChatInput";
import ScrollToBottomButton from "@/components/ui/ScrollToBottomButton";
import AddressAutocomplete from "@/components/ui/AddressAutocomplete";
import TicketMap from "@/components/TicketMap";
import { Message, SendPayload } from "@/types/chat"; // Tipos actualizados
import { apiFetch, getErrorMessage } from "@/utils/api"; // getErrorMessage añadido
import { playMessageSound } from "@/utils/sounds";
import { useUser } from "@/hooks/useUser";
import { parseRubro, esRubroPublico, getAskEndpoint } from "@/utils/chatEndpoints";
import { safeLocalStorage } from "@/utils/safeLocalStorage";
import getOrCreateAnonId from "@/utils/anonId";
import { parseChatResponse } from "@/utils/parseChatResponse"; // Asegurarse que parseChatResponse es compatible o simplificar
import filterLoginPrompt from "@/utils/adminChatFilter.js";
import { getCurrentTipoChat } from "@/utils/tipoChat";
import { requestLocation } from "@/utils/geolocation";
import { toast } from "@/components/ui/use-toast";
import RubroSelector, { Rubro } from "./RubroSelector";

const FRASES_DIRECCION = [
  "indicame la dirección", "necesito la dirección", "ingresa la dirección",
  "especificá la dirección", "decime la dirección", "dirección exacta",
  "¿cuál es la dirección?", "por favor indique la dirección",
  "por favor ingrese su dirección", "dirección completa",
];

const FRASES_EXITO = [
  "Tu reclamo fue generado", "¡Muchas gracias por tu calificación!",
  "Dejaré el ticket abierto", "El curso de seguridad vial es online",
  "He abierto una sala de chat directa", "Tu número de chat es", "ticket **M-",
];

const PENDING_TICKET_KEY = 'pending_ticket_id';
const PENDING_GPS_KEY = 'pending_gps';

interface ChatPanelProps {
  mode?: "standalone" | "iframe" | "script";
  widgetId?: string;
  entityToken?: string;
  initialIframeWidth?: string;
  initialIframeHeight?: string;
  onClose?: () => void;
  openWidth?: string;
  openHeight?: string;
  tipoChat?: "pyme" | "municipio";
  onRequireAuth?: () => void;
  onOpenUserPanel?: () => void;
  onShowLogin?: () => void;
  onShowRegister?: () => void;
  initialRubro?: string;
  muted?: boolean;
  onToggleSound?: () => void;
  onCart?: () => void;
}

const ChatPanel = ({
  mode = "standalone",
  widgetId = "chatboc-widget-iframe",
  entityToken: propEntityToken,
  // initialIframeWidth, initialIframeHeight, // No usados directamente, quizás para el script de embebido
  // openWidth, openHeight, // No usados directamente
  tipoChat = getCurrentTipoChat(),
  onClose,
  onRequireAuth,
  onOpenUserPanel,
  onShowLogin,
  onShowRegister,
  selectedRubro,
  onRubroSelect,
  muted = false,
  onToggleSound,
  onCart,
}: ChatPanelProps) => {

  const [messages, setMessages] = useState<Message[]>([]);
  const [isBotTyping, setIsBotTyping] = useState(false); // Renombrado para claridad
  const [isSendingUserMessage, setIsSendingUserMessage] = useState(false); // Nuevo estado
  const [userTyping, setUserTyping] = useState(false);
  const [preguntasUsadas, setPreguntasUsadas] = useState(0); // No parece usarse activamente, considerar limpieza
  const [rubrosDisponibles, setRubrosDisponibles] = useState<Rubro[]>([]);
  const [esperandoRubro, setEsperandoRubro] = useState(false);
  const [cargandoRubros, setCargandoRubros] = useState(false);
  const [pendingAction, setPendingAction] = useState<"login" | "register" | null>(null);
  const [contexto, setContexto] = useState({});
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [activeTicketId, setActiveTicketId] = useState<number | null>(() => {
    if (typeof window === 'undefined') return null;
    const stored = safeLocalStorage.getItem(PENDING_TICKET_KEY);
    return stored ? Number(stored) : null;
  });
  const [ticketLocation, setTicketLocation] = useState<{ direccion?: string | null; latitud?: number | null; longitud?: number | null; municipio_nombre?: string | null } | null>(null);
  const [pollingErrorShown, setPollingErrorShown] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null); // Para el div al final del todo
  const lastMessageElementRef = useRef<HTMLDivElement>(null); // Para el último elemento de mensaje real
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const lastQueryRef = useRef<string | null>(null);
  const ultimoMensajeIdRef = useRef<number | null>(null);
  const clientMessageIdCounter = useRef(0);

  const [esperandoDireccion, setEsperandoDireccion] = useState(false);
  const [forzarDireccion, setForzarDireccion] = useState(false);
  const [direccionGuardada, setDireccionGuardada] = useState<string | null>(null);
  const [locationRequest, setLocationRequest] = useState<{ type: 'gps_mandatory' | 'address_mandatory', message: string, fieldToUpdate?: string } | null>(null); // Nuevo estado para solicitudes de ubicación dirigidas
  const [showCierre, setShowCierre] = useState<{ show: boolean; text: string } | null>(null);
  const initialMessageAddedRef = useRef(false);

  useEffect(() => {
    if (activeTicketId) {
      safeLocalStorage.removeItem(PENDING_TICKET_KEY);
    }
  }, [activeTicketId]);

  useEffect(() => {
    const stored = safeLocalStorage.getItem("ultima_direccion");
    if (stored) setDireccionGuardada(stored);
  }, []);

  const getAuthTokenFromLocalStorage = () =>
    typeof window === "undefined" ? null : safeLocalStorage.getItem("authToken");
  const anonId = getOrCreateAnonId();
  const finalAuthToken = getAuthTokenFromLocalStorage();

  useEffect(() => {
    if (mode === "iframe" && propEntityToken) {
      safeLocalStorage.setItem("entityToken", propEntityToken);
    } else if (mode === "iframe" && !propEntityToken) {
      safeLocalStorage.removeItem("entityToken");
    }
  }, [mode, propEntityToken]);

  const esAnonimo = !finalAuthToken;
  const { user, refreshUser, loading: userLoading } = useUser(); // Renombrar loading para evitar conflicto

  const generateClientMessageId = () => {
    clientMessageIdCounter.current += 1;
    return `client-${Date.now()}-${clientMessageIdCounter.current}`;
  };

  useEffect(() => {
    if (!esAnonimo && (!user || !user.rubro) && !userLoading) {
      refreshUser();
    }
  }, [esAnonimo, user, refreshUser, userLoading]);
  const storedUser = typeof window !== "undefined" ? JSON.parse(safeLocalStorage.getItem("user") || "null") : null;

  const rubroActual = parseRubro(selectedRubro) || parseRubro(user?.rubro) || parseRubro(storedUser?.rubro) || null;
  const rubroNormalizado = rubroActual;
  const isMunicipioRubro = esRubroPublico(rubroNormalizado || undefined);
  const tipoChatActual: "pyme" | "municipio" =
    (tipoChat && (tipoChat === "municipio" || tipoChat === "pyme"))
      ? tipoChat
      : (rubroNormalizado && isMunicipioRubro ? "municipio" : "pyme");

  const isMobile = useIsMobile();

  const fetchTicket = useCallback(async () => {
    if (!activeTicketId) return;
    const currentToken = getAuthTokenFromLocalStorage();
    try {
      const authHeaders = currentToken ? { Authorization: `Bearer ${currentToken}` } : {};
      const entityTokenFromStorage = safeLocalStorage.getItem("entityToken");
      const entityHeaders = entityTokenFromStorage ? { 'X-Entity-Token': entityTokenFromStorage } : {};

      const data = await apiFetch<{ direccion?: string | null; latitud?: number | string | null; longitud?: number | null; municipio_nombre?: string | null }>(
        `/tickets/municipio/${activeTicketId}`,
        { headers: { ...authHeaders, ...entityHeaders }, skipAuth: !currentToken, sendAnonId: esAnonimo }
      );
      const normalized = {
        ...data,
        latitud: data.latitud != null ? Number(data.latitud) : null,
        longitud: data.longitud != null ? Number(data.longitud) : null,
      };
      setTicketLocation(normalized);
    } catch (e) {
      console.error("Error al refrescar ticket:", e);
    }
  }, [activeTicketId, esAnonimo]);

  const handleShareGps = useCallback(() => {
    if (esAnonimo) {
      if (activeTicketId) safeLocalStorage.setItem(PENDING_TICKET_KEY, String(activeTicketId));
      safeLocalStorage.setItem(PENDING_GPS_KEY, '1');
      onRequireAuth?.();
      return;
    }
    if (!activeTicketId) return;
    safeLocalStorage.removeItem(PENDING_GPS_KEY);
    requestLocation({ enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }).then(async (coords) => {
      if (!coords) {
        setForzarDireccion(true);
        setEsperandoDireccion(true);
        setMessages((prev) => [...prev, {
          id: generateClientMessageId(),
          text: "No pudimos acceder a tu ubicación por GPS. Verificá los permisos y que estés usando una conexión segura (https). Ingresá la dirección manualmente para continuar.",
          isBot: true, timestamp: new Date()
        }]);
        return;
      }
      try {
        const currentToken = getAuthTokenFromLocalStorage();
        const authHeaders = currentToken ? { Authorization: `Bearer ${currentToken}` } : {};
        const entityTokenFromStorage = safeLocalStorage.getItem("entityToken");
        const entityHeaders = entityTokenFromStorage ? { 'X-Entity-Token': entityTokenFromStorage } : {};
        const locationPayload = { lat: coords.latitud, lon: coords.longitud };

        await apiFetch(`/tickets/chat/${activeTicketId}/ubicacion`, { method: "PUT", headers: { ...authHeaders, ...entityHeaders }, body: locationPayload, skipAuth: !currentToken, sendAnonId: esAnonimo });
        await apiFetch(`/tickets/municipio/${activeTicketId}/ubicacion`, { method: "PUT", headers: { ...authHeaders, ...entityHeaders }, body: locationPayload, skipAuth: !currentToken, sendAnonId: esAnonimo });
        safeLocalStorage.removeItem(PENDING_GPS_KEY);
        setForzarDireccion(false);
        fetchTicket();
      } catch (e) { console.error("Error al enviar ubicación", e); }
    });
  }, [activeTicketId, fetchTicket, esAnonimo, onRequireAuth]);

  useEffect(() => { fetchTicket(); }, [activeTicketId, fetchTicket]);

  useEffect(() => {
    if (!activeTicketId || esAnonimo) return;
    const pending = safeLocalStorage.getItem(PENDING_GPS_KEY);
    if (pending) {
      safeLocalStorage.removeItem(PENDING_GPS_KEY);
      handleShareGps();
    }
  }, [activeTicketId, esAnonimo, handleShareGps]);

  useEffect(() => {
    if (!activeTicketId) return;
    const pending = safeLocalStorage.getItem(PENDING_GPS_KEY);
    if (esAnonimo) {
      if (pending) {
        safeLocalStorage.setItem(PENDING_TICKET_KEY, String(activeTicketId));
        onRequireAuth?.();
      }
      return;
    }
    if (!pending) return;
    requestLocation({ enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }).then(async (coords) => {
      if (!coords) {
        setForzarDireccion(true);
        setEsperandoDireccion(true);
        setMessages((prev) => [...prev, {
          id: generateClientMessageId(),
          text: "No pudimos acceder a tu ubicación por GPS. Verificá los permisos y que estés usando una conexión segura (https). Ingresá la dirección manualmente para continuar.",
          isBot: true, timestamp: new Date()
        }]);
        return;
      }
      try {
        const currentToken = getAuthTokenFromLocalStorage();
        const authHeaders = currentToken ? { Authorization: `Bearer ${currentToken}` } : {};
        const entityTokenFromStorage = safeLocalStorage.getItem("entityToken");
        const entityHeaders = entityTokenFromStorage ? { 'X-Entity-Token': entityTokenFromStorage } : {};
        const locationPayload = { lat: coords.latitud, lon: coords.longitud };

        await apiFetch(`/tickets/chat/${activeTicketId}/ubicacion`, { method: "PUT", headers: { ...authHeaders, ...entityHeaders }, body: locationPayload, skipAuth: !currentToken, sendAnonId: esAnonimo });
        await apiFetch(`/tickets/municipio/${activeTicketId}/ubicacion`, { method: "PUT", headers: { ...authHeaders, ...entityHeaders }, body: locationPayload, skipAuth: !currentToken, sendAnonId: esAnonimo });
        fetchTicket();
      } catch (e) { console.error("Error al enviar ubicación", e); }
    }).catch(() => setForzarDireccion(true));
  }, [activeTicketId, fetchTicket, esAnonimo, onRequireAuth]);

  function shouldShowAutocomplete(currentMessages: Message[], currentContexto: any) {
    const lastBotMsg = [...currentMessages].reverse().find((m) => m.isBot && m.text);
    if (!lastBotMsg?.text) return false;
    const contenido = lastBotMsg.text.toLowerCase();
    if (FRASES_DIRECCION.some((frase) => contenido.includes(frase))) return true;
    return currentContexto?.contexto_municipio?.estado_conversacion === "ESPERANDO_DIRECCION_RECLAMO" || currentContexto?.contexto_municipio?.estado_conversacion === 4;
  }

  function checkCierreExito(currentMessages: Message[]) {
    const lastBotMsg = [...currentMessages].reverse().find((m) => m.isBot && m.text);
    if (!lastBotMsg?.text) return null;
    const contenido = lastBotMsg.text.toLowerCase();
    if (FRASES_EXITO.some((frase) => contenido.includes(frase))) {
      const match = contenido.match(/ticket \*\*m-(\d+)/i);
      if (match) {
        return { show: true, text: `✅ ¡Listo! Tu ticket fue generado exitosamente. Número: M-${match[1]}.\nUn agente municipal te va a contactar para seguimiento.` };
      }
      return { show: true, text: lastBotMsg.text };
    }
    return null;
  }

  useEffect(() => {
    const autocomplete = shouldShowAutocomplete(messages, contexto) || forzarDireccion;
    setEsperandoDireccion(autocomplete);
    setShowCierre(autocomplete ? null : checkCierreExito(messages));
  }, [messages, contexto, forzarDireccion]);

  const cargarRubros = async () => {
    setCargandoRubros(true);
    setRubrosDisponibles([]);
    try {
      const data = await apiFetch("/rubros/", { skipAuth: true, sendEntityToken: true });
      setRubrosDisponibles(Array.isArray(data) ? data : []);
    } catch {
      setRubrosDisponibles([]);
    } finally {
      setCargandoRubros(false);
    }
  };

  useEffect(() => {
    if (!activeTicketId) return;
    let intervalId: NodeJS.Timeout | undefined;
    const fetchAllMessages = async () => {
      try {
        const currentToken = getAuthTokenFromLocalStorage();
        const authHeaders = currentToken ? { Authorization: `Bearer ${currentToken}` } : {};
        const entityTokenFromStorage = safeLocalStorage.getItem("entityToken");
        const entityHeaders = entityTokenFromStorage ? { 'X-Entity-Token': entityTokenFromStorage } : {};

        const data = await apiFetch<{ estado_chat: string; mensajes: any[] }>(
          `/tickets/chat/${activeTicketId}/mensajes?ultimo_mensaje_id=${ultimoMensajeIdRef.current ?? 0}`,
          { headers: { ...authHeaders, ...entityHeaders }, sendAnonId: esAnonimo }
        );

        if (data.mensajes && data.mensajes.length > 0) {
          const nuevosMensajes: Message[] = data.mensajes.map((msg) => ({
            id: msg.id,
            text: msg.texto,
            isBot: msg.es_admin,
            timestamp: new Date(msg.fecha),
            // query: undefined, // Si es necesario para mensajes de chat en vivo
            mediaUrl: msg.media_url,
            locationData: msg.ubicacion,
            attachmentInfo: msg.attachment_info, // Asumir que el backend puede enviar esto
            structuredContent: msg.structured_content, // Asumir que el backend puede enviar esto
          }));
          setMessages((prev) => [...prev, ...nuevosMensajes]);
          ultimoMensajeIdRef.current = data.mensajes[data.mensajes.length - 1].id;
        }
        await fetchTicket(); // Actualizar info del ticket (ej. ubicación si se añadió)
        if (["resuelto", "cerrado"].includes(data.estado_chat)) {
          if (intervalId) clearInterval(intervalId);
          setMessages((prev) => [...prev, {
            id: generateClientMessageId(), text: "Un agente ha finalizado esta conversación.",
            isBot: true, timestamp: new Date()
          }]);
        }
      } catch (error) {
        console.error("Error durante el polling:", error);
        if (!pollingErrorShown) {
          setMessages((prev) => [...prev, {
            id: generateClientMessageId(), text: "⚠️ Servicio no disponible.",
            isBot: true, timestamp: new Date()
          }]);
          setPollingErrorShown(true);
        }
      }
    };
    fetchAllMessages();
    intervalId = setInterval(fetchAllMessages, 10000);
    return () => { if (intervalId) clearInterval(intervalId); };
  }, [activeTicketId, esAnonimo, pollingErrorShown, fetchTicket]);

  const handleSendMessage = useCallback(
    async (payload: SendPayload) => {
      const userMessageText = payload.text.trim();
      if (!userMessageText && !payload.attachmentInfo && !payload.ubicacion_usuario && !payload.action) return;
      if (isSendingUserMessage || isBotTyping) return; // Prevenir envíos múltiples

      setIsSendingUserMessage(true); // Inicia envío

      if (esAnonimo && mode === "standalone" && !selectedRubro && !payload.action) {
        setMessages((prev) => [...prev, { id: generateClientMessageId(), text: "🛈 Por favor, seleccioná primero un rubro.", isBot: true, timestamp: new Date() }]);
        setIsSendingUserMessage(false); return;
      }
      if (!esAnonimo) {
        if (userLoading) {
          setMessages((prev) => [...prev, { id: generateClientMessageId(), text: "⏳ Cargando tu perfil, intentá nuevamente...", isBot: true, timestamp: new Date() }]);
          setIsSendingUserMessage(false); return;
        }
        if (!rubroNormalizado && !payload.action) {
          setMessages((prev) => [...prev, { id: generateClientMessageId(), text: "🛈 Definí tu rubro en el perfil antes de usar el chat.", isBot: true, timestamp: new Date() }]);
          setIsSendingUserMessage(false); return;
        }
      }

      if (esperandoDireccion && userMessageText) {
        setEsperandoDireccion(false); setForzarDireccion(false);
        safeLocalStorage.setItem("ultima_direccion", userMessageText);
        setDireccionGuardada(userMessageText);
        if (activeTicketId) {
          try {
            await apiFetch(`/tickets/chat/${activeTicketId}/ubicacion`, { method: "PUT", body: { direccion: userMessageText }, skipAuth: !finalAuthToken, sendAnonId: esAnonimo });
            await apiFetch(`/tickets/municipio/${activeTicketId}/ubicacion`, { method: "PUT", body: { direccion: userMessageText }, skipAuth: !finalAuthToken, sendAnonId: esAnonimo });
            fetchTicket();
            toast({ title: "Dirección enviada", duration: 2000 });
          } catch (e) { console.error("Error al enviar dirección", e); toast({ title: "Error enviando dirección", variant: "destructive" }); }
        }
      }
      setShowCierre(null);

      setMessages((prev) => [...prev, {
        id: generateClientMessageId(), text: userMessageText, isBot: false, timestamp: new Date(),
        attachmentInfo: payload.attachmentInfo, // Mostrar el adjunto del usuario inmediatamente
        locationData: payload.ubicacion_usuario, // Mostrar la ubicación del usuario inmediatamente
      }]);
      lastQueryRef.current = userMessageText;
      setIsBotTyping(true);

      try {
        const currentToken = getAuthTokenFromLocalStorage();
        const authHeaders = currentToken ? { Authorization: `Bearer ${currentToken}` } : {};
        const entityTokenFromStorage = safeLocalStorage.getItem("entityToken");
        const entityHeaders = entityTokenFromStorage ? { 'X-Entity-Token': entityTokenFromStorage } : {};

        if (activeTicketId) {
          await apiFetch(`/tickets/chat/${activeTicketId}/responder_ciudadano`, { 
            method: "POST", headers: { "Content-Type": "application/json", ...authHeaders, ...entityHeaders },
            body: { comentario: userMessageText, attachment_info: payload.attachmentInfo, ubicacion: payload.ubicacion_usuario },
            skipAuth: !currentToken, sendAnonId: esAnonimo
          });
        } else {
          const endpoint = getAskEndpoint({ tipoChat: tipoChatActual, rubro: rubroNormalizado || undefined });
          const requestBody: Record<string, any> = { 
            pregunta: userMessageText, contexto_previo: contexto, tipo_chat: tipoChatActual,
            ...(rubroNormalizado && { rubro_clave: rubroNormalizado }),
            ...(esAnonimo && anonId && { anon_id: anonId }),
            ...(payload.attachmentInfo && { attachment_info: payload.attachmentInfo }),
            ...(payload.ubicacion_usuario && { ubicacion_usuario: payload.ubicacion_usuario }),
            ...(payload.action && { action: payload.action }),
          };

          const data = await apiFetch<any>(endpoint, { 
            method: "POST", headers: { "Content-Type": "application/json", ...authHeaders, ...entityHeaders },
            body: requestBody, skipAuth: !currentToken, sendEntityToken: true
          });

          setContexto(data.contexto_actualizado || {});
          // parseChatResponse ahora es menos crítico si mapeamos campos directamente.
          // const parsed = parseChatResponse(data);
          const filtered = filterLoginPrompt(data.respuesta || "", data.botones || [], user?.rol);

          const botMessage: Message = {
            id: generateClientMessageId(), text: filtered.text || "", isBot: true, timestamp: new Date(),
            botones: filtered.buttons, query: lastQueryRef.current || undefined,
            mediaUrl: data.media_url, locationData: data.location_data,
            attachmentInfo: data.attachment_info,
            structuredContent: data.structured_content,
            displayHint: data.display_hint,
            chatBubbleStyle: data.chat_bubble_style,
          };

          // Procesar solicitud de ubicación dirigida por backend
          if (data.location_request_options && (data.location_request_options.type === 'gps_mandatory' || data.location_request_options.type === 'address_mandatory')) {
            setLocationRequest({
              type: data.location_request_options.type,
              message: data.location_request_options.message || (data.location_request_options.type === 'gps_mandatory' ? "Se requiere tu ubicación GPS para continuar." : "Se requiere tu dirección para continuar."),
              fieldToUpdate: data.location_request_options.fieldToUpdate // Opcional, para saber qué campo del backend actualizar
            });
            // No mostramos el AddressAutocomplete genérico si es una solicitud mandatoria de este tipo
            setEsperandoDireccion(false);
          } else {
            // Si no hay solicitud mandatoria, verificar si se debe mostrar el autocomplete normal
            setEsperandoDireccion(shouldShowAutocomplete(messages, data.contexto_actualizado || contexto) || forzarDireccion);
            setLocationRequest(null); // Limpiar cualquier solicitud anterior
          }


          if (botMessage.text.trim() || (botMessage.botones && botMessage.botones.length > 0) || botMessage.mediaUrl || botMessage.locationData || botMessage.attachmentInfo || (botMessage.structuredContent && botMessage.structuredContent.length > 0) ) {
            setMessages((prev) => [...prev, botMessage]);
          }
          lastQueryRef.current = null;

          if (data.ticket_id) {
            if (esAnonimo) {
              safeLocalStorage.setItem(PENDING_TICKET_KEY, String(data.ticket_id));
              onRequireAuth?.();
            } else {
              setActiveTicketId(data.ticket_id);
              ultimoMensajeIdRef.current = 0;
            }
          }
          if (!esAnonimo) await refreshUser();
        }
      } catch (error: any) {
        const errorMsg = getErrorMessage(error, '⚠️ No se pudo conectar con el servidor.');
        setMessages((prev) => [...prev, { id: generateClientMessageId(), text: errorMsg, isBot: true, timestamp: new Date() }]);
        toast({ title: 'Error de comunicación', description: errorMsg, variant: 'destructive', duration: 5000 });
      } finally {
        setIsBotTyping(false);
        setIsSendingUserMessage(false); // Finaliza envío
      }
    },
    [contexto, esAnonimo, mode, selectedRubro, activeTicketId, esperandoDireccion, anonId, rubroNormalizado, tipoChatActual, fetchTicket, onRequireAuth, userLoading, finalAuthToken, refreshUser, isSendingUserMessage, isBotTyping, preguntasUsadas]
  );

  const handleInternalAction = useCallback(
    (action: string) => {
      const normalized = action.toLowerCase().replace(/[_\s-]+/g, "");
      const isAdmin = user?.rol && user.rol !== "usuario";

      if (["login", "loginpanel", "chatuserloginpanel"].includes(normalized)) {
        if (!isAdmin) onShowLogin?.(); return;
      }
      if (["register", "registerpanel", "chatuserregisterpanel"].includes(normalized)) {
        if (!isAdmin) onShowRegister?.(); return;
      }
      if (["cart", "carrito", "opencart", "vercarrito"].includes(normalized)) {
        onCart?.(); return;
      }
      handleSendMessage({ text: action, action: normalized });
    },
    [onShowLogin, onShowRegister, onCart, handleSendMessage, user]
  );

  const handleFileUploaded = useCallback(
    (fileData: { url: string; name: string; mimeType?: string; size?: number; }) => { // Ahora recibe el objeto completo
      if (fileData?.url && fileData?.name) {
        handleSendMessage({
          text: `Archivo adjunto: ${fileData.name}`, // Texto descriptivo
          attachmentInfo: { // Usar el nuevo campo attachmentInfo en SendPayload
            name: fileData.name,
            url: fileData.url,
            mimeType: fileData.mimeType,
            size: fileData.size,
          },
          // Los campos es_foto y archivo_url se pueden mantener por retrocompatibilidad
          // si el backend aún los usa específicamente, o si se quiere una lógica
          // de renderizado rápido antes de que el backend procese attachmentInfo.
          es_foto: fileData.mimeType?.startsWith("image/"),
          archivo_url: fileData.url
        });
      }
    },
    [handleSendMessage]
  );

  useEffect(() => {
    if (esAnonimo && mode === "standalone" && !selectedRubro && !propEntityToken) {
      setEsperandoRubro(true); cargarRubros(); return;
    }
    setEsperandoRubro(false);
    if (!initialMessageAddedRef.current && (!esAnonimo || selectedRubro)) {
      if (messages.length === 0) {
        setMessages([{ id: generateClientMessageId(), text: "¡Hola! Soy Chatboc. ¿En qué puedo ayudarte hoy?", isBot: true, timestamp: new Date() }]);
      }
      initialMessageAddedRef.current = true;
    }
  }, [esAnonimo, mode, selectedRubro, propEntityToken, messages.length]); // messages.length para re-evaluar si se borran mensajes

  useEffect(() => {
    const container = chatContainerRef.current;
    if (container) {
      const atBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
      if (atBottom) {
        if (lastMessageElementRef.current) {
          lastMessageElementRef.current.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
        } else {
          // Fallback si lastMessageElementRef no está listo, aunque debería estarlo si hay mensajes.
          messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
        setShowScrollDown(false);
      } else {
        // Si el usuario no está al final, solo actualizamos si se debe mostrar el botón de scroll down.
        // Esto evita que el scroll salte si el usuario está leyendo mensajes antiguos y llega uno nuevo.
        setShowScrollDown(true);
      }
    }
    if (!isBotTyping && !isSendingUserMessage && !esperandoDireccion && !esperandoRubro && (!showCierre || !showCierre.show) ) {
      // Solo enfocar si no hay un modal o estado de espera activo
      chatInputRef.current?.focus(); 
    }
  }, [messages, isBotTyping, userTyping, ticketLocation, isSendingUserMessage, esperandoDireccion, esperandoRubro, showCierre]);

  useEffect(() => {
    if (messages.length === 0) return;
    const last = messages[messages.length - 1];
    if (last.isBot && !muted) playMessageSound();
  }, [messages, muted]);

  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;
    const onScroll = () => {
      const atBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
      setShowScrollDown(!atBottom);
    };
    container.addEventListener('scroll', onScroll);
    onScroll(); // Llama una vez para estado inicial
    return () => container.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!esperandoRubro && !esperandoDireccion && (!showCierre || !showCierre.show)) {
      const timer = setTimeout(() => chatInputRef.current?.focus(), 150);
      return () => clearTimeout(timer);
    }
  }, [esperandoRubro, esperandoDireccion, showCierre, messages.length]);

  return (
    <div className={cn("flex flex-col w-full h-full bg-card text-card-foreground overflow-hidden relative", isMobile ? undefined : "rounded-2xl")}>
      <ChatHeader onClose={onClose} onProfile={onOpenUserPanel} muted={muted} onToggleSound={onToggleSound} onCart={onCart} />
      <div ref={chatContainerRef} className="flex-1 p-2 sm:p-4 min-h-0 flex flex-col gap-3 overflow-y-auto">
          {esperandoRubro ? (
            // ... (código de selección de rubro sin cambios) ...
            <div className="text-center w-full">
              <h2 className="text-primary mb-2">👋 ¡Bienvenido!</h2>
              <div className="text-muted-foreground mb-2">¿De qué rubro es tu negocio?</div>
              {cargandoRubros ? ( <div className="text-muted-foreground my-5">Cargando rubros...</div>
              ) : rubrosDisponibles.length === 0 ? (
                <div className="text-destructive my-5"> No se pudieron cargar los rubros. <br />
                  <button onClick={cargarRubros} className="mt-2 underline text-primary hover:text-primary/80" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>Reintentar</button>
                </div>
              ) : (
                <RubroSelector rubros={rubrosDisponibles}
                  onSelect={(rubro: any) => {
                    safeLocalStorage.setItem('rubroSeleccionado', rubro.nombre);
                    onRubroSelect(rubro.nombre); setEsperandoRubro(false);
                    setMessages([{ id: Date.now(), text: `¡Hola! Soy Chatboc, tu asistente para ${rubro.nombre.toLowerCase()}. ¿En qué puedo ayudarte hoy?`, isBot: true, timestamp: new Date() }]);
                    if (pendingAction === 'login') onShowLogin?.();
                    else if (pendingAction === 'register') onShowRegister?.();
                    setPendingAction(null);
                  }}
                />
              )}
            </div>
          ) : locationRequest ? ( // NUEVO: Mostrar UI para solicitud de ubicación mandatoria
            <div className="flex flex-col items-center justify-center text-center p-4 m-auto bg-card border rounded-lg shadow-lg max-w-md">
              <AlertTriangle className="h-12 w-12 text-primary mb-4" />
              <p className="text-lg font-semibold text-foreground mb-2">Solicitud de Ubicación</p>
              <p className="text-sm text-muted-foreground mb-4">{locationRequest.message}</p>
              {locationRequest.type === 'gps_mandatory' && (
                <Button onClick={() => {
                  handleShareGps(); // Asumimos que handleShareGps enviará la ubicación al backend
                  setLocationRequest(null); // Limpiar la solicitud después de intentar
                }} className="w-full mb-2">
                  Compartir Ubicación GPS
                </Button>
              )}
              {locationRequest.type === 'address_mandatory' && (
                 <AddressAutocomplete
                    onSelect={(addr) => {
                      handleSendMessage({ text: addr, action: `direccion_suministrada_para_${locationRequest.fieldToUpdate || 'reclamo'}` });
                      safeLocalStorage.setItem('ultima_direccion', addr);
                      setDireccionGuardada(addr);
                      setLocationRequest(null); // Limpiar la solicitud
                    }}
                    autoFocus
                    placeholder="Ej: Av. Principal 123, Ciudad"
                    // Podríamos añadir una forma de cancelar o decir "no puedo proveerla"
                 />
              )}
               <Button variant="outline" size="sm" onClick={() => {
                  handleSendMessage({ text: "No deseo proveer la ubicación en este momento.", action: "ubicacion_denegada" });
                  setLocationRequest(null);
               }} className="mt-3 w-full">
                  No proveer ubicación ahora
              </Button>
            </div>
          ) : esperandoDireccion ? ( // Lógica anterior para AddressAutocomplete genérico
            <div className="flex flex-col items-center py-8 px-2 gap-4">
              <div className="text-primary text-base font-semibold mb-2">Indicá la dirección exacta (autocompleta con Google)</div>
              <AddressAutocomplete
                onSelect={(addr) => {
                  handleSendMessage({ text: addr });
                  safeLocalStorage.setItem('ultima_direccion', addr);
                  setDireccionGuardada(addr); setEsperandoDireccion(false);
                }}
                autoFocus placeholder="Ej: Av. Principal 123"
                value={direccionGuardada ? { label: direccionGuardada, value: direccionGuardada } : undefined}
                onChange={(opt) => setDireccionGuardada(opt ? (typeof opt.value === 'string' ? opt.value : opt.value?.description ?? null) : null)}
                persistKey="ultima_direccion"
              />
              {direccionGuardada && (<TicketMap ticket={{ direccion: direccionGuardada }} />)}
              <button onClick={handleShareGps} className="text-primary underline text-sm" type="button">Compartir ubicación por GPS</button>
              <div className="text-xs text-muted-foreground mt-2">Escribí y seleccioná tu dirección para continuar el trámite.</div>
            </div>
          ) : ( // Renderizado normal de mensajes
            <>
              {messages.map((msg, index) =>
                <ChatMessage key={msg.id} message={msg}
                  ref={index === messages.length - 1 ? lastMessageElementRef : null}
                  isTyping={isBotTyping || isSendingUserMessage} // Deshabilitar botones si el bot o el usuario están "ocupados"
                  onButtonClick={handleSendMessage}
                  onInternalAction={handleInternalAction}
                  tipoChat={tipoChatActual} /* query={msg.query} // query no es una prop de ChatMessage */
                />
              )}
              {isBotTyping && <TypingIndicator />}
              {userTyping && <UserTypingIndicator />}
              {ticketLocation && (<TicketMap ticket={{ ...ticketLocation, tipo: 'municipio' }} />)}
              <div ref={messagesEndRef} />
              {showCierre?.show && (
                <motion.div className="my-3 p-3 rounded-lg bg-primary/10 text-primary text-center font-semibold shadow"
                  initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}>
                  {showCierre.text}
                </motion.div>
              )}
            </>
          )}
      </div>
      <ScrollToBottomButton target={chatContainerRef.current} />
      {!esperandoRubro && !esperandoDireccion && (!showCierre || !showCierre.show) && (
        <div className="w-full bg-card px-3 py-2 border-t min-w-0">
          <ChatInput
            onSendMessage={handleSendMessage}
            isTyping={isBotTyping || isSendingUserMessage} // Input deshabilitado si el bot está escribiendo o el mensaje del usuario se está enviando
            inputRef={chatInputRef}
            onTypingChange={setUserTyping}
          />
        </div>
      )}
    </div>
  );
};

export default ChatPanel;
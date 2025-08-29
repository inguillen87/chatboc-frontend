// src/hooks/useChatLogic.ts
import { useState, useEffect, useRef, useCallback } from "react";
import { Message, SendPayload as TypeSendPayload } from "@/types/chat";
import { io, Socket } from "socket.io-client";
import { getSocketUrl } from "@/config";
import { apiFetch, getErrorMessage } from "@/utils/api";
import { getAskEndpoint } from "@/utils/chatEndpoints";
import { enforceTipoChatForRubro } from "@/utils/tipoChat";
import { safeLocalStorage } from "@/utils/safeLocalStorage";
import getOrCreateChatSessionId from "@/utils/chatSessionId";
import { getIframeToken } from "@/utils/config";
import { v4 as uuidv4 } from 'uuid';
import { MunicipioContext, updateMunicipioContext, getInitialMunicipioContext } from "@/utils/contexto_municipio";
import { useUser } from './useUser';
import { safeOn, assertEventSource } from "@/utils/safeOn";
import { getVisitorName } from "@/utils/visitorName";

interface UseChatLogicOptions {
  tipoChat: 'pyme' | 'municipio';
  entityToken?: string;
  tokenKey?: string;
  skipAuth?: boolean;
}

export function useChatLogic({ tipoChat, entityToken: propToken, tokenKey = 'authToken', skipAuth = false }: UseChatLogicOptions) {
  const entityToken = propToken || getIframeToken();
  const { user } = useUser();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [contexto, setContexto] = useState<MunicipioContext>(() => getInitialMunicipioContext());
  const [activeTicketId, setActiveTicketId] = useState<number | null>(null);
  const [currentClaimIdempotencyKey, setCurrentClaimIdempotencyKey] = useState<string | null>(null);

  const token = skipAuth ? null : safeLocalStorage.getItem(tokenKey);
  const isAnonimo = skipAuth || !token;

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const ultimoMensajeIdRef = useRef<number>(0);
  const clientMessageIdCounter = useRef(0);

  const generateClientMessageId = () => {
    clientMessageIdCounter.current += 1;
    return `client-${Date.now()}-${clientMessageIdCounter.current}`;
  };

  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!entityToken) {
      console.log("useChatLogic: No entityToken, socket connection deferred.");
      return;
    }
    if (!tipoChat) {
      console.log("useChatLogic: Deferring socket connection until tipoChat is available.");
      return;
    }

    // Setup Socket.IO
    const socketUrl = getSocketUrl();
    const userAuthToken = skipAuth ? null : safeLocalStorage.getItem(tokenKey);

    console.log("useChatLogic: Initializing socket", {
      socketUrl,
      entityToken,
      hasUserToken: !!userAuthToken
    });

    const socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
      auth: {
        ...(userAuthToken && { token: userAuthToken }), // Prioritize user JWT for auth
        entityToken: entityToken // Pass entity token for context
      }
    });

    if (!socket || typeof (socket as any).on !== "function") {
      console.error("Socket.io returned an invalid client", socket);
      return;
    }

    socketRef.current = socket;
    const sessionId = getOrCreateChatSessionId();

    const handleConnect = () => {
      console.log('Socket.IO connected, joining room with web channel...');
      socket.emit('join', { room: sessionId, channel: 'web' });

      // Automatically send a silent greeting to fetch the main menu on connect.
      const endpoint = getAskEndpoint({ tipoChat, rubro: null });
      const initialContext = getInitialMunicipioContext();

      console.log("useChatLogic: Sending initial greeting to fetch menu.");
      setIsTyping(true);

      const initialName = getVisitorName();
      apiFetch<any>(endpoint, {
        method: 'POST',
        skipAuth,
        body: {
          pregunta: '',
          action: 'initial_greeting',
          contexto_previo: initialContext,
          tipo_chat: tipoChat,
          ...(initialName && { nombre_usuario: initialName }),
        },
      })
        .catch(error => {
          console.error("Error sending initial greeting:", getErrorMessage(error));
          const errorMsg = getErrorMessage(error, '⚠️ No se pudo cargar el menú inicial.');
          setMessages(prev => [...prev, { id: generateClientMessageId(), text: errorMsg, isBot: true, timestamp: new Date(), isError: true }]);
          setIsTyping(false);
        });
    };

    const handleConnectError = (err: any) => {
      console.error('Socket.IO connection error:', err.message);
    };

    assertEventSource(socket, 'socket');
    safeOn(socket, 'connect', handleConnect);
    safeOn(socket, 'connect_error', handleConnectError);

    const handleBotMessage = (data: any) => {
      console.log('Bot response received:', data);

      // Actualizar el contexto con la respuesta del bot
      setContexto(prevContext => updateMunicipioContext(prevContext, { llmResponse: data }));

      // Sanitizar mensajes que mencionen al administrador del municipio
      let text = data.comentario || data.message_body || "⚠️ No se pudo generar una respuesta.";
      if (/es el Administrador de la Municipalidad/i.test(text)) {
        text = text
          .replace(/,?\s*[^.]*es el Administrador de la Municipalidad\.\s*/i, ' ')
          .replace(/^Hola\s+/, 'Hola, ') // Asegurar coma después de "Hola"
          .replace(/\s{2,}/g, ' ') // Colapsar espacios múltiples
          .trim();
      }

      const botMessage: Message = {
        id: data.id || generateClientMessageId(),
        text,
        isBot: true,
        timestamp: new Date(data.fecha || Date.now()),
        origen: data.origen,
        attachmentInfo: data.attachment_info,
        botones: data.botones || [],
        categorias: data.categorias || [],
        mediaUrl: data.media_url,
        locationData: data.location_data,
        isError: !data.message_body && !data.comentario,
        // Si el backend envía un ticket_id, lo adjuntamos al mensaje para referencia futura
        ticketId: data.ticket_id,
      };

      if (data.ticket_id) {
        setActiveTicketId(data.ticket_id);
      }

      setMessages(prev => [...prev, botMessage]);
      setIsTyping(false);
    };

    const handleDisconnect = () => {
      console.log('Socket.IO disconnected.');
    };

    safeOn(socket, 'bot_response', handleBotMessage);
    safeOn(socket, 'message', handleBotMessage);
    safeOn(socket, 'disconnect', handleDisconnect);

    // Cleanup on component unmount
    return () => {
      socket.off?.('connect', handleConnect);
      socket.off?.('connect_error', handleConnectError);
      socket.off?.('bot_response', handleBotMessage);
      socket.off?.('message', handleBotMessage);
      socket.off?.('disconnect', handleDisconnect);
      socket.disconnect();
    };
}, [entityToken, tipoChat]);

  useEffect(() => {
    if (contexto.estado_conversacion === 'confirmando_reclamo' && !activeTicketId) {
      const newKey = uuidv4();
      setCurrentClaimIdempotencyKey(newKey);
      console.log("useChatLogic: Generated idempotency key for claim confirmation:", newKey);
    }
  }, [contexto.estado_conversacion, activeTicketId]);

  const addSystemMessage = useCallback((text: string, type: 'error' | 'info' = 'info') => {
    const systemMessage: Message = {
      id: generateClientMessageId(),
      text,
      isBot: true,
      timestamp: new Date(),
      isError: type === 'error',
    };
    setMessages(prev => [...prev, systemMessage]);
    setIsTyping(false); // Ensure typing indicator is turned off for system messages
  }, []);

  const handleSend = useCallback(async (payload: string | TypeSendPayload) => {
    const actualPayload: TypeSendPayload = typeof payload === 'string' ? { text: payload.trim() } : { ...payload, text: payload.text?.trim() || "" };

    // Sanitize text by removing emojis to prevent issues with backend services like Google Search.
    const emojiRegex = /([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g;
    const sanitizedText = (actualPayload.text || "").replace(emojiRegex, '').trim();

    const { text: userMessageText, attachmentInfo, ubicacion_usuario, action, location } = actualPayload;
    const actionPayload = 'payload' in actualPayload ? actualPayload.payload : undefined;

    // Allow confirming/cancelling a claim with free text when awaiting confirmation
    let resolvedAction = action;
    const awaitingConfirmation =
      contexto.estado_conversacion === 'confirmando_reclamo' ||
      contexto.reclamo_flow_v2?.state === 'ESPERANDO_CONFIRMACION';
    if (!resolvedAction && awaitingConfirmation) {
      const normalized = sanitizedText.toLowerCase();
      const confirmWords = ['1', 'si', 'sí', 's', 'ok', 'okay', 'acepto', 'aceptar', 'confirmar', 'confirmo'];
      const cancelWords = ['2', 'no', 'n', 'cancelar', 'cancel', 'rechazo', 'rechazar'];
      if (confirmWords.includes(normalized)) {
        resolvedAction = 'confirmar_reclamo';
      } else if (cancelWords.includes(normalized)) {
        resolvedAction = 'cancelar_reclamo';
      }
    }


    if (!userMessageText && !attachmentInfo && !ubicacion_usuario && !resolvedAction && !actualPayload.archivo_url && !location) return;
    if (isTyping) return;

    if (resolvedAction === 'iniciar_creacion_reclamo') {
      // Check for existing user data
      const userData = user || JSON.parse(safeLocalStorage.getItem('user') || 'null');
      if (userData?.name && userData?.email) { // Assume phone and DNI are not available in user object
        setContexto(prev => ({
          ...prev,
          estado_conversacion: 'confirmando_reclamo',
          datos_reclamo: {
            ...prev.datos_reclamo,
            nombre_ciudadano: userData.name,
            email_ciudadano: userData.email,
          }
        }));
        setMessages(prev => [...prev, {
          id: generateClientMessageId(),
          text: `Hola ${userData.name}. ¿Confirmas la creación del reclamo?`,
          isBot: true,
          timestamp: new Date(),
          botones: [
              { texto: "Confirmar Reclamo", action: "confirmar_reclamo" },
              { texto: "Cancelar", action: "cancelar_reclamo" },
          ]
        }]);
      } else {
        setContexto(prev => ({
          ...prev,
          estado_conversacion: 'recolectando_datos_personales'
        }));
        setMessages(prev => [...prev, {
          id: generateClientMessageId(),
          text: "Para continuar, por favor completá tus datos.",
          isBot: true,
          timestamp: new Date(),
        }]);
      }
      setIsTyping(false);
      return;
    }

    if (resolvedAction === 'submit_personal_data' && actionPayload) {
      setContexto(prev => ({
        ...prev,
        estado_conversacion: 'confirmando_reclamo',
        datos_reclamo: {
          ...prev.datos_reclamo,
          nombre_ciudadano: actionPayload.nombre,
          email_ciudadano: actionPayload.email,
          telefono_ciudadano: actionPayload.telefono,
          dni_ciudadano: actionPayload.dni,
        }
      }));
       setMessages(prev => [...prev, {
        id: generateClientMessageId(),
        text: "¡Gracias! Revisa que los datos sean correctos y confirma para generar el reclamo.",
        isBot: true,
        timestamp: new Date(),
        botones: [
            { texto: "Confirmar Reclamo", action: "confirmar_reclamo" },
            { texto: "Cancelar", action: "cancelar_reclamo" },
        ]
      }]);
      setIsTyping(false);
      return;
    }


    // Create the user message object first
    const userMessage: Message = {
      id: generateClientMessageId(),
      text: userMessageText,
      isBot: false,
      timestamp: new Date(),
      attachmentInfo,
      locationData: location || ubicacion_usuario,
    };

    // Add user message to UI immediately if it has content
    if (userMessageText || attachmentInfo || location) {
      setMessages(prev => [...prev, userMessage]);
    }

    setIsTyping(true);

    try {
      const storedUser = JSON.parse(safeLocalStorage.getItem('user') || 'null');
      const rubro = storedUser?.rubro?.clave || storedUser?.rubro?.nombre || safeLocalStorage.getItem("rubroSeleccionado") || null;
      const tipoChatFinal = enforceTipoChatForRubro(tipoChat, rubro);

      const updatedContext = updateMunicipioContext(contexto, { userInput: userMessageText, action: resolvedAction });
      setContexto(updatedContext);

      const visitorName = getVisitorName();

      const requestBody: Record<string, any> = {
        pregunta: sanitizedText,
        contexto_previo: updatedContext,
        tipo_chat: tipoChatFinal,
        ...(rubro && { rubro_clave: rubro }),
        ...(attachmentInfo && { attachment_info: attachmentInfo }),
        ...(location && { location: location }),
        ...(resolvedAction && { action: resolvedAction }),
        ...(actionPayload && { payload: actionPayload }),
        ...(resolvedAction === "confirmar_reclamo" && currentClaimIdempotencyKey && { idempotency_key: currentClaimIdempotencyKey }),
        ...(visitorName && { nombre_usuario: visitorName }),
      };

      if (resolvedAction === 'confirmar_reclamo') {
        requestBody.datos_personales = {
          nombre: contexto.datos_reclamo.nombre_ciudadano,
          email: contexto.datos_reclamo.email_ciudadano,
          telefono: contexto.datos_reclamo.telefono_ciudadano,
          dni: contexto.datos_reclamo.dni_ciudadano,
        }
      }

      const endpoint = getAskEndpoint({ tipoChat: tipoChatFinal, rubro });

      console.log('useChatLogic: Sending message to backend', { endpoint, requestBody });
      // Fire-and-forget the POST request. The response will be handled by the Socket.IO listener.
      apiFetch<any>(endpoint, { method: 'POST', body: requestBody, skipAuth })
        .then(res => {
          console.log('useChatLogic: Backend response', res);
        })
        .catch(error => {
          console.error("Error sending message:", error);
          const errorMsg = getErrorMessage(error, '⚠️ No se pudo enviar tu mensaje.');
          setMessages(prev => [...prev, { id: generateClientMessageId(), text: errorMsg, isBot: true, timestamp: new Date(), isError: true }]);
          setIsTyping(false);
        });

    } catch (error: any) {
      const errorMsg = getErrorMessage(error, '⚠️ Ocurrió un error inesperado.');
      setMessages(prev => [...prev, { id: generateClientMessageId(), text: errorMsg, isBot: true, timestamp: new Date(), isError: true }]);
      setIsTyping(false);
    }
  }, [contexto, activeTicketId, isTyping, isAnonimo, currentClaimIdempotencyKey, tipoChat]);

  return { messages, isTyping, handleSend, activeTicketId, setMessages, setContexto, setActiveTicketId, contexto, addSystemMessage };
}
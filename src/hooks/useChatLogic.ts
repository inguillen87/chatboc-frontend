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
import { v4 as uuidv4 } from 'uuid';
import { MunicipioContext, updateMunicipioContext, getInitialMunicipioContext } from "@/utils/contexto_municipio";
import { useUser } from './useUser';

interface UseChatLogicOptions {
  tipoChat: 'pyme' | 'municipio';
  entityToken?: string;
}

export function useChatLogic({ tipoChat, entityToken }: UseChatLogicOptions) {
  const { user } = useUser();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [contexto, setContexto] = useState<MunicipioContext>(() => getInitialMunicipioContext());
  const [activeTicketId, setActiveTicketId] = useState<number | null>(null);
  const [currentClaimIdempotencyKey, setCurrentClaimIdempotencyKey] = useState<string | null>(null);

  const token = safeLocalStorage.getItem('authToken');
  const isAnonimo = !token;

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
    };

    // Setup Socket.IO
    const socketUrl = getSocketUrl();
    const userAuthToken = safeLocalStorage.getItem('authToken');

    console.log("useChatLogic: Initializing socket", {
      socketUrl,
      entityToken,
      hasUserToken: !!userAuthToken
    });

    const socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
      auth: {
        token: userAuthToken, // Prioritize user JWT for auth
        entityToken: entityToken // Pass entity token for context
      }
    });
    socketRef.current = socket;
    const sessionId = getOrCreateChatSessionId();

    socket.on('connect', () => {
      console.log('Socket.IO connected.');
      socket.emit('join', { room: sessionId });
    });

    socket.on('connect_error', (err) => {
      console.error('Socket.IO connection error:', err.message);
    });

    const handleBotMessage = (data: any) => {
      console.log('Bot response received:', data);

      // Actualizar el contexto con la respuesta del bot
      setContexto(prevContext => updateMunicipioContext(prevContext, { llmResponse: data }));

      const botMessage: Message = {
        id: data.id || generateClientMessageId(),
        text: data.comentario || data.message_body || "⚠️ No se pudo generar una respuesta.",
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

    socket.on('bot_response', handleBotMessage);
    socket.on('message', handleBotMessage);

    socket.on('disconnect', () => {
      console.log('Socket.IO disconnected.');
    });

    // Cleanup on component unmount
    return () => {
      socket.off('bot_response', handleBotMessage);
      socket.off('message', handleBotMessage);
      socket.disconnect();
    };
  }, [entityToken]); // Effect now depends on entityToken

  useEffect(() => {
    if (contexto.estado_conversacion === 'confirmando_reclamo' && !activeTicketId) {
      const newKey = uuidv4();
      setCurrentClaimIdempotencyKey(newKey);
      console.log("useChatLogic: Generated idempotency key for claim confirmation:", newKey);
    }
  }, [contexto.estado_conversacion, activeTicketId]);

  const handleSend = useCallback(async (payload: string | TypeSendPayload) => {
    const actualPayload: TypeSendPayload = typeof payload === 'string' ? { text: payload.trim() } : { ...payload, text: payload.text?.trim() || "" };
    const { text: userMessageText, attachmentInfo, ubicacion_usuario, action } = actualPayload;
    const actionPayload = 'payload' in actualPayload ? actualPayload.payload : undefined;


    if (!userMessageText && !attachmentInfo && !ubicacion_usuario && !action && !actualPayload.archivo_url) return;
    if (isTyping) return;

    if (action === 'iniciar_creacion_reclamo') {
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

    if (action === 'submit_personal_data' && actionPayload) {
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
      locationData: ubicacion_usuario,
    };

    // Add user message to UI immediately if it has content
    if (userMessageText || attachmentInfo) {
      setMessages(prev => [...prev, userMessage]);
    }

    setIsTyping(true);

    try {
      const storedUser = JSON.parse(safeLocalStorage.getItem('user') || 'null');
      const rubro = storedUser?.rubro?.clave || storedUser?.rubro?.nombre || safeLocalStorage.getItem("rubroSeleccionado") || null;
      const tipoChatFinal = enforceTipoChatForRubro(tipoChat, rubro);

      const updatedContext = updateMunicipioContext(contexto, { userInput: userMessageText, action });
      setContexto(updatedContext);

      const requestBody: Record<string, any> = {
        pregunta: userMessageText,
        contexto_previo: updatedContext,
        tipo_chat: tipoChatFinal,
        ...(rubro && { rubro_clave: rubro }),
        ...(attachmentInfo && { attachment_info: attachmentInfo }),
        ...(ubicacion_usuario && { ubicacion_usuario: ubicacion_usuario }),
        ...(action && { action }),
        ...(actionPayload && { payload: actionPayload }),
        ...(action === "confirmar_reclamo" && currentClaimIdempotencyKey && { idempotency_key: currentClaimIdempotencyKey }),
      };

      if (action === 'confirmar_reclamo') {
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
      apiFetch<any>(endpoint, { method: 'POST', body: requestBody })
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

  return { messages, isTyping, handleSend, activeTicketId, setMessages, setContexto, setActiveTicketId, contexto };
}
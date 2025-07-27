// src/hooks/useChatLogic.ts
import { useState, useEffect, useRef, useCallback } from "react";
import { Message, SendPayload as TypeSendPayload } from "@/types/chat";
import { apiFetch, getErrorMessage } from "@/utils/api";
import { APP_TARGET } from "@/config";
import { getAskEndpoint } from "@/utils/chatEndpoints";
import { enforceTipoChatForRubro } from "@/utils/tipoChat";
import { safeLocalStorage } from "@/utils/safeLocalStorage";
import getOrCreateAnonId from "@/utils/anonId";
import { v4 as uuidv4 } from 'uuid';
import { MunicipioContext, updateMunicipioContext, getInitialMunicipioContext } from "@/utils/contexto_municipio";

export function useChatLogic(initialWelcomeMessage: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [contexto, setContexto] = useState<MunicipioContext>(() => getInitialMunicipioContext());
  const [activeTicketId, setActiveTicketId] = useState<number | null>(null);
  const [currentClaimIdempotencyKey, setCurrentClaimIdempotencyKey] = useState<string | null>(null);

  const token = safeLocalStorage.getItem('authToken');
  const anonId = getOrCreateAnonId();
  const isAnonimo = !token;

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const ultimoMensajeIdRef = useRef<number>(0);
  const clientMessageIdCounter = useRef(0);

  const generateClientMessageId = () => {
    clientMessageIdCounter.current += 1;
    return `client-${Date.now()}-${clientMessageIdCounter.current}`;
  };

  useEffect(() => {
    const user = JSON.parse(safeLocalStorage.getItem('user') || 'null');
    const welcomeMessage = isAnonimo
      ? initialWelcomeMessage
      : `Hola ${user?.nombre || 'usuario'}, bienvenido de nuevo. ¿En qué puedo ayudarte hoy?`;

    if (messages.length === 0 && welcomeMessage) {
      setMessages([
        { id: generateClientMessageId(), text: welcomeMessage, isBot: true, timestamp: new Date() },
      ]);
    }
  }, [initialWelcomeMessage, isAnonimo]);

  useEffect(() => {
    if (contexto.estado_conversacion === 'confirmando_reclamo' && !activeTicketId) {
      const newKey = uuidv4();
      setCurrentClaimIdempotencyKey(newKey);
      console.log("useChatLogic: Generated idempotency key for claim confirmation:", newKey);
    }
  }, [contexto.estado_conversacion, activeTicketId]);

  useEffect(() => {
    const fetchNewMessages = async () => {
      if (!activeTicketId) return;
      try {
        const data = await apiFetch<{ estado_chat: string; mensajes: any[] }>(
          `/tickets/chat/${activeTicketId}/mensajes?ultimo_mensaje_id=${ultimoMensajeIdRef.current}`,
        );
        if (data.mensajes?.length > 0) {
          const nuevosMensajes: Message[] = data.mensajes.map(msg => ({
            id: msg.id,
            text: msg.texto,
            isBot: msg.es_admin,
            timestamp: new Date(msg.fecha),
            attachmentInfo: msg.attachment_info,
          }));
          setMessages(prev => [...prev, ...nuevosMensajes]);
          ultimoMensajeIdRef.current = data.mensajes[data.mensajes.length - 1].id;
        }
        if (['resuelto', 'cerrado'].includes(data.estado_chat)) {
          if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
          setMessages(prev => [...prev, { id: generateClientMessageId(), text: "Un agente ha finalizado esta conversación.", isBot: true, timestamp: new Date() }]);
          setCurrentClaimIdempotencyKey(null);
          setContexto(getInitialMunicipioContext());
        }
      } catch (error) {
        console.error("Error durante el polling:", error);
      }
    };

    if (activeTicketId) {
      fetchNewMessages();
      pollingIntervalRef.current = setInterval(fetchNewMessages, 15000);
    }

    return () => {
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    };
  }, [activeTicketId]);

  const handleSend = useCallback(async (payload: string | TypeSendPayload) => {
    const actualPayload: TypeSendPayload = typeof payload === 'string' ? { text: payload.trim() } : { ...payload, text: payload.text?.trim() || "" };
    const { text: userMessageText, attachmentInfo, ubicacion_usuario, action } = actualPayload;

    if (!userMessageText && !attachmentInfo && !ubicacion_usuario && !action && !actualPayload.archivo_url) return;
    if (isTyping) return;

    const userMessage: Message = {
      id: generateClientMessageId(),
      text: userMessageText,
      isBot: false,
      timestamp: new Date(),
      attachmentInfo,
      locationData: ubicacion_usuario,
    };
    setMessages(prev => [...prev, userMessage]);
    setIsTyping(true);

    try {
      if (activeTicketId) {
        const bodyRequest: any = {
            comentario: userMessageText,
            ...(attachmentInfo && { attachment_info: attachmentInfo }),
            ...(ubicacion_usuario && { ubicacion: ubicacion_usuario }),
        };
        await apiFetch(`/tickets/chat/${activeTicketId}/responder_ciudadano`, { method: "POST", body: JSON.stringify(bodyRequest) });
      } else {
        const storedUser = JSON.parse(safeLocalStorage.getItem('user') || 'null');
        const rubro = storedUser?.rubro?.clave || storedUser?.rubro?.nombre || safeLocalStorage.getItem("rubroSeleccionado") || null;
        const tipoChatInferido = enforceTipoChatForRubro(APP_TARGET, rubro);
        
        const updatedContext = updateMunicipioContext(contexto, { userInput: userMessageText, action });
        setContexto(updatedContext);

        const requestBody: Record<string, any> = {
          pregunta: userMessageText,
          contexto_previo: updatedContext,
          tipo_chat: tipoChatInferido,
          ...(rubro && { rubro_clave: rubro }),
          ...(attachmentInfo && { attachment_info: attachmentInfo }),
          ...(ubicacion_usuario && { ubicacion_usuario: ubicacion_usuario }),
          ...(action && { action }),
          ...(action === "confirmar_reclamo" && currentClaimIdempotencyKey && { idempotency_key: currentClaimIdempotencyKey }),
        };

        const endpoint = getAskEndpoint({ tipoChat: tipoChatInferido, rubro });
        const data = await apiFetch<any>(endpoint, { method: 'POST', body: JSON.stringify(requestBody) });
        
        const finalContext = updateMunicipioContext(updatedContext, { llmResponse: data });
        setContexto(finalContext);
        
        const botMessage: Message = {
          id: generateClientMessageId(),
          text: data.respuesta_usuario || "⚠️ No se pudo generar una respuesta.",
          isBot: true,
          timestamp: new Date(),
          botones: data.botones || [],
          mediaUrl: data.media_url,
          locationData: data.location_data,
          attachmentInfo: data.attachment_info,
        };
        setMessages(prev => [...prev, botMessage]);

        if (finalContext.id_ticket_creado) {
          setActiveTicketId(finalContext.id_ticket_creado);
          ultimoMensajeIdRef.current = 0;
          setCurrentClaimIdempotencyKey(null);
          // No reseteamos el contexto aquí para poder mostrar un mensaje de "ticket creado"
        }
      }
    } catch (error: any) {
      const errorMsg = getErrorMessage(error, '⚠️ No se pudo conectar con el servidor.');
      setMessages(prev => [...prev, { id: generateClientMessageId(), text: errorMsg, isBot: true, timestamp: new Date() }]);
    } finally {
      setIsTyping(false);
    }
  }, [contexto, activeTicketId, isTyping, isAnonimo, anonId, currentClaimIdempotencyKey]);

  return { messages, isTyping, handleSend, activeTicketId, setMessages, setContexto, setActiveTicketId };
}
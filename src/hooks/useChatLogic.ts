// src/hooks/useChatLogic.ts
import { useState, useEffect, useRef, useCallback } from "react";
import { Message, SendPayload as TypeSendPayload } from "@/types/chat"; // Asegúrate que Message tenga los nuevos campos
import { apiFetch, getErrorMessage } from "@/utils/api"; // getErrorMessage ya estaba en ChatPanel
import { APP_TARGET } from "@/config";
import { getAskEndpoint, esRubroPublico } from "@/utils/chatEndpoints";
import { enforceTipoChatForRubro } from "@/utils/tipoChat";
import { safeLocalStorage } from "@/utils/safeLocalStorage";
import getOrCreateAnonId from "@/utils/anonId";
import { v4 as uuidv4 } from 'uuid'; // <--- IMPORTAR uuid

// Interfaz SendPayload ya no es necesaria aquí si TypeSendPayload es importada y correcta.
// Si TypeSendPayload no está en @/types/chat.ts o necesita ser específico aquí:
// interface SendPayload {
//   text: string;
//   es_foto?: boolean;
//   archivo_url?: string;
//   es_ubicacion?: boolean;
//   ubicacion_usuario?: { lat: number; lon: number; };
//   action?: string;
//   attachmentInfo?: AttachmentInfo; // Asumiendo que AttachmentInfo también está en types/chat
// }


export function useChatLogic(initialWelcomeMessage: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [contexto, setContexto] = useState<any>({}); // Especificar un tipo más preciso si es posible
  const [activeTicketId, setActiveTicketId] = useState<number | null>(null);

  // Nuevo estado para la idempotency key del reclamo actual
  const [currentClaimIdempotencyKey, setCurrentClaimIdempotencyKey] = useState<string | null>(null);

  const token = safeLocalStorage.getItem('authToken');
  const anonId = getOrCreateAnonId();
  const isAnonimo = !token;

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const ultimoMensajeIdRef = useRef<number>(0);
  const clientMessageIdCounter = useRef(0); // Para IDs de mensajes optimistas

  const generateClientMessageId = () => { // Función para generar IDs únicos para mensajes optimistas
    clientMessageIdCounter.current += 1;
    return `client-${Date.now()}-${clientMessageIdCounter.current}`;
  };

  // Efecto para el mensaje de bienvenida inicial
  useEffect(() => {
    if (messages.length === 0 && initialWelcomeMessage) { // Solo si hay mensaje inicial
      setMessages([
        { id: generateClientMessageId(), text: initialWelcomeMessage, isBot: true, timestamp: new Date() },
      ]);
    }
  }, [initialWelcomeMessage]); // Dependencia messages.length eliminada para evitar re-trigger innecesario


  // Efecto para generar idempotency key cuando el bot pide confirmación de reclamo
  useEffect(() => {
    const lastBotMessage = messages.length > 0 ? messages[messages.length - 1] : null;
    if (lastBotMessage && lastBotMessage.isBot && lastBotMessage.botones) {
      const requiereConfirmacionReclamo = lastBotMessage.botones.some(
        (btn: any) => btn.action === "confirmar_reclamo" // Asumiendo que los botones tienen 'action'
      );
      if (requiereConfirmacionReclamo && !activeTicketId) { // Solo para nuevos reclamos
        const newKey = uuidv4();
        setCurrentClaimIdempotencyKey(newKey);
        console.log("useChatLogic: Generated idempotency key for claim confirmation:", newKey);
      }
    }
  }, [messages, activeTicketId]);


  // Efecto para el polling de mensajes en vivo
  useEffect(() => {
    const fetchNewMessages = async () => {
      if (!activeTicketId) return;
      try {
        const data = await apiFetch<{ estado_chat: string; mensajes: any[] }>(
          `/tickets/chat/${activeTicketId}/mensajes?ultimo_mensaje_id=${ultimoMensajeIdRef.current}`,
          // apiFetch maneja token/anonId
        );
        if (data.mensajes && data.mensajes.length > 0) {
          const nuevosMensajes: Message[] = data.mensajes.map(msg => ({
            id: msg.id, // Usar ID del servidor
            text: msg.texto,
            isBot: msg.es_admin,
            timestamp: new Date(msg.fecha),
            attachmentInfo: msg.attachment_info, // Asumir que backend puede enviar esto
            // ...otros campos que pueda tener el mensaje de chat en vivo
          }));
          setMessages(prev => [...prev, ...nuevosMensajes]);
          ultimoMensajeIdRef.current = data.mensajes[data.mensajes.length - 1].id;
        }
        if (data.estado_chat === 'resuelto' || data.estado_chat === 'cerrado') {
          if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
          setMessages(prev => [...prev, { id: generateClientMessageId(), text: "Un agente ha finalizado esta conversación.", isBot: true, timestamp: new Date() }]);
          setCurrentClaimIdempotencyKey(null); // Limpiar por si acaso
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
    let actualPayload: TypeSendPayload;

    if (typeof payload === 'string') {
      actualPayload = { text: payload.trim() };
    } else {
      // Asegurarse de que el texto no sea undefined si payload.text es undefined
      actualPayload = { ...payload, text: payload.text?.trim() || "" };
    }

    const userMessageText = actualPayload.text;

    if (!userMessageText && !actualPayload.attachmentInfo && !actualPayload.ubicacion_usuario && !actualPayload.action) {
         // Si hay archivo_url legado pero no attachmentInfo, aún podría ser un adjunto
        if (!actualPayload.archivo_url) return;
    }
    if (isTyping) return;

    const userMessage: Message = {
      id: generateClientMessageId(),
      text: userMessageText,
      isBot: false,
      timestamp: new Date(),
      attachmentInfo: actualPayload.attachmentInfo,
      locationData: actualPayload.ubicacion_usuario,
    };
    setMessages(prev => [...prev, userMessage]);
    setIsTyping(true);

    try {
      if (activeTicketId) {
        const bodyRequest: any = {
            comentario: userMessageText,
            ...(actualPayload.attachmentInfo && { attachment_info: actualPayload.attachmentInfo }),
            ...(actualPayload.ubicacion_usuario && { ubicacion: actualPayload.ubicacion_usuario }),
        };
        await apiFetch(`/tickets/chat/${activeTicketId}/responder_ciudadano`, {
          method: "POST",
          body: JSON.stringify(bodyRequest), // Asegurar que el body sea JSON
          // apiFetch maneja token/anonId
        });
      } else {
        const storedUser = typeof window !== 'undefined' ? JSON.parse(safeLocalStorage.getItem('user') || 'null') : null;
        const rubro = storedUser?.rubro?.clave || storedUser?.rubro?.nombre || safeLocalStorage.getItem("rubroSeleccionado") || null; // Incluir rubroSeleccionado como fallback
        const tipoChatInferido = enforceTipoChatForRubro(APP_TARGET, rubro);
        
        const requestBody: Record<string, any> = {
          pregunta: userMessageText,
          contexto_previo: contexto,
          tipo_chat: tipoChatInferido,
          ...(rubro && { rubro_clave: rubro }),
          ...(actualPayload.attachmentInfo && { attachment_info: actualPayload.attachmentInfo }),
          ...(actualPayload.ubicacion_usuario && { ubicacion_usuario: actualPayload.ubicacion_usuario }),
          ...(actualPayload.action && { action: actualPayload.action }),
        };
        
        // Añadir idempotency_key si es una acción de confirmar reclamo y la key existe
        if (actualPayload.action === "confirmar_reclamo" && currentClaimIdempotencyKey) {
          requestBody.idempotency_key = currentClaimIdempotencyKey;
          console.log("useChatLogic: Sending idempotency_key with confirmation:", currentClaimIdempotencyKey);
        }

        if (isAnonimo && anonId) {
            // requestBody.anon_id = anonId; // El backend lo toma del header
        }

        const endpoint = getAskEndpoint({ tipoChat: tipoChatInferido, rubro });

        const data = await apiFetch<any>(endpoint, {
          method: 'POST',
          body: JSON.stringify(requestBody), // Asegurar que el body sea JSON
          // apiFetch maneja token/anonId
        });
        
        setContexto(data.contexto_actualizado || {});
        
        // Asumiendo que parseChatResponse maneja la estructura de 'data' correctamente
        const { text: respuestaText, botones, ...otrosDatosBot } = parseChatResponse(data);

        const botMessage: Message = {
          id: generateClientMessageId(),
          text: respuestaText || "⚠️ No se pudo generar una respuesta.",
          isBot: true,
          timestamp: new Date(),
          botones: botones || [],
          mediaUrl: data.media_url,
          locationData: data.location_data,
          attachmentInfo: data.attachment_info,
          // ...otrosDatosBot que parseChatResponse pueda devolver
        };

        setMessages(prev => [...prev, botMessage]);

        if (data.ticket_id) {
          setActiveTicketId(data.ticket_id);
          ultimoMensajeIdRef.current = 0;
          setCurrentClaimIdempotencyKey(null); // Limpiar la key una vez que el ticket se creó
        }
        // Limpiar la key si la respuesta del bot ya no es una confirmación de reclamo
        const esConfirmacionSiguiente = botMessage.botones?.some((btn: any) => btn.action === "confirmar_reclamo");
        if (!esConfirmacionSiguiente && !data.ticket_id) {
            // Si no se creó ticket y la siguiente respuesta no es una confirmación,
            // es posible que el flujo de reclamo se haya interrumpido o cambiado.
            // Considerar si limpiar la key aquí es siempre correcto o si debe esperar
            // a una señal más explícita de cancelación del flujo.
            // Por ahora, la limpieza principal es al crear ticket o si el bot explícitamente finaliza.
        }
      }
    } catch (error: any) {
      const errorMsg = getErrorMessage(error, '⚠️ No se pudo conectar con el servidor.');
      setMessages(prev => [
        ...prev,
        { id: generateClientMessageId(), text: errorMsg, isBot: true, timestamp: new Date() }
      ]);
    } finally {
      setIsTyping(false);
    }
  }, [contexto, activeTicketId, isTyping, isAnonimo, anonId, currentClaimIdempotencyKey]); // Añadir currentClaimIdempotencyKey

  return { messages, isTyping, handleSend, activeTicketId, setMessages, setContexto, setActiveTicketId }; // Exponer más estados si ChatPanel los necesita
}
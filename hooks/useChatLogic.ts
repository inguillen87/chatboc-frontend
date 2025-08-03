// src/hooks/useChatLogic.ts
import { useState, useEffect, useRef, useCallback } from "react";
import { Message } from "@/types/chat"; // Asegúrate de que Message tenga los nuevos campos
import { apiFetch } from "@/utils/api";
import { APP_TARGET } from "@/config";
import { getAskEndpoint, esRubroPublico } from "@/utils/chatEndpoints";
import { enforceTipoChatForRubro } from "@/utils/tipoChat";
import { safeLocalStorage } from "@/utils/safeLocalStorage";
import getOrCreateAnonId from "@/utils/anonId";

// --- NUEVA INTERFAZ PARA EL PAYLOAD DE ENVÍO DE MENSAJES (PARA handleSend) ---
interface SendPayload {
  text: string;
  // Opcionales para adjuntos
  es_foto?: boolean;
  archivo_url?: string;
  es_ubicacion?: boolean;
  ubicacion_usuario?: { lat: number; lon: number; }; // Asegúrate de que las claves sean 'lat' y 'lon'
  // Opcional para acciones de botones
  action?: string;
}
// -------------------------------------------------------------------------

// Nueva interfaz para las props del hook
interface UseChatLogicProps {
  initialWelcomeMessage: string;
  tipoChat: "pyme" | "municipio";
}

export function useChatLogic({ initialWelcomeMessage, tipoChat }: UseChatLogicProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [contexto, setContexto] = useState({});
  const [activeTicketId, setActiveTicketId] = useState<number | null>(null);

  const token = safeLocalStorage.getItem('authToken');
  const anonId = getOrCreateAnonId();
  const isAnonimo = !token;

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const ultimoMensajeIdRef = useRef<number>(0);

  // --- NUEVA FUNCIÓN PARA INICIALIZAR EL CHAT ---
  const initializeChat = useCallback(async () => {
    setIsTyping(true);
    try {
      const stored =
        typeof window !== 'undefined'
          ? JSON.parse(safeLocalStorage.getItem('user') || 'null')
          : null;
      const rubro = stored?.rubro?.clave || stored?.rubro?.nombre || null;

      const response = await apiFetch<any>('/chat/init', {
        method: 'POST',
        body: {
          tipo_chat: tipoChat,
          ...(rubro && { rubro_clave: rubro }),
        },
      });

      const initialBotMessage: Message = {
        id: Date.now(),
        text: response?.respuesta || initialWelcomeMessage,
        isBot: true,
        timestamp: new Date(),
        botones: response?.botones || [],
        mediaUrl: response?.media_url,
        locationData: response?.location_data,
      };
      setMessages([initialBotMessage]);
      setContexto(response.contexto_actualizado || {});

    } catch (error) {
      console.error("Error initializing chat:", error);
      // Fallback al mensaje de bienvenida estático
      setMessages([
        { id: Date.now(), text: initialWelcomeMessage, isBot: true, timestamp: new Date() },
      ]);
    } finally {
      setIsTyping(false);
    }
  }, [initialWelcomeMessage, tipoChat]);

  // Efecto para el mensaje de bienvenida (ahora dinámico)
  useEffect(() => {
    if (messages.length === 0) {
      initializeChat();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initializeChat]);


  // Efecto para el polling de mensajes en vivo
  useEffect(() => {
    const fetchNewMessages = async () => {
      if (!activeTicketId) return;
      try {
        const data = await apiFetch<{ estado_chat: string; mensajes: any[] }>(
          `/tickets/chat/${activeTicketId}/mensajes?ultimo_mensaje_id=${ultimoMensajeIdRef.current}`,
          { sendAnonId: isAnonimo }
        );
        if (data.mensajes && data.mensajes.length > 0) {
          const nuevosMensajes: Message[] = data.mensajes.map(msg => ({
            id: msg.id,
            text: msg.texto,
            isBot: msg.es_admin,
            timestamp: new Date(msg.fecha),
          }));
          setMessages(prev => [...prev, ...nuevosMensajes]);
          ultimoMensajeIdRef.current = data.mensajes[data.mensajes.length - 1].id;
        }
        if (data.estado_chat === 'resuelto' || data.estado_chat === 'cerrado') {
          if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
          setMessages(prev => [...prev, { id: Date.now(), text: "Un agente ha finalizado esta conversación.", isBot: true, timestamp: new Date() }]);
        }
      } catch (error) {
        console.error("Error durante el polling:", error);
      }
    };

    if (activeTicketId) {
      fetchNewMessages();
      pollingIntervalRef.current = setInterval(fetchNewMessages, 10000);
    }

    return () => {
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    };
  }, [activeTicketId, isAnonimo]);

  // --- MODIFICACIÓN CLAVE: handleSend ahora acepta un SendPayload ---
  const handleSend = useCallback(async (payload: string | SendPayload) => {
    let actualPayload: SendPayload;

    if (typeof payload === 'string') {
      actualPayload = { text: payload.trim() };
    } else {
      actualPayload = { text: payload.text.trim(), ...payload };
    }

    // No enviar si está vacío, no hay adjuntos y no es una acción de botón
    if (!actualPayload.text && !actualPayload.archivo_url && !actualPayload.ubicacion_usuario && !actualPayload.action) return;
    if (isTyping) return; // No enviar si el bot está escribiendo

    const userMessage: Message = { id: Date.now(), text: actualPayload.text, isBot: false, timestamp: new Date() };
    setMessages(prev => [...prev, userMessage]);
    setIsTyping(true);

    try {
      if (activeTicketId) {
        // Si hay un ticket activo (chat en vivo), enviamos como comentario
        // Aquí podrías adaptar el backend si necesitas adjuntar archivos a los comentarios del ticket
        await apiFetch(`/tickets/chat/${activeTicketId}/responder_ciudadano`, {
          method: "POST",
          body: {
            comentario: actualPayload.text,
            // Ejemplo: Si el backend de comentarios soporta adjuntos:
            ...(actualPayload.es_foto && { foto_url: actualPayload.archivo_url }),
            ...(actualPayload.es_ubicacion && { ubicacion: actualPayload.ubicacion_usuario }),
          },
          sendAnonId: isAnonimo,
        });
      } else {
        const stored =
          typeof window !== 'undefined'
            ? JSON.parse(safeLocalStorage.getItem('user') || 'null')
            : null;
        const rubro = stored?.rubro?.clave || stored?.rubro?.nombre || null;
        const adjustedTipo = enforceTipoChatForRubro(APP_TARGET, rubro);

        // --- CONSTRUCCIÓN DEL BODY CON ADJUNTOS Y ACTION ---
        const requestBody = {
          pregunta: actualPayload.text,
          contexto_previo: contexto,
          tipo_chat: adjustedTipo,
          ...(rubro ? { rubro_clave: rubro } : {}),
          // Incluir datos de adjunto si están presentes
          ...(actualPayload.es_foto && { es_foto: true, archivo_url: actualPayload.archivo_url }),
          ...(actualPayload.es_ubicacion && { es_ubicacion: true, ubicacion_usuario: actualPayload.ubicacion_usuario }),
          // Incluir acción de botón si está presente (para backend)
          ...(actualPayload.action && { action: actualPayload.action }),
        };
        // ----------------------------------------------------

        const endpoint = getAskEndpoint({ tipoChat: adjustedTipo, rubro });
        const esPublico = esRubroPublico(rubro);

        console.log(
          'Voy a pedir a endpoint:',
          endpoint,
          'rubro:',
          rubro,
          'tipoChat:',
          adjustedTipo,
          'esPublico:',
          esPublico,
          'payload enviado:', // Para debug, quita en producción
          requestBody
        );

        const data = await apiFetch<any>(endpoint, {
          method: 'POST',
          body: requestBody, // Usar el body construido
        });

        setContexto(data.contexto_actualizado || {});

        // --- EXTRAER mediaUrl y locationData de la respuesta del backend ---
        const botMessage: Message = {
          id: Date.now(),
          text: data?.respuesta || "⚠️ No se pudo generar una respuesta.",
          isBot: true,
          timestamp: new Date(),
          botones: data?.botones || [],
          mediaUrl: data?.media_url, // Asignar la URL del archivo desde el backend
          locationData: data?.location_data, // Asignar los datos de ubicación desde el backend
        };
        // -----------------------------------------------------------------

        setMessages(prev => [...prev, botMessage]);
        if (data.ticket_id) {
          setActiveTicketId(data.ticket_id);
          ultimoMensajeIdRef.current = 0;
        }
      }
    } catch (error: any) {
      let errorMsg = "⚠️ No se pudo conectar con el servidor.";
      if (error?.body?.error) {
        errorMsg = error.body.error;
      } else if (error?.message) {
        errorMsg = error.message;
      }
      setMessages(prev => [
        ...prev,
        { id: Date.now(), text: errorMsg, isBot: true, timestamp: new Date() }
      ]);
    } finally {
      setIsTyping(false);
    }
  }, [contexto, activeTicketId, isTyping, isAnonimo]); // Añadir isTyping e isAnonimo como dependencias

  return { messages, isTyping, handleSend, setMessages, activeTicketId };
}
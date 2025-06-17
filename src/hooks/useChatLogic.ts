// src/hooks/useChatLogic.ts
import { useState, useEffect, useRef, useCallback } from "react";
import { Message } from "@/types/chat";
import { apiFetch } from "@/utils/api";

export function useChatLogic(initialWelcomeMessage: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [contexto, setContexto] = useState({});
  const [activeTicketId, setActiveTicketId] = useState<number | null>(null);

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const ultimoMensajeIdRef = useRef<number>(0);

  // Efecto para el mensaje de bienvenida inicial
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        { id: Date.now(), text: initialWelcomeMessage, isBot: true, timestamp: new Date() },
      ]);
    }
  }, [initialWelcomeMessage]);

  // Efecto para el polling de mensajes en vivo
  useEffect(() => {
    const fetchNewMessages = async () => {
      if (!activeTicketId) return;
      try {
        const data = await apiFetch<{ estado_chat: string; mensajes: any[] }>(
          `/tickets/chat/${activeTicketId}/mensajes?ultimo_mensaje_id=${ultimoMensajeIdRef.current}`
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
  }, [activeTicketId]);

  // Función para enviar mensajes
  const handleSend = useCallback(async (text: string) => {
    if (!text.trim()) return;
    const userMessage: Message = { id: Date.now(), text, isBot: false, timestamp: new Date() };
    setMessages(prev => [...prev, userMessage]);
    setIsTyping(true);

    try {
      if (activeTicketId) {
        await apiFetch(`/tickets/chat/${activeTicketId}/responder_ciudadano`, {
          method: "POST",
          body: { comentario: text },
        });
      } else {
        const payload = { pregunta: text, contexto_previo: contexto };
        const data = await apiFetch<any>("/ask", {
          method: "POST",
          body: payload,
        });
        setContexto(data.contexto_actualizado || {});
        const botMessage: Message = {
          id: Date.now(),
          text: data?.respuesta || "⚠️ No se pudo generar una respuesta.",
          isBot: true,
          timestamp: new Date(),
          botones: data?.botones || []
        };
        setMessages(prev => [...prev, botMessage]);
        if (data.ticket_id) {
          setActiveTicketId(data.ticket_id);
          ultimoMensajeIdRef.current = 0;
        }
      }
    } catch (error) {
      setMessages(prev => [...prev, { id: Date.now(), text: "⚠️ No se pudo conectar con el servidor.", isBot: true, timestamp: new Date() }]);
    } finally {
      setIsTyping(false);
    }
  }, [contexto, activeTicketId]);

  return { messages, isTyping, handleSend };
}
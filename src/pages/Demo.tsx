import React, { useState, useEffect, useRef, useCallback } from "react";
import ChatInput from "@/components/chat/ChatInput";
import TypingIndicator from "@/components/chat/TypingIndicator";
import { Message } from "@/types/chat";
import { apiFetch } from "@/utils/api";
import { AnimatePresence, motion } from "framer-motion"; // Asumo que usas framer-motion como en ChatPage

const Demo = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [preguntasUsadas, setPreguntasUsadas] = useState(0);
  const [rubroSeleccionado, setRubroSeleccionado] = useState<string | null>(() => {
    return typeof window !== "undefined" ? localStorage.getItem("rubroSeleccionado") : null;
  });
  const [rubrosDisponibles, setRubrosDisponibles] = useState<{ id: number; nombre: string }[]>([]);
  const [esperandoRubro, setEsperandoRubro] = useState(!rubroSeleccionado);
  
  const [token, setToken] = useState<string>("");

  // --- PASO 1: AÑADIMOS UN ESTADO PARA GUARDAR LA "MOCHILA" (EL CONTEXTO) ---
  const [contexto, setContexto] = useState({});
  // --------------------------------------------------------------------------

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      let currentToken = localStorage.getItem("anon_token");
      if (!currentToken) {
        currentToken = `demo-anon-${Math.random().toString(36).substring(2, 10)}`;
        localStorage.setItem("anon_token", currentToken);
      }
      setToken(currentToken);
    }
  }, []);

  useEffect(() => {
    if (!rubroSeleccionado) {
      if (typeof window !== "undefined") {
        apiFetch<any[]>('/rubros/', { skipAuth: true })
          .then((data) => {
            setRubrosDisponibles(Array.isArray(data) ? data : []);
            setEsperandoRubro(true);
          })
          .catch(() => setRubrosDisponibles([]));
      }
    } else if (messages.length === 0) {
        setMessages([
            { id: 1, text: "¡Hola! Soy Chatboc, tu experto virtual. ¿En qué puedo ayudarte?", isBot: true, timestamp: new Date() },
        ]);
        setEsperandoRubro(false);
    }
  }, [rubroSeleccionado, messages.length]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || !rubroSeleccionado || !token) return;

    if (preguntasUsadas >= 15) {
      // ... (lógica de límite de preguntas sin cambios) ...
      return;
    }

    const userMessage: Message = { id: messages.length + 1, text, isBot: false, timestamp: new Date() };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setIsTyping(true);

    try {
        
      // --- PASO 2: ENVIAMOS LA "MOCHILA" (CONTEXTO) EN CADA PETICIÓN ---
      const body: any = { 
        question: text, 
        rubro: rubroSeleccionado,
        contexto_previo: contexto // <-- Aquí viaja nuestra memoria manual
      };
      // --------------------------------------------------------------------

      const response = await apiFetch<any>("/ask", {
        method: "POST",
        body: body, // Usamos el nuevo body
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      
      // --- PASO 3: RECIBIMOS Y GUARDAMOS LA "MOCHILA" ACTUALIZADA ---
      if (response.contexto_actualizado) {
        setContexto(response.contexto_actualizado);
      } else {
        setContexto({}); // Si no viene contexto, la reseteamos por seguridad
      }
      // -------------------------------------------------------------------

      const botMessage: Message = {
        id: updatedMessages.length + 1,
        text: response?.respuesta || "⚠️ No se pudo generar una respuesta.",
        isBot: true,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, botMessage]);
      setPreguntasUsadas((prev) => prev + 1);

    } catch (error) {
      // ... (tu manejo de errores sin cambios) ...
    } finally {
      setIsTyping(false);
    }
  };

  // ... (El resto de tu componente y el JSX se mantienen igual)
  if (esperandoRubro) {
    return (
      // ... Tu JSX para la selección de rubro ...
    );
  }

  return (
    // ... Tu JSX para la vista del chat ...
  );
};

export default Demo;
import React, { useState, useEffect, useRef, useCallback } from "react";
import { Message } from "@/types/chat";
import ChatMessage from "@/components/chat/ChatMessage";
import ChatInput from "@/components/chat/ChatInput";
import TypingIndicator from "@/components/chat/TypingIndicator";
import Navbar from "@/components/layout/Navbar";
import { motion, AnimatePresence } from "framer-motion";

// Hook para mobile detection (sin cambios)
function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < breakpoint : false
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

  // --- PASO 1: AÑADIMOS UN ESTADO PARA GUARDAR LA "MOCHILA" (EL CONTEXTO) ---
  const [contexto, setContexto] = useState({});
  // --------------------------------------------------------------------------

  const isMobile = useIsMobile();

  const path = typeof window !== "undefined" ? window.location.pathname : "";
  const isDemo = path.includes("demo");
  const user = typeof window !== "undefined" ? JSON.parse(localStorage.getItem("user") || "null") : null;
  const token = isDemo ? "demo-token" : localStorage.getItem("authToken") || "demo-token";

  const getRubro = () => {
    if (user?.rubro) {
      if (typeof user.rubro === "object" && user.rubro.nombre) return user.rubro.nombre;
      if (typeof user.rubro === "string") return user.rubro;
    }
    return localStorage.getItem("rubroSeleccionado") || "";
  };

  const scrollToBottom = useCallback(() => {
    if (chatMessagesContainerRef.current) {
      chatMessagesContainerRef.current.scrollTop = chatMessagesContainerRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    if (messages.length === 0) { 
      console.log("ChatPage: Inicializando mensajes del bot.");
      setMessages([
        { id: 1, text: "¡Hola! Soy Chatboc. ¿En qué puedo ayudarte hoy?", isBot: true, timestamp: new Date() },
      ]);
    }
  }, [messages.length]);

  useEffect(() => {
    const timer = setTimeout(() => scrollToBottom(), 150);
    return () => clearTimeout(timer);
  }, [messages.length, isTyping, scrollToBottom]);

  const handleSend = async (text: string) => {
    if (!text.trim()) return;

    const userMessage: Message = { id: messages.length + 1, text, isBot: false, timestamp: new Date() };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setIsTyping(true);

    setTimeout(() => scrollToBottom(), 50);

    try {
      const rubro = getRubro();

      // --- PASO 2: ENVIAMOS LA "MOCHILA" (CONTEXTO) EN CADA PETICIÓN ---
      const payload = {
        question: text,
        rubro: rubro,
        contexto_previo: contexto // <-- Aquí viaja nuestra memoria manual
      };
      // --------------------------------------------------------------------

      const res = await fetch("https://api.chatboc.ar/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload), // Usamos el nuevo payload
      });

      const data = await res.json();
      
      // --- PASO 3: RECIBIMOS Y GUARDAMOS LA "MOCHILA" ACTUALIZADA ---
      if (data.contexto_actualizado) {
        setContexto(data.contexto_actualizado);
      } else {
        setContexto({}); // Si no viene contexto, la reseteamos
      }
      // -------------------------------------------------------------------

      const botMessage: Message = {
        id: updatedMessages.length + 1,
        text: data?.respuesta || "⚠️ No se pudo generar una respuesta.",
        isBot: true,
        timestamp: new Date(),
      };

      const newMessages = [...updatedMessages, botMessage];

      // ... (tu lógica para el __cta__ se mantiene igual) ...

      setMessages(newMessages);
    } catch (error) {
      // ... (tu manejo de errores se mantiene igual) ...
    } finally {
      setIsTyping(false);
    }
  };

  // ... (el resto de tu componente: handleDynamicButtonClick y el JSX se mantienen igual) ...
  // ...
  return (
    // ... tu JSX aquí ...
  );
};

export default ChatPage;
// src/pages/Demo.tsx

import React, { useState, useEffect, useRef, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import ChatInput from "@/components/chat/ChatInput";
import TypingIndicator from "@/components/chat/TypingIndicator";
import ChatMessage from "@/components/chat/ChatMessage";
import { Message } from "@/types/chat";
import { apiFetch } from "@/utils/api";

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

  // --- ESTADO PARA LA "MEMORIA MANUAL" ---
  const [contexto, setContexto] = useState({});
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Inicializar token anónimo
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
// Dentro del componente principal (ChatPage, Demo, o ChatWidget)

useEffect(() => {
    const handleButtonSendMessage = (event: Event) => {
        const customEvent = event as CustomEvent<string>;
        if (customEvent.detail) {
            handleSend(customEvent.detail);
        }
    };

    window.addEventListener('sendChatMessage', handleButtonSendMessage);

    return () => {
        window.removeEventListener('sendChatMessage', handleButtonSendMessage);
    };
}, [handleSend]); // El array de dependencias es importante
  // Cargar rubros o mensaje inicial
  useEffect(() => {
    if (!rubroSeleccionado) {
      setEsperandoRubro(true);
      apiFetch<any[]>('/rubros/', { skipAuth: true })
        .then((data) => setRubrosDisponibles(Array.isArray(data) ? data : []))
        .catch(() => setRubrosDisponibles([]));
    } else if (messages.length === 0) {
      setMessages([{ id: 1, text: "¡Hola! Soy Chatboc, tu experto virtual. ¿En qué puedo ayudarte?", isBot: true, timestamp: new Date() }]);
      setEsperandoRubro(false);
    }
  }, [rubroSeleccionado, messages.length]);

  // Scroll automático
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || !rubroSeleccionado || !token) return;

    if (preguntasUsadas >= 15) {
      // Lógica de límite de preguntas
      return;
    }

    const userMessage: Message = { id: Date.now(), text, isBot: false, timestamp: new Date() };
    setMessages(prev => [...prev, userMessage]);
    setIsTyping(true);

    try {
      const payload = {
        question: text,
        rubro: rubroSeleccionado,
        contexto_previo: contexto, // Enviamos la "mochila"
      };

      const response = await apiFetch<any>("/ask", {
        method: "POST",
        body: payload,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      // Guardamos la "mochila" actualizada
      setContexto(response.contexto_actualizado || {});

      const botMessage: Message = {
              id: updatedMessages.length + 1,
              text: data?.respuesta || "⚠️ No se pudo generar una respuesta.",
              isBot: true,
              timestamp: new Date(),
              botones: data?.botones || [] // <-- AÑADIR ESTA LÍNEA
            };

      setMessages((prev) => [...prev, botMessage]);
      setPreguntasUsadas((prev) => prev + 1);
    } catch (error) {
      const errorMessage: Message = {
        id: Date.now(),
        text: "⚠️ No se pudo conectar con el servidor.",
        isBot: true,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  if (esperandoRubro) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center bg-background dark:bg-gradient-to-b dark:from-[#10141b] dark:to-[#181d24] text-foreground">
        <div className="w-full max-w-md p-6 rounded-3xl shadow-2xl border bg-card dark:bg-[#181d24]">
          <h2 className="text-2xl font-bold mb-3 text-primary">👋 ¡Bienvenido a Chatboc!</h2>
          <p className="mb-4 text-sm text-center text-muted-foreground">
            Para darte una mejor experiencia, contanos a qué rubro pertenece tu negocio:
          </p>
          <div className="flex flex-wrap justify-center gap-2 mt-3">
            {rubrosDisponibles.map((rubro) => (
              <button
                key={rubro.id}
                onClick={() => {
                  localStorage.setItem("rubroSeleccionado", rubro.nombre);
                  setRubroSeleccionado(rubro.nombre);
                }}
                className="px-5 py-3 rounded-full font-semibold text-base bg-primary text-primary-foreground hover:bg-primary/90 shadow-md focus:outline-none transition-all"
              >
                {rubro.nombre}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto bg-card dark:bg-[#1e1e1e] rounded-3xl shadow-2xl border border-border dark:border-gray-700 flex flex-col h-[90vh] sm:h-[84vh] mt-6 overflow-hidden relative">
      <div className="bg-primary text-primary-foreground py-3 px-4 flex items-center justify-between shadow-lg sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <img src="/chatboc_widget_white_outline.webp" alt="Chatboc" className="w-7 h-7" />
          <span className="font-semibold text-base sm:text-lg tracking-tight">Chatboc · Demo Gratuita</span>
        </div>
        <span className="hidden sm:inline-block text-xs opacity-70 text-primary-foreground/70">{rubroSeleccionado}</span>
      </div>
      <div className="flex-1 overflow-y-auto px-2 sm:px-5 py-5 bg-background dark:bg-gradient-to-b dark:from-[#1b2532] dark:to-[#242b33] transition-colors space-y-3 custom-scroll">
        <AnimatePresence>
          {messages.map((msg) => (
            <motion.div key={msg.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 14 }} transition={{ duration: 0.18 }}>
              <ChatMessage message={msg} />
            </motion.div>
          ))}
        </AnimatePresence>
        {isTyping && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>
      <div className="border-t border-border p-2 bg-card sticky bottom-0 z-10">
        <ChatInput onSendMessage={handleSendMessage} />
      </div>
    </div>
  );
};

export default Demo;
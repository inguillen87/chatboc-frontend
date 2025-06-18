import React, { useState, useEffect, useRef } from "react";
import { Message } from "@/types/chat";
import ChatMessage from "@/components/chat/ChatMessage";
import ChatInput from "@/components/chat/ChatInput";
import TypingIndicator from "@/components/chat/TypingIndicator";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { apiFetch } from "@/utils/api";
import { getCurrentTipoChat } from "@/utils/tipoChat";
import { motion, AnimatePresence } from "framer-motion";
import { safeLocalStorage } from "@/utils/safeLocalStorage";

// --- CONFIGURA ACÁ EL RUBRO PARA DEMO O WIDGET
const DEFAULT_WIDGET_RUBRO = "municipios"; // Cambia por "bodega", "almacen", etc. según corresponda

const ChatPage = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const path = window.location.pathname;
  const isDemo = path.includes("demo");
  const tipoChatParam = new URLSearchParams(window.location.search).get('tipo_chat');
  const tipoChatDefault = getCurrentTipoChat();
  const tipoChat: 'pyme' | 'municipio' =
    tipoChatParam === 'pyme' || tipoChatParam === 'municipio'
      ? (tipoChatParam as 'pyme' | 'municipio')
      : tipoChatDefault;
  const user = JSON.parse(safeLocalStorage.getItem("user") || "null");
  const token = isDemo ? "demo-token" : user?.token || "demo-token";
  // Si hay rubro en usuario, lo usamos. Si no, usamos el default
  const rubro = user?.rubro || DEFAULT_WIDGET_RUBRO;

  useEffect(() => {
    setMessages([
      {
        id: 1,
        text: "¡Hola! Soy Chatboc. ¿En qué puedo ayudarte hoy?",
        isBot: true,
        timestamp: new Date(),
      },
    ]);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (text: string) => {
    if (!text.trim()) return;

    const userMessage: Message = {
      id: messages.length + 1,
      text,
      isBot: false,
      timestamp: new Date(),
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setIsTyping(true);

    try {
      // --- Arma el body universal ---
      const body: Record<string, any> = {
        pregunta: text,
        tipo_chat: tipoChat,
      };

      // Si no hay user logueado o es demo, incluye el rubro
      if (!user || isDemo) {
        body.rubro = rubro;
      }

      const response = await apiFetch<any>("/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body,
      });

      const botMessage: Message = {
        id: updatedMessages.length + 1,
        text:
          response?.respuesta?.respuesta ||
          response?.respuesta ||
          "⚠️ No se pudo generar una respuesta.",
        isBot: true,
        timestamp: new Date(),
      };

      const newMessages = [...updatedMessages, botMessage];

      if (
        response?.fuente === "cohere" ||
        botMessage.text.toLowerCase().includes("no encontré") ||
        botMessage.text.toLowerCase().includes("no se pudo")
      ) {
        newMessages.push({
          id: newMessages.length + 1,
          text: "__cta__",
          isBot: true,
          timestamp: new Date(),
        });
      }

      setMessages(newMessages);
    } catch (error) {
      setMessages([
        ...updatedMessages,
        {
          id: updatedMessages.length + 1,
          text: "⚠️ No se pudo conectar con el servidor.",
          isBot: true,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 text-foreground">
      <Navbar />
      <main className="flex-grow flex items-center justify-center px-4 pt-20 pb-10">
        <div className="w-full max-w-2xl bg-white border border-gray-200 rounded-3xl shadow-lg p-4 flex flex-col h-[80vh]">
          <div className="flex-1 overflow-y-auto space-y-4 px-2 pb-4">
            <AnimatePresence>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChatMessage message={msg} />
                </motion.div>
              ))}
            </AnimatePresence>
            {isTyping && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </div>
          <ChatInput onSendMessage={handleSend} />
        </div>
      </main>
    </div>
  );
};

export default ChatPage;

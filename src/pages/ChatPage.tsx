import React, { useState, useEffect, useRef } from "react";
import { Message } from "@/types/chat";
import ChatMessage from "@/components/chat/ChatMessage";
import ChatInput from "@/components/chat/ChatInput";
import TypingIndicator from "@/components/chat/TypingIndicator";
import Navbar from "@/components/layout/Navbar";
import { motion, AnimatePresence } from "framer-motion";

const ChatPage = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const path = typeof window !== "undefined" ? window.location.pathname : "";
  const isDemo = path.includes("demo");
  const user = typeof window !== "undefined" ? JSON.parse(localStorage.getItem("user") || "null") : null;
  const token = isDemo ? "demo-token" : user?.token || "demo-token";

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
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

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
      const res = await fetch("https://api.chatboc.ar/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ pregunta: text }),
      });

      const data = await res.json();

      const botMessage: Message = {
        id: updatedMessages.length + 1,
        text: data?.respuesta || "⚠️ No se pudo generar una respuesta.",
        isBot: true,
        timestamp: new Date(),
      };

      const newMessages = [...updatedMessages, botMessage];

      if (
        data?.fuente === "cohere" ||
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
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <Navbar />

      <main className="flex-grow flex justify-center items-center px-2 sm:px-4 pt-16 pb-4 bg-gradient-to-b from-[#131a23] to-[#181e24]">
        <div
          className="
            w-full max-w-2xl
            h-[80vh] min-h-[420px]
            flex flex-col
            rounded-3xl
            shadow-2xl
            bg-white/80 dark:bg-[#1c1e24]/90
            border border-gray-300 dark:border-[#23272e]
            backdrop-blur-lg
            relative
            overflow-hidden
            transition-all
          "
        >
          {/* Chat messages */}
          <div
            className="
              flex-1
              overflow-y-auto
              p-2 sm:p-4
              space-y-3
              scrollbar-thin scrollbar-thumb-[#90caf9] scrollbar-track-transparent
              custom-scroll
            "
            style={{ minHeight: 0 }}
          >
            <AnimatePresence>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.17 }}
                >
                  <ChatMessage message={msg} />
                </motion.div>
              ))}
            </AnimatePresence>
            {isTyping && <TypingIndicator />}
            <div ref={chatEndRef} />
          </div>
          {/* Chat input */}
          <div
            className="
              bg-gradient-to-t from-[#15181f] via-[#23272e]/90 to-transparent
              border-t border-gray-300 dark:border-[#23272e]
              p-3 sm:p-4
              flex-shrink-0
              "
              style={{ zIndex: 5 }}
          >
            <ChatInput onSendMessage={handleSend} />
          </div>
        </div>
      </main>
    </div>
  );
};

export default ChatPage;

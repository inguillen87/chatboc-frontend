import React, { useState, useEffect, useRef } from "react";
import { safeLocalStorage } from "@/utils/safeLocalStorage";
import ChatInput from "@/components/ChatInput";
import ChatMessage from "@/components/ChatMessage";
import TypingIndicator from "@/components/TypingIndicator";
import { Message } from "@/types/chat";
import { getCurrentTipoChat } from "@/utils/tipoChat";
import { getAskEndpoint } from "@/utils/chatEndpoints";

const Demo: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    setTimeout(() => {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 50);
  };

  const handleSendMessage = async (text: string) => {
    const newMessage: Message = {
      text,
      isBot: false,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, newMessage]);
    setIsTyping(true);

    try {
      const storedUser = JSON.parse(safeLocalStorage.getItem("user") || "null");
      const rubro = storedUser?.rubro?.clave || storedUser?.rubro?.nombre;
      const tipoChat = getCurrentTipoChat();
      const endpoint = getAskEndpoint({ tipoChat, rubro });

      const res = await fetch(`https://api.chatboc.ar${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${safeLocalStorage.getItem("token") || "demo-token"}`,
        },
        body: JSON.stringify({ pregunta: text }),
      });

      const data = await res.json();

      const respuestaBot: Message = {
        text: data.respuesta || "❌ Error al procesar la respuesta.",
        isBot: true,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, respuestaBot]);
    } catch (error) {
      console.error("❌ Error conectando al backend:", error);
      setMessages((prev) => [
        ...prev,
        {
          text: "⚠️ No pudimos contactar al servidor. Intentá de nuevo más tarde.",
          isBot: true,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-start bg-background text-foreground pt-20 px-4">
      <div className="w-full max-w-2xl flex flex-col h-[80vh] bg-white dark:bg-[#1e1e1e] rounded-lg shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div
          className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scroll-smooth"
          ref={scrollContainerRef}
        >
          {messages.map((msg, idx) => (
            <ChatMessage key={idx} message={msg} />
          ))}
          {isTyping && <TypingIndicator />}
          <div ref={chatEndRef} />
        </div>
        <div className="border-t border-gray-200 dark:border-gray-700 p-2">
          <ChatInput onSendMessage={handleSendMessage} />
        </div>
      </div>
    </div>
  );
};

export default Demo;

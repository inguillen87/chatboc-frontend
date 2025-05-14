import React, { useState, useEffect, useRef } from "react";
import ChatMessage from "@/components/chat/ChatMessage";
import ChatInput from "@/components/chat/ChatInput";
import TypingIndicator from "@/components/chat/TypingIndicator";
import { Message } from "@/types/chat";
import { apiFetch } from "@/utils/api";

const Demo = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages([
      {
        id: 1,
        text: "¡Hola! Soy Chatboc, tu experto virtual. ¿En qué puedo ayudarte?",
        isBot: true,
        timestamp: new Date(),
      },
    ]);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async (text: string) => {
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
      const response = await apiFetch(
  "/demo-chat",
  "POST",
  {
    messages: updatedMessages.map((m) => ({
      role: m.isBot ? "assistant" : "user",
      content: m.text,
    })),
    rubro_id: 1, // <--- importante para que el backend funcione
  },
  {
    headers: {
      "Content-Type": "application/json",
    },
  }
);

      const botMessage: Message = {
        id: updatedMessages.length + 1,
        text:
          response?.answer ||
          response?.content ||
          "⚠️ No se pudo generar una respuesta.",
        isBot: true,
        timestamp: new Date(),
      };

      setMessages([...updatedMessages, botMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: updatedMessages.length + 1,
        text: "⚠️ No se pudo conectar con el servidor.",
        isBot: true,
        timestamp: new Date(),
      };
      setMessages([...updatedMessages, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto bg-white rounded-2xl shadow-xl border border-gray-200 flex flex-col h-[80vh] mt-10 overflow-hidden">
      
      {/* Header con branding */}
      <div className="bg-[#006AEC] text-white py-3 px-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src="/chatboc_widget_white_outline.webp" alt="Chatboc" className="w-6 h-6" />
          <span className="font-semibold text-sm">Chatboc - Demo Gratuita</span>
        </div>
      </div>

      {/* Área de mensajes */}
      <div className="flex-1 overflow-y-auto space-y-4 px-4 py-4 bg-gray-50">
        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}
        {isTyping && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <ChatInput onSendMessage={handleSendMessage} />
    </div>
  );
};

export default Demo;

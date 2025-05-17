import React, { useState, useEffect, useRef } from "react";
import ChatInput from "@/components/ChatInput";
import ChatMessage from "@/components/ChatMessage";
import TypingIndicator from "@/components/TypingIndicator"; // si tenés este componente
import { Message } from "@/types/chat";

const Demo: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (text: string) => {
    const newMessage: Message = {
      text,
      isBot: false,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, newMessage]);
    setIsTyping(true);

    try {
      const res = await fetch("https://api.chatboc.ar/responder_chatboc", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token") || "demo-token"}`,
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
    <div className="max-w-2xl mx-auto py-6 px-4">
      <div className="border rounded-lg shadow-sm h-[500px] overflow-y-auto p-4 bg-white space-y-4">
        {messages.map((msg, idx) => (
          <ChatMessage key={idx} message={msg} />
        ))}
        {isTyping && <TypingIndicator />}
        <div ref={chatEndRef} />
      </div>
      <ChatInput onSendMessage={handleSendMessage} />
    </div>
  );
};

export default Demo;

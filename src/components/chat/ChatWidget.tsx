// src/components/ChatWidget.tsx
import React, { useState, useRef, useEffect } from "react";
import { X } from "lucide-react";
import ChatHeader from "./ChatHeader";
import ChatMessage from "./ChatMessage";
import TypingIndicator from "./TypingIndicator";
import ChatInput from "./ChatInput";
import { Message } from "@/types/chat";
import { apiFetch } from "@/utils/api";

const ChatWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const path = window.location.pathname;
  const rutasPermitidas = ["/", "/demo", "/solucion", "/como-funciona", "/precios"];
  const user = JSON.parse(localStorage.getItem("user") || "null");

  // Mostrar solo en rutas públicas
  const mostrarWidget = rutasPermitidas.includes(path);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const toggleChat = () => setIsOpen(!isOpen);

  const sendMessage = async (message: string) => {
    const newMessage: Message = { sender: "user", text: message };
    setMessages((prev) => [...prev, newMessage]);
    setIsTyping(true);

    try {
      const response = await apiFetch("/ask", {
        method: "POST",
        body: JSON.stringify({ message }),
      });

      const data = await response.json();
      setMessages((prev) => [...prev, { sender: "bot", text: data.answer }]);
    } catch (error) {
      setMessages((prev) => [...prev, { sender: "bot", text: "Error de conexión." }]);
    } finally {
      setIsTyping(false);
    }
  };

  if (!mostrarWidget) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {isOpen ? (
        <div className="w-80 max-h-[80vh] rounded-xl shadow-xl border bg-white flex flex-col overflow-hidden">
          <ChatHeader onClose={toggleChat} />
          <div className="flex-1 overflow-y-auto p-2">
            {messages.map((msg, i) => (
              <ChatMessage key={i} sender={msg.sender} text={msg.text} />
            ))}
            {isTyping && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </div>
          <ChatInput onSend={sendMessage} />
        </div>
      ) : (
        <button
          onClick={toggleChat}
          className="bg-blue-500 hover:bg-blue-600 text-white p-3 rounded-full shadow-lg flex items-center justify-center"
        >
          💬
        </button>
      )}
    </div>
  );
};

export default ChatWidget;

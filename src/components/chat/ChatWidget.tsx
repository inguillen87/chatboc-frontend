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
  const isRutaPublica = ["/", "/demo", "/login", "/register"].some((r) => path.startsWith(r));
  const user = JSON.parse(localStorage.getItem("user") || "null");

  if (!user || isRutaPublica) return null;

  const toggleChat = () => {
    setIsOpen(!isOpen);
    if (!isOpen && messages.length === 0) {
      const welcomeMessage = {
        id: 1,
        text: "¡Hola! Soy Chatboc, tu asistente virtual. ¿En qué puedo ayudarte hoy?",
        isBot: true,
        timestamp: new Date()
      };
      setMessages([welcomeMessage]);
    }
  };

  const handleSendMessage = async (text: string) => {
    const token = user?.token || "fake-token";

    const userMessage: Message = {
      id: messages.length + 1,
      text,
      isBot: false,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setIsTyping(true);

    try {
      const data = await apiFetch("/ask", "POST", {
        question: text,
        user_id: user?.id
      }, {
        headers: {
          "Content-Type": "application/json",
          Authorization: token
        }
      });

      const botMessage: Message = {
        id: messages.length + 2,
        text: data.answer || "No entendí tu mensaje.",
        isBot: true,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: messages.length + 2,
        text: "⚠️ No se pudo conectar con el servidor.",
        isBot: true,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-50">
      <button
        onClick={toggleChat}
        className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all ${
          isOpen ? "bg-red-500 hover:bg-red-600" : "bg-[#e0f2fe] hover:bg-[#bae6fd]"
        }`}
        aria-label={isOpen ? "Cerrar chat" : "Abrir chat"}
      >
        {isOpen ? (
          <X className="text-white h-6 w-6" />
        ) : (
          <img
            src="/widget/chatboc_widget_icon.png"
            alt="Chatboc"
            className="w-7 h-7"
          />
        )}
      </button>

      {isOpen && (
        <div className="absolute bottom-16 right-0 w-80 md:w-96 bg-white rounded-lg shadow-xl border border-gray-200 flex flex-col" style={{ maxHeight: "500px", height: "500px" }}>
          <ChatHeader onClose={toggleChat} />
          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
            {messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}
            {isTyping && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </div>
          <ChatInput onSendMessage={handleSendMessage} />
        </div>
      )}
    </div>
  );
};

export default ChatWidget;

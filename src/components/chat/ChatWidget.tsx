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
  const [showNotification, setShowNotification] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const path = window.location.pathname;
  const isRutaOculta = ["/login", "/register"].some((r) =>
    path.startsWith(r)
  );
  const user = JSON.parse(localStorage.getItem("user") || "null");

  if (isRutaOculta) return null;

  // Notificación una vez por sesión
  useEffect(() => {
    const alreadyShown = sessionStorage.getItem("chatboc_notif_shown");
    if (!alreadyShown) {
      setShowNotification(true);
      sessionStorage.setItem("chatboc_notif_shown", "true");

      const timeout = setTimeout(() => setShowNotification(false), 6000);
      return () => clearTimeout(timeout);
    }
  }, []);

  const toggleChat = () => {
    setIsOpen(!isOpen);
    if (!isOpen && messages.length === 0) {
      const welcomeMessage = {
        id: 1,
        text: "¡Hola! Soy Chatboc, tu asistente virtual. ¿En qué puedo ayudarte hoy?",
        isBot: true,
        timestamp: new Date(),
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
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsTyping(true);

    try {
      const data = await apiFetch(
        "/ask",
        "POST",
        {
          question: text,
          user_id: user?.id,
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: token,
          }
        }
      );

      const botMessage: Message = {
        id: messages.length + 2,
        text: data.answer || "No entendí tu mensaje.",
        isBot: true,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, botMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: messages.length + 2,
        text: "⚠️ No se pudo conectar con el servidor.",
        isBot: true,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-50">

      {/* ✅ Notificación flotante */}
      {showNotification && !isOpen && (
        <div className="absolute bottom-24 right-0 w-72 bg-white shadow-lg border border-gray-200 rounded-lg p-4 animate-slide-up flex items-start gap-3">
          <img
            src="/chatboc_widget_64x64.webp"
            alt="Chatboc"
            className="w-8 h-8"
          />
          <div className="flex-1">
            <p className="text-sm text-gray-800 font-medium">
              ¡Hola! Soy Chatboc 😊
            </p>
            <p className="text-xs text-gray-600 mt-1">
              ¿Necesitás ayuda? Estoy acá para responderte.
            </p>
          </div>
          <button
            className="text-gray-400 hover:text-red-500 text-sm"
            onClick={() => setShowNotification(false)}
          >
            ✕
          </button>
        </div>
      )}

      {/* ✅ Botón flotante tipo burbuja profesional */}
      <button
        onClick={toggleChat}
        className={`group relative w-16 h-16 rounded-full flex items-center justify-center border border-gray-300 shadow-xl transition-all duration-300 ease-in-out transform hover:scale-110 hover:brightness-105 ${
          isOpen ? "bg-red-500 hover:bg-red-600" : "bg-[#f1f5f9] hover:bg-[#e2e8f0]"
        }`}
        aria-label={isOpen ? "Cerrar chat" : "Abrir chat"}
      >
        {isOpen ? (
          <X className="text-white h-6 w-6" />
        ) : (
          <>
            <div className="relative">
              <img
                src="/chatboc_widget_64x64.webp"
                alt="Chatboc"
                className="w-8 h-8"
              />
              {/* Badge verde */}
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
            </div>
            {/* Tooltip en desktop */}
            <span className="absolute -left-44 hidden md:block group-hover:flex bg-gray-800 text-white text-xs px-3 py-1 rounded shadow-md whitespace-nowrap">
              ¿Necesitás ayuda?
            </span>
          </>
        )}
      </button>

      {/* ✅ Panel del chat */}
      {isOpen && (
        <div
          className="absolute bottom-20 right-0 w-80 md:w-96 bg-white rounded-xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden animate-slide-up"
          style={{ maxHeight: "500px", height: "500px" }}
        >
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

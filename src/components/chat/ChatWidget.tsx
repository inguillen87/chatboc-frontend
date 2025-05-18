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
  const isRutaOculta = ["/login", "/register", "/perfil"].some((r) => path.startsWith(r));
  if (isRutaOculta) return null;

  // 🧠 Token de sesión o demo
  let token = "demo-token";
  try {
    const storedUser = localStorage.getItem("user");
    const user = storedUser ? JSON.parse(storedUser) : null;
    if (user?.token) token = user.token;
  } catch (e) {
    console.warn("❗ Error leyendo user del localStorage", e);
  }

  // 📥 Auto scroll al último mensaje
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const toggleChat = () => {
    setIsOpen(!isOpen);
    if (!isOpen && messages.length === 0) {
      setMessages([
        {
          id: 1,
          text: "¡Hola! Soy Chatboc, tu asistente virtual. ¿En qué puedo ayudarte hoy?",
          isBot: true,
          timestamp: new Date(),
        },
      ]);
    }
  };

  const handleSendMessage = async (text: string) => {
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
        "/responder_chatboc",
        "POST",
        { pregunta: text },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const botMessage: Message = {
        id: messages.length + 2,
        text: data.respuesta || "❌ No entendí tu mensaje.",
        isBot: true,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, botMessage]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: messages.length + 2,
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
    <div className="fixed bottom-5 right-5 z-50">
      {/* Botón flotante */}
      <button
        onClick={toggleChat}
        className="group relative w-16 h-16 rounded-full flex items-center justify-center border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 hover:shadow-lg transition-all duration-300 ease-in-out transform hover:scale-105"
        aria-label={isOpen ? "Cerrar chat" : "Abrir chat"}
      >
        {isOpen ? (
          <X className="text-gray-600 dark:text-gray-300 h-6 w-6" />
        ) : (
          <>
            <div className="relative">
              <img
                src="/chatboc_widget_64x64.webp"
                alt="Chatboc"
                className="w-8 h-8"
              />
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-900" />
            </div>
            <span className="absolute -left-44 hidden md:block group-hover:flex bg-gray-800 text-white text-xs px-3 py-1 rounded shadow-md whitespace-nowrap">
              ¿Necesitás ayuda?
            </span>
          </>
        )}
      </button>

      {/* Panel del chat */}
      {isOpen && (
        <div
          className="absolute bottom-20 right-0 w-80 md:w-96 h-[500px] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl flex flex-col overflow-hidden animate-slide-up"
        >
          <ChatHeader onClose={toggleChat} />
          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
            {messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} />
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

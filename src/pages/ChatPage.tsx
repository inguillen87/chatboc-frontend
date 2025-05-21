import React, { useState, useEffect, useRef } from "react";
import { Message } from "@/types/chat";
import ChatInput from "@/components/chat/ChatInput";
import TypingIndicator from "@/components/chat/TypingIndicator";
import { apiFetch } from "@/utils/api";

const ChatPage = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [token, setToken] = useState("");
  const [rubro, setRubro] = useState("general");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Siempre que carga el componente, se fija si hay un usuario logueado
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    const user = storedUser ? JSON.parse(storedUser) : null;
    if (user?.token) {
      setToken(user.token);
    }

    setMessages([
      {
        id: 1,
        text: "¡Hola! Soy Chatboc, ¿en qué puedo ayudarte hoy?",
        isBot: true,
        timestamp: new Date(),
      },
    ]);
  }, []);

  // Cada vez que cambia el token, pedimos el rubro real al backend
  useEffect(() => {
    const cargarRubro = async () => {
      if (!token) return;
      try {
        const res = await apiFetch("/me", "GET", null, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setRubro(res?.rubro?.toLowerCase() || "general");
      } catch (err) {
        console.error("❌ Error al obtener rubro:", err);
      }
    };
    cargarRubro();
  }, [token]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
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
      // Siempre tomamos el último user de localStorage por si cambió
      const storedUser = localStorage.getItem("user");
      const user = storedUser ? JSON.parse(storedUser) : null;
      const tokenFinal = user?.token || token;

      const response = await apiFetch(
        "/responder_chatboc",
        "POST",
        {
          pregunta: text,
          rubro: rubro,
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${tokenFinal}`,
          },
        }
      );

      const botMessage: Message = {
        id: updatedMessages.length + 1,
        text: response?.respuesta || "⚠️ No se pudo generar una respuesta.",
        isBot: true,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, botMessage]);
    } catch (error: any) {
      const errorMessage: Message = {
        id: updatedMessages.length + 1,
        text: `⚠️ Error al conectar con el servidor: ${error.message || "desconocido"}`,
        isBot: true,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-start bg-background text-foreground pt-20 px-4">
      <div className="w-full max-w-2xl flex flex-col h-[80vh] bg-white dark:bg-[#1e1e1e] rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scroll-smooth">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`p-3 rounded-xl max-w-[80%] shadow ${
                msg.isBot
                  ? "bg-blue-100 dark:bg-blue-900/30 text-black dark:text-white self-start"
                  : "bg-[#006AEC] text-white self-end"
              }`}
            >
              <div className="text-sm whitespace-pre-wrap">{msg.text}</div>
              <div className="text-[10px] opacity-60 text-right mt-1">
                {msg.timestamp.toLocaleTimeString()}
              </div>
            </div>
          ))}
          {isTyping && <TypingIndicator />}
          <div ref={messagesEndRef} />
        </div>
        <div className="border-t border-gray-200 dark:border-gray-700 p-2">
          <ChatInput onSendMessage={handleSend} />
        </div>
      </div>
    </div>
  );
};

export default ChatPage;

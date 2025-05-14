import React, { useState, useEffect, useRef } from "react";
import { Message } from "@/types/chat";
import ChatMessage from "@/components/chat/ChatMessage";
import ChatInput from "@/components/chat/ChatInput";
import TypingIndicator from "@/components/chat/TypingIndicator";
import { apiFetch } from "@/utils/api";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

const ChatPage = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isDemo = window.location.pathname.includes("demo");
  const navigate = useNavigate();

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

    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const token = user?.token || "";

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
      let response;

      if (isDemo) {
       response = await apiFetch(
  "/demo-chat",
  "POST",
  {
    messages: updatedMessages.map((m) => ({
      role: m.isBot ? "assistant" : "user",
      content: m.text,
    })),
    rubro_id: 1,
  },
          {
            headers: {
              "Content-Type": "application/json",
            },
          }
        );
      } else {
        response = await apiFetch(
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
            },
          }
        );
      }

      const botMessage: Message = {
        id: updatedMessages.length + 1,
        text: response?.answer || response?.content || "⚠️ No se pudo generar una respuesta.",
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

  const handleLogout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    navigate("/login");
  };

  return (
    <div className="w-full max-w-2xl flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4">
  <h1 className="text-xl font-bold text-center sm:text-left">Chat en vivo</h1>
  <div className="flex flex-col sm:flex-row gap-2 justify-center sm:justify-end">
    <Button variant="outline" onClick={() => navigate("/perfil")}>
      Volver al perfil
    </Button>
    <Button variant="destructive" onClick={handleLogout}>
      Cerrar sesión
    </Button>
  </div>



      {/* Área del chat */}
      <div className="w-full max-w-2xl bg-white rounded-lg shadow-md border border-gray-200 p-4 flex flex-col h-[80vh]">
        <div className="flex-1 overflow-y-auto space-y-4 px-2 pb-4">
          {messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))}
          {isTyping && <TypingIndicator />}
          <div ref={messagesEndRef} />
        </div>
        <ChatInput onSendMessage={handleSend} />
      </div>
    </div>
  );
};

export default ChatPage;

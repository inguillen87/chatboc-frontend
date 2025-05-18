import React, { useState, useEffect, useRef } from "react";
import { Message } from "@/types/chat";
import ChatInput from "@/components/chat/ChatInput";
import TypingIndicator from "@/components/chat/TypingIndicator";
// 🔥 Usamos render directo, no ChatMessage
// import ChatMessage from "@/components/chat/ChatMessage";
import { apiFetch } from "@/utils/api";

const ChatPage = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isDemo = window.location.pathname.includes("demo");

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
        response = await apiFetch("/demo-chat", "POST", {
          messages: updatedMessages.map((m) => ({
            role: m.isBot ? "assistant" : "user",
            content: m.text,
          })),
        });
      } else {
        response = await apiFetch(
          "/responder_chatboc",
          "POST",
          { question: text },
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: token,
            },
          }
        );
      }

      console.log("🧪 response:", response);
      const textoRespuesta =
        response && typeof response === "object"
          ? response.respuesta ?? JSON.stringify(response)
          : `⚠️ Respuesta inválida del backend: ${JSON.stringify(response)}`;

      const botMessage: Message = {
        id: updatedMessages.length + 1,
        text: textoRespuesta,
        isBot: true,
        timestamp: new Date(),
      };

      console.log("🪵 Enviando al frontend:", botMessage);
      setMessages([...updatedMessages, botMessage]);
    } catch (error: any) {
      const errorMessage: Message = {
        id: updatedMessages.length + 1,
        text: `⚠️ Error al conectar con el servidor: ${error.message || "desconocido"}`,
        isBot: true,
        timestamp: new Date(),
      };
      setMessages([...updatedMessages, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-80px)] flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-2xl bg-white rounded-lg shadow-md border border-gray-200 p-4 flex flex-col h-[80vh]">
        <div className="flex-1 overflow-y-auto space-y-4 px-2 pb-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`p-3 rounded-xl max-w-[80%] ${
                msg.isBot
                  ? "bg-blue-100 text-black self-start"
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
        <ChatInput onSendMessage={handleSend} />
      </div>
    </div>
  );
};

export default ChatPage;

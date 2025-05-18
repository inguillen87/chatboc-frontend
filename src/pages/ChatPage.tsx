import React, { useState, useEffect, useRef } from "react";
import { Message } from "@/types/chat";
import ChatInput from "@/components/chat/ChatInput";
import TypingIndicator from "@/components/chat/TypingIndicator";
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
        text: "¡Hola! Soy Chatboc 🤖 ¿En qué puedo ayudarte hoy?",
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

      const allMessages = [...updatedMessages, botMessage];

      const sinRespuestaUtil =
        textoRespuesta.includes("no tengo una respuesta") ||
        textoRespuesta.includes("no tengo información") ||
        textoRespuesta.includes("no encontré") ||
        textoRespuesta.includes("desconocida");

      if (sinRespuestaUtil) {
        allMessages.push({
          id: allMessages.length + 1,
          text: "__sugerencia__",
          originalQuestion: text,
          isBot: true,
          timestamp: new Date(),
        });
      }

      setMessages(allMessages);
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

  const renderMessage = (msg: Message) => {
    if (msg.text === "__sugerencia__" && msg.originalQuestion) {
      const [enviado, setEnviado] = useState(false);

      const handleSugerencia = async () => {
        const user = JSON.parse(localStorage.getItem("user") || "null");
        await fetch("https://api.chatboc.ar/sugerencia", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${user?.token || ""}`,
          },
          body: JSON.stringify({
            texto: msg.originalQuestion,
            rubro_id: user?.rubro_id || 1,
          }),
        });
        setEnviado(true);
      };

      return (
        <div
          key={msg.id}
          className="bg-yellow-100 dark:bg-yellow-900/30 text-black dark:text-yellow-200 p-3 rounded-xl max-w-[80%] self-start shadow"
        >
          <p className="text-sm font-semibold">🤔 No encontré una respuesta clara a:</p>
          <p className="text-xs italic mt-1">"{msg.originalQuestion}"</p>
          {!enviado ? (
            <button
              onClick={handleSugerencia}
              className="mt-2 text-xs text-blue-700 dark:text-blue-400 underline"
            >
              ➕ Enviar esta duda como sugerencia
            </button>
          ) : (
            <p className="text-xs text-green-600 mt-2">✅ ¡Gracias por tu sugerencia!</p>
          )}
        </div>
      );
    }

    return (
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
    );
  };

  return (
    <div className="min-h-[calc(100vh-80px)] flex flex-col items-center justify-center px-4 py-4">
      <div className="w-full max-w-2xl bg-white dark:bg-[#1e1e1e] rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 flex flex-col h-[80vh]">
        <div className="flex-1 overflow-y-auto space-y-4 px-3 py-4">
          {messages.map(renderMessage)}
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

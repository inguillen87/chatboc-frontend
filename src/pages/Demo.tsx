import React, { useState, useEffect, useRef } from "react";
import ChatMessage from "@/components/chat/ChatMessage";
import ChatInput from "@/components/chat/ChatInput";
import TypingIndicator from "@/components/chat/TypingIndicator";
import { Message } from "@/types/chat";
import { apiFetch } from "@/utils/api";

const Demo = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [preguntasUsadas, setPreguntasUsadas] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 🔐 Token anónimo persistente
  let token = "";
  try {
    const storedUser = localStorage.getItem("user");
    const user = storedUser ? JSON.parse(storedUser) : null;

    if (user?.token) {
      token = user.token;
    } else {
      let anonToken = localStorage.getItem("anon_token");
      if (!anonToken) {
        anonToken = `demo-anon-${Math.random().toString(36).substring(2, 10)}`;
        localStorage.setItem("anon_token", anonToken);
      }
      token = anonToken;
    }
  } catch (e) {
    console.warn("❗ Error leyendo user/anon_token del localStorage", e);
  }

  // 🎬 Mensaje inicial
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

  // 📜 Scroll automático
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ✉️ Enviar mensaje
  const handleSendMessage = async (text: string) => {
    if (!text.trim()) return;

   if (preguntasUsadas >= 15) {
  setMessages((prev) => [
    ...prev,
    {
      id: prev.length + 1,
      text: `🔒 Alcanzaste el límite de 15 preguntas gratuitas en esta demo.\n\n👉 Si te gustó, podés crear una cuenta gratis para usar Chatboc sin límites y personalizarlo para tu empresa. [Registrarse ahora](/register)`,
      isBot: true,
      timestamp: new Date(),
    },
  ]);
  return;
}


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
        "/responder_chatboc",
        "POST",
        { question: text },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
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
      setPreguntasUsadas((prev) => prev + 1);
    } catch (error) {
      const errorMessage: Message = {
        id: updatedMessages.length + 1,
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
    <div className="w-full max-w-2xl mx-auto bg-white dark:bg-[#1e1e1e] rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 flex flex-col h-[85vh] mt-6 overflow-hidden">
      {/* Header con branding */}
      <div className="bg-[#006AEC] text-white py-3 px-4 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-2">
          <img
            src="/chatboc_widget_white_outline.webp"
            alt="Chatboc"
            className="w-6 h-6"
          />
          <span className="font-semibold text-sm">Chatboc · Demo Gratuita</span>
        </div>
      </div>

      {/* Área de mensajes */}
      <div className="flex-1 overflow-y-auto space-y-4 px-4 py-4 bg-gray-50 dark:bg-[#2a2a2a] transition-colors">
        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}
        {isTyping && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 dark:border-gray-700 p-2 bg-white dark:bg-[#1e1e1e]">
        <ChatInput onSendMessage={handleSendMessage} />
      </div>
    </div>
  );
};

export default Demo;

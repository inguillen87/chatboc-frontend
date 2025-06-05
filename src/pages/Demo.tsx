import React, { useState, useEffect, useRef } from "react";
import ChatInput from "@/components/chat/ChatInput";
import TypingIndicator from "@/components/chat/TypingIndicator";
import { Message } from "@/types/chat";
import { apiFetch } from "@/utils/api";

const Demo = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [preguntasUsadas, setPreguntasUsadas] = useState(0);
  const [rubroSeleccionado, setRubroSeleccionado] = useState<string | null>(() => {
    return localStorage.getItem("rubroSeleccionado");
  });
  const [rubrosDisponibles, setRubrosDisponibles] = useState<{ id: number; nombre: string }[]>([]);
  const [esperandoRubro, setEsperandoRubro] = useState(!rubroSeleccionado);

  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!rubroSeleccionado) {
      fetch("https://api.chatboc.ar/rubros")
        .then((res) => res.json())
        .then((data) => {
          setRubrosDisponibles(data.rubros || []);
          setEsperandoRubro(true);
        })
        .catch((err) => console.error("Error al obtener rubros:", err));
    } else {
      setMessages([
        {
          id: 1,
          text: "¡Hola! Soy Chatboc, tu experto virtual. ¿En qué puedo ayudarte?",
          isBot: true,
          timestamp: new Date(),
        },
      ]);
    }
  }, [rubroSeleccionado]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
        "/ask",
        "POST",
        { question: text, rubro: rubroSeleccionado },
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

  if (esperandoRubro) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center bg-gradient-to-b from-blue-50 to-white dark:from-[#10141b] dark:to-[#181d24]">
        <div className="w-full max-w-md p-6 rounded-3xl shadow-2xl border bg-white dark:bg-[#181d24]">
          <h2 className="text-2xl font-bold mb-3 text-blue-800 dark:text-blue-300">👋 ¡Bienvenido a Chatboc!</h2>
          <p className="mb-4 text-gray-600 dark:text-gray-300">
            Para darte una mejor experiencia, contanos a qué rubro pertenece tu negocio:
          </p>
          <div className="flex flex-wrap justify-center gap-2 mt-3">
            {rubrosDisponibles.map((rubro) => (
              <button
                key={rubro.id}
                onClick={() => {
                  localStorage.setItem("rubroSeleccionado", rubro.nombre);
                  setRubroSeleccionado(rubro.nombre);
                  setEsperandoRubro(false);
                }}
                className="px-5 py-3 rounded-full font-semibold text-base bg-gradient-to-r from-blue-500 to-blue-700 text-white hover:from-blue-600 hover:to-blue-800 shadow-md focus:outline-none transition-all"
              >
                {rubro.nombre}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="
      w-full max-w-2xl mx-auto
      bg-white dark:bg-[#1e1e1e]
      rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-700
      flex flex-col h-[90vh] sm:h-[84vh] mt-6
      overflow-hidden
      relative
      "
    >
      {/* Header */}
      <div className="bg-[#006AEC] text-white py-3 px-4 flex items-center justify-between shadow-lg sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <img
            src="/chatboc_widget_white_outline.webp"
            alt="Chatboc"
            className="w-7 h-7"
          />
          <span className="font-semibold text-base sm:text-lg tracking-tight">Chatboc · Demo Gratuita</span>
        </div>
        <span className="hidden sm:inline-block text-xs opacity-70">{rubroSeleccionado}</span>
      </div>

      {/* Mensajes */}
      <div className="
        flex-1 overflow-y-auto px-2 sm:px-5 py-5 bg-gradient-to-b from-blue-50/40 via-white to-blue-100/10 dark:bg-gradient-to-b dark:from-[#1b2532] dark:to-[#242b33]
        transition-colors space-y-3 custom-scroll
      ">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`max-w-[84%] sm:max-w-[75%] rounded-2xl px-4 py-3 shadow-lg mb-2 whitespace-pre-wrap break-words text-justify
              text-[15px] sm:text-base
              ${msg.isBot
                ? "bg-blue-100 dark:bg-blue-900/60 text-blue-900 dark:text-white self-start"
                : "bg-gradient-to-br from-blue-500 to-blue-700 text-white self-end"
              }
            `}
            style={{
              marginLeft: msg.isBot ? 0 : "auto",
              marginRight: msg.isBot ? "auto" : 0,
            }}
          >
            {msg.text}
            <div className={`text-[10px] sm:text-xs mt-1 text-right opacity-60 ${msg.isBot ? "text-blue-700 dark:text-blue-200" : "text-white"}`}>
              {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </div>
          </div>
        ))}
        {isTyping && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 dark:border-gray-700 p-2 bg-white dark:bg-[#1e1e1e] sticky bottom-0 z-10">
        <ChatInput onSendMessage={handleSendMessage} />
      </div>
    </div>
  );
};

export default Demo;

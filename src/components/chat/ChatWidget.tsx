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
  const [preguntasUsadas, setPreguntasUsadas] = useState(0);
  const [rubroSeleccionado, setRubroSeleccionado] = useState<string | null>(() => {
    return localStorage.getItem("rubroSeleccionado");
  });
  const [rubrosDisponibles, setRubrosDisponibles] = useState<{ id: number; nombre: string }[]>([]);
  const [esperandoRubro, setEsperandoRubro] = useState(!rubroSeleccionado);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const path = window.location.pathname;
  const isRutaOculta = ["/login", "/register", "/perfil"].some((r) => path.startsWith(r));
  if (isRutaOculta) return null;

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
    console.warn("❗ Error leyendo user del localStorage", e);
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
    }
  }, [rubroSeleccionado]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const toggleChat = () => {
    setIsOpen(!isOpen);
    if (!isOpen && messages.length === 0 && rubroSeleccionado) {
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
    if (!text.trim()) return;

    const esAnonimo = token.startsWith("demo-anon-") || token.startsWith("demo-token");
    if (esAnonimo && preguntasUsadas >= 15) {
      setMessages((prev) => [
        ...prev,
        {
          id: prev.length + 1,
          text: `🔒 Alcanzaste el límite de 15 preguntas gratuitas en esta demo.\n\n👉 Si te gustó, podés crear una cuenta gratis para usar Chatboc sin límites y personalizarlo para tu empresa: https://chatboc.ar/register`,
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

    setMessages((prev) => [...prev, userMessage]);
    setIsTyping(true);

    try {
      const data = await apiFetch(
        "/responder_chatboc",
        "POST",
        { pregunta: text, rubro: rubroSeleccionado },
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

      if (esAnonimo) {
        setPreguntasUsadas((prev) => prev + 1);
      }
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

  if (isOpen && esperandoRubro) {
    return (
      <div className="fixed bottom-20 right-5 z-50 w-80 md:w-96 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl shadow-xl p-4 animate-slide-up">
        <h2 className="text-lg font-semibold mb-3 text-center">👋 ¡Bienvenido!</h2>
        <p className="mb-4 text-sm text-center">¿De qué rubro es tu negocio? Elegí uno para personalizar tu experiencia:</p>
        <div className="flex flex-wrap justify-center gap-2">
          {rubrosDisponibles.map((rubro) => (
            <button
              key={rubro.id}
              onClick={() => {
                localStorage.setItem("rubroSeleccionado", rubro.nombre);
                setRubroSeleccionado(rubro.nombre);
                setEsperandoRubro(false);
                setMessages([
                  {
                    id: 1,
                    text: "¡Hola! Soy Chatboc, tu asistente virtual. ¿En qué puedo ayudarte hoy?",
                    isBot: true,
                    timestamp: new Date(),
                  },
                ]);
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 text-sm"
            >
              {rubro.nombre}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-5 right-5 z-50">
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
                src="/chatboc_logo_clean_transparent.png"
                alt="Chatboc"
                className="w-8 h-8 rounded"
                style={{ padding: "2px" }}
              />
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-900" />
            </div>
            <span className="absolute -left-44 hidden md:block group-hover:flex bg-gray-800 text-white text-xs px-3 py-1 rounded shadow-md whitespace-nowrap">
              ¿Necesitás ayuda?
            </span>
          </>
        )}
      </button>

      {isOpen && !esperandoRubro && (
        <div className="absolute bottom-20 right-0 w-80 md:w-96 h-[500px] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl flex flex-col overflow-hidden animate-slide-up">
          <ChatHeader onClose={toggleChat} />
          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3" ref={chatContainerRef}>
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

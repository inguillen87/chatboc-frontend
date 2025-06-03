import React, { useState, useRef, useEffect } from "react";
import { X } from "lucide-react";
import ChatHeader from "./ChatHeader";
import ChatMessage from "./ChatMessage";
import TypingIndicator from "./TypingIndicator";
import ChatInput from "./ChatInput";
import { Message } from "@/types/chat";
import { apiFetch } from "@/utils/api";

function getToken() {
  // PRIORIDAD 1: token por URL (widget embed)
  const params = new URLSearchParams(window.location.search);
  const urlToken = params.get("token");
  if (urlToken) return urlToken;

  // PRIORIDAD 2: token logueado
  const storedUser = localStorage.getItem("user");
  const user = storedUser ? JSON.parse(storedUser) : null;
  if (user?.token && !user.token.startsWith("demo")) return user.token;

  // PRIORIDAD 3: demo token anónimo
  let anonToken = localStorage.getItem("anon_token");
  if (!anonToken) {
    anonToken = `demo-anon-${Math.random().toString(36).substring(2, 10)}`;
    localStorage.setItem("anon_token", anonToken);
  }
  return anonToken;
}

const ChatWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(true); // Siempre abierto si es iframe/widget
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [preguntasUsadas, setPreguntasUsadas] = useState(0);
  const [rubroSeleccionado, setRubroSeleccionado] = useState<string | null>(null);
  const [rubrosDisponibles, setRubrosDisponibles] = useState<{ id: number; nombre: string }[]>([]);
  const [esperandoRubro, setEsperandoRubro] = useState(false);
  const [cargandoRubros, setCargandoRubros] = useState(false);
  const [token, setToken] = useState("");
  const [isVisible, setIsVisible] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Carga rubros si es necesario (demo)
  const cargarRubros = async () => {
    setCargandoRubros(true);
    try {
      const res = await fetch("https://api.chatboc.ar/rubros");
      const data = await res.json();
      setRubrosDisponibles(data.rubros || []);
    } catch {
      setRubrosDisponibles([]);
    }
    setCargandoRubros(false);
  };

  // Recarga token y rubro
  const recargarTokenYRubro = () => {
    const token = getToken();
    setToken(token);

    // Si es user real, rubro por perfil
    if (token && !token.startsWith("demo")) {
      setPreguntasUsadas(0);
      localStorage.removeItem("rubroSeleccionado");
      const storedUser = localStorage.getItem("user");
      const user = storedUser ? JSON.parse(storedUser) : null;
      setRubroSeleccionado(user?.rubro?.toLowerCase() || "general");
      setEsperandoRubro(false);
      return;
    }

    // Si es demo anónimo, rubro de storage (o pide elegir)
    const rubro = localStorage.getItem("rubroSeleccionado");
    if (!rubro) {
      setEsperandoRubro(true);
      setRubroSeleccionado(null);
      cargarRubros();
    } else {
      setRubroSeleccionado(rubro);
      setEsperandoRubro(false);
    }
  };

  useEffect(() => {
    recargarTokenYRubro();
    window.addEventListener("storage", recargarTokenYRubro);
    return () => window.removeEventListener("storage", recargarTokenYRubro);
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  // Mensaje de bienvenida por rubro
  useEffect(() => {
    if (isOpen && rubroSeleccionado) {
      setMessages([
        {
          id: 1,
          text: "¡Hola! Soy Chatboc, tu asistente virtual. ¿En qué puedo ayudarte hoy?",
          isBot: true,
          timestamp: new Date(),
        },
      ]);
    }
  }, [isOpen, rubroSeleccionado]);

  const toggleChat = () => {
    const nextState = !isOpen;
    setIsOpen(nextState);

    if (nextState) {
      recargarTokenYRubro();
      if (messages.length === 0 && rubroSeleccionado) {
        setMessages([
          {
            id: 1,
            text: "¡Hola! Soy Chatboc, tu asistente virtual. ¿En qué puedo ayudarte hoy?",
            isBot: true,
            timestamp: new Date(),
          },
        ]);
      }
    }
  };

  const handleSendMessage = async (text: string) => {
    if (!text.trim()) return;

    if (!rubroSeleccionado) {
      setMessages((prev) => [
        ...prev,
        {
          id: prev.length + 1,
          text: "🛈 Por favor, seleccioná primero el rubro de tu negocio.",
          isBot: true,
          timestamp: new Date(),
        },
      ]);
      return;
    }

    const esAnonimo = token.startsWith("demo-anon") || token.startsWith("demo-token");
    if (esAnonimo && preguntasUsadas >= 15) {
      setMessages((prev) => [
        ...prev,
        {
          id: prev.length + 1,
          text: `🔒 Alcanzaste el límite de 15 preguntas gratuitas en esta demo.\n\n👉 Creá una cuenta para seguir usando Chatboc: https://chatboc.ar/register`,
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
        "/ask",
        "POST",
        { pregunta: text, rubro: rubroSeleccionado },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const respuestaFinal: string =
        typeof data?.respuesta === "string"
          ? data.respuesta
          : data?.respuesta?.text || "❌ No entendí tu mensaje.";

      const botMessage: Message = {
        id: messages.length + 2,
        text: respuestaFinal,
        isBot: true,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, botMessage]);

      if (esAnonimo) {
        setPreguntasUsadas((prev) => prev + 1);
      }
    } catch {
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

  if (!isVisible) return null;

  if (isOpen && esperandoRubro) {
    return (
      <div className="fixed bottom-20 right-5 z-50 w-80 md:w-96 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl shadow-xl p-4 animate-slide-up">
        <h2 className="text-lg font-semibold mb-3 text-center">👋 ¡Bienvenido!</h2>
        <p className="mb-4 text-sm text-center">¿De qué rubro es tu negocio?</p>
        {cargandoRubros ? (
          <div className="text-center text-gray-500 text-sm my-6">Cargando rubros...</div>
        ) : rubrosDisponibles.length === 0 ? (
          <div className="text-center text-red-500 text-sm my-6">
            No se pudieron cargar los rubros. <br />
            <button
              onClick={cargarRubros}
              className="mt-2 underline text-blue-600 hover:text-blue-800"
            >
              Reintentar
            </button>
          </div>
        ) : (
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
        )}
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
          <div className="relative">
            <img
              src="/chatboc_logo_clean_transparent.png"
              alt="Chatboc"
              className="w-8 h-8 rounded"
              style={{ padding: "2px" }}
            />
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-900" />
          </div>
        )}
      </button>

      {isOpen && !esperandoRubro && (
        <div className="absolute bottom-20 right-0 w-80 md:w-96 h-[500px] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl flex flex-col overflow-hidden animate-slide-up">
          <ChatHeader onClose={toggleChat} />
          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3" ref={chatContainerRef}>
            {messages.map((msg) =>
              typeof msg.text === "string" ? (
                <ChatMessage key={msg.id} message={msg} />
              ) : null
            )}
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

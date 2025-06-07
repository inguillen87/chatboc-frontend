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
    return typeof window !== "undefined" ? localStorage.getItem("rubroSeleccionado") : null;
  });
  const [rubrosDisponibles, setRubrosDisponibles] = useState<{ id: number; nombre: string }[]>([]);
  const [esperandoRubro, setEsperandoRubro] = useState(!rubroSeleccionado);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Token siempre anónimo
  let token = "";
  try {
    let anonToken = typeof window !== "undefined" ? localStorage.getItem("anon_token") : null;
    if (!anonToken && typeof window !== "undefined") {
      anonToken = `demo-anon-${Math.random().toString(36).substring(2, 10)}`;
      localStorage.setItem("anon_token", anonToken);
    }
    token = anonToken || "demo-anon";
  } catch (e) {
    token = "demo-anon";
  }

  useEffect(() => {
    if (!rubroSeleccionado) {
      // MODIFICADO: Usar apiFetch para consistencia, aunque para demo fetch directo también funciona.
      // Aquí se podría usar apiFetch('/rubros/', { skipAuth: true }) si el backend espera barra final
      fetch("https://api.chatboc.ar/rubros/") // Asegurarse de usar la barra final si es necesario
        .then((res) => res.json())
        .then((data) => {
          // Asumiendo que el backend puede devolver { rubros: [...] } o directamente [...]
          setRubrosDisponibles(Array.isArray(data) ? data : data.rubros || []);
          setEsperandoRubro(true);
        })
        .catch(() => setRubrosDisponibles([]));
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
    if (!text.trim() || !rubroSeleccionado) return;

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
      // MODIFICADO: apiFetch ahora tiene un formato de opciones. Aquí se usa el token de demo.
      // Si apiFetch fuera el tuyo, se pasaría así:
      // const response = await apiFetch("/ask", {
      //   method: "POST",
      //   body: { question: text, rubro: rubroSeleccionado },
      //   headers: { Authorization: `Bearer ${token}` } // Se envía el token de demo
      // });
      // Pero como ya tiene el formato antiguo, lo dejo así por ahora, solo revisa el token.

      // Asumiendo que apiFetch fue actualizado a la interfaz ApiFetchOptions
      // Si apiFetch es tu version personalizada, ajusta el segundo parametro
      const response = await apiFetch<any>(
        "/ask",
        {
          method: "POST",
          body: { question: text, rubro: rubroSeleccionado }, // SIEMPRE mando el rubro
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`, // Se envía el token de demo
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
      // MODIFICADO: Fondo para la página de "Esperando Rubro"
      <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center bg-background dark:bg-gradient-to-b dark:from-[#10141b] dark:to-[#181d24]">
        <div className="w-full max-w-md p-6 rounded-3xl shadow-2xl border bg-card dark:bg-[#181d24]"> {/* bg-card para modo claro */}
          <h2 className="text-2xl font-bold mb-3 text-blue-800 dark:text-blue-300">👋 ¡Bienvenido a Chatboc!</h2>
          <p className="mb-4 text-muted-foreground">
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
                // MODIFICADO: Botones de rubro con dark: clases
                className="px-5 py-3 rounded-full font-semibold text-base bg-gradient-to-r from-blue-500 to-blue-700 text-white hover:from-blue-600 hover:to-blue-800 shadow-md focus:outline-none transition-all dark:from-blue-700 dark:to-blue-900 dark:hover:from-blue-800 dark:hover:to-blue-950"
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
      bg-card dark:bg-[#1e1e1e] {/* bg-card para modo claro */}
      rounded-3xl shadow-2xl border border-border dark:border-gray-700 {/* border-border para modo claro */}
      flex flex-col h-[90vh] sm:h-[84vh] mt-6
      overflow-hidden
      relative
      "
    >
      {/* Header */}
      {/* MODIFICADO: Header con colores semánticos o mejorados para ambos modos */}
      <div className="bg-primary text-primary-foreground py-3 px-4 flex items-center justify-between shadow-lg sticky top-0 z-10">
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
        flex-1 overflow-y-auto px-2 sm:px-5 py-5
        bg-background dark:bg-gradient-to-b dark:from-[#1b2532] dark:to-[#242b33] {/* bg-background para modo claro */}
        transition-colors space-y-3 custom-scroll
      ">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`max-w-[84%] sm:max-w-[75%] rounded-2xl px-4 py-3 shadow-lg mb-2 whitespace-pre-wrap break-words text-justify
              text-[15px] sm:text-base
              ${msg.isBot
                ? "bg-blue-100 dark:bg-blue-900/60 text-blue-900 dark:text-white self-start"
                // MODIFICADO: Mensajes de usuario con adaptación a modo oscuro
                : "bg-gradient-to-br from-blue-500 to-blue-700 text-white self-end dark:from-blue-700 dark:to-blue-900 dark:text-gray-100"
              }
            `}
            style={{
              marginLeft: msg.isBot ? 0 : "auto",
              marginRight: msg.isBot ? "auto" : 0,
            }}
          >
            {msg.text}
            {/* MODIFICADO: Timestamp del mensaje con adaptación a modo oscuro */}
            <div className={`text-[10px] sm:text-xs mt-1 text-right opacity-60 ${msg.isBot ? "text-blue-700 dark:text-blue-200" : "text-white dark:text-gray-200"}`}>
              {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </div>
          </div>
        ))}
        {isTyping && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border dark:border-gray-700 p-2 bg-card dark:bg-[#1e1e1e] sticky bottom-0 z-10"> {/* bg-card y border-border */}
        <ChatInput onSendMessage={handleSendMessage} />
      </div>
    </div>
  );
};

export default Demo;
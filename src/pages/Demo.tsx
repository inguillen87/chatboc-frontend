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
      // MODIFICADO: Usar apiFetch con skipAuth: true (si tu apiFetch lo soporta y es necesario)
      // Asegurarse de usar la barra final si es necesario para /rubros/
      apiFetch<any[]>('/rubros/', { skipAuth: true }) // Asumiendo apiFetch está configurado para manejar esto
        .then((data) => {
          setRubrosDisponibles(Array.isArray(data) ? data : []); // Ajustado para un array
          setEsperandoRubro(true);
        })
        .catch(() => {
          setRubrosDisponibles([]);
          // Considerar mostrar un mensaje de error aquí
        });
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
  }, [messages, isTyping]); // Añadido isTyping para asegurar scroll al aparecer TypingIndicator

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
      const body: any = { pregunta: text };
      // Asumiendo que el token se maneja dentro de apiFetch o se envía explícitamente
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
      // MODIFICADO: Fondo y colores adaptativos
      <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center bg-background dark:bg-gradient-to-b dark:from-[#10141b] dark:to-[#181d24] text-foreground">
        <div className="w-full max-w-md p-6 rounded-3xl shadow-2xl border bg-card dark:bg-[#181d24]">
          <h2 className="text-2xl font-bold mb-3 text-primary">👋 ¡Bienvenido a Chatboc!</h2>
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
                className="px-5 py-3 rounded-full font-semibold text-base bg-primary text-primary-foreground hover:bg-primary/90 shadow-md focus:outline-none transition-all"
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
      bg-card dark:bg-[#1e1e1e]
      rounded-3xl shadow-2xl border border-border dark:border-gray-700
      flex flex-col h-[90vh] sm:h-[84vh] mt-6
      overflow-hidden
      relative
      "
    >
      {/* Header */}
      {/* MODIFICADO: Header con colores semánticos (bg-primary, text-primary-foreground) */}
      <div className="bg-primary text-primary-foreground py-3 px-4 flex items-center justify-between shadow-lg sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <img
            src="/chatboc_widget_white_outline.webp"
            alt="Chatboc"
            className="w-7 h-7"
          />
          <span className="font-semibold text-base sm:text-lg tracking-tight">Chatboc · Demo Gratuita</span>
        </div>
        <span className="hidden sm:inline-block text-xs opacity-70 text-primary-foreground/70">{rubroSeleccionado}</span> {/* Ajustado opacidad de texto */}
      </div>

      {/* Mensajes */}
      <div className="
        flex-1 overflow-y-auto px-2 sm:px-5 py-5
        bg-background dark:bg-gradient-to-b dark:from-[#1b2532] dark:to-[#242b33]
        transition-colors space-y-3 custom-scroll
      ">
        {messages.map((msg) => (
          <div
            key={msg.id}
            // IMPORTANTE: Aquí NO debe haber clases de estilo de burbuja. ChatMessage se encarga.
            className={`
              flex items-end gap-2 px-3 mb-1
              ${msg.isBot ? "justify-start" : "justify-end"}
            `}
          >
            <ChatMessage message={msg} />
          </div>
        ))}
        {isTyping && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      {/* MODIFICADO: El input se renderiza a través de ChatInput.tsx, que ya fue modificado */}
      <div className="border-t border-border p-2 bg-card sticky bottom-0 z-10"> {/* bg-card y border-border */}
        <ChatInput onSendMessage={handleSendMessage} />
      </div>
    </div>
  );
};

export default Demo;
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
    // Lee rubroSeleccionado de localStorage solo en el cliente
    return typeof window !== "undefined" ? localStorage.getItem("rubroSeleccionado") : null;
  });
  const [rubrosDisponibles, setRubrosDisponibles] = useState<{ id: number; nombre: string }[]>([]);
  const [esperandoRubro, setEsperandoRubro] = useState(false); // Inicialmente false, se actualiza en useEffect
  
  // MODIFICADO: Declaración única del token con useState
  const [token, setToken] = useState<string>("");

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Lógica para inicializar el token al montar el componente
  useEffect(() => {
    if (typeof window !== "undefined") {
      let currentToken = localStorage.getItem("anon_token");
      if (!currentToken) {
        currentToken = `demo-anon-${Math.random().toString(36).substring(2, 10)}`;
        localStorage.setItem("anon_token", currentToken);
      }
      setToken(currentToken);
    }
  }, []); // Dependencia vacía para que se ejecute solo una vez al montar

  // Lógica para cargar rubros o inicializar mensajes al cambiar rubroSeleccionado
  useEffect(() => {
    if (!rubroSeleccionado) {
      // Asegurarse de que el token está inicializado antes de cargar rubros si apiFetch lo requiere
      // Aunque para /rubros/ normalmente no se necesita token si skipAuth es true
      if (typeof window !== "undefined") { // Asegurar ejecución solo en el cliente
        apiFetch<any[]>('/rubros/', { skipAuth: true })
          .then((data) => {
            setRubrosDisponibles(Array.isArray(data) ? data : []);
            setEsperandoRubro(true); // Una vez que los rubros están disponibles, mostramos la pantalla de selección
          })
          .catch(() => {
            setRubrosDisponibles([]);
            // Considerar un mensaje de error visible al usuario si no se pueden cargar los rubros
          });
      }
    } else {
      setMessages([
        {
          id: 1,
          text: "¡Hola! Soy Chatboc, tu experto virtual. ¿En qué puedo ayudarte?",
          isBot: true,
          timestamp: new Date(),
        },
      ]);
      setEsperandoRubro(false); // Si ya hay rubro seleccionado, no esperamos
    }
  }, [rubroSeleccionado]);

  // Lógica de scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]); // Dependencias: mensajes y estado de typing

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || !rubroSeleccionado || !token) return; // Asegurarse de que el token esté disponible

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
      const body: any = { question: text, rubro: rubroSeleccionado };
      const response = await apiFetch<any>(
        "/ask",
        {
          method: "POST",
          body: body,
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
      // Fondo y colores adaptativos
      <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center bg-background dark:bg-gradient-to-b dark:from-[#10141b] dark:to-[#181d24] text-foreground">
        <div className="w-full max-w-md p-6 rounded-3xl shadow-2xl border bg-card dark:bg-[#181d24]">
          <h2 className="text-2xl font-bold mb-3 text-primary">👋 ¡Bienvenido a Chatboc!</h2>
          <p className="mb-4 text-sm text-center text-muted-foreground">
            Para darte una mejor experiencia, contanos a qué rubro pertenece tu negocio:
          </p>
          <div className="flex flex-wrap justify-center gap-2 mt-3">
            {rubrosDisponibles.map((rubro) => (
              <button
                key={rubro.id}
                onClick={() => {
                  localStorage.setItem("rubroSeleccionado", rubro.nombre);
                  setRubroSeleccionado(rubro.nombre);
                  // No es necesario setEsperandoRubro(false) aquí, lo manejará el useEffect de rubroSeleccionado
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
      <div className="bg-primary text-primary-foreground py-3 px-4 flex items-center justify-between shadow-lg sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <img
            src="/chatboc_widget_white_outline.webp"
            alt="Chatboc"
            className="w-7 h-7"
          />
          <span className="font-semibold text-base sm:text-lg tracking-tight">Chatboc · Demo Gratuita</span>
        </div>
        <span className="hidden sm:inline-block text-xs opacity-70 text-primary-foreground/70">{rubroSeleccionado}</span>
      </div>

      {/* Mensajes */}
      <div className="
        flex-1 overflow-y-auto px-2 sm:px-5 py-5
        bg-background dark:bg-gradient-to-b dark:from-[#1b2532] dark:to-[#242b33]
        transition-colors space-y-3 custom-scroll
      ">
        <AnimatePresence>
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`
                flex items-end gap-2 px-3 mb-1
                ${msg.isBot ? "justify-start" : "justify-end"}
              `}
            >
              <ChatMessage message={msg} />
            </div>
          ))}
        </AnimatePresence>
        {isTyping && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border p-2 bg-card sticky bottom-0 z-10">
        <ChatInput onSendMessage={handleSendMessage} />
      </div>
    </div>
  );
};

export default Demo;
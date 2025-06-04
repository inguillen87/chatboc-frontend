import React, { useState, useRef, useEffect, CSSProperties } from "react";
import { X } from "lucide-react"; // Icono para el botón de cierre en el Header
// Asume que tienes estos componentes y tipos en las rutas correctas:
import ChatMessage from "./ChatMessage";
import TypingIndicator from "./TypingIndicator";
import ChatInput from "./ChatInput";
import { Message } from "@/types/chat";
import { apiFetch } from "@/utils/api";

// --- Componente ChatHeader (Definido aquí para completitud) ---
interface ChatHeaderProps {
  title?: string;
  onClose?: () => void; // Para minimizar a globito
}
const ChatHeader: React.FC<ChatHeaderProps> = ({
  title = "Chatboc Asistente",
  onClose,
}) => {
  const [prefersDarkHeader, setPrefersDarkHeader] = useState(
    typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => setPrefersDarkHeader(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return (
    <div
      className="flex items-center justify-between p-3 border-b select-none"
      style={{
        borderBottomColor: prefersDarkHeader ? "#374151" : "#e5e7eb",
        // El arrastre lo maneja widget.js sobre el iframe, no el header interno directamente
        cursor: "default", 
      }}
    >
      <div className="flex items-center pointer-events-none">
        <img
          src="/chatboc_logo_clean_transparent.png" // VERIFICA ESTA RUTA PÚBLICA
          alt="Chatboc"
          className="w-6 h-6 mr-2"
        />
        <span className="font-semibold text-sm">{title}</span>
      </div>
      <div className="flex items-center">
        <span style={{ fontSize: 12, fontWeight: 400, color: prefersDarkHeader ? "#90EE90" : "#24ba53", marginRight: onClose ? '8px' : '0' }} className="pointer-events-none">
          &nbsp;• Online
        </span>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-600 dark:text-gray-300 hover:text-red-500 focus:outline-none"
            aria-label="Minimizar chat"
          >
            <X size={20} />
          </button>
        )}
      </div>
    </div>
  );
};
// --- Fin Componente ChatHeader ---

// --- Función getToken (Completa) ---
function getToken() {
  if (typeof window === "undefined") return "demo-anon-ssr"; // Salvaguarda para SSR
  const params = new URLSearchParams(window.location.search);
  const urlToken = params.get("token");
  if (urlToken) return urlToken;

  const storedUser = localStorage.getItem("user");
  const user = storedUser ? JSON.parse(storedUser) : null;
  if (user?.token && !user.token.startsWith("demo")) return user.token;

  let anonToken = localStorage.getItem("anon_token");
  if (!anonToken) {
    anonToken = `demo-anon-${Math.random().toString(36).substring(2, 10)}`;
    localStorage.setItem("anon_token", anonToken);
  }
  return anonToken;
}
// --- Fin Función getToken ---

// --- Props y Constantes de Dimensiones ---
interface ChatWidgetProps {
  defaultOpen?: boolean;
  widgetId?: string;
}

const WIDGET_DIMENSIONS = {
  OPEN: { width: "360px", height: "520px" }, // Valores por defecto, widget.js puede tener los suyos
  CLOSED: { width: "80px", height: "80px" },
};

// --- Componente ChatWidget ---
const ChatWidget: React.FC<ChatWidgetProps> = ({
  defaultOpen = false,
  widgetId = "chatboc-widget-iframe", // Debe coincidir con el ID en widget.js
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [preguntasUsadas, setPreguntasUsadas] = useState(0);
  const [rubroSeleccionado, setRubroSeleccionado] = useState<string | null>(null);
  const [rubrosDisponibles, setRubrosDisponibles] = useState<{ id: number; nombre: string }[]>([]);
  const [esperandoRubro, setEsperandoRubro] = useState(false);
  const [cargandoRubros, setCargandoRubros] = useState(false);
  const [token, setToken] = useState("");
  const [prefersDark, setPrefersDark] = useState(
    typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
  );

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Efecto para Dark Mode
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => setPrefersDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Cargar Rubros
  const cargarRubros = async () => {
    setCargandoRubros(true);
    try {
      const res = await fetch("https://api.chatboc.ar/rubros"); // URL de tu API
      const data = await res.json();
      setRubrosDisponibles(data.rubros || []);
    } catch (error) {
      console.error("Error cargando rubros:", error);
      setRubrosDisponibles([]);
    }
    setCargandoRubros(false);
  };

  // Recargar Token y Rubro
  const recargarTokenYRubro = () => {
    const currentToken = getToken();
    setToken(currentToken);
    if (currentToken && !currentToken.startsWith("demo")) {
      setPreguntasUsadas(0);
      if (typeof window !== "undefined") localStorage.removeItem("rubroSeleccionado");
      const storedUser = typeof window !== "undefined" ? localStorage.getItem("user") : null;
      const user = storedUser ? JSON.parse(storedUser) : null;
      setRubroSeleccionado(user?.rubro?.toLowerCase() || "general");
      setEsperandoRubro(false);
      return;
    }
    const rubro = typeof window !== "undefined" ? localStorage.getItem("rubroSeleccionado") : null;
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
    if (typeof window !== "undefined") window.addEventListener("storage", recargarTokenYRubro);
    return () => { if (typeof window !== "undefined") window.removeEventListener("storage", recargarTokenYRubro); };
  }, []);

  // Scroll al final de los mensajes
  useEffect(() => {
    if (chatContainerRef.current) chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
  }, [messages, isTyping]);

  // Mensaje de bienvenida y limpieza de mensajes al minimizar
  useEffect(() => {
    if (isOpen && rubroSeleccionado) {
      if (messages.length === 0 || messages[0]?.text !== "¡Hola! Soy Chatboc, tu asistente virtual. ¿En qué puedo ayudarte hoy?") {
         setMessages([{ id: Date.now(), text: "¡Hola! Soy Chatboc, tu asistente virtual. ¿En qué puedo ayudarte hoy?", isBot: true, timestamp: new Date() }]);
      }
    } else if (!isOpen) {
      setMessages([]); // Limpiar mensajes cuando se minimiza a globito
    }
  }, [isOpen, rubroSeleccionado]); // messages fue quitado para evitar bucle si el ID cambia

  // Enviar Mensaje
  const handleSendMessage = async (text: string) => {
    if (!text.trim()) return;
    if (!rubroSeleccionado) {
      setMessages((prev) => [...prev, { id: Date.now(), text: "🛈 Por favor, seleccioná primero el rubro de tu negocio.", isBot: true, timestamp: new Date() }]);
      return;
    }
    const esAnonimo = token.startsWith("demo-anon") || token.startsWith("demo-token");
    if (esAnonimo && preguntasUsadas >= 15) {
      setMessages((prev) => [...prev, { id: Date.now(), text: `🔒 Alcanzaste el límite de 15 preguntas gratuitas en esta demo.\n\n👉 Creá una cuenta para seguir usando Chatboc: https://chatboc.ar/register`, isBot: true, timestamp: new Date() }]);
      return;
    }
    const userMessage: Message = { id: Date.now(), text, isBot: false, timestamp: new Date() };
    setMessages((prevMessages) => [...prevMessages, userMessage]);
    setIsTyping(true);
    try {
      const data = await apiFetch("/ask", "POST", { pregunta: text, rubro: rubroSeleccionado }, { headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` } });
      const respuestaFinal: string = typeof data?.respuesta === "string" ? data.respuesta : data?.respuesta?.text || "❌ No entendí tu mensaje.";
      const botMessage: Message = { id: Date.now() +1, text: respuestaFinal, isBot: true, timestamp: new Date() };
      setMessages((prevMessages) => [...prevMessages.filter(m => m.id !== userMessage.id), userMessage, botMessage]); // Asegura orden y evita duplicados si hay re-render rápido
      if (esAnonimo) setPreguntasUsadas((prev) => prev + 1);
    } catch (error) {
      console.error("Error enviando mensaje:", error);
      setMessages((prevMessages) => [...prevMessages, { id: Date.now(), text: "⚠️ No se pudo conectar con el servidor.", isBot: true, timestamp: new Date() }]);
    } finally {
      setIsTyping(false);
    }
  };

  // Comunicación con widget.js para redimensionar el iframe
  useEffect(() => {
    if (typeof window !== "undefined" && window.parent !== window) {
      const desiredDimensions = isOpen ? WIDGET_DIMENSIONS.OPEN : WIDGET_DIMENSIONS.CLOSED;
      // Leer dimensiones de data-attributes del script en widget.js si están disponibles
      // Esto es complejo de hacer desde el iframe. widget.js debe proveerlas.
      // Por ahora, usamos las constantes.

      window.parent.postMessage({
        type: "chatboc-resize",
        widgetId: widgetId,
        dimensions: desiredDimensions,
        isOpen: isOpen,
      }, "*"); // CAMBIA ESTO EN PRODUCCIÓN al origin de la página contenedora
    }
  }, [isOpen, widgetId]);

  // Toggle entre ventana de chat y globito
  const toggleChat = () => {
    setIsOpen(prevIsOpen => {
      const nextIsOpen = !prevIsOpen;
      if (nextIsOpen) { // Si se está abriendo
        if(!rubroSeleccionado) recargarTokenYRubro(); // Cargar rubro si no está seleccionado
      }
      return nextIsOpen;
    });
  };
  
  // Vista para selección de Rubro
  const rubroSelectionViewContent = (
    <div className="w-full h-full flex flex-col items-center justify-center p-4 animate-slide-up">
      <h2 className="text-lg font-semibold mb-3 text-center">👋 ¡Bienvenido!</h2>
      <p className="mb-4 text-sm text-center">¿De qué rubro es tu negocio?</p>
      {cargandoRubros ? ( <div className="text-center text-gray-500 text-sm my-6">Cargando rubros...</div>
      ) : rubrosDisponibles.length === 0 ? ( <div className="text-center text-red-500 text-sm my-6"> No se pudieron cargar los rubros. <br /> <button onClick={cargarRubros} className="mt-2 underline text-blue-600 hover:text-blue-800"> Reintentar </button> </div>
      ) : ( <div className="flex flex-wrap justify-center gap-2"> {rubrosDisponibles.map((rubro) => ( <button key={rubro.id} onClick={() => { if(typeof window !== "undefined") localStorage.setItem("rubroSeleccionado", rubro.nombre); setRubroSeleccionado(rubro.nombre); setEsperandoRubro(false); }} className="px-4 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 text-sm"> {rubro.nombre} </button> ))} </div>
      )}
    </div>
  );

  // Vista principal del Chat
  const mainChatViewContent = (
    <>
      <ChatHeader title="Chatboc Asistente" onClose={toggleChat} />
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3" ref={chatContainerRef}>
        {messages.map((msg) => <ChatMessage key={msg.id} message={msg} /> )}
        {isTyping && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>
      <ChatInput onSendMessage={handleSendMessage} />
    </>
  );

  // Estilo base del contenedor del widget (ocupa todo el iframe)
  const widgetBaseStyle: CSSProperties = {
    width: "100%",
    height: "100%",
    display: "flex", // Clave para centrar el globito
    alignItems: "center", // Centra verticalmente el globito
    justifyContent: "center", // Centra horizontalmente el globito
    color: prefersDark ? "#fff" : "#222",
    overflow: "hidden",
    // La transición de borderRadius, background, etc., la manejará el iframe en widget.js
    // para evitar conflictos visuales durante el redimensionamiento.
    // Aquí solo nos preocupamos del contenido.
  };

  // El fondo del iframe será transparente. El contenido del ChatWidget tendrá el fondo.
  if (!isOpen) { // Renderizar el "globito"
    return (
      <div
        style={{
          ...widgetBaseStyle,
          background: "transparent", // El iframe es el que cambia, el contenido del globito se centra
        }}
        role="button" // El iframe se hará pequeño, este div lo llena transparentemente
        tabIndex={-1} // No enfocable, el botón interno sí
      >
        {/* Botón real del globito, centrado por el div padre */}
        <button
          onClick={toggleChat}
          aria-label="Abrir chat"
          className="w-16 h-16 rounded-full flex items-center justify-center border focus:outline-none shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
          style={{
            borderColor: prefersDark ? "#4a5568" : "#ccc", // Borde más sutil para el globito
            background: prefersDark ? "#2d3748" : "#fff", // Fondo del globito
            cursor: "pointer",
          }}
        >
          <div className="relative">
            <img src="/chatboc_logo_clean_transparent.png" alt="Chatboc" className="w-8 h-8 rounded" style={{ padding: "2px" }} />
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-900" />
          </div>
        </button>
      </div>
    );
  }

  // Renderizar la ventana de chat completa o selección de rubro
  return (
    <div style={{
        ...widgetBaseStyle,
        flexDirection: "column", // Para apilar Header, Messages, Input
        alignItems: "stretch", // Estirar hijos horizontalmente
        justifyContent: "flex-start", // Alinear hijos arriba
        background: prefersDark ? "#161c24" : "#fff",
        // El borde y borderRadius los maneja el iframe en widget.js
        // No aplicar aquí para evitar doble borde si el iframe ya tiene uno.
        // Si el iframe no tuviera borde (iframe.style.border = "none" como está en widget.js),
        // y quieres que el contenido SÍ tenga borde, lo pones aquí.
        // border: `1px solid ${prefersDark ? "#374151" : "#e5e7eb"}`,
        // borderRadius: "16px", // Esto debería coincidir con el borderRadius del iframe
    }}>
      {esperandoRubro ? rubroSelectionViewContent : mainChatViewContent}
    </div>
  );
};

export default ChatWidget;
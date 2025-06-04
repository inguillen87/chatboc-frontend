import React, { useState, useRef, useEffect } from "react";
import { X } from "lucide-react"; // O tu ícono de Lucide para el logo/abrir
// Asume que SendHorizontal es el nombre correcto o ajústalo (ej. Send)
import { SendHorizontal } from "lucide-react"; 
import ChatMessage from "./ChatMessage"; // Ajusta la ruta
import TypingIndicator from "./TypingIndicator"; // Ajusta la ruta
// ChatInput no se usa directamente aquí si está separado, pero ChatWidget lo invocaría
// import ChatInput from "./ChatInput"; // Ajusta la ruta si lo usas como componente separado
import { Message } from "@/types/chat"; // Ajusta la ruta
import { apiFetch } from "@/utils/api"; // Ajusta la ruta

// --- Componente ChatHeader (Integrado) ---
interface ChatHeaderPropsStandalone {
  onCloseInternal: () => void; // Para el toggle interno del ChatWidget
  prefersDark: boolean;
}
const ChatHeaderStandalone: React.FC<ChatHeaderPropsStandalone> = ({ onCloseInternal, prefersDark }) => {
  return (
    <div
      className="flex items-center justify-between p-3 border-b select-none"
      style={{
        borderBottomColor: prefersDark ? "#374151" : "#e5e7eb",
        // backgroundColor: prefersDark ? "#1f2937" : "#f9fafb", // Fondo sutil para el header
        cursor: "default", // O 'move' si esta parte del header fuera arrastrable
      }}
      // onMouseDown={onDragHeader} // Si el header fuera arrastrable
    >
      <div className="flex items-center pointer-events-none">
        <img src="/chatboc_logo_clean_transparent.png" alt="Chatboc" className="w-6 h-6 mr-2" />
        <span className="font-semibold text-sm">Chatboc Asistente</span>
      </div>
      <div className="flex items-center">
        <span style={{ fontSize: 12, fontWeight: 400, color: prefersDark ? "#90EE90" : "#24ba53", marginRight: '8px' }} className="pointer-events-none">
          &nbsp;• Online
        </span>
        <button onClick={onCloseInternal} className="text-gray-600 dark:text-gray-300 hover:text-red-500 focus:outline-none" aria-label="Cerrar ventana de chat">
          <X size={20} />
        </button>
      </div>
    </div>
  );
};

// --- Componente ChatInput (Integrado, basado en el que me pasaste) ---
interface ChatInputStandaloneProps {
  onSendMessage: (text: string) => void;
  prefersDark: boolean;
}
const PLACEHOLDERS_INTERNAL = [
  "Escribí tu mensaje...",
  "¿En qué puedo ayudarte hoy?",
  "Probá: '¿Qué hace Chatboc?'",
  "¿Cuánto cuesta el servicio?",
];
const ChatInputStandalone: React.FC<ChatInputStandaloneProps> = ({ onSendMessage, prefersDark }) => {
  const [input, setInput] = useState("");
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex((i) => (i + 1) % PLACEHOLDERS_INTERNAL.length);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  const handleSend = () => {
    if (!input.trim()) return;
    onSendMessage(input.trim());
    setInput("");
    inputRef.current?.focus();
  };

  return (
    <div className={`flex items-center gap-2 p-3 border-t ${prefersDark ? 'border-gray-700' : 'border-gray-200'}`}>
      <input
        ref={inputRef}
        className={`
          flex-1 
          ${prefersDark ? 'bg-[#1c1e24] border-[#23272e] text-gray-100 placeholder:text-gray-500 focus:border-blue-400' 
                       : 'bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-blue-500'}
          rounded-2xl px-4 py-2 text-sm outline-none transition shadow-sm
        `}
        type="text"
        placeholder={PLACEHOLDERS_INTERNAL[placeholderIndex]}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
        autoFocus
        autoComplete="off"
      />
      <button
        className={`
          flex items-center justify-center
          bg-blue-500 hover:bg-blue-600 dark:hover:bg-blue-400
          text-white rounded-full p-2 shadow-md transition
          disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed
        `}
        onClick={handleSend}
        disabled={!input.trim()}
        aria-label="Enviar"
        type="button"
      >
        <SendHorizontal className="w-5 h-5" />
      </button>
    </div>
  );
};


// --- ChatWidget (Tu Versión Original para Iframe con Toggle Interno) ---
// Esta versión NO usa postMessage. El iframe tiene un tamaño fijo.
// El botón de abrir/cerrar solo afecta el contenido DENTRO del iframe.
const ChatWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(true); // Por defecto abierto DENTRO del iframe
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [preguntasUsadas, setPreguntasUsadas] = useState(0);
  const [rubroSeleccionado, setRubroSeleccionado] = useState<string | null>(null);
  const [rubrosDisponibles, setRubrosDisponibles] = useState<{ id: number; nombre: string }[]>([]);
  const [esperandoRubro, setEsperandoRubro] = useState(false); // Cambiado para que intente cargar rubro al inicio
  const [cargandoRubros, setCargandoRubros] = useState(false);
  const [token, setToken] = useState("");
  const [prefersDark, setPrefersDark] = useState(
    typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
  );

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => setPrefersDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  
  // Lógica de getToken, cargarRubros, recargarTokenYRubro, handleSendMessage
  // (Estas funciones son las mismas que en la versión completa de ChatWidget que te pasé antes,
  // las omito aquí por brevedad, pero deben estar presentes y funcionales)
  function getTokenInternal(): string { /* ... (misma lógica de getToken que te pasé antes) ... */ 
    if (typeof window === "undefined") return "demo-anon-ssr";
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get("token");
    if (urlToken) return urlToken;
    const storedUserItem = localStorage.getItem("user");
    const user = storedUserItem ? JSON.parse(storedUserItem) : null;
    if (user && user.token && typeof user.token === 'string' && !user.token.startsWith("demo")) return user.token;
    let anonToken = localStorage.getItem("anon_token");
    if (!anonToken) {
      anonToken = `demo-anon-${Math.random().toString(36).substring(2, 10)}`;
      localStorage.setItem("anon_token", anonToken);
    }
    return anonToken;
  }

  const cargarRubrosInternal = async () => { /* ... (misma lógica de cargarRubros) ... */ 
    setCargandoRubros(true);
    try {
      const res = await fetch("https://api.chatboc.ar/rubros");
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      setRubrosDisponibles(data.rubros || []);
    } catch (error) { console.error("Error cargando rubros:", error); setRubrosDisponibles([]); }
    setCargandoRubros(false);
  };

  const recargarTokenYRubroInternal = () => { /* ... (misma lógica de recargarTokenYRubro) ... */ 
    const currentToken = getTokenInternal();
    setToken(currentToken);
    if (currentToken && !currentToken.startsWith("demo") && !currentToken.includes("anon")) {
      setPreguntasUsadas(0);
      if (typeof window !== "undefined") localStorage.removeItem("rubroSeleccionado");
      const storedUserItem = typeof window !== "undefined" ? localStorage.getItem("user") : null;
      const user = storedUserItem ? JSON.parse(storedUserItem) : null;
      const userRubro = user?.rubro;
      setRubroSeleccionado(typeof userRubro === 'string' ? userRubro.toLowerCase() : "general");
      setEsperandoRubro(false); return;
    }
    const rubro = typeof window !== "undefined" ? localStorage.getItem("rubroSeleccionado") : null;
    if (!rubro) { setEsperandoRubro(true); setRubroSeleccionado(null); cargarRubrosInternal(); } 
    else { setRubroSeleccionado(rubro); setEsperandoRubro(false); }
  };

  useEffect(() => { recargarTokenYRubroInternal(); if (typeof window !== "undefined") window.addEventListener("storage", recargarTokenYRubroInternal); return () => window.removeEventListener("storage", recargarTokenYRubroInternal); }, []);
  useEffect(() => { if (chatContainerRef.current) chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight; }, [messages, isTyping]);
  
  useEffect(() => {
    if (isOpen && rubroSeleccionado && !esperandoRubro) {
      const welcomeMessageText = "¡Hola! Soy Chatboc, tu asistente virtual. ¿En qué puedo ayudarte hoy?";
      if (messages.length === 0 || messages[messages.length -1]?.text !== welcomeMessageText) {
        setMessages([{ id: Date.now(), text: welcomeMessageText, isBot: true, timestamp: new Date() }]);
      }
    } else if (!isOpen) {
        // setMessages([]); // Opcional: limpiar mensajes al cerrar internamente
    }
  }, [isOpen, rubroSeleccionado, esperandoRubro, messages]);

  const handleSendMessageInternal = async (text: string) => { /* ... (misma lógica de handleSendMessage) ... */ 
    if (!text.trim()) return;
    if (!rubroSeleccionado) { /* ... mensaje de error ... */ return; }
    const esAnonimo = token.startsWith("demo-anon") || token.startsWith("demo-token");
    if (esAnonimo && preguntasUsadas >= 15) { /* ... mensaje de límite ... */ return; }
    const newUserMessageId = `${Date.now()}-${Math.random().toString(36).substring(2,7)}`;
    const userMessage: Message = { id: newUserMessageId, text, isBot: false, timestamp: new Date() };
    setMessages((prev) => [...prev, userMessage]);
    setIsTyping(true);
    try {
      const data = await apiFetch("/ask", "POST", { pregunta: text, rubro: rubroSeleccionado }, { headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` } });
      const respFinal: string = typeof data?.respuesta === "string" ? data.respuesta : data?.respuesta?.text || "❌ No entendí tu mensaje.";
      const botMsg: Message = { id: `${Date.now()+1}-${Math.random().toString(36).substring(2,7)}`, text: respFinal, isBot: true, timestamp: new Date() };
      setMessages((prev) => [...prev.filter(m => m.id !== newUserMessageId), userMessage, botMsg]);
      if (esAnonimo) setPreguntasUsadas((p) => p + 1);
    } catch (err) { console.error(err); setMessages((prev) => [...prev, { id: Date.now(), text: "⚠️ No se pudo conectar.", isBot: true, timestamp: new Date() }]);
    } finally { setIsTyping(false); }
  };

  const toggleInternalChatWindow = () => {
    setIsOpen(prev => !prev);
  };

  // Estilo del contenedor principal DENTRO del iframe. Ocupa el 100% del iframe.
  const mainDivStyle: CSSProperties = {
    width: "100%",
    height: "100%",
    display: "flex",
    flexDirection: "column", // Para que el botón flotante y la ventana de chat se posicionen
    background: prefersDark ? "#161c24" : "#fff", // Fondo general
    color: prefersDark ? "#fff" : "#222",
    borderRadius: "16px", // Hereda del iframe, pero por si acaso
    overflow: "hidden", // Muy importante
  };
  
  const rubroSelectionViewContentInternal = ( /* ... (definición como en ChatWidget anterior) ... */ );
  const mainChatViewContentInternal = ( /* ... (definición como en ChatWidget anterior, usando ChatHeaderStandalone y ChatInputStandalone) ... */ );


  return (
    <div style={mainDivStyle}>
      {!isOpen && ( // Botón Flotante para abrir DENTRO del iframe
        <div className="w-full h-full flex items-center justify-center"> {/* Contenedor para centrar el botón */}
          <button
            onClick={toggleInternalChatWindow}
            className="group w-16 h-16 rounded-full flex items-center justify-center border shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
            style={{
                borderColor: prefersDark ? "#374151" : "#e5e7eb",
                background: prefersDark ? "#161c24" : "#fff",
            }}
            aria-label="Abrir chat"
          >
            <div className="relative">
              <img src="/chatboc_logo_clean_transparent.png" alt="Chatboc" className="w-8 h-8 rounded" style={{ padding: "2px" }} />
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-900" />
            </div>
          </button>
        </div>
      )}

      {isOpen && ( // Ventana de chat o selección de rubro DENTRO del iframe
        <div className="w-full h-full flex flex-col overflow-hidden animate-slide-up"> {/* Ocupa todo el espacio */}
          {esperandoRubro ? (
            <div className="w-full h-full flex flex-col items-center justify-center p-4">
              <h2 className="text-lg font-semibold mb-3 text-center">👋 ¡Bienvenido!</h2>
              <p className="mb-4 text-sm text-center">¿De qué rubro es tu negocio?</p>
              {cargandoRubros ? ( <div className="text-center text-gray-500 text-sm my-6">Cargando rubros...</div>
              ) : rubrosDisponibles.length === 0 ? ( <div className="text-center text-red-500 text-sm my-6"> No se pudieron cargar los rubros. <br /> <button onClick={cargarRubrosInternal} className="mt-2 underline text-blue-600 hover:text-blue-800"> Reintentar </button> </div>
              ) : ( <div className="flex flex-wrap justify-center gap-2"> {rubrosDisponibles.map((rubro) => ( <button key={rubro.id} onClick={() => { if(typeof window !== "undefined") localStorage.setItem("rubroSeleccionado", rubro.nombre); setRubroSeleccionado(rubro.nombre); setEsperandoRubro(false); }} className="px-4 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 text-sm"> {rubro.nombre} </button> ))} </div>
              )}
            </div>
          ) : (
            <>
              <ChatHeaderStandalone onCloseInternal={toggleInternalChatWindow} prefersDark={prefersDark} />
              <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3" ref={chatContainerRef}>
                {messages.map((msg) => <ChatMessage key={msg.id} message={msg} />)}
                {isTyping && <TypingIndicator />}
                <div ref={messagesEndRef} />
              </div>
              <ChatInputStandalone onSendMessage={handleSendMessageInternal} prefersDark={prefersDark} />
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default ChatWidget;
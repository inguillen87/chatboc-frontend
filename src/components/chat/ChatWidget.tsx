// src/components/chat/ChatWidget.tsx

import React, { useState, useRef, useEffect, useCallback } from "react";
import { X } from "lucide-react";
import ChatMessage from "./ChatMessage";
import TypingIndicator from "./TypingIndicator";
import ChatInput from "./ChatInput";
import { Message } from "@/types/chat"; // Asegúrate de que esta interfaz esté correcta y tenga 'botones?: BotonProps[];'
import { apiFetch } from "@/utils/api";
import { useIsMobile } from "@/hooks/use-mobile";

// --- WidgetChatHeader (se mantiene igual) ---
const WidgetChatHeader = ({ title = "Chatboc Asistente", showCloseButton = false, onClose, onMouseDownDrag, isDraggable }) => (
  <div
    className="flex items-center justify-between p-3 border-b border-border bg-card text-foreground select-none"
    style={{ cursor: isDraggable && onMouseDownDrag ? "move" : "default" }}
    onMouseDown={onMouseDownDrag}
    onTouchStart={onMouseDownDrag}
  >
    <div className="flex items-center pointer-events-none">
      <img src="/chatboc_logo_clean_transparent.png" alt="Chatboc" className="w-6 h-6 mr-2" />
      <span className="font-semibold text-sm text-primary">{title}</span>
    </div>
    <div className="flex items-center">
      <span className="text-green-500 text-xs font-semibold mr-2 pointer-events-none">• Online</span>
      {showCloseButton && (
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground focus:outline-none" aria-label="Cerrar o minimizar chat">
          <X size={20} />
        </button>
      )}
    </div>
  </div>
);

// getAuthTokenFromLocalStorage: Lee el token de localStorage (para modo standalone)
const getAuthTokenFromLocalStorage = () => (typeof window === "undefined" ? null : localStorage.getItem("authToken"));

// getAnonToken: Genera o recupera un token anónimo (para usuarios no logueados en standalone)
const getAnonToken = () => {
  if (typeof window === "undefined") return "anon-ssr";
  let token = localStorage.getItem("anon_token");
  if (!token) {
    token = `anon-${Math.random().toString(36).substring(2, 12)}`;
    localStorage.setItem("anon_token", token);
  }
  return token;
};

// Interfaz para las props de ChatWidget
interface ChatWidgetProps {
  mode?: "standalone" | "iframe";
  initialPosition?: { bottom: number; right: number };
  draggable?: boolean;
  defaultOpen?: boolean;
  widgetId?: string;
  authToken?: string | null; // Token de autenticación recibido como prop
}


const ChatWidget: React.FC<ChatWidgetProps> = ({ 
  mode = "standalone",
  initialPosition = { bottom: 20, right: 20 },
  draggable = true,
  defaultOpen = false,
  widgetId = "chatboc-widget-iframe",
  authToken: propAuthToken, // Recibe el token como prop (ej. desde Iframe.tsx)
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [preguntasUsadas, setPreguntasUsadas] = useState(0);
  const [rubroSeleccionado, setRubroSeleccionado] = useState<string | null>(null);
  const [rubrosDisponibles, setRubrosDisponibles] = useState([]);
  const [esperandoRubro, setEsperandoRubro] = useState(false);
  const [cargandoRubros, setCargandoRubros] = useState(false);
  const [contexto, setContexto] = useState({});

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const widgetContainerRef = useRef<HTMLDivElement>(null); 
  const dragStartPosRef = useRef<any>(null); // Uso 'any' por la complejidad de la estructura de ref para el arrastre

  const [currentPos, setCurrentPos] = useState(
    mode === "standalone" ? { position: "fixed", ...initialPosition, zIndex: 99998 } : {}
  );
  const isMobile = useIsMobile();

  // <<< LÓGICA PARA OBTENER EL TOKEN DEFINITIVO (Más robusta) >>>
  // El token final es el propAuthToken (si modo iframe) o el de localStorage (si standalone)
  const finalAuthToken = mode === "iframe" ? propAuthToken : getAuthTokenFromLocalStorage();
  const esAnonimo = !finalAuthToken; // Determina si es anónimo basándose en el token final
  // <<< FIN LÓGICA DE TOKEN >>>


  // Comunicación con el padre (widget.js) para redimensionar el iframe
  const postResizeMessage = useCallback(() => {
    if (mode === "iframe" && typeof window !== "undefined" && window.parent) {
      const currentElement = widgetContainerRef.current; 
      if (currentElement) {
        const { offsetWidth, offsetHeight } = currentElement;
        window.parent.postMessage({
          type: "chatboc-resize",
          widgetId: widgetId,
          dimensions: { width: `${offsetWidth}px`, height: `${offsetHeight}px` },
          isOpen: isOpen,
        }, "*");
      }
    }
  }, [mode, isOpen, widgetId]);


  // Lógica de bienvenida / rubro (MODIFICADA para usar finalAuthToken y ser más precisa)
  useEffect(() => {
    // Solo si el chat está abierto
    if (isOpen) {
        // Caso 1: Usuario anónimo en modo standalone y sin rubro seleccionado
        if (esAnonimo && mode === "standalone" && !rubroSeleccionado) {
            setEsperandoRubro(true);
            cargarRubros();
        } 
        // Caso 2: Usuario autenticado (sea iframe o standalone), o ya tiene rubro seleccionado
        else if (!esAnonimo || rubroSeleccionado) {
            setEsperandoRubro(false);
            // Si el chat se acaba de abrir y no hay mensajes, muestra el mensaje de bienvenida
            if (messages.length === 0) {
              setMessages([{ id: Date.now(), text: "¡Hola! Soy Chatboc. ¿En qué puedo ayudarte hoy?", isBot: true, timestamp: new Date() }]);
            }
        }
    }
  }, [isOpen, esAnonimo, mode, rubroSeleccionado, messages.length]); // Dependencias actualizadas

  // Scroll al final de los mensajes (se mantiene igual)
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
    if (messagesEndRef.current) {
      (messagesEndRef.current as any).scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isTyping]);

  // Enviar mensaje de resize (se mantiene igual)
  useEffect(() => {
    postResizeMessage();
  }, [isOpen, messages, isTyping, postResizeMessage]);


  const cargarRubros = async () => {
    setCargandoRubros(true);
    try {
      const data = await apiFetch("/rubros/");
      setRubrosDisponibles(Array.isArray(data) ? data : data.rubros || []);
    } catch {
      setRubrosDisponibles([]);
    } finally {
      setCargandoRubros(false);
    }
  };

  const handleSendMessage = useCallback(async (text: string) => {
    if (!text.trim()) return;

    // Validar rubro solo si es anónimo en modo standalone
    if (esAnonimo && mode === "standalone" && !rubroSeleccionado) {
      setMessages(prev => [...prev, { id: Date.now(), text: "🛈 Por favor, seleccioná primero un rubro.", isBot: true, timestamp: new Date() }]);
      return;
    }

    const userMessage = { id: Date.now(), text, isBot: false, timestamp: new Date() }; // <<<<<<<<<<<<<< CORREGIDO: ID CON Date.now()
    setMessages(prev => [...prev, userMessage]);
    setIsTyping(true);

    const payload: any = { pregunta: text, contexto_previo: contexto };
    // Solo enviar rubro si es un usuario anónimo en modo standalone y ya seleccionó uno
    if (esAnonimo && mode === "standalone" && rubroSeleccionado) payload.rubro = rubroSeleccionado;

    try {
      // Usar finalAuthToken para la autorización de la petición al backend
      const data = await apiFetch("/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${finalAuthToken || getAnonToken()}` }, // Si por alguna razón finalAuthToken es nulo, usa el anónimo
        body: payload,
      });

      setContexto(data.contexto_actualizado || {});
      setMessages(prev => [...prev, {
        id: Date.now(), // <<<<<<<<<<<<<< CORREGIDO: ID CON Date.now()
        text: data.respuesta || "No pude procesar tu solicitud.",
        isBot: true,
        timestamp: new Date(),
        botones: data.botones || [],
      }]);
      // Solo contar preguntas si es un usuario anónimo de la demo
      if (esAnonimo && mode === "standalone") setPreguntasUsadas(prev => prev + 1);
    } catch (error) {
      const msg = error instanceof Error ? `⚠️ Error: ${error.message}` : "⚠️ No se pudo conectar con el servidor.";
      setMessages(prev => [...prev, { id: Date.now(), text: msg, isBot: true, timestamp: new Date() }]);
    } finally {
      setIsTyping(false);
    }
  }, [contexto, rubroSeleccionado, preguntasUsadas, esAnonimo, mode, finalAuthToken]); // Añadir finalAuthToken a las dependencias

  const toggleChat = () => setIsOpen(o => !o);

  // Lógica de arrastre (DRAG) (CORREGIDA la inconsistencia de `clientY` y `dragStartPosRef.current.top`)
  const onMouseDownDrag = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (mode === "standalone" && draggable && isOpen && !isMobile && widgetContainerRef.current) {
      const startX = e.touches ? e.touches[0].clientX : e.clientX;
      const startY = e.touches ? e.touches[0].clientY : e.clientY; // Corregido: e.clientY para mouse
      const rect = widgetContainerRef.current.getBoundingClientRect();
      dragStartPosRef.current = {
        x: startX,
        y: startY,
        left: rect.left,
        top: rect.top,
      };

      const handleMouseMove = (moveEvent: MouseEvent | TouchEvent) => {
        if (!dragStartPosRef.current) return;
        const clientX = moveEvent.touches ? moveEvent.touches[0].clientX : moveEvent.clientX;
        const clientY = moveEvent.touches ? moveEvent.touches[0].clientY : moveEvent.clientY;

        const newLeft = dragStartPosRef.current.left + (clientX - dragStartPosRef.current.x);
        const newTop = dragStartPosRef.current.top + (clientY - dragStartPosRef.current.y); // Corregido: dragStartPosRef.current.top

        setCurrentPos({
          position: "fixed",
          left: `${newLeft}px`,
          top: `${newTop}px`,
          right: "auto",
          bottom: "auto",
          zIndex: 99998,
        });
      };

      const handleMouseUp = () => {
        dragStartPosRef.current = null;
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
        window.removeEventListener("touchmove", handleMouseMove);
        window.removeEventListener("touchend", handleMouseUp);
      };

      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      window.addEventListener("touchmove", handleMouseMove, { passive: false });
      window.addEventListener("touchend", handleMouseUp);
      if (e.type === 'touchstart' && e.cancelable) e.preventDefault(); 
    }
  }, [mode, draggable, isOpen, isMobile]);


  const mainChatViewContent = (
    <>
      <WidgetChatHeader
        title="Chatboc Asistente"
        showCloseButton={true}
        onClose={toggleChat}
        isDraggable={mode === "standalone" && draggable && isOpen && !isMobile}
        onMouseDownDrag={onMouseDownDrag} 
      />
      <div
        className="flex-1 overflow-y-auto overflow-x-hidden p-3 flex flex-col gap-3 bg-background text-foreground"
        ref={chatContainerRef}
      >
        {messages.map(msg => typeof msg.text === "string" && (
          <ChatMessage 
            key={msg.id} 
            message={msg} 
            isTyping={isTyping} 
            onButtonClick={handleSendMessage} 
          />
        ))}
        {isTyping && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>
      <ChatInput onSendMessage={handleSendMessage} />
    </>
  );


  return (
    <div ref={widgetContainerRef} style={currentPos} className="chatboc-standalone-widget">
      {!isOpen && (
        // ... (botón para abrir chat) ...
      )}
      {isOpen && (
        <div
          // ESTAS SON LAS CLASES CLAVE
          // w-full h-full le dice que ocupe el 100% del ancho y alto de su padre (el iframe)
          // rounded-3xl, shadow-2xl, flex flex-col, overflow-hidden, etc. son para el estilo y layout
          className="w-full h-full rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-slide-up bg-white border border-border dark:bg-gray-900" 
          // Eliminamos los estilos inline 'height' y 'minHeight' para que no anulen 'h-full'
          // style={{ height: esperandoRubro ? "auto" : "500px", minHeight: esperandoRubro ? "240px" : "400px" }} // COMENTAR o ELIMINAR esta línea
        >
          {esperandoRubro ? (
            <div
              className={`w-full h-full flex flex-col items-center justify-center p-6 text-foreground border border-border rounded-3xl ${isMobile ? "bg-white shadow-2xl dark:bg-gray-900" : "bg-card"}`}
              // style={{ minHeight: 240 }} // Si este minHeight es muy restrictivo, también puede ser un problema.
            >
              {/* Contenido de selección de rubro */}
              {/* Asegúrate de que los botones de rubro y el texto no sean excesivamente anchos/altos */}
            </div>
          ) : (
            mainChatViewContent
          )}
        </div>
      )}
    </div>
  );
};
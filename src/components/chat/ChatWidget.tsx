// src/components/chat/ChatWidget.tsx

import React, { useState, useRef, useEffect, useCallback } from "react";
import { X } from "lucide-react";
import ChatMessage from "./ChatMessage"; 
import TypingIndicator from "./TypingIndicator"; 
import ChatInput from "./ChatInput"; 
import { Message } from "@/types/chat"; 
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
  mode?: "standalone" | "iframe"; // Modo de ejecución: en página principal o incrustado
  initialPosition?: { bottom: number; right: number };
  draggable?: boolean; // Si el widget puede ser arrastrado (solo en standalone)
  defaultOpen?: boolean; // Si inicia abierto o cerrado
  widgetId?: string; // ID único para comunicación entre iframe y host
  authToken?: string | null; // Token de autenticación recibido como prop desde Iframe.tsx
  initialIframeWidth?: string | null; // Prop para ancho inicial del iframe
  initialIframeHeight?: string | null; // Prop para alto inicial del iframe
}


const ChatWidget: React.FC<ChatWidgetProps> = ({ 
  mode = "standalone",
  initialPosition = { bottom: 20, right: 20 },
  draggable = true,
  defaultOpen = false,
  widgetId = "chatboc-widget-iframe",
  authToken: propAuthToken, // Recibe el token como prop (ej. desde Iframe.tsx)
  initialIframeWidth, // Recibe la prop
  initialIframeHeight, // Recibe la prop
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
  const dragStartPosRef = useRef<any>(null); 

  // currentPos: Define la posición y dimensiones del widget en modo standalone
  const [currentPos, setCurrentPos] = useState(
    mode === "standalone" 
      ? { position: "fixed", ...initialPosition, zIndex: 99998 }
      : { 
          // En modo iframe, las dimensiones iniciales vienen del iframe host a través de props
          // No son 'position: fixed' porque el iframe ya es fijo.
          // Aquí el ChatWidget simplemente ocupa el tamaño que el iframe le da.
          width: initialIframeWidth || "360px",
          height: initialIframeHeight || "520px",
          position: "relative", // Contenedor interno del iframe es relativo
          zIndex: 1 // o undefined
        }
  );
  const isMobile = useIsMobile();

  // finalAuthToken: Token que se usará para las peticiones al backend
  const finalAuthToken = mode === "iframe" ? propAuthToken : getAuthTokenFromLocalStorage();
  const esAnonimo = !finalAuthToken; 


  // postResizeMessage: Envía un mensaje al padre (widget.js) para que redimensione el iframe
  const postResizeMessage = useCallback(() => {
    if (mode === "iframe" && typeof window !== "undefined" && window.parent) {
      const currentElement = widgetContainerRef.current; 
      if (currentElement) {
        // Dimensiones Fijas que el widget.js debe aplicar al iframe
        const dimensionsToSend = isOpen 
          ? { width: '360px', height: '520px' } 
          : { width: '80px', height: '80px' };  

        window.parent.postMessage({
          type: "chatboc-resize",
          widgetId: widgetId,
          dimensions: dimensionsToSend, 
          isOpen: isOpen,
        }, "*"); 
      }
    }
  }, [mode, isOpen, widgetId]); 

  // Lógica de bienvenida / rubro (para usuarios anónimos en standalone)
  useEffect(() => {
    if (isOpen) {
        if (esAnonimo && mode === "standalone" && !rubroSeleccionado) {
            setEsperandoRubro(true);
            cargarRubros();
        } 
        else if (!esAnonimo || rubroSeleccionado) { // Si no es anónimo o ya tiene rubro
            setEsperandoRubro(false);
            if (messages.length === 0) { // Si no hay mensajes, muestra el de bienvenida
              setMessages([{ id: Date.now(), text: "¡Hola! Soy Chatboc. ¿En qué puedo ayudarte hoy?", isBot: true, timestamp: new Date() }]);
            }
        }
    }
  }, [isOpen, esAnonimo, mode, rubroSeleccionado, messages.length]); 

  // Scroll al final de los mensajes
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
    if (messagesEndRef.current) {
      (messagesEndRef.current as any).scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isTyping]);

  // Se dispara al montar y cada vez que isOpen, messages, isTyping cambien para redimensionar el iframe.
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

    if (esAnonimo && mode === "standalone" && !rubroSeleccionado) {
      setMessages(prev => [...prev, { id: Date.now(), text: "🛈 Por favor, seleccioná primero un rubro.", isBot: true, timestamp: new Date() }]);
      return;
    }

    const userMessage = { id: Date.now(), text, isBot: false, timestamp: new Date() }; 
    setMessages(prev => [...prev, userMessage]);
    setIsTyping(true);

    const payload: any = { pregunta: text, contexto_previo: contexto };
    if (esAnonimo && mode === "standalone" && rubroSeleccionado) payload.rubro = rubroSeleccionado;

    try {
      const data = await apiFetch("/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${finalAuthToken || getAnonToken()}` }, 
        body: payload,
      });

      setContexto(data.contexto_actualizado || {});
      setMessages(prev => [...prev, {
        id: Date.now(), 
        text: data.respuesta || "No pude procesar tu solicitud.",
        isBot: true,
        timestamp: new Date(),
        botones: data.botones || [],
      }]);
      if (esAnonimo && mode === "standalone") setPreguntasUsadas(prev => prev + 1);
    } catch (error) {
      const msg = error instanceof Error ? `⚠️ Error: ${error.message}` : "⚠️ No se pudo conectar con el servidor.";
      setMessages(prev => [...prev, { id: Date.now(), text: msg, isBot: true, timestamp: new Date() }]);
    } finally {
      setIsTyping(false);
    }
  }, [contexto, rubroSeleccionado, preguntasUsadas, esAnonimo, mode, finalAuthToken]); 

  const toggleChat = () => setIsOpen(o => !o);

  // Lógica de arrastre (DRAG)
  const onMouseDownDrag = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (mode === "standalone" && draggable && isOpen && !isMobile && widgetContainerRef.current) {
      const startX = e.touches ? e.touches[0].clientX : e.clientX;
      const startY = e.touches ? e.touches[0].clientY : e.clientY; 
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
        const newTop = dragStartPosRef.current.top + (clientY - dragStartPosRef.current.y); 

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
    // Contenedor principal del ChatWidget.
    // En modo iframe, sus estilos son controlados por el iframe host (Iframe.tsx y widget.js)
    // En modo standalone, tiene 'position: fixed' para flotar en la página
    <div ref={widgetContainerRef} 
         style={mode === "standalone" ? currentPos : undefined} // currentPos solo si standalone
         className={mode === "standalone" 
                      ? "chatboc-standalone-widget" 
                      // En modo iframe, aseguramos que ocupe todo el espacio que le da el iframe host
                      // Y que tenga un fondo blanco con borde y sombra (igual que el standalone, para que se vea bien)
                      : "w-full h-full flex flex-col rounded-3xl shadow-2xl overflow-hidden bg-white border border-border dark:bg-gray-900"} 
    >
      {/* Botón para abrir el chat (solo en modo standalone, porque el widget.js lo gestiona en iframe) */}
      {mode === "standalone" && !isOpen && (
        <button
          onClick={toggleChat} 
          className="group w-16 h-16 rounded-full flex items-center justify-center border shadow-lg hover:shadow-xl transition-all duration-300 ease-in-out transform hover:scale-105 bg-card border-border"
          aria-label="Abrir chat"
        >
          <div className="relative">
            <img src="/chatboc_logo_clean_transparent.png" alt="Chatboc" className="w-8 h-8 rounded" style={{ padding: "2px" }} />
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-background" />
          </div>
        </button>
      )}
      {/* Contenido del chat (cuando está abierto) */}
      {isOpen && (
        <div
          className={mode === "standalone" ? 
            "w-80 md:w-96 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-slide-up bg-white border border-border dark:bg-gray-900" :
            "w-full h-full flex flex-col" // En iframe, solo necesita ser flex col para que el contenido se estire
          }
           style={mode === "standalone" ? { height: esperandoRubro ? "auto" : "500px", minHeight: esperandoRubro ? "240px" : "400px" } : undefined}
        >
          {esperandoRubro ? (
            <div
              className={`w-full h-full flex flex-col items-center justify-center p-6 text-foreground border border-border rounded-3xl ${isMobile ? "bg-white shadow-2xl dark:bg-gray-900" : "bg-card"}`}
            >
              <h2 className="text-lg font-semibold mb-3 text-center text-primary">👋 ¡Bienvenido!</h2>
              <p className="mb-4 text-sm text-center text-muted-foreground">¿De qué rubro es tu negocio?</p>
              {cargandoRubros ? (
                <div className="text-center text-muted-foreground text-sm my-6">Cargando rubros...</div>
              ) : rubrosDisponibles.length === 0 ? (
                <div className="text-center text-destructive text-sm my-6">
                  No se pudieron cargar los rubros. <br />
                  <button
                    onClick={cargarRubros}
                    className="mt-2 underline text-primary hover:text-primary/80"
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
                            id: Date.now(),
                            text: `¡Hola! Soy Chatboc, tu asistente para ${rubro.nombre.toLowerCase()}. ¿En qué puedo ayudarte hoy?`,
                            isBot: true,
                            timestamp: new Date(),
                          },
                        ]);
                      }}
                      className="px-4 py-2 rounded-full text-sm shadow transition-all duration-200 ease-in-out font-semibold bg-blue-500/80 text-white hover:bg-blue-600 dark:bg-blue-800/80 dark:text-blue-100 dark:hover:bg-blue-700"
                    >
                      {rubro.nombre}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            mainChatViewContent
          )}
        </div>
      )}
    </div>
  );
};

export default ChatWidget;
// src/components/chat/ChatWidget.tsx

import React, { useState, useRef, useEffect, useCallback } from "react";
import { X } from "lucide-react";
import ChatMessage from "./ChatMessage"; // Asegúrate de que este archivo exista y esté actualizado
import TypingIndicator from "./TypingIndicator"; // Asegúrate de que este archivo exista
import ChatInput from "./ChatInput"; // Asegúrate de que este archivo exista
import { Message } from "@/types/chat"; // Asegúrate de que esta interfaz esté correcta y tenga 'botones?: BotonProps[];'
import { apiFetch } from "@/utils/api"; // Asegúrate de que este archivo exista
import { useIsMobile } from "@/hooks/use-mobile"; // Asegúrate de que este hook exista y esté correcto

// --- WidgetChatHeader (se mantiene igual y es el que me proporcionaste antes) ---
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
  const dragStartPosRef = useRef<any>(null); // Se usa 'any' para la estructura de la ref de arrastre

  const [currentPos, setCurrentPos] = useState(
    mode === "standalone" ? { position: "fixed", ...initialPosition, zIndex: 99998 } : {}
  );
  const isMobile = useIsMobile();

  // <<< LÓGICA PARA OBTENER EL TOKEN DEFINITIVO (Más robusta) >>>
  // Si estamos en modo iframe, el token viene por propAuthToken
  // Si estamos en modo standalone, el token viene de localStorage
  const finalAuthToken = mode === "iframe" ? propAuthToken : getAuthTokenFromLocalStorage();
  const esAnonimo = !finalAuthToken; // Es anónimo si no hay token final
  // <<< FIN LÓGICA DE TOKEN >>>


  // Comunicación con el padre (widget.js) para redimensionar el iframe
  const postResizeMessage = useCallback(() => {
    if (mode === "iframe" && typeof window !== "undefined" && window.parent) {
      const currentElement = widgetContainerRef.current; 
      if (currentElement) {
        // Definimos las dimensiones esperadas que el widget.js debe aplicar al iframe.
        // Estas deben coincidir con las definidas en widget.js.
        const dimensionsToSend = isOpen 
          ? { width: '360px', height: '520px' } // Dimensiones cuando está ABIERTO
          : { width: '80px', height: '80px' };  // Dimensiones cuando está CERRADO (globito)

        window.parent.postMessage({
          type: "chatboc-resize",
          widgetId: widgetId,
          dimensions: dimensionsToSend, // Usar estas dimensiones fijas
          isOpen: isOpen,
        }, "*"); // Usar '*' si el origen no es fijo (ej. si se incrusta en diferentes dominios)
      }
    }
  }, [mode, isOpen, widgetId]); // Depende de `isOpen` para enviar el tamaño correcto al cambiar

  // Lógica de bienvenida / rubro
  useEffect(() => {
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

  // Enviar mensaje de resize (se dispara al montar, y cada vez que isOpen, messages, isTyping cambien)
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
    // widgetContainerRef ya no tiene "chatboc-standalone-widget" en modo iframe
    // Sus estilos serán definidos por el iframe host
    <div ref={widgetContainerRef} 
         // Eliminar el style={currentPos} para modo iframe si ya lo gestiona el iframe host
         // El currentPos solo es relevante si mode="standalone" y draggable
         className={mode === "standalone" ? "chatboc-standalone-widget" : "w-full h-full flex flex-col"} 
    >
      {/* Botón para abrir el chat (solo en modo standalone) */}
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
          // Clases para el contenedor principal del chat ABIERTO.
          // Aseguramos que ocupe todo el espacio vertical del iframe (`h-full`)
          // Y que los hijos se distribuyan con flexbox (`flex flex-col`)
          className="w-full h-full rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-slide-up bg-white border border-border dark:bg-gray-900" 
        >
          {esperandoRubro ? (
            <div
              // Si estamos esperando rubro, también ocupar todo el espacio
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
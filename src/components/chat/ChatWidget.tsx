import React, { useState, useRef, useEffect, useCallback, CSSProperties } from "react";
import { X } from "lucide-react";
import ChatMessage from "./ChatMessage";
import TypingIndicator from "./TypingIndicator";
import ChatInput from "./ChatInput";
import { Message } from "@/types/chat";
import { apiFetch } from "@/utils/api";
import { useIsMobile } from "@/hooks/use-mobile";

// --- Componente WidgetChatHeader (SIN CAMBIOS) ---
const WidgetChatHeader: React.FC<{
  title?: string;
  showCloseButton?: boolean;
  onClose?: () => void;
  onMouseDownDrag?: (e: React.MouseEvent | React.TouchEvent) => void;
  isDraggable?: boolean;
}> = ({ title = "Chatboc Asistente", showCloseButton = false, onClose, onMouseDownDrag, isDraggable, }) => {
  // Tu código JSX para el header se mantiene 100% intacto
  return (
    <div
      className="flex items-center justify-between p-3 border-b border-border bg-card text-foreground select-none"
      style={{ cursor: isDraggable && onMouseDownDrag ? "move" : "default", }}
      onMouseDown={onMouseDownDrag}
      onTouchStart={onMouseDownDrag}
    >
      <div className="flex items-center pointer-events-none">
        <img src="/chatboc_logo_clean_transparent.png" alt="Chatboc" className="w-6 h-6 mr-2" />
        <span className="font-semibold text-sm text-primary">{title}</span>
      </div>
      <div className="flex items-center">
        <span className="text-green-500 text-xs font-semibold mr-2 pointer-events-none">&nbsp;• Online</span>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground focus:outline-none" aria-label="Cerrar o minimizar chat"><X size={20} /></button>
      </div>
    </div>
  );
};

// --- LÓGICA DE TOKEN SIMPLIFICADA Y ROBUSTA ---
const getAuthToken = (): string | null => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("authToken"); 
}

const getAnonToken = (): string => {
    if (typeof window === "undefined") return "anon-ssr";
    let token = localStorage.getItem("anon_token");
    if (!token) {
        token = `anon-${Math.random().toString(36).substring(2, 12)}`;
        localStorage.setItem("anon_token", token);
    }
    return token;
}

// --- INTERFACES ACTUALIZADAS ---
interface Rubro { id: number; nombre: string; }
interface AskApiResponse {
  respuesta?: string;
  fuente?: string;
  contexto_actualizado?: object;
  botones?: { texto: string; payload?: string; }[];
}
interface ChatWidgetProps { /* ... tus props sin cambios ... */ }

const DEFAULT_WIDGET_RUBRO = "municipios";
const WIDGET_DIMENSIONS = { /* ... sin cambios ... */ };

const ChatWidget: React.FC<ChatWidgetProps> = ({
  mode = "standalone",
  initialPosition: initialPosProp = { bottom: 20, right: 20 },
  draggable = true,
  defaultOpen = false,
  widgetId = "chatboc-widget-iframe",
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [preguntasUsadas, setPreguntasUsadas] = useState(0);
  const [rubroSeleccionado, setRubroSeleccionado] = useState<string | null>(null);
  const [rubrosDisponibles, setRubrosDisponibles] = useState<Rubro[]>([]);
  const [esperandoRubro, setEsperandoRubro] = useState(false);
  const [cargandoRubros, setCargandoRubros] = useState(false);
  const [token, setToken] = useState<string>(""); // Eliminamos la inicialización directa aquí

  // --- AÑADIMOS EL ESTADO PARA LA "MOCHILA" ---
  const [contexto, setContexto] = useState({});

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const widgetContainerRef = useRef<HTMLDivElement>(null);
  const dragStartPosRef = useRef<{ x: number; y: number; elementX: number; elementY: number } | null>(null);
  const [currentPos, setCurrentPos] = useState<CSSProperties>(
    mode === "standalone" ? { position: 'fixed', ...initialPosProp, zIndex: 99998 } : {}
  );
  const [prefersDark, setPrefersDark] = useState(false);
  const isMobile = useIsMobile(); 

  // Dark mode listener (SIN CAMBIOS)
  useEffect(() => { /* ... */ }, []);

  // Lógica para inicializar el componente (SIN CAMBIOS)
  useEffect(() => { /* ... */ }, []);

  const getUser = () => { /* ... sin cambios ... */ };
  const cargarRubros = async () => { /* ... sin cambios ... */ };
  const recargarTokenAndRubroOnStorageChange = useCallback(() => { /* ... sin cambios ... */ }, [token, rubroSeleccionado]);
  useEffect(() => { /* ... sin cambios ... */ }, [recargarTokenAndRubroOnStorageChange]);
  useEffect(() => { /* ... scroll sin cambios ... */ }, [messages, isTyping]);
  useEffect(() => { /* ... mensaje inicial sin cambios ... */ }, [isOpen, rubroSeleccionado, messages.length]);


  // --- FUNCIÓN DE ENVÍO REFACTORIZADA Y COMPLETA ---
  const handleSendMessage = useCallback(async (text: string) => {
    if (!text.trim()) return;
    
    const authToken = getAuthToken();
    const finalToken = authToken || getAnonToken();
    const esAnonimo = !authToken;

    if (esAnonimo && !rubroSeleccionado) {
        setMessages((prev) => [...prev, {id: Date.now(), text: "🛈 Por favor, seleccioná primero un rubro.", isBot: true, timestamp: new Date()}]);
        return;
    }

    const userMessage: Message = { id: Date.now(), text, isBot: false, timestamp: new Date() };
    setMessages((prev) => [...prev, userMessage]);
    setIsTyping(true);

    const payload: any = { 
      pregunta: text,
      contexto_previo: contexto
    };
    if (esAnonimo) {
      payload.rubro = rubroSeleccionado || DEFAULT_WIDGET_RUBRO;
    }

    try {
      const data = await apiFetch<AskApiResponse>("/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${finalToken}` },
        body: payload,
      });
      
      setContexto(data.contexto_actualizado || {});

      const botMessage: Message = {
        id: Date.now(),
        text: data.respuesta || "No pude procesar tu solicitud.",
        isBot: true,
        timestamp: new Date(),
        botones: data.botones || [],
      };
      setMessages((prev) => [...prev, botMessage]);
      if (esAnonimo) setPreguntasUsadas(p => p + 1);

    } catch (error) {
      let errorMessageText = "⚠️ No se pudo conectar con el servidor.";
      if (error instanceof Error) { errorMessageText = `⚠️ Error: ${error.message}`; } 
      else if (typeof error === 'object' && error !== null && 'message' in error) { errorMessageText = `⚠️ Error: ${String((error as any).message)}`; }
      setMessages((prev) => [...prev, { id: Date.now(), text: errorMessageText, isBot: true, timestamp: new Date() }]);
    } finally {
      setIsTyping(false);
    }
  }, [contexto, rubroSeleccionado, preguntasUsadas]); // Dependencias correctas

  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (mode !== "standalone" || !draggable || !widgetContainerRef.current || typeof window === "undefined") return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const rect = widgetContainerRef.current.getBoundingClientRect();
    dragStartPosRef.current = { x: clientX, y: clientY, elementX: rect.left, elementY: rect.top };
    document.addEventListener("mousemove", handleDragging);
    document.addEventListener("mouseup", handleDragEnd);
    document.addEventListener("touchmove", handleDragging, { passive: false });
    document.addEventListener("touchend", handleDragEnd);
    if ('preventDefault' in e && e.cancelable) e.preventDefault();
  };
  const handleDragging = (e: MouseEvent | TouchEvent) => {
    if (!dragStartPosRef.current) return;
    const clientX = "touches" in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
    const dx = clientX - dragStartPosRef.current.x;
    const dy = clientY - dragStartPosRef.current.y;
    setCurrentPos((prev) => ({
      ...prev,
      left: dragStartPosRef.current!.elementX + dx,
      top: dragStartPosRef.current!.elementY + dy,
      right: undefined,
      bottom: undefined,
    }));
  };
  const handleDragEnd = () => {
    dragStartPosRef.current = null;
    document.removeEventListener("mousemove", handleDragging);
    document.removeEventListener("mouseup", handleDragEnd);
    document.removeEventListener("touchmove", handleDragging);
    document.removeEventListener("touchend", handleDragEnd);
  };

  const toggleChat = () => {
    setIsOpen(prevIsOpen => {
      const nextIsOpen = !prevIsOpen;
      if (nextIsOpen && esperandoRubro) recargarTokenAndRubroOnStorageChange();
      return nextIsOpen;
    });
  };

  useEffect(() => {
    if (mode === "iframe" && typeof window !== "undefined" && window.parent !== window) {
      const desiredDimensions = isOpen ? WIDGET_DIMENSIONS.OPEN : WIDGET_DIMENSIONS.CLOSED;
      window.parent.postMessage({
        type: "chatboc-resize",
        widgetId: widgetId,
        dimensions: desiredDimensions,
        isOpen: isOpen,
      }, "*");
    }
  }, [isOpen, mode, widgetId]);

 
    // --- Listener para los Clics en Botones Dinámicos ---
  useEffect(() => {
    const handleButtonSendMessage = (event: Event) => {
        const customEvent = event as CustomEvent<string>;
        if (customEvent.detail) {
            // Reutilizamos la misma función que usa el input de texto.
            handleSendMessage(customEvent.detail);
        }
    };

    window.addEventListener('sendChatMessage', handleButtonSendMessage);

    return () => {
        window.removeEventListener('sendChatMessage', handleButtonSendMessage);
    };
  }, [handleSendMessage]); // La dependencia con handleSendMessage es crucial
  // --- VISTA Selección de Rubro ---
  const rubroSelectionViewContent = (
    // MODIFICADO: Aplicar fondo mucho más opaco y sólido en modo claro para la "pared" tenue.
    // En modo oscuro, usará dark:bg-gray-900 (o tu bg-card oscuro)
    // rounded-3xl para los bordes del contenedor
    <div className={`w-full flex flex-col items-center justify-center p-6 text-foreground border border-border rounded-3xl
                      ${isMobile
                        ? "bg-white shadow-2xl dark:bg-gray-900" // FONDO SÓLIDO Y OSCURO EN MOBILE (white para light, gray-900 para dark)
                        : "bg-card" // En web, el bg-card original
                      }`}
         style={{ minHeight: 240 }}
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
                setMessages([{
                  id: Date.now() + Math.random(),
                  text: "¡Hola! Soy Chatboc, tu asistente virtual. ¿En qué puedo ayudarte hoy?",
                  isBot: true,
                  timestamp: new Date(),
                }]);
              }}
              // MODIFICADO: rounded-full para mayor redondez en los botones de rubro y hover sutil
              // bg-blue-500/80 (tenue) en modo claro, hover:bg-blue-600
              // dark:bg-blue-800/80 (tenue) en modo oscuro, hover:bg-blue-700
              className="px-4 py-2 rounded-full text-sm shadow transition-all duration-200 ease-in-out font-semibold
                         bg-blue-500/80 text-white hover:bg-blue-600
                         dark:bg-blue-800/80 dark:text-blue-100 dark:hover:bg-blue-700"
            >
              {rubro.nombre}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  const mainChatViewContent = (
    <>
      <WidgetChatHeader
        title="Chatboc Asistente"
        showCloseButton={true}
        onClose={toggleChat}
        onMouseDownDrag={mode === "standalone" && isOpen && draggable ? handleDragStart : undefined}
        isDraggable={mode === "standalone" && draggable && isOpen}
      />
      {/* Fondo del contenedor de mensajes ahora es adaptativo */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3 bg-background text-foreground" ref={chatContainerRef}>
        {messages.map((msg) =>
          typeof msg.text === "string" ? (
            <ChatMessage key={msg.id} message={msg} />
          ) : null
        )}
        {isTyping && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>
      <ChatInput onSendMessage={handleSendMessage} />
    </>
  );

  const commonWrapperStyle: CSSProperties = {
    width: "100%",
    height: "100%",
    display: "flex",
    flexDirection: "column",
    color: prefersDark ? "hsl(var(--foreground))" : "hsl(var(--foreground))", // Usa variables temáticas
    overflow: "hidden",
  };

  if (mode === "iframe") {
    return (
      <div style={{
        ...commonWrapperStyle,
        background: isOpen ? "hsl(var(--card))" : "transparent",
      }}>
        {!isOpen && (
          <div
            style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
            onClick={toggleChat}
            role="button" tabIndex={0} aria-label="Abrir chat"
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleChat(); }}
          >
            <div className="relative">
              <img src="/chatboc_logo_clean_transparent.png" alt="Chatboc" className="w-8 h-8 rounded" style={{ padding: "2px" }} />
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-background" />
            </div>
          </div>
        )}
        {isOpen && (
          esperandoRubro ? rubroSelectionViewContent : mainChatViewContent
        )}
      </div>
    );
  }

  // ---- Renderizado para modo Standalone ----
  return (
    <div ref={widgetContainerRef} style={currentPos} className="chatboc-standalone-widget">
      {!isOpen && (
        <button
          onClick={toggleChat}
          onMouseDown={draggable ? handleDragStart : undefined}
          onTouchStart={draggable ? handleDragStart : undefined}
          className="group w-16 h-16 rounded-full flex items-center justify-center border shadow-lg hover:shadow-xl transition-all duration-300 ease-in-out transform hover:scale-105 bg-card border-border"
          aria-label="Abrir chat"
        >
          <div className="relative">
            <img src="/chatboc_logo_clean_transparent.png" alt="Chatboc" className="w-8 h-8 rounded" style={{ padding: "2px" }} />
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-background" />
          </div>
        </button>
      )}

      {isOpen && (
        <div
          // MODIFICADO: CLASES DE FONDO SÓLIDO PARA EL CHAT WIDGET
          // bg-white para modo claro, dark:bg-gray-900 para modo oscuro.
          // Esto asegurará que el fondo siempre sea opaco y no se transparente.
          className="w-80 md:w-96 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-slide-up bg-white border border-border dark:bg-gray-900"
          style={{
            height: esperandoRubro ? 'auto' : '500px',
            minHeight: esperandoRubro ? '240px' : '400px',
          }}
        >
          {esperandoRubro ? rubroSelectionViewContent : mainChatViewContent}
        </div>
      )}
    </div>
  );
};

export default ChatWidget;
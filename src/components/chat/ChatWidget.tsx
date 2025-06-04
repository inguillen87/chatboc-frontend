import React, { useState, useRef, useEffect, CSSProperties } from "react";
import { X } from "lucide-react";
import ChatMessage from "./ChatMessage"; // Ajusta la ruta
import TypingIndicator from "./TypingIndicator"; // Ajusta la ruta
import ChatInput from "./ChatInput"; // Ajusta la ruta
import { Message } from "@/types/chat"; // Ajusta la ruta
import { apiFetch } from "@/utils/api"; // Ajusta la ruta

// --- Componente ChatHeader (integrado y adaptado) ---
interface ChatHeaderProps {
  title?: string;
  showCloseButton?: boolean; // Para controlar si se muestra el botón X
  onClose?: () => void;    // Acción del botón X (minimizar en standalone, o enviar postMessage en iframe)
  onMouseDownDrag?: (e: React.MouseEvent | React.TouchEvent) => void; // Para arrastrar en modo standalone
  isDraggable?: boolean; // Para el cursor en modo standalone
}
const ChatHeader: React.FC<ChatHeaderProps> = ({
  title = "Chatboc Asistente",
  showCloseButton = false,
  onClose,
  onMouseDownDrag,
  isDraggable,
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
        cursor: isDraggable && onMouseDownDrag ? "move" : "default",
      }}
      onMouseDown={onMouseDownDrag} // Solo se activa si onMouseDownDrag tiene una función (modo standalone)
      onTouchStart={onMouseDownDrag} // Solo se activa si onMouseDownDrag tiene una función (modo standalone)
    >
      <div className="flex items-center pointer-events-none">
        <img src="/chatboc_logo_clean_transparent.png" alt="Chatboc" className="w-6 h-6 mr-2" />
        <span className="font-semibold text-sm">{title}</span>
      </div>
      <div className="flex items-center">
        <span style={{ fontSize: 12, fontWeight: 400, color: prefersDarkHeader ? "#90EE90" : "#24ba53", marginRight: showCloseButton ? '8px' : '0' }} className="pointer-events-none">
          &nbsp;• Online
        </span>
        {showCloseButton && onClose && (
          <button onClick={onClose} className="text-gray-600 dark:text-gray-300 hover:text-red-500 focus:outline-none" aria-label="Cerrar o minimizar chat">
            <X size={20} />
          </button>
        )}
      </div>
    </div>
  );
};

// --- Función getToken (Completa) ---
function getToken(): string {
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

// --- Props y Constantes de Dimensiones ---
interface ChatWidgetProps {
  mode?: "iframe" | "standalone";
  initialPosition?: { top?: number | string; bottom?: number | string; left?: number | string; right?: number | string };
  draggable?: boolean;
  defaultOpen?: boolean;
  widgetId?: string; // Para iframe mode
}

const WIDGET_DIMENSIONS = {
  OPEN: { width: "360px", height: "520px" },
  CLOSED: { width: "80px", height: "80px" }, // Para el "globito"
};

// --- Componente ChatWidget Unificado ---
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
  const [rubrosDisponibles, setRubrosDisponibles] = useState<{ id: number; nombre: string }[]>([]);
  const [esperandoRubro, setEsperandoRubro] = useState(true);
  const [cargandoRubros, setCargandoRubros] = useState(false);
  const [token, setToken] = useState<string>("");
  const [prefersDark, setPrefersDark] = useState(
    typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
  );

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const widgetContainerRef = useRef<HTMLDivElement>(null); // Para arrastre en standalone
  const dragStartPosRef = useRef<{ x: number; y: number; elementX: number; elementY: number } | null>(null);
  
  const [currentPos, setCurrentPos] = useState<CSSProperties>(
    mode === "standalone" ? { position: 'fixed', ...initialPosProp, zIndex: 99998 } : {}
  );

  // Efectos (dark mode, carga de rubros, token, scroll, bienvenida)
  useEffect(() => { /* ... detección dark mode (sin cambios)... */ }, []);
  const cargarRubros = async () => { /* ... (lógica de cargarRubros sin cambios) ... */ };
  const recargarTokenYRubro = () => { /* ... (lógica de recargarTokenYRubro sin cambios) ... */ };
  useEffect(() => { /* ... efecto para recargarTokenYRubro y storage listener (sin cambios) ... */ }, []);
  useEffect(() => { /* ... efecto para scroll al final de mensajes (sin cambios) ... */ }, [messages, isTyping]);
  useEffect(() => { /* ... efecto para mensaje de bienvenida (sin cambios, depende de isOpen y rubroSeleccionado) ... */ }, [isOpen, rubroSeleccionado, esperandoRubro, messages]); // messages.length como dependencia también podría ser
  const handleSendMessage = async (text: string) => { /* ... (lógica de handleSendMessage sin cambios) ... */ };

  // Lógica de Arrastre para modo Standalone
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
  const handleDragging = (e: MouseEvent | TouchEvent) => { /* ... (sin cambios, actualiza currentPos) ... */ };
  const handleDragEnd = () => { /* ... (sin cambios, limpia listeners) ... */ };

  // Toggle y Comunicación con el padre (para iframe mode)
  const toggleChat = () => {
    setIsOpen(prevIsOpen => {
      const nextIsOpen = !prevIsOpen;
      if (nextIsOpen && mode === "iframe") { // Solo recargar si se está abriendo en iframe y no estaba ya cargado el rubro
         if(!rubroSeleccionado) recargarTokenYRubro();
      } else if (nextIsOpen && mode === "standalone") {
         if(!rubroSeleccionado) recargarTokenYRubro();
      }
      return nextIsOpen;
    });
  };

  useEffect(() => { // Comunicación con widget.js para redimensionar el iframe
    if (mode === "iframe" && typeof window !== "undefined" && window.parent !== window) {
      const desiredDimensions = isOpen ? WIDGET_DIMENSIONS.OPEN : WIDGET_DIMENSIONS.CLOSED;
      window.parent.postMessage({
        type: "chatboc-resize",
        widgetId: widgetId,
        dimensions: desiredDimensions,
        isOpen: isOpen, // Para que widget.js sepa si es globito o ventana
      }, "*"); // IMPORTANTE: En producción, cambia "*" por el origin de la página contenedora
    }
  }, [isOpen, mode, widgetId]);
  
  // Vistas de contenido
  const rubroSelectionViewContent = ( /* ... (JSX sin cambios, usa cargarRubros) ... */ );
  const mainChatViewContent = (
    <>
      <ChatHeader
        title="Chatboc Asistente"
        showCloseButton={true} // Siempre mostrar X, la acción cambia por `onClose`
        onClose={toggleChat} // En ambos modos, el X interno llama a toggleChat
        onMouseDownDrag={mode === "standalone" && isOpen && draggable ? handleDragStart : undefined}
        isDraggable={mode === "standalone" && draggable && isOpen}
      />
      {/* ... resto del JSX de mainChatViewContent (mensajes, input) sin cambios ... */}
    </>
  );
  
  // --- Renderizado Principal ---
  const commonWrapperStyle: CSSProperties = { // Estilos comunes para el contenido del widget
    width: "100%",
    height: "100%",
    display: "flex",
    flexDirection: "column",
    color: prefersDark ? "#fff" : "#222",
    overflow: "hidden",
  };

  if (mode === "iframe") {
    // En modo iframe, el widget siempre "ocupa" el espacio que le da el iframe.
    // El iframe (controlado por widget.js) se encarga del borderRadius, boxShadow y tamaño.
    // El ChatWidget interno se adapta para parecer un globito o una ventana.
    return (
      <div style={{
          ...commonWrapperStyle,
          background: prefersDark ? (isOpen ? "#161c24" : "#2d3748") : (isOpen ? "#fff" : "#fff"), // Globito puede tener fondo diferente
          // borderRadius es manejado por el iframe
        }}
      >
        {!isOpen && ( // Renderizar el "globito" DENTRO del iframe (iframe será pequeño)
          <div
            style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
            onClick={toggleChat}
            role="button" tabIndex={0} aria-label="Abrir chat"
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleChat();}}
          >
            <div className="relative">
              <img src="/chatboc_logo_clean_transparent.png" alt="Chatboc" className="w-8 h-8 rounded" style={{ padding: "2px" }} />
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2" style={{ borderColor: prefersDark ? '#2d3748' : '#fff' }} />
            </div>
          </div>
        )}
        {isOpen && ( // Renderizar la ventana de chat completa o selección de rubro
          esperandoRubro ? rubroSelectionViewContent : mainChatViewContent
        )}
      </div>
    );
  }

  // ---- Renderizado para modo Standalone ----
  return (
    <div ref={widgetContainerRef} style={currentPos} className="chatboc-standalone-widget">
      {!isOpen && ( // Botón flotante cuando está cerrado en modo standalone
        <button
          onClick={toggleChat}
          onMouseDown={draggable ? handleDragStart : undefined}
          onTouchStart={draggable ? handleDragStart : undefined}
          className="group w-16 h-16 rounded-full flex items-center justify-center border shadow-lg hover:shadow-xl transition-all duration-300 ease-in-out transform hover:scale-105"
          aria-label="Abrir chat"
          style={{
            borderColor: prefersDark ? "#374151" : "#e5e7eb",
            background: prefersDark ? "#161c24" : "#fff",
            cursor: draggable ? "move" : "pointer",
          }}
        >
          <div className="relative">
            <img src="/chatboc_logo_clean_transparent.png" alt="Chatboc" className="w-8 h-8 rounded" style={{ padding: "2px" }} />
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-900" />
          </div>
        </button>
      )}

      {isOpen && ( // Ventana de chat o selección de rubro cuando está abierto en modo standalone
        <div
          className="w-80 md:w-96 rounded-xl shadow-2xl flex flex-col overflow-hidden animate-slide-up"
          // El onMouseDown para arrastrar la ventana abierta está en el ChatHeader
          style={{
            height: esperandoRubro ? 'auto' : '500px', // Ajustar según necesidad
            minHeight: esperandoRubro ? '240px' : '400px', // Ajustar según necesidad
            background: prefersDark ? "#161c24" : "#fff",
            border: `1px solid ${prefersDark ? "#374151" : "#e5e7eb"}`,
          }}
        >
          {esperandoRubro ? rubroSelectionViewContent : mainChatViewContent}
        </div>
      )}
    </div>
  );
};

export default ChatWidget;
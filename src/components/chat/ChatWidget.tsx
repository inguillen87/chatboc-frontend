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
}> = ({ title = "Chatboc Asistente", showCloseButton = false, onClose, onMouseDownDrag, isDraggable }) => {
  return (
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
        <span className="text-green-500 text-xs font-semibold mr-2 pointer-events-none">&nbsp;• Online</span>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground focus:outline-none" aria-label="Cerrar o minimizar chat">
          <X size={20} />
        </button>
      </div>
    </div>
  );
};


// --- Lógica de Token Simplificada para claridad ---
const getAuthToken = (): string | null => {
    if (typeof window === "undefined") return null;
    // Unificamos la fuente del token para usuarios logueados
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


// --- Interfaces ---
interface Rubro { id: number; nombre: string; }
interface AskApiResponse {
  respuesta?: string;
  fuente?: string;
  contexto_actualizado?: object; // <-- La "mochila" de vuelta
}
interface ChatWidgetProps {
  mode?: "iframe" | "standalone";
  initialPosition?: { top?: number | string; bottom?: number | string; left?: number | string; right?: number | string };
  draggable?: boolean;
  defaultOpen?: boolean;
  widgetId?: string;
}

const DEFAULT_WIDGET_RUBRO = "municipios";
const WIDGET_DIMENSIONS = {
  OPEN: { width: "360px", height: "520px" },
  CLOSED: { width: "80px", height: "80px" },
};


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

  // --- PASO 1: AÑADIMOS EL ESTADO PARA LA "MOCHILA" ---
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

  // useEffects para UI (dark mode, scroll, etc.) se mantienen SIN CAMBIOS
  useEffect(() => { /* ... dark mode ... */ }, []);
  useEffect(() => { if (chatContainerRef.current) { /* ... scroll ... */ } }, [messages, isTyping]);
  
  // Lógica para inicializar el componente
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Chequeamos si el usuario ya tiene un rubro o si está logueado
    const authToken = getAuthToken();
    const storedRubro = localStorage.getItem("rubroSeleccionado");

    if (authToken) {
      // Si hay un token de login, intentamos obtener el perfil para saber el rubro
      apiFetch<any>('/me', { headers: { Authorization: `Bearer ${authToken}` } })
        .then(data => {
            if (data && data.rubro) {
                setRubroSeleccionado(data.rubro.nombre);
                setEsperandoRubro(false);
            }
        }).catch(() => { /* si falla, se quedará esperando rubro */ });
    } else if (storedRubro) {
      setRubroSeleccionado(storedRubro);
      setEsperandoRubro(false);
    } else {
      setEsperandoRubro(true);
      cargarRubros();
    }
  }, []);

  const cargarRubros = async () => { /* ... sin cambios ... */ };
  
  // Mensaje de bienvenida
  useEffect(() => {
    if (isOpen && rubroSeleccionado && messages.length === 0) {
      setMessages([
        { id: Date.now() + Math.random(), text: "¡Hola! Soy Chatboc, tu asistente virtual. ¿En qué puedo ayudarte hoy?", isBot: true, timestamp: new Date() },
      ]);
    }
  }, [isOpen, rubroSeleccionado, messages.length]);


  const handleSendMessage = async (text: string) => {
    if (!text.trim()) return;

    const authToken = getAuthToken();
    const finalToken = authToken || getAnonToken();
    const esAnonimo = !authToken;
    
    if (esAnonimo && !rubroSeleccionado) {
        // ... Lógica si el anónimo no eligió rubro
        return;
    }
    if (esAnonimo && preguntasUsadas >= 15) {
        // ... Lógica de límite de preguntas
        return;
    }

    const userMessage: Message = { id: Date.now() + Math.random(), text, isBot: false, timestamp: new Date() };
    setMessages((prev) => [...prev, userMessage]);
    setIsTyping(true);

    // --- PASO 2: CONSTRUIMOS EL PAYLOAD CON LA "MOCHILA" ---
    const payload: any = { 
      pregunta: text,
      contexto_previo: contexto, // <-- Enviamos la memoria
    };
    // Si es anónimo, el backend no conoce el rubro, así que lo enviamos
    if (esAnonimo) {
      payload.rubro = rubroSeleccionado || DEFAULT_WIDGET_RUBRO;
    }

    try {
      const data = await apiFetch<AskApiResponse>("/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${finalToken}` },
        body: payload,
      });

      // --- PASO 3: GUARDAMOS LA "MOCHILA" ACTUALIZADA ---
      setContexto(data.contexto_actualizado || {});

      const respuestaFinal = typeof data?.respuesta === "string" ? data.respuesta : "❌ No entendí tu mensaje.";
      const botMessage: Message = { id: Date.now() + Math.random(), text: respuestaFinal, isBot: true, timestamp: new Date() };
      setMessages((prev) => [...prev, botMessage]);
      if (esAnonimo) setPreguntasUsadas((prev) => prev + 1);

    } catch (error) {
      // ... tu manejo de errores ...
    } finally {
      setIsTyping(false);
    }
  };

  // ... (El resto de tu código: handleDrag, toggleChat, JSX, etc. se mantiene 100% igual)
  // ...
};

export default ChatWidget;
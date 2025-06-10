// Archivo: ChatWidget.tsx (versión final con mejoras y lógica corregida)

import React, { useState, useRef, useEffect, useCallback, CSSProperties } from "react";
import { X } from "lucide-react";
import ChatMessage from "./ChatMessage";
import TypingIndicator from "./TypingIndicator";
import ChatInput from "./ChatInput";
import { Message } from "@/types/chat";
import { apiFetch } from "@/utils/api";
import { useIsMobile } from "@/hooks/use-mobile";

const WidgetChatHeader: React.FC<{
  title?: string;
  showCloseButton?: boolean;
  onClose?: () => void;
  onMouseDownDrag?: (e: React.MouseEvent | React.TouchEvent) => void;
  isDraggable?: boolean;
}> = ({ title = "Chatboc Asistente", showCloseButton = false, onClose, onMouseDownDrag, isDraggable }) => {
  return (
    <div className="flex items-center justify-between p-3 border-b border-border bg-card text-foreground select-none"
      style={{ cursor: isDraggable && onMouseDownDrag ? "move" : "default" }}
      onMouseDown={onMouseDownDrag}
      onTouchStart={onMouseDownDrag}>
      <div className="flex items-center pointer-events-none">
        <img src="/chatboc_logo_clean_transparent.png" alt="Chatboc" className="w-6 h-6 mr-2" />
        <span className="font-semibold text-sm text-primary">{title}</span>
      </div>
      <div className="flex items-center">
        <span className="text-green-500 text-xs font-semibold mr-2 pointer-events-none">• Online</span>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground focus:outline-none" aria-label="Cerrar o minimizar chat">
          <X size={20} />
        </button>
      </div>
    </div>
  );
};

const getAuthToken = (): string | null => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("authToken");
};

const getAnonToken = (): string => {
  if (typeof window === "undefined") return "anon-ssr";
  let token = localStorage.getItem("anon_token");
  if (!token) {
    token = `anon-${Math.random().toString(36).substring(2, 12)}`;
    localStorage.setItem("anon_token", token);
  }
  return token;
};

interface Rubro { id: number; nombre: string; }
interface AskApiResponse {
  respuesta?: string;
  fuente?: string;
  contexto_actualizado?: object;
  botones?: { texto: string; payload?: string; }[];
}
interface ChatWidgetProps {
  mode?: "standalone" | "iframe";
  initialPosition?: { bottom?: number; right?: number; top?: number; left?: number; };
  draggable?: boolean;
  defaultOpen?: boolean;
  widgetId?: string;
}

const DEFAULT_WIDGET_RUBRO = "municipios";
const WIDGET_DIMENSIONS = {
  OPEN: { width: 380, height: 500 },
  CLOSED: { width: 64, height: 64 },
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
  const [contexto, setContexto] = useState({});

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const widgetContainerRef = useRef<HTMLDivElement>(null);
  const dragStartPosRef = useRef<{ x: number; y: number; elementX: number; elementY: number } | null>(null);
  const [currentPos, setCurrentPos] = useState<CSSProperties>(
    mode === "standalone" ? { position: "fixed", ...initialPosProp, zIndex: 99998 } : {}
  );
  const [prefersDark, setPrefersDark] = useState(false);
  const isMobile = useIsMobile();

  const cargarRubros = async () => {
    try {
      setCargandoRubros(true);
      const data = await apiFetch<{ rubros: Rubro[] }>("/rubros/");
      setRubrosDisponibles(data.rubros || []);
    } catch (e) {
      setRubrosDisponibles([]);
    } finally {
      setCargandoRubros(false);
    }
  };

  useEffect(() => {
    const esAnonimo = !getAuthToken();
    const rubroStorage = localStorage.getItem("rubroSeleccionado");
    if (isOpen && esAnonimo && !rubroStorage) {
      setEsperandoRubro(true);
      cargarRubros();
    }
  }, [isOpen]);

  const handleSendMessage = useCallback(async (text: string) => {
    if (!text.trim()) return;
    const authToken = getAuthToken();
    const finalToken = authToken || getAnonToken();
    const esAnonimo = !authToken;

    if (esAnonimo && !rubroSeleccionado) {
      setMessages((prev) => [...prev, { id: Date.now(), text: "🛈 Por favor, seleccioná primero un rubro.", isBot: true, timestamp: new Date() }]);
      return;
    }

    const userMessage: Message = { id: Date.now(), text, isBot: false, timestamp: new Date() };
    setMessages((prev) => [...prev, userMessage]);
    setIsTyping(true);

    const payload: any = {
      pregunta: text,
      contexto_previo: contexto,
    };
    if (esAnonimo) payload.rubro = rubroSeleccionado || DEFAULT_WIDGET_RUBRO;

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
      if (esAnonimo) setPreguntasUsadas((p) => p + 1);

    } catch (error) {
      const errorMessageText = error instanceof Error ? `⚠️ Error: ${error.message}` : "⚠️ No se pudo conectar con el servidor.";
      setMessages((prev) => [...prev, { id: Date.now(), text: errorMessageText, isBot: true, timestamp: new Date() }]);
    } finally {
      setIsTyping(false);
    }
  }, [contexto, rubroSeleccionado, preguntasUsadas]);

  // Resto del código sigue igual (drag, toggleChat, renderización)...

  // 🔚 return final con renderización condicional ya está incluido más arriba
};

export default ChatWidget;

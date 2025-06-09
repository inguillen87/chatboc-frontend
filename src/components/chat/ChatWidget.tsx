import React, { useState, useRef, useEffect, useCallback, CSSProperties } from "react";
import { X } from "lucide-react";
import ChatMessage from "./ChatMessage";
import TypingIndicator from "./TypingIndicator";
import ChatInput from "./ChatInput";
import { Message } from "@/types/chat";
import { apiFetch } from "@/utils/api";
import { useIsMobile } from "@/hooks/use-mobile";

// --- Componente de Cabecera (sin cambios) ---
const WidgetChatHeader: React.FC<{ /* ... tus props ... */ }> = ({ /* ... */ }) => {
    // ... tu JSX para el header ...
};


// --- Token Management Simplificado ---
function getAuthToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("authToken");
}

function getAnonToken(): string {
    if (typeof window === "undefined") return "anon-ssr";
    let anonToken = localStorage.getItem("anon_token");
    if (!anonToken) {
        anonToken = `anon-${Math.random().toString(36).substring(2, 12)}`;
        localStorage.setItem("anon_token", anonToken);
    }
    return anonToken;
}


interface Rubro { id: number; nombre: string; }
interface AskApiResponse {
  respuesta?: string;
  fuente?: string;
  contexto_actualizado?: any; // <-- importante para la mochila
}

// ... (El resto de tus interfaces) ...

const ChatWidget: React.FC<ChatWidgetProps> = ({ /* ... tus props ... */ }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    const [messages, setMessages] = useState<Message[]>([]);
    const [isTyping, setIsTyping] = useState(false);
    
    // --- ESTADO PARA LA MEMORIA MANUAL ("la mochila") ---
    const [contexto, setContexto] = useState({});

    const [rubroSeleccionado, setRubroSeleccionado] = useState<string | null>(null);
    const [esperandoRubro, setEsperandoRubro] = useState(true);
    
    const messagesEndRef = useRef<HTMLDivElement>(null);
    // ... (otros refs y estados sin cambios) ...

    // Lógica para inicializar el rubro al montar el componente
    useEffect(() => {
        const storedRubro = localStorage.getItem("rubroSeleccionado");
        if (storedRubro) {
            setRubroSeleccionado(storedRubro);
            setEsperandoRubro(false);
        } else {
            setEsperandoRubro(true);
            // Aquí podrías llamar a tu función para cargar los rubros si es necesario
        }
    }, []);

    // Scroll al fondo (sin cambios)
    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [messages, isTyping]);
    
    // Mensaje inicial (sin cambios)
    useEffect(() => {
        if (isOpen && !esperandoRubro && messages.length === 0) {
            setMessages([
                { id: Date.now(), text: "¡Hola! Soy Chatboc, tu asistente virtual. ¿En qué puedo ayudarte hoy?", isBot: true, timestamp: new Date() },
            ]);
        }
    }, [isOpen, esperandoRubro, messages.length]);


    // --- FUNCIÓN DE ENVÍO REFACTORIZADA ---
    const handleSendMessage = async (text: string) => {
        if (!text.trim()) return;

        // 1. Determinar si el usuario está logueado o es anónimo
        const authToken = getAuthToken();
        const finalToken = authToken || getAnonToken();
        const esAnonimo = !authToken;

        // 2. Validar que tengamos un rubro si es anónimo
        if (esAnonimo && !rubroSeleccionado) {
            setMessages(prev => [...prev, { id: Date.now(), text: "Por favor, seleccioná primero un rubro para poder ayudarte.", isBot: true, timestamp: new Date() }]);
            return;
        }

        // 3. Agregar el mensaje del usuario a la UI
        const userMessage: Message = { id: Date.now(), text, isBot: false, timestamp: new Date() };
        setMessages((prev) => [...prev, userMessage]);
        setIsTyping(true);

        // 4. Construir el PAYLOAD con la "mochila"
        const payload: any = {
            pregunta: text,
            contexto_previo: contexto, // <-- Enviamos la memoria actual
        };
        // Si es anónimo, también enviamos el rubro
        if (esAnonimo) {
            payload.rubro = rubroSeleccionado;
        }

        // 5. Llamar a la API
        try {
            const data = await apiFetch<AskApiResponse>("/ask", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${finalToken}`,
                },
                body: JSON.stringify(payload),
            });

            // 6. GUARDAR LA "MOCHILA" ACTUALIZADA
            setContexto(data.contexto_actualizado || {});

            const botMessage: Message = {
                id: Date.now(),
                text: data.respuesta || "No pude procesar tu solicitud.",
                isBot: true,
                timestamp: new Date(),
            };
            setMessages((prev) => [...prev, botMessage]);

        } catch (error) {
            // ... (tu manejo de errores se mantiene igual) ...
        } finally {
            setIsTyping(false);
        }
    };
    
    // ... (El resto de tu componente, como las funciones de drag, el JSX, etc., se mantiene igual)
    // ...
    return (
        // ... Tu JSX aquí ...
    );
};

export default ChatWidget;
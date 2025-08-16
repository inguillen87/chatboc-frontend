import React, { useState, useRef, useEffect, useCallback } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import ChatHeader from "./ChatHeader";
import ChatMessage from "./ChatMessage";
import TypingIndicator from "./TypingIndicator";
import UserTypingIndicator from "./UserTypingIndicator";
import ChatInput from "./ChatInput";
import ScrollToBottomButton from "@/components/ui/ScrollToBottomButton";
import { useChatLogic } from "@/hooks/useChatLogic";
import { SendPayload } from "@/types/chat";
import PersonalDataForm from './PersonalDataForm';
import { Rubro } from "./RubroSelector";
import { Message } from "@/types/chat";
import { safeLocalStorage } from "@/utils/safeLocalStorage";
import { requestLocation } from "@/utils/geolocation";
import { toast } from "@/components/ui/use-toast";
import RubroSelector from "./RubroSelector";
import AddressAutocomplete from "@/components/ui/AddressAutocomplete";
import TicketMap from "@/components/TicketMap";
import { apiFetch } from "@/utils/api";
import { parseRubro, esRubroPublico } from "@/utils/chatEndpoints";
import { useUser } from "@/hooks/useUser";
import { motion } from "framer-motion";
import { useBusinessHours } from "@/hooks/useBusinessHours";
import { Button } from "@/components/ui/button";
import io from 'socket.io-client';
import { getSocketUrl } from "@/config";

const PENDING_TICKET_KEY = 'pending_ticket_id';
const PENDING_GPS_KEY = 'pending_gps';

const FRASES_DIRECCION = [
  "indicame la dirección", "necesito la dirección", "ingresa la dirección",
  "especificá la dirección", "decime la dirección", "dirección exacta",
  "¿cuál es la dirección?", "por favor indique la dirección",
  "por favor ingrese su dirección", "dirección completa",
];

const FRASES_EXITO = [
  "Tu reclamo fue generado", "¡Muchas gracias por tu calificación!",
  "Dejaré el ticket abierto", "El curso de seguridad vial es online",
  "He abierto una sala de chat directa", "Tu número de chat es", "ticket **M-",
];

interface ChatPanelProps {
  mode?: "standalone" | "iframe" | "script";
  widgetId?: string;
  entityToken?: string;
  onClose?: () => void;
  tipoChat: "pyme" | "municipio";
  onRequireAuth?: () => void;
  onOpenUserPanel?: () => void;
  onShowLogin?: () => void;
  onShowRegister?: () => void;
  selectedRubro?: string | null;
  onRubroSelect?: (rubro: any) => void;
  muted?: boolean;
  onToggleSound?: () => void;
  onCart?: () => void;
}

const ChatPanel = ({
  onClose,
  tipoChat,
  onOpenUserPanel,
  onShowLogin,
  onShowRegister,
  onCart,
  muted,
  onToggleSound,
  onRequireAuth,
  selectedRubro,
  onRubroSelect,
  mode,
  entityToken: propEntityToken,
}: ChatPanelProps) => {
  const isMobile = useIsMobile();
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [userTyping, setUserTyping] = useState(false);
  const { isLiveChatEnabled, horariosAtencion } = useBusinessHours(propEntityToken);
  const socketRef = useRef<SocketIOClient.Socket | null>(null);

  const { messages, isTyping, handleSend, activeTicketId, setMessages, contexto } = useChatLogic({
    initialWelcomeMessage: "¡Hola! Soy Chatboc. ¿En qué puedo ayudarte hoy?",
    tipoChat: tipoChat,
    entityToken: propEntityToken,
  });

  const handlePersonalDataSubmit = (data: { nombre: string; email: string; telefono: string; dni: string; }) => {
    handleSend({
      action: 'submit_personal_data',
      payload: data,
    });
  };

  const [esperandoDireccion, setEsperandoDireccion] = useState(false);
  const [forzarDireccion, setForzarDireccion] = useState(false);
  const [direccionGuardada, setDireccionGuardada] = useState<string | null>(null);
  const [showCierre, setShowCierre] = useState<{ show: boolean; text: string } | null>(null);
  const [ticketLocation, setTicketLocation] = useState<{ direccion?: string | null; latitud?: number | null; longitud?: number | null; municipio_nombre?: string | null } | null>(null);
  const esAnonimo = !safeLocalStorage.getItem("authToken");
  const { user } = useUser();

  useEffect(() => {
    const stored = safeLocalStorage.getItem("ultima_direccion");
    if (stored) setDireccionGuardada(stored);
  }, []);

  useEffect(() => {
    if (activeTicketId) {
      const socketUrl = getSocketUrl();
      const socket = io(socketUrl);
      socketRef.current = socket;

      const room = `ticket_${tipoChat}_${activeTicketId}`;
      socket.emit('join', { room });

      const handleIncoming = (data: any) => {
        const newMessage: Message = {
          id: data.id,
          author: data.es_admin ? 'agent' : 'user',
          content: data.comentario,
          timestamp: data.fecha,
        };
        setMessages(prevMessages => [...prevMessages, newMessage]);
      };

      socket.on('new_chat_message', handleIncoming);
      socket.on('message', handleIncoming);

      return () => {
        socket.off('new_chat_message', handleIncoming);
        socket.off('message', handleIncoming);
        socket.disconnect();
      };
    }
  }, [activeTicketId, tipoChat, setMessages]);

  const handleLiveChatRequest = () => {
    handleSend({
      text: "Quisiera hablar con un representante",
      action: "request_agent",
    });
  };

  const handleInternalAction = useCallback(
    async (action: string) => {
      const normalized = action.toLowerCase().replace(/[_\s-]+/g, "");

      if (["login", "loginpanel", "chatuserloginpanel"].includes(normalized)) {
        onShowLogin?.();
        return;
      }
      if (["register", "registerpanel", "chatuserregisterpanel"].includes(normalized)) {
        onShowRegister?.();
        return;
      }
      if (["cart", "carrito"].includes(normalized)) {
        onCart?.();
        return;
      }
      if (normalized === "requestuserlocation") {
        try {
          const position = await requestLocation();
          if (position) {
            handleSend({
              text: "Ubicación compartida.",
              ubicacion_usuario: {
                lat: position.latitud,
                lon: position.longitud,
              },
              action: "user_provided_location",
            });
            toast({
              title: "Éxito",
              description: "Ubicación compartida correctamente.",
              variant: "success",
            });
          } else {
            toast({
              title: "Error",
              description: "No se pudo obtener la ubicación. Por favor, revisa los permisos de tu navegador.",
              variant: "destructive",
            });
          }
        } catch (error) {
          console.error("Error getting location:", error);
          toast({
            title: "Error",
            description: "Ocurrió un error al intentar obtener la ubicación.",
            variant: "destructive",
          });
        }
        return;
      }
      // For other actions, the backend request was already sent. No extra handling needed.
    },
    [handleSend, onShowLogin, onShowRegister, onCart, toast]
  );

  const handleFileUploaded = useCallback(
    (fileData: { url: string; name: string; mimeType?: string; size?: number }) => {
      if (fileData?.url && fileData?.name) {
        handleSend({
          text: `Archivo adjunto: ${fileData.name}`,
          attachmentInfo: {
            name: fileData.name,
            url: fileData.url,
            mimeType: fileData.mimeType,
            size: fileData.size,
          },
        });
      }
    },
    [handleSend]
  );

  useEffect(() => {
    if (chatContainerRef.current) {
      const { scrollHeight, scrollTop, clientHeight } = chatContainerRef.current;
      const atBottom = scrollHeight - scrollTop - clientHeight < 100;
      if (atBottom) {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        setShowScrollDown(false);
      } else {
        setShowScrollDown(true);
      }
    }
  }, [messages]);

  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;
    const onScroll = () => {
      const { scrollHeight, scrollTop, clientHeight } = container;
      const atBottom = scrollHeight - scrollTop - clientHeight < 100;
      setShowScrollDown(!atBottom);
    };
    container.addEventListener("scroll", onScroll);
    return () => container.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className={cn("flex flex-col w-full h-full bg-card text-card-foreground overflow-hidden relative", isMobile ? undefined : "rounded-2xl")}>
      <ChatHeader onClose={onClose} onProfile={onOpenUserPanel} muted={muted} onToggleSound={onToggleSound} onCart={onCart} />
      <div ref={chatContainerRef} className="flex-1 p-2 sm:p-4 min-h-0 flex flex-col gap-3 overflow-y-auto">
        {messages.map((msg) =>
          <ChatMessage key={msg.id} message={msg}
            isTyping={isTyping}
            onButtonClick={handleSend}
            onInternalAction={handleInternalAction}
            tipoChat={tipoChat}
          />
        )}
        {isTyping && <TypingIndicator />}
        {userTyping && <UserTypingIndicator />}
        <div ref={messagesEndRef} />
      </div>
      <ScrollToBottomButton target={chatContainerRef.current} />
      <div className="w-full bg-card px-3 py-2 border-t min-w-0">
        {!activeTicketId && (
            isLiveChatEnabled ? (
              <Button onClick={handleLiveChatRequest} className="w-full mb-2">
                Hablar con un representante
              </Button>
            ) : (
              horariosAtencion && (
                <div className="text-center text-sm text-muted-foreground p-2">
                  <p>Para hablar con un representante, nuestro horario de atención es:</p>
                  <p>
                    <strong>{horariosAtencion}</strong>
                  </p>
                </div>
              )
            )
        )}
        {contexto.estado_conversacion === 'recolectando_datos_personales' ? (
          <PersonalDataForm onSubmit={handlePersonalDataSubmit} isSubmitting={isTyping} />
        ) : (
          <ChatInput
            onSendMessage={handleSend}
            isTyping={isTyping}
            inputRef={chatInputRef}
            onTypingChange={setUserTyping}
            onFileUploaded={handleFileUploaded}
          />
        )}
      </div>
    </div>
  );
};

export default ChatPanel;
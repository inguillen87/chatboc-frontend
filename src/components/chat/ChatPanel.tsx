import React, { useState, useRef, useEffect, useCallback } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import ChatHeader from "./ChatHeader";
import type { Prefs } from "./AccessibilityToggle";
import ChatMessage from "./ChatMessage";
import TypingIndicator from "./TypingIndicator";
import UserTypingIndicator from "./UserTypingIndicator";
import ChatInput, { ChatInputHandle } from "./ChatInput";
import ScrollToBottomButton from "@/components/ui/ScrollToBottomButton";
import { useChatLogic } from "@/hooks/useChatLogic";
import PersonalDataForm from './PersonalDataForm';
import { Rubro } from "./RubroSelector";
import { Message } from "@/types/chat";
import { safeLocalStorage } from "@/utils/safeLocalStorage";
import { requestLocation } from "@/utils/geolocation";
import { toast } from "@/components/ui/use-toast";
import RubroSelector from "./RubroSelector";
import AddressAutocomplete from "@/components/ui/AddressAutocomplete";
import TicketMap from "@/components/TicketMap";
import { apiFetch, getErrorMessage } from "@/utils/api";
import { useUser } from "@/hooks/useUser";
import { useBusinessHours } from "@/hooks/useBusinessHours";
import { Button } from "@/components/ui/button";
import io from 'socket.io-client';
import { getSocketUrl } from "@/config";
import { safeOn, assertEventSource } from "@/utils/safeOn";
import { Loader2 } from "lucide-react";
import { getInitialMunicipioContext } from "@/utils/contexto_municipio";
import { resetChatSessionId } from "@/utils/chatSessionId";

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
  headerLogoUrl?: string;
  welcomeTitle?: string;
  welcomeSubtitle?: string;
  logoAnimation?: string;
  onA11yChange?: (p: Prefs) => void;
  a11yPrefs?: Prefs;
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
  headerLogoUrl,
  welcomeTitle,
  welcomeSubtitle,
  logoAnimation,
  onA11yChange,
  a11yPrefs,
}: ChatPanelProps) => {
  const isMobile = useIsMobile();
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatInputTextRef = useRef<HTMLInputElement>(null);
  const chatInputHandleRef = useRef<ChatInputHandle>(null);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [userTyping, setUserTyping] = useState(false);
  const { isLiveChatEnabled, horariosAtencion } = useBusinessHours(propEntityToken);
  const socketRef = useRef<SocketIOClient.Socket | null>(null);

  const skipAuth = mode === 'script';
  const { messages, isTyping, handleSend, activeTicketId, setMessages, setContexto, setActiveTicketId, contexto, addSystemMessage } = useChatLogic({
    tipoChat: tipoChat,
    entityToken: propEntityToken,
    skipAuth,
  });

  const rubrosEnabled = tipoChat === 'pyme';
  const [rubros, setRubros] = useState<Rubro[]>([]);
  const [isLoadingRubros, setIsLoadingRubros] = useState(false);
  const [rubrosError, setRubrosError] = useState<string | null>(null);
  const welcomeShownRef = useRef(false);
  const [localRubro, setLocalRubro] = useState<string | null>(() => selectedRubro ?? null);

  const loadRubros = useCallback(() => {
    setIsLoadingRubros(true);
    setRubrosError(null);
    apiFetch<Rubro[]>("/rubros/", { skipAuth: true })
      .then((data) => {
        if (Array.isArray(data)) {
          setRubros(data);
        } else {
          setRubros([]);
        }
      })
      .catch((error) => {
        setRubros([]);
        setRubrosError(getErrorMessage(error, "No se pudieron cargar los rubros."));
      })
      .finally(() => {
        setIsLoadingRubros(false);
      });
  }, []);


  useEffect(() => {
    if (!rubrosEnabled) {
      safeLocalStorage.removeItem("rubroSeleccionado");
      welcomeShownRef.current = false;
      const nextValue = selectedRubro ?? null;
      if (localRubro !== nextValue) {
        setLocalRubro(nextValue);
      }
      return;
    }

    if (selectedRubro && selectedRubro !== localRubro) {
      welcomeShownRef.current = false;
      setLocalRubro(selectedRubro);
      return;
    }

    if (!selectedRubro && !localRubro) {
      const stored = safeLocalStorage.getItem("rubroSeleccionado");
      if (stored) {
        setLocalRubro(stored);
      }
    }
  }, [rubrosEnabled, selectedRubro, localRubro]);


  useEffect(() => {
    if (!rubrosEnabled || localRubro) {
      return;
    }
    if (isLoadingRubros || rubros.length > 0 || rubrosError) {
      return;
    }
    loadRubros();
  }, [rubrosEnabled, localRubro, isLoadingRubros, rubros.length, rubrosError, loadRubros]);

  useEffect(() => {
    if (!rubrosEnabled) {
      return;
    }
    if (!selectedRubro && localRubro && onRubroSelect) {
      onRubroSelect(localRubro);
    }
  }, [rubrosEnabled, selectedRubro, localRubro, onRubroSelect]);

  useEffect(() => {
    if (!rubrosEnabled) {
      return;
    }
    if (localRubro) {
      safeLocalStorage.setItem("rubroSeleccionado", localRubro);
    } else {
      safeLocalStorage.removeItem("rubroSeleccionado");
      welcomeShownRef.current = false;
    }
  }, [rubrosEnabled, localRubro]);

  useEffect(() => {
    if (!rubrosEnabled) {
      return;
    }
    if (localRubro && messages.length === 0 && !welcomeShownRef.current) {
      addSystemMessage(
        `¡Hola! Soy Chatboc, tu asistente para ${localRubro.toLowerCase()}. ¿En qué puedo ayudarte hoy?`
      );
      welcomeShownRef.current = true;
    }
  }, [rubrosEnabled, localRubro, messages.length, addSystemMessage]);

  const [esperandoDireccion, setEsperandoDireccion] = useState(false);
  const [forzarDireccion, setForzarDireccion] = useState(false);
  const [direccionGuardada, setDireccionGuardada] = useState<string | null>(null);
  const [showCierre, setShowCierre] = useState<{ show: boolean; text: string } | null>(null);
  const [ticketLocation, setTicketLocation] = useState<{
    direccion?: string | null;
    latitud?: number | null;
    longitud?: number | null;
    municipio_nombre?: string | null;
  } | null>(null);

  const handleRubroSelection = useCallback(
    (rubro: Rubro) => {
      const nombre = rubro.nombre;
      welcomeShownRef.current = false;
      safeLocalStorage.setItem("rubroSeleccionado", nombre);
      setLocalRubro(nombre);
      resetChatSessionId();
      setMessages([]);
      setActiveTicketId(null);
      setContexto(getInitialMunicipioContext());
      setEsperandoDireccion(false);
      setForzarDireccion(false);
      setShowCierre(null);
      setTicketLocation(null);
      onRubroSelect?.(nombre);
    },
    [
      onRubroSelect,
      setMessages,
      setActiveTicketId,
      setContexto,
      setEsperandoDireccion,
      setForzarDireccion,
      setShowCierre,
      setTicketLocation,
    ]
  );

  const showRubroSelector = rubrosEnabled && !localRubro;

  const handlePersonalDataSubmit = (data: { nombre: string; email: string; telefono: string; dni: string; }) => {
    const normalizedName = data?.nombre?.trim();
    handleSend({
      action: 'submit_personal_data',
      payload: normalizedName ? { ...data, nombre: normalizedName } : data,
    });
  };

  const esAnonimo = skipAuth || !safeLocalStorage.getItem("authToken");
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
          text: data.comentario || '',
          isBot: data.es_admin, // Agent messages are treated as "bot" for styling
          timestamp: new Date(data.fecha || Date.now()),
          origen: data.origen,
        };
        setMessages(prevMessages => [...prevMessages, newMessage]);
      };
      assertEventSource(socket, 'socket');
      const ok = safeOn(socket, 'new_chat_message', handleIncoming);
      if (!ok) {
        console.warn('No pude suscribirme a "new_chat_message"');
      }

      return () => {
        socket?.off?.('new_chat_message', handleIncoming);
        socket?.disconnect?.();
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

      const photoActions = [
        "requestuserphoto",
        "requestphoto",
        "subirfoto",
        "agregarfoto",
        "addphoto",
        "attachphoto",
        "adjuntarfoto",
      ];
      if (photoActions.includes(normalized)) {
        chatInputHandleRef.current?.openFilePicker();
        return;
      }

      // For other actions, the backend request was already sent. No extra handling needed.
    },
    [handleSend, onShowLogin, onShowRegister, onCart, toast]
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

  if (showRubroSelector) {
    return (
      <div className={cn("chat-root flex flex-col w-full h-full bg-card text-card-foreground overflow-hidden relative", isMobile ? undefined : "rounded-[inherit]")}>
        <ChatHeader
          onClose={onClose}
          onProfile={onOpenUserPanel}
          muted={muted}
          onToggleSound={onToggleSound}
          onCart={onCart}
          logoUrl={headerLogoUrl}
          title={welcomeTitle}
          subtitle={welcomeSubtitle}
          logoAnimation={logoAnimation}
          onA11yChange={onA11yChange}
        />
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-background/90 p-6 text-center shadow-lg">
            <img
              src="/chatboc_logo_clean_transparent.png"
              alt="Chatboc"
              className="mx-auto mb-4 h-14 w-14"
              onError={(e) => {
                (e.target as HTMLImageElement).src = "/favicon/favicon-48x48.png";
              }}
            />
            <h2 className="mb-2 text-xl font-semibold text-primary">¡Bienvenido a Chatboc!</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Seleccioná el rubro que más se parece a tu negocio:
            </p>
            {isLoadingRubros ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : rubrosError ? (
              <div className="space-y-4">
                <p className="text-sm text-destructive">{rubrosError}</p>
                <Button onClick={loadRubros} className="w-full">
                  Reintentar
                </Button>
              </div>
            ) : rubros.length > 0 ? (
              <RubroSelector rubros={rubros} onSelect={handleRubroSelection} />
            ) : (
              <p className="text-sm text-muted-foreground">No hay rubros disponibles por el momento.</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("chat-root flex flex-col w-full h-full bg-card text-card-foreground overflow-hidden relative", isMobile ? undefined : "rounded-[inherit]")}>
      <ChatHeader
        onClose={onClose}
        onProfile={onOpenUserPanel}
        muted={muted}
        onToggleSound={onToggleSound}
        onCart={onCart}
        logoUrl={headerLogoUrl}
        title={welcomeTitle}
        subtitle={welcomeSubtitle}
        logoAnimation={logoAnimation}
        onA11yChange={onA11yChange}
      />
      <div ref={chatContainerRef} className="flex-1 p-2 sm:p-4 min-h-0 flex flex-col gap-3 overflow-y-auto">
        {messages.map((msg) => (
          <ChatMessage
            key={`${msg.id}-${a11yPrefs?.simplified ? "s" : "f"}`}
            message={msg}
            isTyping={isTyping}
            onButtonClick={handleSend}
            onInternalAction={handleInternalAction}
            tipoChat={tipoChat}
            botLogoUrl={headerLogoUrl}
            logoAnimation={logoAnimation}
          />
        ))}
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
            ref={chatInputHandleRef}
            onSendMessage={handleSend}
            isTyping={isTyping}
            inputRef={chatInputTextRef}
            onTypingChange={setUserTyping}
            onSystemMessage={addSystemMessage}
          />
        )}
      </div>
    </div>
  );
};

export default ChatPanel;
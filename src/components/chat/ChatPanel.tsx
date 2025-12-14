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
import { Rubro } from '@/types/rubro';
import { Message } from "@/types/chat";
import { safeLocalStorage } from "@/utils/safeLocalStorage";
import { extractRubroKey, extractRubroLabel } from "@/utils/rubros";
import { requestLocation } from "@/utils/geolocation";
import { toast } from "@/components/ui/use-toast";
import RubroSelector from "./RubroSelector";
import AddressAutocomplete from "@/components/ui/AddressAutocomplete";
import TicketMap from "@/components/TicketMap";
import { apiFetch, getErrorMessage } from "@/utils/api";
import { getRubrosHierarchy } from "@/api/rubros";
import { useUser } from "@/hooks/useUser";
import { useBusinessHours } from "@/hooks/useBusinessHours";
import { Button } from "@/components/ui/button";
import io from 'socket.io-client';
import { getSocketUrl, SOCKET_PATH } from "@/config";
import { safeOn, assertEventSource } from "@/utils/safeOn";
import { Loader2 } from "lucide-react";
import { getInitialMunicipioContext } from "@/utils/contexto_municipio";
import { resetChatSessionId } from "@/utils/chatSessionId";

const PENDING_TICKET_KEY = 'pending_ticket_id';
const PENDING_GPS_KEY = 'pending_gps';
const PENDING_WIDGET_ACTION = 'pending_widget_action';

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
  tenantSlug?: string | null;
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
  onCart?: (target?: "cart" | "catalog" | "market") => void;
  cartCount?: number;
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
  tenantSlug,
  cartCount,
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
  const normalizedPropRubro = extractRubroKey(selectedRubro);
  const [localRubro, setLocalRubro] = useState<string | null>(() => normalizedPropRubro ?? null);
  const resolvedSelectedRubro = localRubro ?? normalizedPropRubro ?? null;
  const {
    messages,
    isTyping,
    handleSend,
    activeTicketId,
    setMessages,
    setContexto,
    setActiveTicketId,
    contexto,
    addSystemMessage,
    initializeConversation,
  } = useChatLogic({
    tipoChat: tipoChat,
    entityToken: propEntityToken,
    tenantSlug,
    skipAuth,
    selectedRubro: resolvedSelectedRubro,
  });

  // Check for pending widget action from CTA bubble
  useEffect(() => {
    const pendingAction = safeLocalStorage.getItem(PENDING_WIDGET_ACTION);
    if (pendingAction) {
      safeLocalStorage.removeItem(PENDING_WIDGET_ACTION);
      try {
        const actionData = JSON.parse(pendingAction);
        if (actionData && actionData.action) {
          // Allow slight delay for component initialization
          setTimeout(() => {
            handleSend({
                text: actionData.text || actionData.action, // Fallback text if just action
                action: actionData.action,
                payload: actionData.payload
            });
          }, 500);
        }
      } catch (e) {
        console.error("Error parsing pending widget action", e);
      }
    }
  }, [handleSend]);

  const rubrosEnabled = tipoChat === 'pyme';
  const [rubros, setRubros] = useState<Rubro[]>([]);
  const [isLoadingRubros, setIsLoadingRubros] = useState(false);
  const [rubrosError, setRubrosError] = useState<string | null>(null);
  const lastInitializedRubro = useRef<string | null>(null);

  const loadRubros = useCallback(() => {
    setIsLoadingRubros(true);
    setRubrosError(null);
    getRubrosHierarchy()
      .then((data) => {
        if (Array.isArray(data)) {
          // getRubrosHierarchy already returns the tree
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
      safeLocalStorage.removeItem("rubroSeleccionado_label");
      lastInitializedRubro.current = null;
      const nextValue = extractRubroKey(selectedRubro);
      if (localRubro !== nextValue) {
        setLocalRubro(nextValue ?? null);
      }
      return;
    }

    const sanitizedSelected = extractRubroKey(selectedRubro);
    if (sanitizedSelected && sanitizedSelected !== localRubro) {
      lastInitializedRubro.current = null;
      setLocalRubro(sanitizedSelected);
      return;
    }

    if (!selectedRubro && !localRubro) {
      const stored = safeLocalStorage.getItem("rubroSeleccionado");
      const storedKey = extractRubroKey(stored);
      if (storedKey) {
        lastInitializedRubro.current = null;
        setLocalRubro(storedKey);
      }
    }
  }, [rubrosEnabled, selectedRubro, localRubro]);

  useEffect(() => {
    if (!rubrosEnabled) {
      return;
    }
    if (localRubro) {
      return;
    }
    if (lastInitializedRubro.current === localRubro) {
      return;
    }

    initializeConversation({
      rubroOverride: localRubro,
      resetContext: true,
      resetMessages: true,
      force: true,
    });
    lastInitializedRubro.current = localRubro;
  }, [rubrosEnabled, localRubro, initializeConversation]);


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
      safeLocalStorage.removeItem("rubroSeleccionado_label");
      lastInitializedRubro.current = null;
    }
  }, [rubrosEnabled, localRubro]);

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
      const rubroKey = extractRubroKey(rubro);
      if (!rubroKey) {
        console.warn("handleRubroSelection: rubro inválido", rubro);
        return;
      }

      const rubroLabel = extractRubroLabel(rubro);

      lastInitializedRubro.current = null;
      safeLocalStorage.setItem("rubroSeleccionado", rubroKey);
      if (rubroLabel) {
        safeLocalStorage.setItem("rubroSeleccionado_label", rubroLabel);
      } else {
        safeLocalStorage.removeItem("rubroSeleccionado_label");
      }
      setLocalRubro(rubroKey);
      resetChatSessionId();
      setMessages([]);
      setActiveTicketId(null);
      setContexto(getInitialMunicipioContext());
      setEsperandoDireccion(false);
      setForzarDireccion(false);
      setShowCierre(null);
      setTicketLocation(null);
      onRubroSelect?.(rubroKey);
      initializeConversation({
        rubroOverride: rubroKey,
        resetContext: true,
        resetMessages: true,
        force: true,
      });
      lastInitializedRubro.current = rubroKey;
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
      initializeConversation,
    ]
  );

  // If we have a tenantSlug or entityToken, we are in a specific context, so we force-disable the selector
  // unless explicitly required (which shouldn't happen for single-tenant mode).
  // Actually, 'rubrosEnabled' is true for 'pyme', false for 'municipio'.
  // If tipoChat is 'municipio', rubrosEnabled is false, so showRubroSelector is false.
  // If tipoChat is 'pyme' (which might be default if detection fails), rubrosEnabled is true.
  // We need to ensure that if tenantSlug is present, we consider it "bound" to that tenant.
  // However, a 'pyme' tenant might still have rubros? No, usually a single pyme is a specific business.
  // The 'directory' mode is when we are at the aggregator level.
  // If tenantSlug is present, we assume it's a specific entity.
  const showRubroSelector = rubrosEnabled && !localRubro && !tenantSlug && !propEntityToken;

  const handlePersonalDataSubmit = (data: { nombre: string; email: string; telefono: string; dni: string; }) => {
    const normalizedName = data?.nombre?.trim();
    handleSend({
      action: 'submit_personal_data',
      payload: normalizedName ? { ...data, nombre: normalizedName } : data,
    });
  };

  const { user } = useUser();

  useEffect(() => {
    const stored = safeLocalStorage.getItem("ultima_direccion");
    if (stored) setDireccionGuardada(stored);
  }, []);

  useEffect(() => {
    if (activeTicketId) {
      const socketUrl =
        typeof getSocketUrl === "function"
          ? getSocketUrl()
          : (() => {
              if (typeof window === "undefined") return "";
              try {
                const url = new URL(window.location.href);
                url.protocol = url.protocol.replace("http", "ws");
                return url.origin;
              } catch (error) {
                console.error("No se pudo resolver la URL del socket:", error);
                return "";
              }
            })();

      if (!socketUrl) {
        console.error("Socket URL no disponible. Se omite la conexión.");
        return;
      }

      const socket = io(socketUrl, { path: SOCKET_PATH });
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

      const cartActions = [
        "cart",
        "carrito",
        "catalogo",
        "catalog",
        "catalogue",
        "tienda",
        "store",
        "catalogomenu",
        "menucatalogo",
        "market",
        "marketcatalog",
      ];
      if (cartActions.includes(normalized)) {
        const target: "cart" | "catalog" | "market" =
          normalized === "cart" || normalized === "carrito" ? "cart" : "market";
        onCart?.(target);
        handleSend({ text: "Catálogo", action: "catalogo" });
        return;
      }

      if (normalized === "subastas" || normalized === "subasta") {
        // Subastas is not yet supported, so avoid dispatching an internal action for it.
        return;
      }

      const loyaltyActions: Record<string, { text: string; action: string }> = {
        donaciones: { text: "Donaciones", action: "donaciones" },
        donacion: { text: "Donaciones", action: "donaciones" },
        canje: { text: "Canje de puntos", action: "canje_puntos" },
        canjearpuntos: { text: "Canje de puntos", action: "canje_puntos" },
        puntos: { text: "Puntos", action: "saldo_puntos" },
        compras: { text: "Comprar productos", action: "compras" },
      };
      if (loyaltyActions[normalized]) {
        const entry = loyaltyActions[normalized];
        handleSend({ text: entry.text, action: entry.action });
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

  const handleOpenCatalog = useCallback(() => {
    onCart?.("market");
  }, [onCart]);

  if (showRubroSelector) {
    return (
      <div
        className={cn(
          "chat-root flex h-full w-full flex-col bg-card text-card-foreground overflow-hidden relative",
          isMobile ? undefined : "rounded-[inherit]",
        )}
      >
        <ChatHeader
          onClose={onClose}
          onProfile={onOpenUserPanel}
          muted={muted}
          onToggleSound={onToggleSound}
          onCart={() => onCart?.()}
          cartCount={cartCount}
          logoUrl={headerLogoUrl}
          title={welcomeTitle}
          subtitle={welcomeSubtitle}
          logoAnimation={logoAnimation}
          onA11yChange={onA11yChange}
        />
        <div className="flex-1 overflow-hidden px-4 pb-4">
          <div className="mx-auto flex h-full max-h-[calc(100vh-160px)] w-full max-w-sm flex-col rounded-2xl border border-border bg-background/90 p-6 text-center shadow-lg">
            <img
              src="/chatboc_logo_clean_transparent.png"
              alt="Chatboc"
              className="mx-auto h-14 w-14"
              onError={(e) => {
                (e.target as HTMLImageElement).src = "/favicon/favicon-48x48.png";
              }}
            />
            <h2 className="text-xl font-semibold text-primary">¡Bienvenido a Chatboc!</h2>
            <p className="text-sm text-muted-foreground">
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
            ) : (
              <div className="min-h-0 flex-1 overflow-hidden pt-2">
                {/* Always attempt to render RubroSelector if not loading/error, passing rubros (even if empty, RubroSelector handles it or we rely on fallback inside selector if needed, but current logic handles 0 length in ternary above if strictly empty). Wait, actually we want to force render if there are items OR if we trust the selector to show something. The outer condition checked rubros.length > 0. Let's make it more robust. */}
                {rubros.length > 0 ? (
                    <RubroSelector rubros={rubros} onSelect={handleRubroSelection} />
                ) : (
                    <p className="text-sm text-muted-foreground py-8">No hay rubros disponibles por el momento.</p>
                )}
              </div>
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
        onCart={() => onCart?.()}
        cartCount={cartCount}
        logoUrl={headerLogoUrl}
        title={welcomeTitle}
        subtitle={welcomeSubtitle}
        logoAnimation={logoAnimation}
        onA11yChange={onA11yChange}
      />
      {onCart && tipoChat === 'pyme' && (
        <div className="px-2 sm:px-4 pt-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center rounded-xl border bg-muted/40 px-3 py-3">
            <div className="text-sm text-muted-foreground flex-1">
              <p className="text-sm font-medium text-foreground">Explora el catálogo</p>
              <p>Conocé los productos disponibles y agregalos al carrito.</p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              className="w-full sm:w-auto"
              onClick={handleOpenCatalog}
            >
              Ver catálogo
            </Button>
          </div>
        </div>
      )}
      <div ref={chatContainerRef} className="flex-1 p-2 sm:p-4 min-h-0 flex flex-col gap-3 overflow-y-auto justify-end">
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
        {isTyping && (
          <TypingIndicator logoUrl={headerLogoUrl} logoAnimation={logoAnimation} />
        )}
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

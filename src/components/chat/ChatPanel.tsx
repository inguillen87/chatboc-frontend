import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
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
import CatalogShareCard from "./CatalogShareCard";
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
import { io } from 'socket.io-client';
import { getSocketUrl, SOCKET_PATH } from "@/config";
import { safeOn, assertEventSource } from "@/utils/safeOn";
import { Loader2, X, Lightbulb, CheckCircle2, Mic, MicOff, Captions, CaptionsOff, Phone, Video, Bot, Wifi, WifiOff } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { getInitialMunicipioContext } from "@/utils/contexto_municipio";
import { resetChatSessionId } from "@/utils/chatSessionId";
import { extractSmartHint } from "@/utils/smartHints";
import { trackFrontendEvent, type FrontendEventName } from '@/utils/frontendTelemetry';

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
  typingAnimation?: string;
  bubbleAnimation?: string;
  messageEnterAnimation?: string;
  logoBadgeStyle?: string;
  supportChannels?: {
    live_chat?: { realtime?: boolean; available?: boolean; media?: Record<string, boolean>; label?: string };
    whatsapp?: { enabled?: boolean; realtime_bridge?: boolean; media?: Record<string, boolean>; label?: string };
    voice_call?: { enabled?: boolean; provider?: string; model?: string; label?: string; features?: Record<string, boolean> };
    video_call?: { enabled?: boolean; provider?: string; model?: string; label?: string; features?: Record<string, boolean> };
  } | null;
  realtimeConfig?: {
    model?: string;
    voiceEnabled?: boolean;
    videoEnabled?: boolean;
    avatarEnabled?: boolean;
    avatarType?: string;
    avatarPersona?: string;
  } | null;
  onA11yChange?: (p: Prefs) => void;
  a11yPrefs?: Prefs;
  openWidth?: string;
  openHeight?: string;
  catalogCard?: {
    bannerUrl?: string | null;
    viewUrl?: string | null;
    downloadUrl?: string | null;
    viewLabel?: string | null;
    downloadLabel?: string | null;
  } | null;
}

const ChatPanel = (props: ChatPanelProps) => {
  const {
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
    typingAnimation,
    bubbleAnimation,
    messageEnterAnimation,
    logoBadgeStyle,
    supportChannels,
    realtimeConfig,
    onA11yChange,
    a11yPrefs,
    catalogCard,
  } = props;
  const isMobile = useIsMobile();
  const fallbackRubroTitle = welcomeTitle || "Chatboc";
  const fallbackRubroSubtitle =
    welcomeSubtitle ||
    "Seleccioná un rubro para personalizar la experiencia automáticamente.";
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatInputTextRef = useRef<HTMLInputElement>(null);
  const chatInputHandleRef = useRef<ChatInputHandle>(null);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [userTyping, setUserTyping] = useState(false);
  const { isLiveChatEnabled, horariosAtencion, availabilityLabel, timezone } = useBusinessHours(propEntityToken, tenantSlug);
  const socketRef = useRef<SocketIOClient.Socket | null>(null);

  const skipAuth = mode === 'script';
  const liveChatIsAvailable = Boolean(supportChannels?.live_chat?.available ?? supportChannels?.live_chat?.realtime);
  const normalizedPropRubro = extractRubroKey(selectedRubro);
  const [localRubro, setLocalRubro] = useState<string | null>(() => normalizedPropRubro ?? null);
  const resolvedSelectedRubro = localRubro ?? normalizedPropRubro ?? null;
  const {
    messages,
    isTyping,
    handleSend,
    activeTicketId,
    liveChatTicketId,
    isLiveChatActive,
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
    liveChatAvailable: liveChatIsAvailable,
  });

  const shouldShowCatalogCard = Boolean(
    catalogCard?.viewUrl || catalogCard?.downloadUrl || catalogCard?.bannerUrl,
  );
  const catalogViewLabel = catalogCard?.viewLabel ?? null;
  const catalogDownloadLabel = catalogCard?.downloadLabel ?? null;

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
    if (isLiveChatActive && liveChatTicketId) {
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

      const room = `ticket_${tipoChat}_${liveChatTicketId}`;
      socket.emit('join', { room });

      const handleIncoming = (data: any) => {
        const newMessage: Message = {
          id: data.id,
          text: data.comentario || '',
          isBot: data.es_admin, // Agent messages are treated as "bot" for styling
          timestamp: new Date(data.fecha || Date.now()),
          origen: data.origen,
          audioUrl: data.audio_url,
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
  }, [isLiveChatActive, liveChatTicketId, tipoChat, setMessages]);

  const handleLiveChatRequest = () => {
    handleSend({
      text: "Quisiera hablar con un representante",
      action: "request_agent",
    });
    if (channelMode !== 'chat') {
      emitRealtimeAnalytics('business_action_executed', channelMode, { action: 'request_agent' });
    }
  };

  const handleWhatsAppBridge = () => {
    handleSend({
      action: 'contact_whatsapp',
      payload: { channel: 'whatsapp' },
    });
  };

  const liveChatAllowedByBackend = supportChannels?.live_chat?.realtime !== false;
  const canRenderLiveChat = Boolean(liveChatAllowedByBackend && isLiveChatEnabled);
  const canRenderWhatsAppBridge = Boolean(
    supportChannels?.whatsapp?.enabled && supportChannels?.whatsapp?.realtime_bridge,
  );
  const voiceCallConfig = supportChannels?.voice_call;
  const videoCallConfig = supportChannels?.video_call;
  const realtimeVoiceEnabled = Boolean(voiceCallConfig?.enabled && realtimeConfig?.voiceEnabled !== false);
  const realtimeVideoEnabled = Boolean(videoCallConfig?.enabled && realtimeConfig?.videoEnabled !== false);
  const [channelMode, setChannelMode] = useState<'chat' | 'voice' | 'video'>('chat');
  const [sessionState, setSessionState] = useState<'idle' | 'connecting' | 'live' | 'reconnecting' | 'ended'>('idle');
  const [captionsEnabled, setCaptionsEnabled] = useState(Boolean(voiceCallConfig?.features?.captions));
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [assistantSpeaking, setAssistantSpeaking] = useState(false);
  const [networkLatency, setNetworkLatency] = useState<'good' | 'unstable'>('good');
  const [transcript, setTranscript] = useState<Array<{ id: string; text: string; role: 'assistant' | 'user' }>>([]);

  const emitRealtimeAnalytics = useCallback((eventName: FrontendEventName, channel: 'chat' | 'voice' | 'video', extra?: Record<string, unknown>) => {
    trackFrontendEvent(eventName, {
      tenant: tenantSlug || 'unknown',
      channel,
      session_id: activeTicketId || `rt_${Date.now()}`,
      ...extra,
    });
  }, [tenantSlug, activeTicketId]);

  const beginRealtimeSession = useCallback(async (mode: 'voice' | 'video') => {
    setChannelMode(mode);
    setSessionState('connecting');
    try {
      if (mode === 'video' && typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          stream.getTracks().forEach((track) => track.stop());
        } catch {
          setChannelMode('voice');
          setSessionState('reconnecting');
          emitRealtimeAnalytics('realtime_mode_switched', 'voice', { from: 'video', to: 'voice', reason: 'webcam_unavailable' });
          mode = 'voice';
        }
      }

      const payload = await apiFetch<any>('/api/public/realtime/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_slug: tenantSlug, channel: mode }),
        tenantSlug: tenantSlug || undefined,
      });

      const sessionId = payload?.session?.id || payload?.session_id || `rt_${Date.now()}`;
      setSessionState('live');
      setAssistantSpeaking(true);
      emitRealtimeAnalytics('realtime_session_started', mode, {
        session_id: sessionId,
        model: payload?.model || realtimeConfig?.model || voiceCallConfig?.model || videoCallConfig?.model,
      });

      if (mode === 'video' && (payload?.avatar || realtimeConfig?.avatarEnabled)) {
        emitRealtimeAnalytics('avatar_rendered', 'video', {
          avatar_type: payload?.avatar?.type || realtimeConfig?.avatarType || 'robot',
          avatar_persona: payload?.avatar?.persona || realtimeConfig?.avatarPersona || null,
        });
      }
    } catch (error) {
      setSessionState('ended');
      emitRealtimeAnalytics('realtime_session_failed', mode, {
        error: getErrorMessage(error, 'realtime_session_failed'),
      });
    }
  }, [emitRealtimeAnalytics, realtimeConfig, tenantSlug, videoCallConfig?.model, voiceCallConfig?.model]);

  const endRealtimeSession = useCallback(() => {
    setSessionState('ended');
    setIsUserSpeaking(false);
    setAssistantSpeaking(false);
  }, []);

  useEffect(() => {
    if (channelMode === 'video' && sessionState === 'live' && !realtimeVideoEnabled) {
      setChannelMode('voice');
      setSessionState('reconnecting');
      emitRealtimeAnalytics('realtime_mode_switched', 'voice', { from: 'video', to: 'voice', reason: 'video_unavailable' });
      window.setTimeout(() => setSessionState('live'), 500);
    }
  }, [channelMode, emitRealtimeAnalytics, realtimeVideoEnabled, sessionState]);

  useEffect(() => {
    if (sessionState !== 'live') return;

    const evaluateNetwork = () => {
      const online = typeof navigator !== 'undefined' ? navigator.onLine : true;
      const rtt = Number((navigator as any)?.connection?.rtt || 0);
      setNetworkLatency(!online || (rtt > 0 && rtt >= 300) ? 'unstable' : 'good');
    };

    evaluateNetwork();
    window.addEventListener('online', evaluateNetwork);
    window.addEventListener('offline', evaluateNetwork);

    return () => {
      window.removeEventListener('online', evaluateNetwork);
      window.removeEventListener('offline', evaluateNetwork);
    };
  }, [sessionState]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || channelMode === 'chat' || sessionState !== 'live' || isMicMuted) return;
      event.preventDefault();
      setIsUserSpeaking(true);
      setAssistantSpeaking(false);
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return;
      setIsUserSpeaking(false);
      setAssistantSpeaking(true);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [channelMode, isMicMuted, sessionState]);

  const voiceCallLabel = useMemo(() => {
    if (typeof voiceCallConfig?.label === 'string' && voiceCallConfig.label.trim()) return voiceCallConfig.label.trim();
    return null;
  }, [voiceCallConfig?.label]);

  const videoCallLabel = useMemo(() => {
    if (typeof videoCallConfig?.label === 'string' && videoCallConfig.label.trim()) return videoCallConfig.label.trim();
    return null;
  }, [videoCallConfig?.label]);
  const whatsappButtonLabel =
    typeof supportChannels?.whatsapp?.label === 'string' && supportChannels.whatsapp.label.trim()
      ? supportChannels.whatsapp.label.trim()
      : 'WhatsApp';

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
      if (channelMode !== 'chat') {
        emitRealtimeAnalytics('business_action_executed', channelMode, { action: normalized });
      }
    },
    [channelMode, emitRealtimeAnalytics, handleSend, onShowLogin, onShowRegister, onCart, toast]
  );

  useEffect(() => {
    if (sessionState !== 'live') return;
    const latestMessage = messages[messages.length - 1];
    if (!latestMessage?.text) return;
    setTranscript((prev) => {
      const next = [...prev, {
        id: latestMessage.id,
        text: latestMessage.text,
        role: latestMessage.isBot ? 'assistant' : 'user',
      }];
      return next.slice(-8);
    });
  }, [messages, sessionState]);

  useEffect(() => {
    // FORCE SCROLL ON NEW MESSAGE
    // Use a small timeout to allow layout to settle (e.g. images loading)
    const timer = setTimeout(() => {
        if (chatContainerRef.current) {
            const { scrollHeight, scrollTop, clientHeight } = chatContainerRef.current;

            // Check if we are "close enough" to the bottom OR if it's the very first render/messages
            // We increase the threshold to 500px to be more aggressive (solving "lost messages")
            const isCloseToBottom = scrollHeight - scrollTop - clientHeight < 500;
            const isShortConversation = messages.length <= 3;
            const isLatestMessageMine = !messages[messages.length - 1]?.isBot;

            // Always scroll if:
            // 1. We are close to bottom
            // 2. It's a short conversation (initial load)
            // 3. The user just sent a message (we want to see our own message)
            if (isCloseToBottom || isShortConversation || isLatestMessageMine) {
                // Use 'auto' behavior to prevent layout trashing in iframes
                if (messagesEndRef.current) {
                   messagesEndRef.current.scrollIntoView({ behavior: "auto", block: "end" });
                }
                // Double check via container scrollTop for robustness
                if (chatContainerRef.current) {
                    chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
                }
                setShowScrollDown(false);
            } else {
                // User is scrolled up reading history
                setShowScrollDown(true);
            }
        } else {
            // Fallback if ref is not ready yet
             if (messagesEndRef.current) {
                messagesEndRef.current.scrollIntoView({ behavior: "auto", block: "end" });
             }
        }
    }, 100);
    return () => clearTimeout(timer);
  }, [messages]);

  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;
    const onScroll = () => {
      const { scrollHeight, scrollTop, clientHeight } = container;
      // Define tolerance for "at bottom"
      const atBottom = scrollHeight - scrollTop - clientHeight < 100;
      setShowScrollDown(!atBottom);
    };
    container.addEventListener("scroll", onScroll);
    return () => container.removeEventListener("scroll", onScroll);
  }, []);

  const handleOpenCatalog = useCallback(() => {
    onCart?.("market");
  }, [onCart]);

  // Smart Features Logic
  const lastMessage = messages[messages.length - 1];
  const lastUserMessage = [...messages].reverse().find(m => !m.isBot); // Safe find last user message
  const [smartHint, setSmartHint] = useState<string | null>(null);
  const [leadSuccessTicket, setLeadSuccessTicket] = useState<string | null>(null);
  const leadStepViewedRef = useRef<string | null>(null);


  useEffect(() => {
    const latestWithTicket = [...messages]
      .reverse()
      .find((msg) => msg.isBot && (msg.data as any)?.fuente === 'demo_lead_capture' && (msg.data as any)?.nro_ticket);
    const ticket = latestWithTicket ? String((latestWithTicket.data as any).nro_ticket) : null;
    if (!ticket || ticket === leadSuccessTicket) return;
    setLeadSuccessTicket(ticket);
    const timer = setTimeout(() => setLeadSuccessTicket(null), 4500);
    return () => clearTimeout(timer);
  }, [messages, leadSuccessTicket]);

  useEffect(() => {
    if (lastMessage?.isBot) {
      const { hint } = extractSmartHint(lastMessage.text);
      if (hint) {
        setSmartHint(hint);
      }
    }
  }, [lastMessage]);

  const isAnalyzingImage = isTyping && lastUserMessage?.attachmentInfo?.type === 'image';
  const typingText = isAnalyzingImage ? "Analizando imagen..." : undefined;


  const latestLeadCaptureMessage = [...messages]
    .reverse()
    .find((msg) => msg.isBot && (msg.data as any)?.fuente === 'demo_lead_capture');

  const leadRequestedFieldRaw = (latestLeadCaptureMessage?.data as any)?.pedir_info;
  const leadRequestedField = typeof leadRequestedFieldRaw === 'string' ? leadRequestedFieldRaw.toLowerCase() : null;
  const leadStep = leadRequestedField === 'nombre' ? 1 : leadRequestedField === 'telefono' ? 2 : leadRequestedField === 'email' ? 3 : null;
  const leadStepProgress = leadStep ? (leadStep / 3) * 100 : 0;

  useEffect(() => {
    if (!leadRequestedField) return;
    if (leadStepViewedRef.current === leadRequestedField) return;
    leadStepViewedRef.current = leadRequestedField;
    trackFrontendEvent('lead_capture_step_viewed', { step: leadRequestedField });
  }, [leadRequestedField]);

  const persistentLeadButton = [...messages]
    .flatMap((msg) => msg.botones || [])
    .find((btn) => {
      const candidate = (btn.action_id || btn.action || '').toLowerCase();
      return candidate === 'open_demo_form';
    });

  const validateLeadCaptureInput = useCallback((payload: { text: string; action?: string; action_id?: string }) => {
    if (!leadRequestedField || payload.action || payload.action_id) return null;
    const value = payload.text?.trim() || '';
    if (!value) return null;
    if (leadRequestedField === 'telefono') {
      const digits = value.replace(/\D/g, '');
      if (digits.length < 8) return 'Ingresá un teléfono válido para continuar.';
    }
    if (leadRequestedField === 'email') {
      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
      if (!isEmail) return 'Ingresá un email válido para continuar.';
    }
    trackFrontendEvent('lead_capture_step_completed', { step: leadRequestedField });
    return null;
  }, [leadRequestedField]);

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
          supportChannels={supportChannels}
        />
        <div className="flex-1 overflow-hidden px-4 pb-4">
          <div className="mx-auto flex h-full max-h-[calc(100vh-160px)] w-full max-w-sm flex-col rounded-2xl border border-primary/20 bg-gradient-to-b from-background via-background to-primary/[0.05] p-6 text-center shadow-xl backdrop-blur-sm">
            <img
              src={headerLogoUrl || "/chatboc_logo_clean_transparent.png"}
              alt="Chatboc"
              className="mx-auto h-16 w-16 rounded-2xl border border-primary/20 bg-background p-2 shadow-lg"
              onError={(e) => {
                (e.target as HTMLImageElement).src = "/favicon/favicon-48x48.png";
              }}
            />
            <h2 className="text-xl font-semibold text-primary mt-3">{fallbackRubroTitle}</h2>
            <p className="text-sm text-muted-foreground">{fallbackRubroSubtitle}</p>
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
        supportChannels={supportChannels}
      />
      <div className="px-2 sm:px-4 pt-2">
        <div className="grid grid-cols-3 gap-2 rounded-xl border border-border/70 bg-muted/30 p-2">
          <Button size="sm" variant={channelMode === 'chat' ? 'default' : 'ghost'} onClick={() => setChannelMode('chat')}>
            {supportChannels?.live_chat?.label || 'Chat'}
          </Button>
          {realtimeVoiceEnabled && voiceCallLabel ? (
            <Button size="sm" variant={channelMode === 'voice' ? 'default' : 'ghost'} onClick={() => beginRealtimeSession('voice')}>
              <Phone className="mr-1 h-4 w-4" /> {voiceCallLabel}
            </Button>
          ) : <div />}
          {realtimeVideoEnabled && videoCallLabel ? (
            <Button size="sm" variant={channelMode === 'video' ? 'default' : 'ghost'} onClick={() => beginRealtimeSession('video')}>
              <Video className="mr-1 h-4 w-4" /> {videoCallLabel}
            </Button>
          ) : <div />}
        </div>
      </div>

      {channelMode !== 'chat' ? (
        <div className="px-2 sm:px-4 pt-2">
          <div className="rounded-xl border border-border/70 bg-background/90 p-3">
            <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                {networkLatency === 'good' ? <Wifi className="h-3.5 w-3.5 text-emerald-600" /> : <WifiOff className="h-3.5 w-3.5 text-amber-600" />}
                {networkLatency}
              </span>
              <span>{sessionState}</span>
            </div>

            <div className={cn('mb-3 rounded-lg border p-3', isUserSpeaking ? 'border-primary bg-primary/5' : 'border-border')}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{channelMode === 'video' ? (videoCallLabel || 'video') : (voiceCallLabel || 'voice')}</span>
                {sessionState === 'live' && isUserSpeaking ? <span className="text-xs text-primary">listening</span> : null}
              </div>
              {channelMode === 'video' && realtimeConfig?.avatarEnabled ? (
                <div className="mt-2 flex items-center gap-2 rounded-md bg-muted/60 px-2 py-1 text-xs">
                  <Bot className="h-3.5 w-3.5" />
                  {realtimeConfig?.avatarType || 'robot'} · {realtimeConfig?.avatarPersona || 'default'}
                </div>
              ) : null}
              {assistantSpeaking ? (
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded bg-primary/15">
                  <div className="h-full w-1/2 animate-pulse rounded bg-primary/60" />
                </div>
              ) : null}
            </div>

            <div className="mb-2 flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => setIsMicMuted((prev) => !prev)}>
                {isMicMuted ? <MicOff className="mr-1 h-4 w-4" /> : <Mic className="mr-1 h-4 w-4" />}
                {isMicMuted ? 'Unmute' : 'Mute'}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setCaptionsEnabled((prev) => !prev);
                  emitRealtimeAnalytics('accessibility_caption_enabled', channelMode, { enabled: !captionsEnabled });
                }}
              >
                {captionsEnabled ? <Captions className="mr-1 h-4 w-4" /> : <CaptionsOff className="mr-1 h-4 w-4" />}
                CC
              </Button>
              <Button type="button" size="sm" variant="destructive" onClick={endRealtimeSession}>Finalizar</Button>
            </div>

            {captionsEnabled && transcript.length > 0 ? (
              <div className="space-y-1 rounded-md bg-black px-2 py-1 text-xs font-medium text-white">
                {transcript.map((item) => (
                  <div key={`transcript_${item.id}`} className="opacity-95">
                    <span className="mr-1 uppercase text-[10px] text-white/70">{item.role}</span>
                    <span>{item.text}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
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
      {shouldShowCatalogCard && (catalogViewLabel || catalogDownloadLabel) && (
        <div className="px-2 sm:px-4">
          <CatalogShareCard
            bannerUrl={catalogCard?.bannerUrl}
            viewUrl={catalogCard?.viewUrl}
            downloadUrl={catalogCard?.downloadUrl}
            viewLabel={catalogCard?.viewUrl && catalogViewLabel ? catalogViewLabel : null}
            downloadLabel={catalogCard?.downloadUrl && catalogDownloadLabel ? catalogDownloadLabel : null}
          />
        </div>
      )}
      <div ref={chatContainerRef} className="flex-1 p-2 sm:p-4 min-h-0 flex flex-col gap-3 overflow-y-auto">
        <div className="flex-1" />
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
            messageEnterAnimation={messageEnterAnimation}
            bubbleAnimation={bubbleAnimation}
            logoBadgeStyle={logoBadgeStyle}
          />
        ))}
        {isTyping && (
          <TypingIndicator
            logoUrl={headerLogoUrl}
            logoAnimation={logoAnimation}
            text={typingText}
            typingAnimation={typingAnimation}
            logoBadgeStyle={logoBadgeStyle}
          />
        )}
        {userTyping && <UserTypingIndicator />}
        <div ref={messagesEndRef} />
      </div>
      <ScrollToBottomButton target={chatContainerRef.current} />
      <div className="w-full bg-card px-3 py-2 border-t min-w-0 relative">
        {smartHint && (
           <div className="absolute bottom-full left-0 w-full px-4 pb-2 z-10">
              <div className="bg-amber-50 text-amber-900 p-3 rounded-lg shadow-md flex justify-between items-start gap-2 text-sm border border-amber-200 animate-in slide-in-from-bottom-2 fade-in">
                 <div className="flex gap-2">
                    <Lightbulb className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                    <span>{smartHint}</span>
                 </div>
                 <button onClick={() => setSmartHint(null)} className="text-amber-500 hover:text-amber-700 p-0.5"><X size={14}/></button>
              </div>
           </div>
        )}
        {!activeTicketId ? (
          <div className="mb-2 rounded-md border px-3 py-2 text-xs">
            <span className={cn('font-medium', isLiveChatEnabled ? 'text-emerald-700' : 'text-amber-700')}>{availabilityLabel || (isLiveChatEnabled ? 'Asesores en línea' : 'Te respondemos en horario')}</span>
            {!isLiveChatEnabled && horariosAtencion ? <p className="mt-1 text-muted-foreground">{horariosAtencion}{timezone ? ` · ${timezone}` : ''}</p> : null}
          </div>
        ) : null}

        {!activeTicketId && (
          canRenderLiveChat ? (
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
        {!activeTicketId && canRenderWhatsAppBridge ? (
          <Button onClick={handleWhatsAppBridge} variant="outline" className="w-full mb-2">
            {whatsappButtonLabel}
          </Button>
        ) : null}
        {!activeTicketId && realtimeVoiceEnabled && voiceCallLabel ? (
          <Button onClick={() => beginRealtimeSession('voice')} className="w-full mb-2" variant="secondary">
            {voiceCallLabel}
          </Button>
        ) : null}
        {!activeTicketId && realtimeVideoEnabled && videoCallLabel ? (
          <Button onClick={() => beginRealtimeSession('video')} className="w-full mb-2" variant="outline">
            {videoCallLabel}
          </Button>
        ) : null}
        {sessionState === 'ended' ? (
          <div className="mb-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button size="sm" variant="outline" onClick={() => handleSend({ action: 'send_summary_whatsapp', text: 'Enviar resumen por WhatsApp' })}>
              Enviar resumen por WhatsApp
            </Button>
            <Button size="sm" variant="outline" onClick={() => handleSend({ action: 'send_summary_email', text: 'Enviar resumen por Email' })}>
              Enviar resumen por Email
            </Button>
          </div>
        ) : null}
        <AnimatePresence>
          {leadSuccessTicket ? (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8 }}
              className="mb-2 flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>Lead registrado con éxito. Seguimiento: #{leadSuccessTicket}</span>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {leadStep ? (
          <div className="mb-2 rounded-lg border bg-muted/40 px-3 py-2">
            <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
              <span>Captura de lead</span>
              <span>Paso {leadStep}/3</span>
            </div>
            <div className="h-1.5 rounded bg-muted"><div className="h-1.5 rounded bg-primary transition-all" style={{ width: `${leadStepProgress}%` }} /></div>
          </div>
        ) : null}

        {persistentLeadButton ? (
          <Button
            variant="outline"
            className="mb-2 w-full"
            onClick={() => handleSend({ text: persistentLeadButton.texto, action: persistentLeadButton.action, action_id: persistentLeadButton.action_id, source: 'button' })}
          >
            {persistentLeadButton.texto}
          </Button>
        ) : null}

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
            validateBeforeSend={validateLeadCaptureInput}
          />
        )}
      </div>
    </div>
  );
};

export default ChatPanel;

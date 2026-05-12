import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import ChatHeader from "./ChatHeader";
import type { Prefs } from "./AccessibilityToggle";
import ChatMessage from "./ChatMessage";
import TypingIndicator from "./TypingIndicator";
import UserTypingIndicator from "./UserTypingIndicator";
import ChatInput, { ChatInputHandle } from "./ChatInput";
import RealtimeAvatarStage from "./RealtimeAvatarStage";
import ScrollToBottomButton from "@/components/ui/ScrollToBottomButton";
import { useChatLogic } from "@/hooks/useChatLogic";
import PersonalDataForm from "./PersonalDataForm";
import { Rubro } from "@/types/rubro";
import {
  ChatAnimationTokens,
  ChatConversionCtaAction,
  ChatConversionCtasConfig,
  ChatExperienceBlock,
  ChatExperienceBlueprint,
  ChatLeadCaptureConfig,
  ChatMediaCapabilities,
  ChatUxChannelCapabilities,
  ChatWidgetOnboarding,
  ChatWidgetOnboardingOption,
  ChatWidgetUiHints,
  Message,
} from "@/types/chat";
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
import {
  createLeadCaptureIdempotencyKey,
  submitLeadCapture,
  type LeadCaptureNextAction,
} from "@/features/chat/chatApi";
import { io } from "socket.io-client";
import { getSocketUrl, SOCKET_PATH } from "@/config";
import {
  envelopeMatchesTicket,
  normalizeConversationStreamEvent,
  toRealtimeMessage,
} from "@/utils/conversationStream";
import { safeOn, assertEventSource } from "@/utils/safeOn";
import { readBackendFlag } from "@/utils/backendFlags";
import {
  ArrowRightLeft,
  Loader2,
  X,
  Lightbulb,
  CheckCircle2,
  ImagePlus,
  MapPinned,
  Mic,
  MicOff,
  Captions,
  CaptionsOff,
  Paperclip,
  Sparkles,
  Bot,
  Wifi,
  WifiOff,
  MessageSquare,
  PhoneCall,
  Video,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { getInitialMunicipioContext } from "@/utils/contexto_municipio";
import getOrCreateChatSessionId, { resetChatSessionId } from "@/utils/chatSessionId";
import { getOrCreateAnonId } from "@/utils/anonId";
import { extractSmartHint } from "@/utils/smartHints";
import {
  trackFrontendEvent,
} from "@/utils/frontendTelemetry";
import type { RealtimeVoiceCapabilities } from "@/types/realtimeVoice";
import {
  getRealtimeVoiceBadges,
  getRealtimeVoiceStarters,
  isRealtimeVoiceRenderable,
} from "@/utils/realtimeVoice";
import type { ChatBootstrapConfig } from "@/features/chat/chatTypes";

const PENDING_TICKET_KEY = "pending_ticket_id";
const REALTIME_TOOL_EVENT_NAMES = [
  "chatboc:realtime-tool-call",
  "chatboc:realtime-action",
] as const;

const REALTIME_TOOL_MESSAGE_TYPES = new Set([
  "chatboc:realtime-tool-call",
  "chatboc:realtime-action",
  "CHATBOC_REALTIME_TOOL_CALL",
  "CHATBOC_REALTIME_ACTION",
]);

type FrontendEventName =
  | "realtime_session_started"
  | "realtime_session_failed"
  | "realtime_mode_switched"
  | "avatar_rendered"
  | "accessibility_caption_enabled"
  | "business_action_executed";

const readFirstString = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
};

const normalizeRealtimeToolPayload = (
  raw: unknown,
  fallbackChannel: "voice" | "video",
  fallbackSessionId?: string | null,
) => {
  if (!raw || typeof raw !== "object") return null;
  const source = raw as Record<string, any>;
  const functionPayload =
    source.function && typeof source.function === "object"
      ? source.function
      : {};
  const action = readFirstString(
    source.action,
    source.intent,
    source.name,
    source.tool_name,
    source.tool,
    functionPayload.name,
  );

  if (!action) return null;

  const channel = source.channel === "video" ? "video" : fallbackChannel;
  const status = source.status === "error" ? "error" : "ok";
  const details = {
    ...(source.details && typeof source.details === "object" ? source.details : {}),
    ...(source.payload !== undefined ? { payload: source.payload } : {}),
    ...(source.arguments !== undefined ? { arguments: source.arguments } : {}),
    ...(source.args !== undefined ? { args: source.args } : {}),
    ...(source.call_id || source.callId ? { call_id: source.call_id || source.callId } : {}),
    ...(source.type ? { event_type: source.type } : {}),
  };

  return {
    action,
    channel,
    status,
    sessionId:
      readFirstString(source.session_id, source.sessionId, source.realtime_session_id) ||
      fallbackSessionId ||
      null,
    details,
  };
};

const leadNextActionsToButtons = (actions?: LeadCaptureNextAction[] | null) =>
  (actions ?? [])
    .filter((action) => action.label?.trim())
    .map((action) => ({
      texto: action.label?.trim() || "",
      url: action.endpoint?.trim() || undefined,
      action_id: action.id?.trim() || undefined,
      payload: action.payload ?? undefined,
    }));

const normalizeOnboardingOption = (
  item: unknown,
  index: number,
): ChatWidgetOnboardingOption | null => {
  if (!item) return null;
  if (typeof item === "string") {
    const label = item.trim();
    return label ? { id: `onboarding-${index}`, label } : null;
  }
  if (typeof item !== "object" || Array.isArray(item)) return null;
  const source = item as Record<string, unknown>;
  const label =
    typeof source.label === "string" && source.label.trim()
      ? source.label.trim()
      : typeof source.title === "string" && source.title.trim()
        ? source.title.trim()
        : typeof source.text === "string" && source.text.trim()
          ? source.text.trim()
          : "";
  if (!label) return null;
  const readText = (key: string) =>
    typeof source[key] === "string" && String(source[key]).trim()
      ? String(source[key]).trim()
      : null;
  const payload =
    source.payload && typeof source.payload === "object" && !Array.isArray(source.payload)
      ? (source.payload as Record<string, unknown>)
      : null;
  return {
    id: readText("id") || readText("key") || `onboarding-${index}`,
    label,
    description: readText("description") || readText("subtitle") || readText("detail"),
    cta_label: readText("cta_label") || readText("ctaLabel"),
    intent: readText("intent"),
    sector: readText("sector"),
    tenant_slug: readText("tenant_slug") || readText("tenantSlug"),
    rubro: readText("rubro") || readText("rubro_slug") || readText("rubro_key"),
    payload,
  };
};

const leadCaptureStructuredContent = (response: {
  contract_version?: string | null;
  request_id?: string | null;
  lead_id?: string | number | null;
  ticket_id?: string | number | null;
  ticket_type?: string | null;
  status?: string | null;
  deduplicated?: boolean;
}) =>
  [
    response.contract_version
      ? { label: "Contrato", value: response.contract_version, type: "text" as const }
      : null,
    response.lead_id
      ? { label: "Lead", value: String(response.lead_id), type: "text" as const }
      : null,
    response.ticket_id
      ? { label: "Ticket", value: String(response.ticket_id), type: "text" as const }
      : null,
    response.ticket_type
      ? { label: "Tipo", value: response.ticket_type, type: "text" as const }
      : null,
    response.status
      ? { label: "Estado", value: response.status, type: "text" as const }
      : null,
    response.deduplicated
      ? { label: "Deduplicado", value: "true", type: "badge" as const }
      : null,
    response.request_id
      ? { label: "Req", value: response.request_id, type: "text" as const }
      : null,
  ].filter((item): item is NonNullable<typeof item> => Boolean(item));
const PENDING_GPS_KEY = "pending_gps";
const PENDING_WIDGET_ACTION = "pending_widget_action";

const FRASES_DIRECCION = [
  "indicame la dirección",
  "necesito la dirección",
  "ingresa la dirección",
  "especificá la dirección",
  "decime la dirección",
  "dirección exacta",
  "¿cuál es la dirección?",
  "por favor indique la dirección",
  "por favor ingrese su dirección",
  "dirección completa",
];

const FRASES_EXITO = [
  "Tu reclamo fue generado",
  "¡Muchas gracias por tu calificación!",
  "Dejaré el ticket abierto",
  "El curso de seguridad vial es online",
  "He abierto una sala de chat directa",
  "Tu número de chat es",
  "ticket **M-",
];

const readExperienceTitle = (block?: ChatExperienceBlock | null) =>
  block?.title?.trim() || block?.label?.trim() || block?.text?.trim() || "";

const readExperienceDescription = (block?: ChatExperienceBlock | null) =>
  block?.detail?.trim() || block?.description?.trim() || block?.subtitle?.trim() || "";

const mediaModeEnabled = (capabilities: ChatMediaCapabilities | null | undefined, mode: string) => {
  if (!capabilities) return true;
  const inputMode = capabilities.input_modes?.[mode];
  if (inputMode?.enabled === false) return false;
  if (inputMode?.enabled === true) return true;
  const actions = capabilities.composer?.actions;
  if (!Array.isArray(actions) || actions.length === 0) return true;
  return actions.some((action) => action?.type === mode);
};

const mediaActionLabel = (capabilities: ChatMediaCapabilities | null | undefined, mode: string) => {
  const action = capabilities?.composer?.actions?.find((item) => item?.type === mode);
  return action?.label?.trim() || undefined;
};

const channelCapabilitiesFromMedia = (
  capabilities: ChatMediaCapabilities | null | undefined,
): ChatUxChannelCapabilities | null => {
  if (!capabilities) return null;
  return {
    supports_audio_input: mediaModeEnabled(capabilities, "audio"),
    supports_file_upload: mediaModeEnabled(capabilities, "file"),
    supports_image_input: mediaModeEnabled(capabilities, "image"),
    supports_location_share: mediaModeEnabled(capabilities, "location"),
    audio_input_label: mediaActionLabel(capabilities, "audio"),
    file_upload_label: mediaActionLabel(capabilities, "file"),
    image_input_label: mediaActionLabel(capabilities, "image"),
    location_share_label: mediaActionLabel(capabilities, "location"),
  };
};

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
    live_chat?: {
      realtime?: boolean;
      available?: boolean;
      socket_enabled?: boolean | string | number | null;
      socket_url?: string | null;
      fallback_mode?: string | null;
      media?: Record<string, boolean>;
      label?: string;
    };
    whatsapp?: {
      enabled?: boolean;
      realtime_bridge?: boolean;
      media?: Record<string, boolean>;
      label?: string;
      url?: string;
      action?: string;
    };
    voice_call?: {
      enabled?: boolean;
      provider?: string;
      model?: string;
      fallback_model?: string;
      voice?: string;
      transport?: string;
      profile?: string;
      label?: string;
      capabilities?: RealtimeVoiceCapabilities | null;
      features?: {
        cta_label?: string;
        summary_whatsapp_label?: string;
        summary_email_label?: string;
        captions?: boolean;
        [key: string]: string | number | boolean | null | undefined;
      };
    };
    video_call?: {
      enabled?: boolean;
      provider?: string;
      model?: string;
      label?: string;
      features?: {
        cta_label?: string;
        summary_whatsapp_label?: string;
        summary_email_label?: string;
        captions?: boolean;
        [key: string]: string | number | boolean | null | undefined;
      };
    };
  } | null;
  realtimeConfig?: {
    model?: string;
    fallbackModel?: string;
    voice?: string;
    transport?: string;
    profile?: string;
    voiceEnabled?: boolean;
    videoEnabled?: boolean;
    avatarEnabled?: boolean;
    avatarType?: string;
    avatarPersona?: string;
    voiceLabel?: string;
    videoLabel?: string;
    voiceHandoff?: {
      enabled?: boolean;
      supportsWhatsAppFollowup?: boolean;
      supportsConfirmationCards?: boolean;
      preferredChannels?: string[];
    };
    socketEnabled?: boolean;
    socketUrl?: string | null;
    fallbackMode?: string | null;
  } | null;
  realtimeVoice?: RealtimeVoiceCapabilities | null;
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
  quickMenu?: unknown;
  onboarding?: ChatWidgetOnboarding | null;
  uiHints?: ChatWidgetUiHints | null;
  chatBootstrap?: ChatBootstrapConfig | null;
  onPlatformSelection?: (option: ChatWidgetOnboardingOption) => void | Promise<void>;
  platformSelectionLoadingId?: string | null;
  platformSelectionError?: string | null;
  leadCapture?: ChatLeadCaptureConfig | null;
  mediaCapabilities?: ChatMediaCapabilities | null;
  conversionCtas?: ChatConversionCtasConfig | null;
  animationTokens?: ChatAnimationTokens | null;
  emptyStates?: Record<string, ChatExperienceBlock> | null;
  experienceBlueprint?: ChatExperienceBlueprint | null;
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
    realtimeVoice,
    onA11yChange,
    a11yPrefs,
    catalogCard,
    quickMenu,
    onboarding,
    uiHints,
    chatBootstrap,
    onPlatformSelection,
    platformSelectionLoadingId,
    platformSelectionError,
    leadCapture,
    mediaCapabilities,
    conversionCtas,
    animationTokens,
    emptyStates,
    experienceBlueprint,
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
  const { isLiveChatEnabled, horariosAtencion, availabilityLabel, timezone } =
    useBusinessHours(propEntityToken, tenantSlug);
  const socketRef = useRef<ReturnType<typeof io> | null>(null);

  const skipAuth = mode === "script";
  const liveChatMarkedAvailable = Boolean(
    supportChannels?.live_chat?.available ??
    supportChannels?.live_chat?.realtime,
  );
  const backendSocketEnabled = readBackendFlag(
    realtimeConfig?.socketEnabled ?? supportChannels?.live_chat?.socket_enabled,
    false,
  );
  const backendSocketUrl =
    realtimeConfig?.socketUrl?.trim() ||
    supportChannels?.live_chat?.socket_url?.trim() ||
    null;
  const liveChatIsAvailable = Boolean(
    liveChatMarkedAvailable && backendSocketEnabled,
  );
  const normalizedPropRubro = extractRubroKey(selectedRubro);
  const [localRubro, setLocalRubro] = useState<string | null>(
    () => normalizedPropRubro ?? null,
  );
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
    uxContext,
    addSystemMessage,
    initializeConversation,
  } = useChatLogic({
    tipoChat: tipoChat,
    entityToken: propEntityToken,
    tenantSlug,
    skipAuth,
    selectedRubro: resolvedSelectedRubro,
    liveChatAvailable: liveChatIsAvailable,
    socketEnabled: backendSocketEnabled,
    socketUrlOverride: backendSocketUrl,
    chatBootstrap,
  });
  const visibilityRules = uxContext?.visibility_rules || null;
  const shouldSuppressDemoShell =
    uxContext?.trusted_owner === true &&
    uxContext?.should_render_demo_shell === false;
  const allowRubroSelectorByBackend =
    visibilityRules &&
    Object.prototype.hasOwnProperty.call(visibilityRules, "show_rubro_selector")
      ? Boolean(visibilityRules.show_rubro_selector)
      : true;
  const isBoundTenantContext = Boolean(
    (tenantSlug && tenantSlug.trim()) ||
    (propEntityToken && propEntityToken.trim()),
  );

  const shouldShowCatalogCard = Boolean(
    catalogCard?.viewUrl || catalogCard?.downloadUrl || catalogCard?.bannerUrl,
  );
  const catalogViewLabel = catalogCard?.viewLabel ?? null;
  const catalogDownloadLabel = catalogCard?.downloadLabel ?? null;


  const channelCapabilities = useMemo<ChatUxChannelCapabilities | null>(() => {
    const mediaSource = channelCapabilitiesFromMedia(mediaCapabilities ?? experienceBlueprint?.media_capabilities);
    const source = mediaSource ?? uxContext?.channel_capabilities;
    if (!source) return null;
    return {
      ...(source.supports_audio_input !== undefined
        ? { supports_audio_input: source.supports_audio_input }
        : {}),
      ...(source.supports_file_upload !== undefined
        ? { supports_file_upload: source.supports_file_upload }
        : {}),
      ...(source.supports_image_input !== undefined
        ? { supports_image_input: source.supports_image_input }
        : {}),
      ...(source.supports_location_share !== undefined
        ? { supports_location_share: source.supports_location_share }
        : {}),
      ...(source.supports_realtime !== undefined
        ? { supports_realtime: source.supports_realtime }
        : {}),
      ...(source.audio_input_label ? { audio_input_label: source.audio_input_label } : {}),
      ...(source.file_upload_label ? { file_upload_label: source.file_upload_label } : {}),
      ...(source.image_input_label ? { image_input_label: source.image_input_label } : {}),
      ...(source.location_share_label ? { location_share_label: source.location_share_label } : {}),
      ...(source.realtime_label ? { realtime_label: source.realtime_label } : {}),
    };
  }, [experienceBlueprint?.media_capabilities, mediaCapabilities, uxContext?.channel_capabilities]);
  const recommendedExperience = uxContext?.recommended_experience || null;
  const recommendedExperienceLabel =
    typeof recommendedExperience?.label === "string" && recommendedExperience.label.trim().length > 0
      ? recommendedExperience.label.trim()
      : null;
  const recommendedExperienceSummary =
    typeof recommendedExperience?.summary_text === "string" && recommendedExperience.summary_text.trim().length > 0
      ? recommendedExperience.summary_text.trim()
      : null;
  const websocketRuleRaw = uxContext?.visibility_rules?.allow_websocket;
  const liveChatRuleRaw = uxContext?.visibility_rules?.allow_realtime_live_chat;
  const allowWebsocketFromUx = readBackendFlag(websocketRuleRaw, true);
  const allowRealtimeLiveChatFromUx = readBackendFlag(liveChatRuleRaw, true);
  const socketDisabledByBackend =
    !backendSocketEnabled || !allowWebsocketFromUx || !allowRealtimeLiveChatFromUx;
  const platformOptions = useMemo(() => {
    const source =
      onboarding?.quick_menu && onboarding.quick_menu.length
        ? onboarding.quick_menu
        : Array.isArray(quickMenu)
          ? quickMenu
          : [];
    return source
      .map(normalizeOnboardingOption)
      .filter((item): item is ChatWidgetOnboardingOption => Boolean(item));
  }, [onboarding?.quick_menu, quickMenu]);
  const isPlatformOnboarding =
    onboarding?.mode === "platform_sector_selector" &&
    platformOptions.length > 0 &&
    !chatBootstrap;
  const compactHeaderActions = Boolean(
    isPlatformOnboarding ||
      uiHints?.density === "compact" ||
      uiHints?.toolbar?.avoid_header_action_overload ||
      uiHints?.composer?.icon_buttons_only,
  );
  const collapsedToolbarActions = new Set(uiHints?.toolbar?.collapse ?? []);
  const isToolbarActionCollapsed = (action: string) => collapsedToolbarActions.has(action);
  const collapseExtraQuickReplies = Boolean(
    uiHints && uiHints.collapse_extra_quick_replies !== false,
  );
  const quickReplyLimit =
    typeof uiHints?.max_visible_quick_replies === "number" &&
    uiHints.max_visible_quick_replies > 0
      ? uiHints.max_visible_quick_replies
      : 3;

  const capabilityPills = useMemo(() => {
    if (!channelCapabilities) return [] as Array<{ label: string; icon: React.ElementType }>;
    return [
      channelCapabilities.supports_audio_input && channelCapabilities.audio_input_label
        ? { label: channelCapabilities.audio_input_label, icon: Mic }
        : null,
      channelCapabilities.supports_image_input && channelCapabilities.image_input_label
        ? { label: channelCapabilities.image_input_label, icon: ImagePlus }
        : null,
      channelCapabilities.supports_file_upload && channelCapabilities.file_upload_label
        ? { label: channelCapabilities.file_upload_label, icon: Paperclip }
        : null,
      channelCapabilities.supports_location_share && channelCapabilities.location_share_label
        ? { label: channelCapabilities.location_share_label, icon: MapPinned }
        : null,
      channelCapabilities.supports_realtime && channelCapabilities.realtime_label
        ? { label: channelCapabilities.realtime_label, icon: Wifi }
        : null,
    ].filter((item): item is { label: string; icon: React.ElementType } => Boolean(item));
  }, [channelCapabilities]);

  const preferredHandoffChannels = Array.isArray(recommendedExperience?.preferred_handoff_channels)
    ? recommendedExperience.preferred_handoff_channels
        .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        .map((item) => item.trim())
        .filter((item) => !["widget", "voice"].includes(item.toLowerCase()))
    : [];


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
              action_id: actionData.action_id,
              payload: actionData.payload,
            });
          }, 500);
        }
      } catch (e) {
        console.error("Error parsing pending widget action", e);
      }
    }
  }, [handleSend]);

  const rubrosEnabled = tipoChat === "pyme";
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
        setRubrosError(
          getErrorMessage(error, "No se pudieron cargar los rubros."),
        );
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

    if (!selectedRubro && !localRubro && propEntityToken) {
      const stored = safeLocalStorage.getItem("rubroSeleccionado");
      const storedKey = extractRubroKey(stored);
      if (storedKey) {
        lastInitializedRubro.current = null;
        setLocalRubro(storedKey);
      }
    }
  }, [rubrosEnabled, selectedRubro, localRubro, propEntityToken]);

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
  }, [
    rubrosEnabled,
    localRubro,
    isLoadingRubros,
    rubros.length,
    rubrosError,
    loadRubros,
  ]);

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
  const [direccionGuardada, setDireccionGuardada] = useState<string | null>(
    null,
  );
  const [showCierre, setShowCierre] = useState<{
    show: boolean;
    text: string;
  } | null>(null);
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
    ],
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
  const showRubroSelector =
    rubrosEnabled &&
    !isPlatformOnboarding &&
    !localRubro &&
    allowRubroSelectorByBackend &&
    (!shouldSuppressDemoShell || !isBoundTenantContext);

  const handlePersonalDataSubmit = (data: {
    nombre: string;
    email: string;
    telefono: string;
    dni: string;
  }) => {
    const normalizedName = data?.nombre?.trim();
    handleSend({
      action: "submit_personal_data",
      payload: normalizedName ? { ...data, nombre: normalizedName } : data,
    });
  };

  const { user } = useUser();

  useEffect(() => {
    const stored = safeLocalStorage.getItem("ultima_direccion");
    if (stored) setDireccionGuardada(stored);
  }, []);

  useEffect(() => {
    if (!shouldSuppressDemoShell || !isBoundTenantContext) return;
    if (lastInitializedRubro.current === "__tenant_bound__") return;

    initializeConversation({
      resetContext: true,
      force: true,
    });
    lastInitializedRubro.current = "__tenant_bound__";
  }, [initializeConversation, isBoundTenantContext, shouldSuppressDemoShell]);

  useEffect(() => {
    if (isLiveChatActive && liveChatTicketId) {
      if (socketDisabledByBackend) {
        trackFrontendEvent("socket_fallback_http", {
          ticket_id: liveChatTicketId,
          ticket_type: tipoChat,
          reason: !backendSocketEnabled
            ? "socket_disabled_by_backend"
            : !allowWebsocketFromUx
            ? "websocket_disabled_by_backend"
            : "live_chat_disabled_by_backend",
        });
        return;
      }

      const socketUrl =
        backendSocketUrl ||
        (typeof getSocketUrl === "function"
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
            })());

      if (!socketUrl) {
        console.error("Socket URL no disponible. Se omite la conexión.");
        return;
      }

      const resolveTransportHintKey = (slug?: string | null) =>
        `chatboc_socket_transport_hint:${slug || "default"}`;
      const resolveTransportListKey = (slug?: string | null) =>
        `chatboc_socket_transports:${slug || "default"}`;
      const host =
        typeof window !== "undefined"
          ? window.location.hostname.toLowerCase()
          : "";
      const defaultPollingOnly =
        host === "chatboc.ar" ||
        host.endsWith(".chatboc.ar") ||
        host === "www.chatboc.ar";
      const hint = safeLocalStorage.getItem(
        resolveTransportHintKey(tenantSlug),
      );
      const rawTransportList = safeLocalStorage.getItem(
        resolveTransportListKey(tenantSlug),
      );
      let transports: Array<"polling" | "websocket"> = defaultPollingOnly
        ? ["polling"]
        : ["polling", "websocket"];

      if (rawTransportList) {
        try {
          const parsed = JSON.parse(rawTransportList);
          const valid = Array.isArray(parsed)
            ? parsed.filter(
                (item): item is "polling" | "websocket" =>
                  item === "polling" || item === "websocket",
              )
            : [];
          if (valid.length > 0) {
            transports = valid;
          }
        } catch {
          // keep defaults
        }
      } else if (hint === "polling") {
        transports = ["polling"];
      }

      const socket = io(socketUrl, {
        path: SOCKET_PATH,
        transports,
        reconnectionAttempts: 2,
        reconnectionDelay: 1500,
        timeout: 8000,
      });
      socketRef.current = socket;

      const handleConnectError = (error: unknown) => {
        const lowered = String((error as any)?.message || "").toLowerCase();
        const httpStatus = Number(
          (error as any)?.description?.status ||
            (error as any)?.data?.status ||
            (error as any)?.context?.status,
        );
        if (
          (lowered.includes("xhr poll error") || lowered.includes("500")) &&
          httpStatus === 500
        ) {
          socket.disconnect();
          return;
        }
        if (
          lowered.includes("websocket") ||
          lowered.includes("transport") ||
          lowered.includes("xhr poll error")
        ) {
          const nextTransportHint =
            lowered.includes("websocket") || lowered.includes("transport")
              ? "polling"
              : "websocket";
          safeLocalStorage.setItem(
            resolveTransportHintKey(tenantSlug),
            nextTransportHint,
          );
          safeLocalStorage.setItem(
            resolveTransportListKey(tenantSlug),
            nextTransportHint === "polling"
              ? JSON.stringify(["polling"])
              : JSON.stringify(["websocket", "polling"]),
          );
        }
      };

      const room = `ticket_${tipoChat}_${liveChatTicketId}`;
      let hasJoinedRealtimeRoom = false;
      const joinLiveChatRoom = () => {
        socket.emit("join", { room });
        if (hasJoinedRealtimeRoom) {
          trackFrontendEvent("socket_reconnect", {
            room,
            ticket_id: liveChatTicketId,
            ticket_type: tipoChat,
          });
        }
        hasJoinedRealtimeRoom = true;
      };
      joinLiveChatRoom();

      const appendRealtimeMessage = (envelope: ReturnType<typeof normalizeConversationStreamEvent>) => {
        if (!envelope || !envelopeMatchesTicket(envelope, liveChatTicketId)) {
          return;
        }

        const nextMessage = toRealtimeMessage(envelope);
        if (!nextMessage) return;

        setMessages((prevMessages) => {
          const alreadyExists = prevMessages.some(
            (message) => String(message.id) === String(nextMessage.id),
          );
          if (alreadyExists) {
            trackFrontendEvent("realtime_duplicate_dropped", {
              room,
              ticket_id: liveChatTicketId,
              message_id: nextMessage.id,
            });
            return prevMessages;
          }
          return [...prevMessages, nextMessage];
        });
      };

      const handleIncoming = (data: any) => {
        appendRealtimeMessage(
          normalizeConversationStreamEvent('legacy.new_chat_message', data),
        );
      };

      const handleConversationCreated = (payload: any) => {
        appendRealtimeMessage(
          normalizeConversationStreamEvent('conversation.message.created', payload),
        );
      };
      const handleTicketStatusChanged = (payload: any) => {
        const envelope = normalizeConversationStreamEvent('ticket.status.changed', payload);
        if (!envelope || !envelopeMatchesTicket(envelope, liveChatTicketId)) return;

        const nextStatus = envelope.statusChange?.nextStatus;
        if (!nextStatus) return;
        addSystemMessage(
          `Estado actualizado: ${String(nextStatus).replace(/_/g, " ")}.`,
        );
      };
      const handleTicketAssignmentChanged = (payload: any) => {
        const envelope = normalizeConversationStreamEvent('ticket.assignment.changed', payload);
        if (!envelope || !envelopeMatchesTicket(envelope, liveChatTicketId)) return;

        addSystemMessage(`Asignación actualizada: ${envelope.assignmentChange?.assigneeName || "un responsable"}.`);
      };
      assertEventSource(socket, "socket");
      const ok = safeOn(socket, "new_chat_message", handleIncoming);
      if (!ok) {
        console.warn('No pude suscribirme a "new_chat_message"');
      }
      safeOn(socket, "conversation.message.created", handleConversationCreated);
      safeOn(socket, "ticket.status.changed", handleTicketStatusChanged);
      safeOn(
        socket,
        "ticket.assignment.changed",
        handleTicketAssignmentChanged,
      );
      safeOn(socket, "connect", joinLiveChatRoom);
      safeOn(socket, "connect_error", handleConnectError);

      return () => {
        socket?.off?.("new_chat_message", handleIncoming);
        socket?.off?.(
          "conversation.message.created",
          handleConversationCreated,
        );
        socket?.off?.("ticket.status.changed", handleTicketStatusChanged);
        socket?.off?.(
          "ticket.assignment.changed",
          handleTicketAssignmentChanged,
        );
        socket?.off?.("connect", joinLiveChatRoom);
        socket?.off?.("connect_error", handleConnectError);
        socket?.disconnect?.();
      };
    }
  }, [
    addSystemMessage,
    isLiveChatActive,
    liveChatTicketId,
    tipoChat,
    setMessages,
    tenantSlug,
    socketDisabledByBackend,
    allowWebsocketFromUx,
    backendSocketEnabled,
    backendSocketUrl,
  ]);

  const handleLiveChatRequest = () => {
    handleSend({
      text: "Quisiera hablar con un representante",
      action: "request_agent",
    });
    if (channelMode !== "chat") {
      emitRealtimeAnalytics("business_action_executed", channelMode, {
        action: "request_agent",
      });
      postRealtimeActionEvent({
        channel: channelMode,
        action: "request_agent",
      });
    }
  };

  const handleWhatsAppBridge = () => {
    const configuredAction =
      typeof supportChannels?.whatsapp?.action === "string" && supportChannels.whatsapp.action.trim().length > 0
        ? supportChannels.whatsapp.action.trim()
        : "contact_whatsapp";

    handleSend({
      action: configuredAction,
      payload: { channel: "whatsapp", url: supportChannels?.whatsapp?.url },
    });
  };

  const boolish = (value: unknown): boolean => {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value === 1;
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (["true", "1", "yes", "si", "on", "enabled"].includes(normalized))
        return true;
      if (["false", "0", "no", "off", "disabled"].includes(normalized))
        return false;
    }
    return false;
  };

  const liveChatAllowedByBackend =
    !socketDisabledByBackend &&
    supportChannels?.live_chat?.realtime !== false &&
    supportChannels?.live_chat?.available !== false;
  const canRenderLiveChat = Boolean(
    liveChatAllowedByBackend && isLiveChatEnabled,
  );
  const hasWhatsAppAction = Boolean(
    (typeof supportChannels?.whatsapp?.url === "string" && supportChannels.whatsapp.url.trim().length > 0) ||
      (typeof supportChannels?.whatsapp?.action === "string" && supportChannels.whatsapp.action.trim().length > 0) ||
      boolish(supportChannels?.whatsapp?.realtime_bridge),
  );
  const hasRecommendedWhatsAppHandoff = preferredHandoffChannels.some(
    (channel) => channel.toLowerCase() === "whatsapp",
  );
  const canRenderWhatsAppBridge = Boolean(
    (boolish(supportChannels?.whatsapp?.enabled) && hasWhatsAppAction) ||
      (boolish(realtimeConfig?.voiceHandoff?.enabled) &&
        boolish(realtimeConfig?.voiceHandoff?.supportsWhatsAppFollowup)) ||
      hasRecommendedWhatsAppHandoff,
  );
  const voiceCallConfig = supportChannels?.voice_call;
  const videoCallConfig = supportChannels?.video_call;
  const effectiveRealtimeVoice =
    realtimeVoice || voiceCallConfig?.capabilities || null;
  const realtimeVoiceEnabled = isRealtimeVoiceRenderable(
    effectiveRealtimeVoice,
    voiceCallConfig,
  );
  const realtimeVideoEnabled = Boolean(
    boolish(videoCallConfig?.enabled) &&
      boolish(realtimeConfig?.videoEnabled ?? true),
  );
  const realtimeVoiceBadges = useMemo(
    () => getRealtimeVoiceBadges(effectiveRealtimeVoice),
    [effectiveRealtimeVoice],
  );
  const realtimeVoiceStarters = useMemo(
    () => getRealtimeVoiceStarters(effectiveRealtimeVoice),
    [effectiveRealtimeVoice],
  );
  const [channelMode, setChannelMode] = useState<"chat" | "voice" | "video">(
    "chat",
  );
  const [sessionState, setSessionState] = useState<
    "idle" | "connecting" | "live" | "reconnecting" | "ended"
  >("idle");
  const [captionsEnabled, setCaptionsEnabled] = useState(
    Boolean(voiceCallConfig?.features?.captions),
  );
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [assistantSpeaking, setAssistantSpeaking] = useState(false);
  const [networkLatency, setNetworkLatency] = useState<"good" | "unstable">(
    "good",
  );
  const [transcript, setTranscript] = useState<
    Array<{ id: string; text: string; role: "assistant" | "user" }>
  >([]);
  const [realtimeTimeline, setRealtimeTimeline] = useState<
    Array<{
      id: string;
      message: string;
      tone?: "neutral" | "success" | "warning";
    }>
  >([]);
  const [realtimeSessionId, setRealtimeSessionId] = useState<string | null>(
    null,
  );
  const [realtimeRateLimit, setRealtimeRateLimit] = useState<{
    limit?: string | null;
    window?: string | null;
  }>({});
  const [realtimeErrorCode, setRealtimeErrorCode] = useState<string | null>(
    null,
  );
  const readAvailabilityDismissed = useCallback((key: string) => {
    if (typeof window === "undefined") return false;
    try {
      return window.sessionStorage.getItem(key) === "1";
    } catch {
      return false;
    }
  }, []);
  const writeAvailabilityDismissed = useCallback((key: string) => {
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(key, "1");
    } catch {
      // no-op
    }
  }, []);
  const availabilityDismissKey = React.useMemo(
    () => `chatboc_availability_dismissed:${tenantSlug || "default"}`,
    [tenantSlug],
  );
  const [showAvailabilityNotice, setShowAvailabilityNotice] = useState(() => {
    return !readAvailabilityDismissed("chatboc_availability_dismissed:default");
  });
  useEffect(() => {
    setShowAvailabilityNotice(
      !readAvailabilityDismissed(availabilityDismissKey),
    );
  }, [availabilityDismissKey, readAvailabilityDismissed]);
  const previousChannelModeRef = useRef<"chat" | "voice" | "video">("chat");
  const realtimeSessionRequestRef = useRef(false);

  const pushRealtimeTimeline = useCallback(
    (message: string, tone: "neutral" | "success" | "warning" = "neutral") => {
      setRealtimeTimeline((prev) => [
        ...prev.slice(-8),
        { id: `${Date.now()}_${Math.random()}`, message, tone },
      ]);
    },
    [],
  );

  const emitRealtimeAnalytics = useCallback(
    (
      eventName: FrontendEventName,
      channel: "chat" | "voice" | "video",
      extra?: Record<string, unknown>,
    ) => {
      trackFrontendEvent(eventName, {
        tenant: tenantSlug || "unknown",
        channel,
        session_id: activeTicketId || `rt_${Date.now()}`,
        ...extra,
      });
    },
    [tenantSlug, activeTicketId],
  );

  const postRealtimeActionEvent = useCallback(
    async (payload: {
      channel: "voice" | "video";
      action: string;
      status?: "ok" | "error";
      details?: Record<string, unknown>;
      sessionId?: string | null;
    }) => {
      if (!tenantSlug) return false;
      try {
        await apiFetch("/api/public/realtime/action-event", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          tenantSlug,
          body: JSON.stringify({
            tenant_slug: tenantSlug,
            widget_token: propEntityToken || undefined,
            channel: payload.channel,
            action: payload.action,
            session_id:
              payload.sessionId ||
              realtimeSessionId ||
              activeTicketId ||
              `rt_${Date.now()}`,
            status: payload.status || "ok",
            details: payload.details || {},
          }),
        });
        return true;
      } catch (error) {
        console.warn("[realtime/action-event] failed", error);
        return false;
      }
    },
    [activeTicketId, propEntityToken, realtimeSessionId, tenantSlug],
  );

  const beginRealtimeSession = useCallback(
    async (mode: "voice" | "video") => {
      if (realtimeSessionRequestRef.current) return;
      if (mode === "voice" && !realtimeVoiceEnabled) return;
      if (mode === "video" && !realtimeVideoEnabled) return;
      if (
        sessionState === "connecting" ||
        sessionState === "live" ||
        sessionState === "reconnecting"
      )
        return;

      realtimeSessionRequestRef.current = true;
      setChannelMode(mode);
      setSessionState("connecting");
      setRealtimeErrorCode(null);

      const readRealtimeErrorInfo = (error: unknown) => {
        const maybeStatus = (error as any)?.status;
        const maybeBody = (error as any)?.body;
        const code =
          typeof maybeStatus === "number" || maybeBody
            ? String(
                maybeBody?.reason_code ||
                  maybeBody?.error ||
                  maybeBody?.code ||
                  maybeStatus,
              )
            : null;
        return {
          status: typeof maybeStatus === "number" ? maybeStatus : null,
          code,
          message: getErrorMessage(error, "realtime_session_failed"),
        };
      };

      const requestRealtimeSession = async (requestedMode: "voice" | "video") => {
        const payload = await apiFetch<any>("/api/public/realtime/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tenant_slug: tenantSlug,
            channel: requestedMode,
            model:
              effectiveRealtimeVoice?.recommended_model ||
              realtimeConfig?.model ||
              voiceCallConfig?.model ||
              videoCallConfig?.model ||
              undefined,
            fallback_model:
              effectiveRealtimeVoice?.fallback_model ||
              realtimeConfig?.fallbackModel ||
              voiceCallConfig?.fallback_model ||
              undefined,
            voice:
              effectiveRealtimeVoice?.voice ||
              realtimeConfig?.voice ||
              voiceCallConfig?.voice ||
              undefined,
            transport:
              realtimeConfig?.transport ||
              voiceCallConfig?.transport ||
              effectiveRealtimeVoice?.transports?.browser ||
              undefined,
            profile:
              realtimeConfig?.profile ||
              voiceCallConfig?.profile ||
              effectiveRealtimeVoice?.active_vertical ||
              undefined,
          }),
          tenantSlug: tenantSlug || undefined,
          onResponse: (response) => {
            setRealtimeRateLimit({
              limit: response.headers.get("X-RateLimit-Limit"),
              window: response.headers.get("X-RateLimit-Window"),
            });
          },
        });

        const sessionId =
          payload?.session?.id || payload?.session_id || `rt_${Date.now()}`;
        setRealtimeSessionId(sessionId);
        setSessionState("live");
        setAssistantSpeaking(true);
        pushRealtimeTimeline(sessionId, "success");
        emitRealtimeAnalytics("realtime_session_started", requestedMode, {
          session_id: sessionId,
          model:
            payload?.model ||
            effectiveRealtimeVoice?.recommended_model ||
            realtimeConfig?.model ||
            voiceCallConfig?.model ||
            videoCallConfig?.model,
        });

        if (
          requestedMode === "video" &&
          (payload?.avatar || realtimeConfig?.avatarEnabled)
        ) {
          emitRealtimeAnalytics("avatar_rendered", "video", {
            avatar_type:
              payload?.avatar?.type || realtimeConfig?.avatarType || "robot",
            avatar_persona:
              payload?.avatar?.persona ||
              realtimeConfig?.avatarPersona ||
              null,
          });
        }

        return payload;
      };

      try {
        if (
          mode === "video" &&
          typeof navigator !== "undefined" &&
          navigator.mediaDevices?.getUserMedia
        ) {
          try {
            const stream = await navigator.mediaDevices.getUserMedia({
              video: true,
              audio: true,
            });
            stream.getTracks().forEach((track) => track.stop());
          } catch {
            setChannelMode("voice");
            setSessionState("reconnecting");
            emitRealtimeAnalytics("realtime_mode_switched", "voice", {
              from: "video",
              to: "voice",
              reason: "webcam_unavailable",
            });
            mode = "voice";
          }
        }

        await requestRealtimeSession(mode);
      } catch (error) {
        let errorInfo = readRealtimeErrorInfo(error);
        const shouldFallbackToVoice =
          mode === "video" &&
          realtimeVoiceEnabled &&
          (errorInfo.status === 400 ||
            errorInfo.code === "video_realtime_disabled" ||
            errorInfo.code === "video_disabled" ||
            errorInfo.code === "webcam_unavailable");

        if (shouldFallbackToVoice) {
          setChannelMode("voice");
          setSessionState("reconnecting");
          setRealtimeErrorCode(errorInfo.code);
          pushRealtimeTimeline(errorInfo.code || "video_fallback_voice", "warning");
          emitRealtimeAnalytics("realtime_mode_switched", "voice", {
            from: "video",
            to: "voice",
            reason: errorInfo.code || "video_fallback_voice",
          });
          try {
            await requestRealtimeSession("voice");
            return;
          } catch (fallbackError) {
            errorInfo = readRealtimeErrorInfo(fallbackError);
          }
        }

        setSessionState("ended");
        setChannelMode("chat");
        setRealtimeErrorCode(errorInfo.code);
        pushRealtimeTimeline(
          errorInfo.code || errorInfo.message,
          "warning",
        );
        emitRealtimeAnalytics("realtime_session_failed", mode, {
          error: errorInfo.message,
        });
      } finally {
        realtimeSessionRequestRef.current = false;
      }
    },
    [
      emitRealtimeAnalytics,
      effectiveRealtimeVoice,
      pushRealtimeTimeline,
      realtimeConfig,
      realtimeVideoEnabled,
      realtimeVoiceEnabled,
      sessionState,
      tenantSlug,
      videoCallConfig?.model,
      voiceCallConfig?.fallback_model,
      voiceCallConfig?.model,
      voiceCallConfig?.profile,
      voiceCallConfig?.transport,
      voiceCallConfig?.voice,
    ],
  );

  const endRealtimeSession = useCallback(() => {
    setSessionState("ended");
    setIsUserSpeaking(false);
    setAssistantSpeaking(false);
    if (realtimeSessionId) {
      pushRealtimeTimeline(realtimeSessionId);
    }
  }, [pushRealtimeTimeline, realtimeSessionId]);

  useEffect(() => {
    if (channelMode === "chat" || sessionState !== "live") return;
    const fallbackChannel = channelMode === "video" ? "video" : "voice";

    const dispatchRealtimeTool = (raw: unknown) => {
      const normalized = normalizeRealtimeToolPayload(
        raw,
        fallbackChannel,
        realtimeSessionId,
      );
      if (!normalized) return;

      pushRealtimeTimeline(`registrando:${normalized.action}`);
      emitRealtimeAnalytics("business_action_executed", normalized.channel, {
        action: normalized.action,
        source: "realtime_tool_call",
      });

      void postRealtimeActionEvent({
        channel: normalized.channel,
        action: normalized.action,
        status: normalized.status,
        details: normalized.details,
        sessionId: normalized.sessionId,
      }).then((ok) => {
        pushRealtimeTimeline(
          `${ok ? "confirmado" : "pendiente"}:${normalized.action}`,
          ok ? "success" : "warning",
        );
      });
    };

    const handleCustomEvent = (event: Event) => {
      dispatchRealtimeTool((event as CustomEvent).detail);
    };

    const handleWindowMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== "object") return;
      const type = (data as Record<string, unknown>).type;
      if (typeof type !== "string" || !REALTIME_TOOL_MESSAGE_TYPES.has(type)) {
        return;
      }
      dispatchRealtimeTool(
        (data as Record<string, unknown>).detail ||
          (data as Record<string, unknown>).payload ||
          data,
      );
    };

    REALTIME_TOOL_EVENT_NAMES.forEach((eventName) => {
      window.addEventListener(eventName, handleCustomEvent as EventListener);
    });
    window.addEventListener("message", handleWindowMessage);

    return () => {
      REALTIME_TOOL_EVENT_NAMES.forEach((eventName) => {
        window.removeEventListener(eventName, handleCustomEvent as EventListener);
      });
      window.removeEventListener("message", handleWindowMessage);
    };
  }, [
    channelMode,
    emitRealtimeAnalytics,
    postRealtimeActionEvent,
    pushRealtimeTimeline,
    realtimeSessionId,
    sessionState,
  ]);

  useEffect(() => {
    const previous = previousChannelModeRef.current;
    if (previous !== channelMode) {
      emitRealtimeAnalytics("realtime_mode_switched", channelMode, {
        from: previous,
        to: channelMode,
      });
      pushRealtimeTimeline(`${previous}->${channelMode}`);
      previousChannelModeRef.current = channelMode;
    }
  }, [channelMode, emitRealtimeAnalytics, pushRealtimeTimeline]);

  useEffect(() => {
    if (
      channelMode === "video" &&
      sessionState === "live" &&
      !realtimeVideoEnabled
    ) {
      setChannelMode("voice");
      setSessionState("reconnecting");
      emitRealtimeAnalytics("realtime_mode_switched", "voice", {
        from: "video",
        to: "voice",
        reason: "video_unavailable",
      });
      window.setTimeout(() => setSessionState("live"), 500);
    }
  }, [channelMode, emitRealtimeAnalytics, realtimeVideoEnabled, sessionState]);

  useEffect(() => {
    if (sessionState !== "live") return;

    const evaluateNetwork = () => {
      const online = typeof navigator !== "undefined" ? navigator.onLine : true;
      const rtt = Number((navigator as any)?.connection?.rtt || 0);
      setNetworkLatency(
        !online || (rtt > 0 && rtt >= 300) ? "unstable" : "good",
      );
    };

    evaluateNetwork();
    window.addEventListener("online", evaluateNetwork);
    window.addEventListener("offline", evaluateNetwork);

    return () => {
      window.removeEventListener("online", evaluateNetwork);
      window.removeEventListener("offline", evaluateNetwork);
    };
  }, [sessionState]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.code !== "Space" ||
        channelMode === "chat" ||
        sessionState !== "live" ||
        isMicMuted
      )
        return;
      event.preventDefault();
      setIsUserSpeaking(true);
      setAssistantSpeaking(false);
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (
        event.code !== "Space" ||
        channelMode === "chat" ||
        sessionState !== "live" ||
        isMicMuted
      )
        return;
      setIsUserSpeaking(false);
      setAssistantSpeaking(true);
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [channelMode, isMicMuted, sessionState]);

  const voiceCallLabel = useMemo(() => {
    const candidates = [
      voiceCallConfig?.features?.cta_label,
      voiceCallConfig?.label,
      realtimeConfig?.voiceLabel,
      effectiveRealtimeVoice?.voice ? `Probar llamada IA` : null,
    ];
    for (const candidate of candidates) {
      if (typeof candidate === "string" && candidate.trim())
        return candidate.trim();
    }
    return "Probar llamada IA";
  }, [
    effectiveRealtimeVoice?.voice,
    realtimeConfig?.voiceLabel,
    voiceCallConfig?.features?.cta_label,
    voiceCallConfig?.label,
  ]);

  const videoCallLabel = useMemo(() => {
    const candidates = [
      videoCallConfig?.features?.cta_label,
      videoCallConfig?.label,
      realtimeConfig?.videoLabel,
      realtimeConfig?.avatarPersona,
    ];
    for (const candidate of candidates) {
      if (typeof candidate === "string" && candidate.trim())
        return candidate.trim();
    }
    return null;
  }, [
    realtimeConfig?.avatarPersona,
    realtimeConfig?.videoLabel,
    videoCallConfig?.features?.cta_label,
    videoCallConfig?.label,
  ]);
  const summaryWhatsAppLabel = useMemo(() => {
    const fromVoice = voiceCallConfig?.features?.summary_whatsapp_label;
    const fromVideo = videoCallConfig?.features?.summary_whatsapp_label;
    const candidate =
      typeof fromVoice === "string" && fromVoice.trim() ? fromVoice : fromVideo;
    return typeof candidate === "string" && candidate.trim()
      ? candidate.trim()
      : null;
  }, [
    videoCallConfig?.features?.summary_whatsapp_label,
    voiceCallConfig?.features?.summary_whatsapp_label,
  ]);
  const summaryEmailLabel = useMemo(() => {
    const fromVoice = voiceCallConfig?.features?.summary_email_label;
    const fromVideo = videoCallConfig?.features?.summary_email_label;
    const candidate =
      typeof fromVoice === "string" && fromVoice.trim() ? fromVoice : fromVideo;
    return typeof candidate === "string" && candidate.trim()
      ? candidate.trim()
      : null;
  }, [
    videoCallConfig?.features?.summary_email_label,
    voiceCallConfig?.features?.summary_email_label,
  ]);
  const whatsappButtonLabel =
    typeof supportChannels?.whatsapp?.label === "string" &&
    supportChannels.whatsapp.label.trim()
      ? supportChannels.whatsapp.label.trim()
      : "WhatsApp";
  const handleRealtimeVoiceStarter = useCallback(
    (starter: string) => {
      handleSend({
        text: starter,
        action: "realtime_voice_starter",
        payload: {
          channel: "voice",
          active_vertical: effectiveRealtimeVoice?.active_vertical || null,
        },
      });
      postRealtimeActionEvent({
        channel: "voice",
        action: "realtime_voice_starter",
        details: {
          starter,
          active_vertical: effectiveRealtimeVoice?.active_vertical || null,
        },
      });
    },
    [effectiveRealtimeVoice?.active_vertical, handleSend, postRealtimeActionEvent],
  );
  const chatContentMaxWidthClass = "mx-auto w-full max-w-4xl";

  const handleInternalAction = useCallback(
    async (action: string) => {
      const normalized = action.toLowerCase().replace(/[_\s-]+/g, "");

      if (["login", "loginpanel", "chatuserloginpanel"].includes(normalized)) {
        onShowLogin?.();
        return;
      }
      if (
        ["register", "registerpanel", "chatuserregisterpanel"].includes(
          normalized,
        )
      ) {
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
              description:
                "No se pudo obtener la ubicación. Por favor, revisa los permisos de tu navegador.",
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
      if (channelMode !== "chat") {
        emitRealtimeAnalytics("business_action_executed", channelMode, {
          action: normalized,
        });
        postRealtimeActionEvent({ channel: channelMode, action: normalized });
      }
    },
    [
      channelMode,
      emitRealtimeAnalytics,
      handleSend,
      onShowLogin,
      onShowRegister,
      onCart,
      postRealtimeActionEvent,
      toast,
    ],
  );

  useEffect(() => {
    if (sessionState !== "live") return;
    const latestMessage = messages[messages.length - 1];
    if (!latestMessage?.text) return;
    setTranscript((prev) => {
      const next = [
        ...prev,
        {
          id: latestMessage.id,
          text: latestMessage.text,
          role: latestMessage.isBot ? "assistant" : "user",
        },
      ];
      return next.slice(-8);
    });
  }, [messages, sessionState]);

  useEffect(() => {
    // FORCE SCROLL ON NEW MESSAGE
    // Use a small timeout to allow layout to settle (e.g. images loading)
    const timer = setTimeout(() => {
      if (chatContainerRef.current) {
        const { scrollHeight, scrollTop, clientHeight } =
          chatContainerRef.current;

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
            messagesEndRef.current.scrollIntoView({
              behavior: "auto",
              block: "end",
            });
          }
          // Double check via container scrollTop for robustness
          if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop =
              chatContainerRef.current.scrollHeight;
          }
          setShowScrollDown(false);
        } else {
          // User is scrolled up reading history
          setShowScrollDown(true);
        }
      } else {
        // Fallback if ref is not ready yet
        if (messagesEndRef.current) {
          messagesEndRef.current.scrollIntoView({
            behavior: "auto",
            block: "end",
          });
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
  const lastUserMessage = [...messages].reverse().find((m) => !m.isBot); // Safe find last user message
  const [smartHint, setSmartHint] = useState<string | null>(null);

  useEffect(() => {
    if (!onClose) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (event.defaultPrevented) return;
      onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);
  const [leadSuccessTicket, setLeadSuccessTicket] = useState<string | null>(
    null,
  );
  const leadStepViewedRef = useRef<string | null>(null);

  useEffect(() => {
    const latestWithTicket = [...messages]
      .reverse()
      .find(
        (msg) =>
          msg.isBot &&
          (msg.data as any)?.fuente === "demo_lead_capture" &&
          (msg.data as any)?.nro_ticket,
      );
    const ticket = latestWithTicket
      ? String((latestWithTicket.data as any).nro_ticket)
      : null;
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

  const isAnalyzingImage =
    isTyping && lastUserMessage?.attachmentInfo?.type === "image";
  const typingText = isAnalyzingImage ? "Analizando imagen..." : undefined;

  const latestLeadCaptureMessage = [...messages]
    .reverse()
    .find(
      (msg) => msg.isBot && (msg.data as any)?.fuente === "demo_lead_capture",
    );

  const leadRequestedFieldRaw = (latestLeadCaptureMessage?.data as any)
    ?.pedir_info;
  const leadRequestedField =
    typeof leadRequestedFieldRaw === "string"
      ? leadRequestedFieldRaw.toLowerCase()
      : null;
  const leadStep =
    leadRequestedField === "nombre"
      ? 1
      : leadRequestedField === "telefono"
        ? 2
        : leadRequestedField === "email"
          ? 3
          : null;
  const leadStepProgress = leadStep ? (leadStep / 3) * 100 : 0;

  useEffect(() => {
    if (!leadRequestedField) return;
    if (leadStepViewedRef.current === leadRequestedField) return;
    leadStepViewedRef.current = leadRequestedField;
    trackFrontendEvent("lead_capture_step_viewed", {
      step: leadRequestedField,
    });
  }, [leadRequestedField]);

  const guidedFlow = useMemo(() => {
    const requestedFields = messages
      .filter((msg) => msg.isBot)
      .map((msg) => (msg.data as any)?.pedir_info)
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      .map((value) => value.trim().toLowerCase());

    const dedupedFields = Array.from(new Set(requestedFields));
    const currentField = dedupedFields.length > 0 ? dedupedFields[dedupedFields.length - 1] : null;

    if (!currentField) return null;

    return {
      currentField,
      fields: dedupedFields,
    };
  }, [messages]);
  const supportsMultimodalIntake =
    recommendedExperience?.supports_multimodal_intake !== false;
  const forceDemoComposerTools =
    typeof window !== "undefined" && window.location.pathname.startsWith("/demo");
  const effectiveLeadCapture = leadCapture ?? experienceBlueprint?.lead_capture ?? null;
  const effectiveMediaCapabilities = mediaCapabilities ?? experienceBlueprint?.media_capabilities ?? null;
  const effectiveConversionCtas = conversionCtas ?? experienceBlueprint?.conversion_ctas ?? null;
  const effectiveAnimationTokens = animationTokens ?? experienceBlueprint?.animation_tokens ?? null;
  const motionLevel = effectiveAnimationTokens?.motion_level?.trim() || undefined;
  const effectiveChannelCapabilities = effectiveMediaCapabilities
    ? channelCapabilities
    : forceDemoComposerTools
      ? null
      : channelCapabilities;
  const resolvedEmptyBlock =
    experienceBlueprint?.first_visit ??
    emptyStates?.first_visit ??
    emptyStates?.no_messages ??
    emptyStates?.empty ??
    null;
  const emptyStateTitle =
    readExperienceTitle(resolvedEmptyBlock) || "¿En qué podemos ayudarte?";
  const emptyStateDescription =
    readExperienceDescription(resolvedEmptyBlock) ||
    "Escribí tu consulta abajo o usá las opciones del menú.";
  const sampleConversationBlocks = useMemo(
    () =>
      Array.isArray(experienceBlueprint?.sample_conversations)
        ? experienceBlueprint.sample_conversations.filter(Boolean)
        : [],
    [experienceBlueprint?.sample_conversations],
  );
  const trustSignalBlocks = useMemo(
    () =>
      Array.isArray(experienceBlueprint?.trust_signals)
        ? experienceBlueprint.trust_signals.filter(Boolean)
        : [],
    [experienceBlueprint?.trust_signals],
  );
  const visibleConversionCtas = useMemo(() => {
    const actions = effectiveConversionCtas?.actions ?? [];
    const maxVisible = Number(effectiveConversionCtas?.rules?.max_visible ?? 3);
    return actions.slice(0, Number.isFinite(maxVisible) && maxVisible > 0 ? maxVisible : 3);
  }, [effectiveConversionCtas?.actions, effectiveConversionCtas?.rules?.max_visible]);
  const handleConversionCta = useCallback(
    async (action: ChatConversionCtaAction) => {
      const endpoint = action.endpoint || effectiveLeadCapture?.endpoint || "";
      const shouldPostLead =
        effectiveLeadCapture?.enabled !== false &&
        endpoint.toLowerCase().includes("lead-capture") &&
        (effectiveLeadCapture?.fields?.length ?? 0) === 0;

      if (shouldPostLead) {
        try {
          const chatSessionId = getOrCreateChatSessionId();
          const anonId = getOrCreateAnonId();
          const trigger = action.intent || action.id || "lead_capture";
          const idempotencyKey = createLeadCaptureIdempotencyKey(
            tenantSlug,
            chatSessionId,
            trigger,
          );
          const leadConfig: ChatLeadCaptureConfig = {
            ...(effectiveLeadCapture ?? {}),
            endpoint: endpoint || effectiveLeadCapture?.endpoint || "/api/public/lead-capture",
          };
          const response = await submitLeadCapture(
            leadConfig,
            {
              tenant_slug: tenantSlug ?? undefined,
              tipo_chat: tipoChat,
              chat_session_id: chatSessionId,
              anon_id: anonId || undefined,
              channel: "web",
              source: "widget_chat",
              trigger,
              idempotency_key: idempotencyKey,
              fields: {},
              intent: action.intent ?? undefined,
              cta_id: action.id,
              payload: action.payload ?? undefined,
            },
            tenantSlug,
            { idempotencyKey },
          );
          const success =
            response.message_body?.trim() ||
            effectiveLeadCapture?.success_message?.trim();
          const botones = leadNextActionsToButtons(response.next_actions);
          const structuredContent = leadCaptureStructuredContent(response);
          if (success || botones.length || structuredContent.length) {
            setMessages((prev) => [
              ...prev,
              {
                id: `lead-${Date.now()}`,
                text: success || "",
                isBot: true,
                timestamp: new Date(),
                botones,
                structuredContent,
                data: {
                  fuente: "lead_capture",
                  contract_version: response.contract_version,
                  request_id: response.request_id,
                  deduplicated: response.deduplicated,
                  lead_id: response.lead_id,
                  ticket_id: response.ticket_id,
                  ticket_type: response.ticket_type,
                  status: response.status,
                },
              },
            ]);
          }
          return;
        } catch (error) {
          addSystemMessage(getErrorMessage(error, "No se pudo guardar el seguimiento."), "error");
          return;
        }
      }

      handleSend({
        text: action.label,
        action: action.intent || action.id,
        payload: {
          ...(action.payload ?? {}),
          endpoint: action.endpoint,
        },
        source: "button",
      });
    },
    [addSystemMessage, effectiveLeadCapture, handleSend, setMessages, tenantSlug, tipoChat],
  );

  const persistentLeadButton = [...messages]
    .flatMap((msg) => msg.botones || [])
    .find((btn) => {
      const candidate = (btn.action_id || btn.action || "").toLowerCase();
      return candidate === "open_demo_form";
    });

  const validateLeadCaptureInput = useCallback(
    (payload: { text: string; action?: string; action_id?: string }) => {
      if (!leadRequestedField || payload.action || payload.action_id)
        return null;
      const value = payload.text?.trim() || "";
      if (!value) return null;
      if (leadRequestedField === "telefono") {
        const digits = value.replace(/\D/g, "");
        if (digits.length < 8)
          return "Ingresá un teléfono válido para continuar.";
      }
      if (leadRequestedField === "email") {
        const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
        if (!isEmail) return "Ingresá un email válido para continuar.";
      }
      trackFrontendEvent("lead_capture_step_completed", {
        step: leadRequestedField,
      });
      return null;
    },
    [leadRequestedField],
  );

  if (showRubroSelector) {
    return (
      <div
        data-motion-level={motionLevel}
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
          compactActions={compactHeaderActions}
        />
        <div className="flex-1 overflow-hidden px-4 pb-4">
          <div className="mx-auto flex h-full max-h-[calc(100vh-160px)] w-full max-w-sm flex-col rounded-2xl border border-primary/20 bg-gradient-to-b from-background via-background to-primary/[0.05] p-6 text-center shadow-xl backdrop-blur-sm">
            <img
              src={headerLogoUrl || "/chatboc_logo_clean_transparent.png"}
              alt="Chatboc"
              className="mx-auto h-16 w-16 rounded-2xl border border-primary/20 bg-background p-2 shadow-lg"
              onError={(e) => {
                (e.target as HTMLImageElement).src =
                  "/favicon/favicon-48x48.png";
              }}
            />
            <h2 className="text-xl font-semibold text-primary mt-3">
              {fallbackRubroTitle}
            </h2>
            <p className="text-sm text-muted-foreground">
              {fallbackRubroSubtitle}
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
                {rubros.length > 0 ? (
                  <RubroSelector
                    rubros={rubros}
                    onSelect={handleRubroSelection}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground py-8">
                    No hay rubros disponibles por el momento.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (isPlatformOnboarding) {
    const visibleOptions = platformOptions.slice(0, quickReplyLimit);
    return (
      <div
        role="region"
        aria-label="Chat widget"
        data-motion-level={motionLevel}
        className={cn(
          "chat-root flex h-full w-full flex-col overflow-hidden bg-gradient-to-b from-card via-card to-card/95 text-card-foreground relative",
          isMobile ? undefined : "rounded-[inherit]",
        )}
      >
        <ChatHeader
          onClose={onClose}
          muted={muted}
          logoUrl={headerLogoUrl}
          title={welcomeTitle}
          subtitle={welcomeSubtitle}
          logoAnimation={logoAnimation}
          supportChannels={supportChannels}
          compactActions
        />
        <div className="flex min-h-0 flex-1 items-center justify-center p-4">
          <div className="w-full max-w-[380px] rounded-[8px] border border-border/70 bg-background/92 p-4 shadow-[0_22px_70px_rgba(15,23,42,0.16)] backdrop-blur">
            <div className="mb-4 text-left">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                {onboarding?.title || "Chatboc"}
              </p>
              <h2 className="mt-2 text-xl font-bold leading-tight text-foreground">
                {onboarding?.entry_question || onboarding?.title}
              </h2>
            </div>
            <div className="grid gap-2.5" aria-label="Selector de plataforma">
              {visibleOptions.map((option) => {
                const optionId = option.id || option.sector || option.label || "option";
                const isLoading = platformSelectionLoadingId === optionId;
                return (
                  <button
                    key={optionId}
                    type="button"
                    className="group relative flex min-h-[76px] w-full items-center justify-between gap-3 overflow-hidden rounded-[8px] border border-border/70 bg-card px-3.5 py-3 text-left text-sm font-semibold text-foreground shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-wait disabled:opacity-70"
                    disabled={Boolean(platformSelectionLoadingId)}
                    onClick={() => void onPlatformSelection?.(option)}
                  >
                    <span className="absolute inset-y-0 left-0 w-1 bg-primary/75 opacity-70 transition group-hover:opacity-100" />
                    <span className="min-w-0 pl-1">
                      <span className="block truncate text-[0.95rem]">{option.label}</span>
                      {option.description ? (
                        <span className="mt-1 line-clamp-2 block text-xs font-medium leading-snug text-muted-foreground">
                          {option.description}
                        </span>
                      ) : null}
                    </span>
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
                    ) : (
                      <Sparkles className="h-4 w-4 shrink-0 text-primary/70 transition group-hover:text-primary" />
                    )}
                  </button>
                );
              })}
            </div>
            {platformSelectionError ? (
              <p className="mt-3 rounded-[8px] border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {platformSelectionError}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      role="region"
      aria-label="Chat widget"
      data-motion-level={motionLevel}
      className={cn(
        "chat-root flex flex-col w-full h-full bg-gradient-to-b from-card via-card to-card/95 text-card-foreground overflow-hidden relative",
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
        recommendationLabel={recommendedExperienceLabel}
        compactActions={compactHeaderActions}
      />
      {channelMode !== "chat" ? (
        <div className="px-2 sm:px-4 pt-2">
          <div className={cn(chatContentMaxWidthClass, "rounded-2xl border border-border/70 bg-background/90 p-3 shadow-sm")}>
            <div className="mb-3 grid grid-cols-3 gap-1 rounded-xl border border-border/70 bg-muted/30 p-1">
              <button
                type="button"
                className="rounded-lg px-2 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-background hover:text-foreground"
                onClick={() => {
                  endRealtimeSession();
                  setChannelMode("chat");
                }}
              >
                Chat
              </button>
              <button
                type="button"
                disabled={!realtimeVoiceEnabled}
                className={cn(
                  "rounded-lg px-2 py-1.5 text-xs font-medium transition disabled:opacity-40",
                  channelMode === "voice"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-background hover:text-foreground",
                )}
                onClick={() => {
                  if (!realtimeVoiceEnabled) return;
                  setChannelMode("voice");
                }}
              >
                Llamada
              </button>
              <button
                type="button"
                disabled={!realtimeVideoEnabled}
                className={cn(
                  "rounded-lg px-2 py-1.5 text-xs font-medium transition disabled:opacity-40",
                  channelMode === "video"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-background hover:text-foreground",
                )}
                onClick={() => {
                  if (!realtimeVideoEnabled) return;
                  setChannelMode("video");
                }}
              >
                Video
              </button>
            </div>
            <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                {networkLatency === "good" ? (
                  <Wifi className="h-3.5 w-3.5 text-emerald-600" />
                ) : (
                  <WifiOff className="h-3.5 w-3.5 text-amber-600" />
                )}
                {networkLatency}
              </span>
              <span>{sessionState}</span>
            </div>
            {realtimeErrorCode ? (
              <div className="mb-3 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] text-amber-800">
                {realtimeErrorCode}
              </div>
            ) : null}
            {realtimeRateLimit.limit || realtimeRateLimit.window ? (
              <div className="mb-3 rounded-md border border-border bg-muted/50 px-2 py-1 text-[11px] text-muted-foreground">
                {realtimeRateLimit.limit || "—"} ·{" "}
                {realtimeRateLimit.window || "—"}
              </div>
            ) : null}

            <div className="mb-3">
              <RealtimeAvatarStage
                mode={channelMode === "video" ? "video" : "voice"}
                sessionState={sessionState}
                title={
                  channelMode === "video"
                    ? videoCallLabel || "Video"
                    : voiceCallLabel
                }
                avatarType={realtimeConfig?.avatarType || "robot"}
                avatarPersona={realtimeConfig?.avatarPersona || null}
                logoUrl={headerLogoUrl || null}
                captionsEnabled={captionsEnabled}
                transcript={transcript}
                isUserSpeaking={isUserSpeaking}
                assistantSpeaking={assistantSpeaking}
                isMicMuted={isMicMuted}
                networkLatency={networkLatency}
              />
              {channelMode === "voice" && realtimeVoiceBadges.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {realtimeVoiceBadges.map((badge) => (
                    <span
                      key={badge}
                      className="rounded-md border border-primary/15 bg-primary/5 px-2 py-1 text-[11px] font-medium text-primary"
                    >
                      {badge}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>

            <div
              className={cn(
                "hidden",
                isUserSpeaking
                  ? "border-primary bg-primary/5"
                  : "border-border",
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  {channelMode === "video" ? videoCallLabel : voiceCallLabel}
                </span>
                {sessionState === "live" && isUserSpeaking ? (
                  <span className="text-xs text-primary">•</span>
                ) : null}
              </div>
              {channelMode === "video" && realtimeConfig?.avatarEnabled ? (
                <div className="mt-2 flex items-center gap-2 rounded-md bg-muted/60 px-2 py-1 text-xs">
                  <Bot className="h-3.5 w-3.5" />
                  {realtimeConfig?.avatarType || "robot"} ·{" "}
                  {realtimeConfig?.avatarPersona || "default"}
                </div>
              ) : null}
              {channelMode === "voice" && realtimeVoiceBadges.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {realtimeVoiceBadges.map((badge) => (
                    <span
                      key={badge}
                      className="rounded-md border border-primary/15 bg-primary/5 px-2 py-1 text-[11px] font-medium text-primary"
                    >
                      {badge}
                    </span>
                  ))}
                </div>
              ) : null}
              {assistantSpeaking ? (
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded bg-primary/15">
                  <div className="h-full w-1/2 animate-pulse rounded bg-primary/60" />
                </div>
              ) : null}
            </div>

            <div className="mb-2 flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setIsMicMuted((prev) => !prev)}
              >
                {isMicMuted ? (
                  <MicOff className="mr-1 h-4 w-4" />
                ) : (
                  <Mic className="mr-1 h-4 w-4" />
                )}
                {isMicMuted ? "Unmute" : "Mute"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setCaptionsEnabled((prev) => !prev);
                  emitRealtimeAnalytics(
                    "accessibility_caption_enabled",
                    channelMode,
                    { enabled: !captionsEnabled },
                  );
                }}
              >
                {captionsEnabled ? (
                  <Captions className="mr-1 h-4 w-4" />
                ) : (
                  <CaptionsOff className="mr-1 h-4 w-4" />
                )}
                {captionsEnabled ? "ON" : "OFF"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                onClick={endRealtimeSession}
              >
                Finalizar
              </Button>
            </div>

            {false && captionsEnabled && transcript.length > 0 ? (
              <div className="space-y-1 rounded-md bg-black px-2 py-1 text-xs font-medium text-white">
                {transcript.map((item) => (
                  <div key={`transcript_${item.id}`} className="opacity-95">
                    <span className="mr-1 uppercase text-[10px] text-white/70">
                      {item.role}
                    </span>
                    <span>{item.text}</span>
                  </div>
                ))}
              </div>
            ) : null}
            {realtimeTimeline.length > 0 ? (
              <div className="mt-2 space-y-1">
                {realtimeTimeline.map((item) => (
                  <div
                    key={item.id}
                    className={cn(
                      "rounded-md border px-2 py-1 text-[11px]",
                      item.tone === "success"
                        ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                        : item.tone === "warning"
                          ? "border-amber-300 bg-amber-50 text-amber-800"
                          : "border-border bg-muted/40 text-muted-foreground",
                    )}
                  >
                    {item.message}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
      {(capabilityPills.length > 0 || preferredHandoffChannels.length > 0 || recommendedExperienceLabel || recommendedExperienceSummary) && (
        <div className="px-2 sm:px-4 pt-2">
          <div className={cn(chatContentMaxWidthClass, "rounded-2xl border border-border/70 bg-muted/30 p-3 shadow-sm")}>
            {recommendedExperienceLabel ? (
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Sparkles className="h-4 w-4 text-primary" />
                <span>{recommendedExperienceLabel}</span>
              </div>
            ) : null}
            {recommendedExperienceSummary ? (
              <p className={cn('text-sm text-muted-foreground', recommendedExperienceLabel ? 'mt-1' : '')}>
                {recommendedExperienceSummary}
              </p>
            ) : null}
            {(preferredHandoffChannels.length > 0 || capabilityPills.length > 0) ? (
              <div className={cn('flex flex-wrap gap-2', recommendedExperienceLabel || recommendedExperienceSummary ? 'mt-3' : '')}>
                {preferredHandoffChannels.map((channel) => (
                  <span
                    key={channel}
                    className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700"
                  >
                    <ArrowRightLeft className="h-3.5 w-3.5" />
                    {channel}
                  </span>
                ))}
                {capabilityPills.map((item) => {
                  const Icon = item.icon;
                  return (
                    <span key={item.label} className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/80 px-3 py-1 text-xs font-medium text-foreground">
                      <Icon className="h-3.5 w-3.5 text-primary" />
                      {item.label}
                    </span>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>
      )}

      {onCart &&
        tipoChat === "pyme" &&
        !isToolbarActionCollapsed("catalog") &&
        !shouldShowCatalogCard &&
        (catalogViewLabel || catalogDownloadLabel) && (
        <div className="px-2 sm:px-4 pt-2">
          <div className={cn(chatContentMaxWidthClass, "flex justify-end rounded-xl border bg-muted/40 px-3 py-3")}>
            <Button
              variant="secondary"
              size="sm"
              className="w-full sm:w-auto"
              onClick={handleOpenCatalog}
            >
              {catalogViewLabel || catalogDownloadLabel}
            </Button>
          </div>
        </div>
      )}
      {shouldShowCatalogCard && (catalogViewLabel || catalogDownloadLabel) && (
        <div className="px-2 sm:px-4">
          <div className={chatContentMaxWidthClass}>
            <CatalogShareCard
              bannerUrl={catalogCard?.bannerUrl}
              viewUrl={catalogCard?.viewUrl}
              downloadUrl={catalogCard?.downloadUrl}
              viewLabel={
                catalogCard?.viewUrl && catalogViewLabel ? catalogViewLabel : null
              }
              downloadLabel={
                catalogCard?.downloadUrl && catalogDownloadLabel
                  ? catalogDownloadLabel
                  : null
              }
            />
          </div>
        </div>
      )}
      <div
        ref={chatContainerRef}
        aria-live="polite"
        className={cn(
          chatContentMaxWidthClass,
          "flex-1 p-2 sm:p-4 lg:px-6 min-h-0 flex flex-col gap-3 overflow-y-auto",
        )}
      >
        <div className="flex-1" />

        {messages.length === 0 ? (
             <div className="flex-1 flex flex-col justify-center items-center text-center p-6 mt-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-4">
                   <MessageSquare className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{emptyStateTitle}</h3>
                <p className="text-sm text-muted-foreground mb-8 max-w-[260px]">
                   {emptyStateDescription}
                </p>
                {sampleConversationBlocks.length ? (
                  <div className="mb-4 flex max-w-[320px] flex-wrap justify-center gap-2">
                    {sampleConversationBlocks.map((item, index) => {
                      const label = readExperienceTitle(item);
                      if (!label) return null;
                      return (
                        <Button
                          key={item.id || `${label}-${index}`}
                          size="sm"
                          variant="outline"
                          className="h-auto whitespace-normal text-xs"
                          onClick={() =>
                            handleSend({
                              text: item.text || label,
                              action: item.intent || undefined,
                              payload: item.payload,
                              source: "button",
                            })
                          }
                        >
                          {label}
                        </Button>
                      );
                    })}
                  </div>
                ) : null}
                {trustSignalBlocks.length ? (
                  <div className="flex max-w-[420px] flex-wrap justify-center gap-2 text-left text-xs" aria-label="Senales de confianza">
                    {trustSignalBlocks.map((item, index) => {
                      const label = readExperienceTitle(item);
                      const description = readExperienceDescription(item);
                      if (!label && !description) return null;
                      return (
                        <span
                          key={item.id || `${label}-${index}`}
                          className="inline-flex max-w-full items-center gap-1.5 rounded-full border bg-background/70 px-2.5 py-1"
                        >
                          {label ? <span className="shrink-0 font-medium text-foreground">{label}</span> : null}
                          {description ? <span className="min-w-0 truncate text-muted-foreground">{description}</span> : null}
                        </span>
                      );
                    })}
                  </div>
                ) : null}
             </div>
        ) : (
          <>
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
            maxVisibleQuickReplies={quickReplyLimit}
            collapseExtraQuickReplies={collapseExtraQuickReplies}
          />
        ))}
          </>
        )}
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
      <div className="w-full bg-card/95 px-3 py-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] border-t min-w-0 relative backdrop-blur-sm">
        {smartHint && (
          <div className="absolute bottom-full left-0 w-full px-4 pb-2 z-10">
            <div className="bg-amber-50 text-amber-900 p-3 rounded-lg shadow-md flex justify-between items-start gap-2 text-sm border border-amber-200 animate-in slide-in-from-bottom-2 fade-in">
              <div className="flex gap-2">
                <Lightbulb className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <span>{smartHint}</span>
              </div>
              <button
                onClick={() => setSmartHint(null)}
                className="text-amber-500 hover:text-amber-700 p-0.5"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        )}
        {!activeTicketId && showAvailabilityNotice ? (
          <div className="relative mb-2 rounded-md border px-2.5 py-2 text-xs">
            <span
              className={cn(
                "font-medium",
                isLiveChatEnabled ? "text-emerald-700" : "text-amber-700",
              )}
            >
              {availabilityLabel ||
                (isLiveChatEnabled
                  ? "Asesores en línea"
                  : "Te respondemos en horario")}
            </span>
            {!isLiveChatEnabled && horariosAtencion ? (
              <p className="mt-1 text-muted-foreground pr-5">
                {horariosAtencion}
                {timezone ? ` · ${timezone}` : ""}
              </p>
            ) : null}
            <button
              type="button"
              className="absolute right-2 mt-[-1.1rem] text-muted-foreground hover:text-foreground"
              onClick={() => {
                setShowAvailabilityNotice(false);
                writeAvailabilityDismissed(availabilityDismissKey);
              }}
              aria-label="Cerrar aviso de horario"
            >
              <X size={12} />
            </button>
          </div>
        ) : null}

        {!activeTicketId &&
          (canRenderLiveChat && !isToolbarActionCollapsed("live_chat") ? (
            <Button onClick={handleLiveChatRequest} className="w-full mb-2">
              Hablar con un representante
            </Button>
          ) : null)}
        {!activeTicketId && canRenderWhatsAppBridge && !isToolbarActionCollapsed("whatsapp") ? (
          <Button
            onClick={handleWhatsAppBridge}
            variant="outline"
            className="w-full mb-2"
          >
            {whatsappButtonLabel}
          </Button>
        ) : null}
        {!activeTicketId && realtimeVoiceEnabled && !isToolbarActionCollapsed("voice_call") ? (
          <div className="mb-2 space-y-2 rounded-lg border border-primary/15 bg-primary/5 p-2">
            <Button
              onClick={() => beginRealtimeSession("voice")}
              className="w-full"
              variant="secondary"
            >
              <PhoneCall className="mr-2 h-4 w-4" />
              {voiceCallLabel}
            </Button>
            {realtimeVoiceBadges.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {realtimeVoiceBadges.map((badge) => (
                  <span
                    key={badge}
                    className="rounded-md border border-border/60 bg-background/80 px-2 py-1 text-[11px] text-muted-foreground"
                  >
                    {badge}
                  </span>
                ))}
              </div>
            ) : null}
            {realtimeVoiceStarters.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {realtimeVoiceStarters.slice(0, 3).map((starter) => (
                  <button
                    key={starter}
                    type="button"
                    className="rounded-md border border-border/70 bg-background px-2 py-1 text-[11px] font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5"
                    onClick={() => handleRealtimeVoiceStarter(starter)}
                  >
                    {starter}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
        {!activeTicketId && realtimeVideoEnabled && !isToolbarActionCollapsed("video_call") ? (
          <Button
            onClick={() => beginRealtimeSession("video")}
            className="w-full mb-2"
            variant="outline"
          >
            <Video className="mr-2 h-4 w-4" />
            {videoCallLabel || "Video"}
          </Button>
        ) : null}
        {sessionState === "ended" ? (
          <div className="mb-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {summaryWhatsAppLabel ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  handleSend({
                    action: "send_summary_whatsapp",
                    text: summaryWhatsAppLabel,
                  });
                  if (channelMode !== "chat") {
                    postRealtimeActionEvent({
                      channel: channelMode,
                      action: "send_summary_whatsapp",
                    });
                  }
                }}
              >
                {summaryWhatsAppLabel}
              </Button>
            ) : null}
            {summaryEmailLabel ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  handleSend({
                    action: "send_summary_email",
                    text: summaryEmailLabel,
                  });
                  if (channelMode !== "chat") {
                    postRealtimeActionEvent({
                      channel: channelMode,
                      action: "send_summary_email",
                    });
                  }
                }}
              >
                {summaryEmailLabel}
              </Button>
            ) : null}
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
              <span>
                Lead registrado con éxito. Seguimiento: #{leadSuccessTicket}
              </span>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {leadStep ? (
          <div className="mb-2 rounded-lg border bg-muted/40 px-3 py-2">
            <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
              <span>Captura de lead</span>
              <span>Paso {leadStep}/3</span>
            </div>
            <div className="h-1.5 rounded bg-muted">
              <div
                className="h-1.5 rounded bg-primary transition-all"
                style={{ width: `${leadStepProgress}%` }}
              />
            </div>
          </div>
        ) : null}

        {visibleConversionCtas.length ? (
          <div className="mb-2 flex flex-wrap gap-2" aria-label="Acciones sugeridas">
            {visibleConversionCtas.map((action) => (
              <Button
                key={action.id}
                size="sm"
                variant={action.style === "primary" || action.style === "accent" ? "default" : "outline"}
                className="h-auto whitespace-normal text-xs"
                onClick={() => void handleConversionCta(action)}
              >
                {action.label}
              </Button>
            ))}
          </div>
        ) : null}

        {persistentLeadButton ? (
          <Button
            variant="outline"
            className="mb-2 w-full"
            onClick={() =>
              handleSend({
                text: persistentLeadButton.texto,
                action: persistentLeadButton.action,
                action_id: persistentLeadButton.action_id,
                source: "button",
              })
            }
          >
            {persistentLeadButton.texto}
          </Button>
        ) : null}

        {contexto.estado_conversacion === "recolectando_datos_personales" ? (
          <PersonalDataForm
            onSubmit={handlePersonalDataSubmit}
            isSubmitting={isTyping}
          />
        ) : (
          <ChatInput
            ref={chatInputHandleRef}
            onSendMessage={handleSend}
            isTyping={isTyping}
            inputRef={chatInputTextRef}
            onTypingChange={setUserTyping}
            onSystemMessage={addSystemMessage}
            validateBeforeSend={validateLeadCaptureInput}
            channelCapabilities={effectiveChannelCapabilities}
            mediaCapabilities={effectiveMediaCapabilities}
            uiHints={uiHints}
            guidedFlow={guidedFlow}
            supportsMultimodalIntake={supportsMultimodalIntake}
          />
        )}
      </div>
    </div>
  );
};

export default ChatPanel;

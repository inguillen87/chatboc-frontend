// src/hooks/useChatLogic.ts
import { useState, useEffect, useRef, useCallback } from "react";
import {
  Message,
  SendPayload as TypeSendPayload,
  Categoria,
  StructuredContentItem,
  Post,
  ChatUxContext,
} from "@/types/chat";
import { io, Socket } from "socket.io-client";
import { getSocketUrl, SOCKET_PATH } from "@/config";
import { apiFetch, getErrorMessage } from "@/utils/api";
import { getAskEndpoint, parseRubro } from "@/utils/chatEndpoints";
import { extractRubroKey } from "@/utils/rubros";
import { enforceTipoChatForRubro } from "@/utils/tipoChat";
import { safeLocalStorage } from "@/utils/safeLocalStorage";
import getOrCreateChatSessionId from "@/utils/chatSessionId";
import { getIframeToken } from "@/utils/config";
import { v4 as uuidv4 } from "uuid";
import {
  MunicipioContext,
  updateMunicipioContext,
  getInitialMunicipioContext,
} from "@/utils/contexto_municipio";
import { useUser } from "./useUser";
import { safeOn, assertEventSource } from "@/utils/safeOn";
import { getVisitorName, setVisitorName } from "@/utils/visitorName";
import {
  ensureAbsoluteUrl,
  mergeButtons,
  pickFirstString,
} from "@/utils/chatButtons";
import { deriveAttachmentInfo } from "@/utils/attachment";
import { getValidStoredToken } from "@/utils/authTokens";
import { enterpriseService } from "@/services/enterpriseService";
import { trackWidgetEvent } from "@/utils/widgetTelemetry";

const PUBLIC_CHAT_CONTEXT_KEY = "chatboc_public_chat_context";

const clearStoredPublicChatContext = () => {
  try {
    safeLocalStorage.removeItem(PUBLIC_CHAT_CONTEXT_KEY);
  } catch {
    // no-op
  }
};

const readStoredPublicChatContext = () => {
  try {
    const raw = safeLocalStorage.getItem(PUBLIC_CHAT_CONTEXT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
};

const EMOJI_CATEGORY_MAP: Record<string, string> = {
  // Agua y saneamiento
  "💧": "agua",
  "💦": "agua",
  "🌊": "agua",
  "🌧️": "agua",
  "🚰": "agua",
  "🚱": "agua",
  // Arbolado y espacios verdes
  "🌳": "arbolado",
  "🌲": "arbolado",
  "🌴": "arbolado",
  "🍃": "arbolado",
  // Fuego y emergencias
  "🔥": "fuego",
  "🚒": "fuego",
  "🧯": "fuego",
  // Animales
  "🐶": "animales",
  "🐱": "animales",
  "🐾": "animales",
  "🐕": "animales",
  // Limpieza y residuos
  "🚮": "limpieza",
  "🧹": "limpieza",
  "🗑️": "limpieza",
  "🧽": "limpieza",
};

const findCategoryFromEmoji = (text: string): string | undefined => {
  return Object.entries(EMOJI_CATEGORY_MAP).find(([emoji]) =>
    text.includes(emoji),
  )?.[1];
};

const LIVE_CHAT_STATUSES = new Set(["esperando_agente_en_vivo", "en_vivo"]);

const HIGH_INTENT_PATTERNS = [
  "hablar con un representante",
  "hablar con un agente",
  "hablar con ventas",
  "quiero comprar",
  "necesito asesor",
  "cotizacion",
  "cotización",
  "presupuesto",
  "contacto",
  "whatsapp",
];

const URGENT_PATTERNS = [
  "urgente",
  "emergencia",
  "ahora",
  "ya",
  "inmediato",
  "prioridad",
];

interface UseChatLogicOptions {
  tipoChat: "pyme" | "municipio";
  entityToken?: string;
  tenantSlug?: string | null;
  tokenKey?: string;
  skipAuth?: boolean;
  selectedRubro?: string | null;
  liveChatAvailable?: boolean;
}

export function useChatLogic({
  tipoChat,
  entityToken: propToken,
  tenantSlug,
  tokenKey = "authToken",
  skipAuth = false,
  selectedRubro = null,
  liveChatAvailable = false,
	}: UseChatLogicOptions) {
  const entityToken = propToken || getIframeToken();

  const shouldUsePublicFlow = useCallback(
    (
      resolvedTipoChat: "pyme" | "municipio",
      resolvedTenantSlug?: string | null,
    ) => {
      if (resolvedTipoChat !== "municipio") return false;

      const normalizedTenant =
        typeof resolvedTenantSlug === "string"
          ? resolvedTenantSlug.trim().toLowerCase()
          : "";
      const isMunicipioTenant = normalizedTenant === "municipio";
      const hasAuthToken = Boolean(
        safeLocalStorage.getItem("authToken") ||
        safeLocalStorage.getItem("chatAuthToken") ||
        safeLocalStorage.getItem(tokenKey),
      );

      return (
        isMunicipioTenant ||
        (!entityToken && !normalizedTenant && !hasAuthToken)
      );
    },
    [entityToken, tokenKey],
  );
  const { user } = useUser();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [contexto, setContexto] = useState<MunicipioContext>(() =>
    getInitialMunicipioContext(),
  );
  const [activeTicketId, setActiveTicketId] = useState<number | null>(null);
  const [liveChatTicketId, setLiveChatTicketId] = useState<number | null>(null);
  const [liveChatStatus, setLiveChatStatus] = useState<string | null>(null);
  const [currentClaimIdempotencyKey, setCurrentClaimIdempotencyKey] = useState<
    string | null
  >(null);
  const [uxContext, setUxContext] = useState<ChatUxContext | null>(null);
  const messagesRef = useRef<Message[]>([]);
  const initSentRef = useRef(false);
  const initPendingResponseRef = useRef(false);
  const firstRealQuestionSentRef = useRef(false);
  const leadCompletionTrackedTicketsRef = useRef<Set<string>>(new Set());
  const lastUxTelemetryStateRef = useRef<string | null>(null);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

	  const sanitizeRubroValue = (value: unknown): string | null => {
    const key = extractRubroKey(value);
    return key && key.length > 0 ? key : null;
	  };

  const resolvePersistentPublicContext = useCallback(() => {
    const storedContext = readStoredPublicChatContext();
    if (!storedContext) return null;

    const normalizedPin = pickFirstString(
      storedContext.pin,
      storedContext.consulta_pin,
      storedContext.consultaPin,
    )?.trim();
    const ticketNumber = pickFirstString(
      storedContext.ticketNumber,
      storedContext.ticket_number,
      storedContext.nro_ticket,
    )?.trim();
    const ticketId = storedContext.ticketId ?? storedContext.ticket_id ?? null;

    if (!normalizedPin && !ticketNumber && !ticketId) return null;

    return {
      pin: normalizedPin || undefined,
      consulta_pin: normalizedPin || undefined,
      ticket_id: ticketId ?? undefined,
      ticket_number: ticketNumber || undefined,
    };
  }, []);

  const resolvePersistentPublicContext = useCallback(() => {
    const storedContext = readStoredPublicChatContext();
    if (!storedContext) return null;

    const normalizedPin = pickFirstString(
      storedContext.pin,
      storedContext.consulta_pin,
      storedContext.consultaPin,
    )?.trim();
    const ticketNumber = pickFirstString(
      storedContext.ticketNumber,
      storedContext.ticket_number,
      storedContext.nro_ticket,
    )?.trim();
    const ticketId = storedContext.ticketId ?? storedContext.ticket_id ?? null;

    if (!normalizedPin && !ticketNumber && !ticketId) return null;

    return {
      pin: normalizedPin || undefined,
      consulta_pin: normalizedPin || undefined,
      ticket_id: ticketId ?? undefined,
      ticket_number: ticketNumber || undefined,
    };
  }, []);

  const resolvePersistentPublicContext = useCallback(
    (
      resolvedTipoChat: "pyme" | "municipio",
      resolvedTenantSlug?: string | null,
    ) => {
      if (!shouldUsePublicFlow(resolvedTipoChat, resolvedTenantSlug)) {
        clearStoredPublicChatContext();
        return null;
      }

    const storedContext = readStoredPublicChatContext();
    if (!storedContext) return null;

      const storedTipoChat = pickFirstString(
        storedContext.tipoChat,
        storedContext.tipo_chat,
      )?.trim();
      const storedTenantSlug = pickFirstString(
        storedContext.tenantSlug,
        storedContext.tenant_slug,
      )?.trim();
      const normalizedResolvedTenant =
        typeof resolvedTenantSlug === "string" ? resolvedTenantSlug.trim() : "";

      if (
        storedTipoChat &&
        storedTipoChat !== resolvedTipoChat
      ) {
        clearStoredPublicChatContext();
        return null;
      }

      if (
        storedTenantSlug &&
        normalizedResolvedTenant &&
        storedTenantSlug !== normalizedResolvedTenant
      ) {
        clearStoredPublicChatContext();
        return null;
      }

    const normalizedPin = pickFirstString(
      storedContext.pin,
      storedContext.consulta_pin,
      storedContext.consultaPin,
    )?.trim();
    const ticketNumber = pickFirstString(
      storedContext.ticketNumber,
      storedContext.ticket_number,
      storedContext.nro_ticket,
    )?.trim();
    const ticketId = storedContext.ticketId ?? storedContext.ticket_id ?? null;

    if (!normalizedPin && !ticketNumber && !ticketId) return null;

    return {
      pin: normalizedPin || undefined,
      consulta_pin: normalizedPin || undefined,
      ticket_id: ticketId ?? undefined,
      ticket_number: ticketNumber || undefined,
    };
    },
    [shouldUsePublicFlow],
  );

  const initializeConversation = useCallback(
    async (options?: {
      rubroOverride?: string | null;
      resetContext?: boolean;
      resetMessages?: boolean;
      force?: boolean;
    }) => {
      if (!options?.force && messagesRef.current.length > 0) {
        return;
      }

      if (initSentRef.current || initPendingResponseRef.current) {
        return;
      }

      const allowRubroInference = tipoChat !== "municipio";

      let rawRubro = sanitizeRubroValue(options?.rubroOverride);
      if (!rawRubro) {
        rawRubro = sanitizeRubroValue(selectedRubro);
      }

      if (allowRubroInference && !rawRubro) {
        try {
          const storedUser = JSON.parse(
            safeLocalStorage.getItem("user") || "null",
          );
          rawRubro =
            sanitizeRubroValue(storedUser?.rubro) ||
            sanitizeRubroValue(storedUser?.rubro?.clave) ||
            sanitizeRubroValue(storedUser?.rubro?.nombre) ||
            null;
        } catch {
          rawRubro = null;
        }
      }

      if (allowRubroInference && !rawRubro) {
        rawRubro = sanitizeRubroValue(
          safeLocalStorage.getItem("rubroSeleccionado"),
        );
      }

      const normalizedRubro = rawRubro ? parseRubro(rawRubro) : null;
      const tipoChatFinal = enforceTipoChatForRubro(
        tipoChat,
        normalizedRubro || undefined,
      );
      const rubroForPayload = tipoChatFinal === "pyme" ? rawRubro : null;

      const isBoundTenantContext = Boolean(
        (typeof tenantSlug === "string" && tenantSlug.trim()) ||
        (typeof entityToken === "string" && entityToken.trim()),
      );

      if (
        tipoChatFinal === "pyme" &&
        !rubroForPayload &&
        !isBoundTenantContext
      ) {
        console.log(
          "useChatLogic: Rubro no seleccionado para chat pyme, se omite el saludo inicial.",
        );
        setIsTyping(false);
        return;
      }

      if (options?.resetMessages) {
        setMessages([]);
        setActiveTicketId(null);
        setLiveChatTicketId(null);
        setLiveChatStatus(null);
        seenMessageFingerprintsRef.current.clear();
      }

      const shouldResetContext =
        options?.resetContext ?? messagesRef.current.length === 0;
      const contextToSend = shouldResetContext
        ? getInitialMunicipioContext()
        : contexto;
      if (shouldResetContext) {
        setContexto(contextToSend);
        seenMessageFingerprintsRef.current.clear();
      }

      const visitorName = getVisitorName();
      const endpoint = getAskEndpoint({
        tipoChat: tipoChatFinal,
        rubro: normalizedRubro || null,
      });

      console.log("useChatLogic: Enviando saludo inicial", {
        endpoint,
        tipoChatFinal,
        rubroForPayload,
      });

      const sessionId = getOrCreateChatSessionId();

      setIsTyping(true);
      initSentRef.current = true;
      initPendingResponseRef.current = true;

      const isPublicDemo = shouldUsePublicFlow(tipoChatFinal, tenantSlug);
      const effectiveSkipAuth = skipAuth || isPublicDemo;

      try {
        const publicChatContext = resolvePersistentPublicContext(
          tipoChatFinal,
          tenantSlug,
        );
        const response = await apiFetch<any>(endpoint, {
          method: "POST",
          skipAuth: effectiveSkipAuth,
          isWidgetRequest: true,
          tenantSlug: tenantSlug,
          entityToken,
          body: {
            pregunta: "__INIT__",
            action: "initial_greeting",
            contexto_previo: contextToSend,
            tipo_chat: tipoChatFinal,
            tenant_slug: tenantSlug ?? "municipio",
            session_id: sessionId,
            ...(publicChatContext || {}),
            ...(rubroForPayload && { rubro_clave: rubroForPayload }),
            ...(visitorName && { nombre_usuario: visitorName }),
          },
        });
        console.log("useChatLogic: Initial greeting response", response);
        processBotPayload(response, {
          fallbackOnEmpty: !socketRef.current || !socketRef.current.connected,
          fromInit: true,
        });
      } catch (error) {
        console.error(
          "Error sending initial greeting:",
          getErrorMessage(error),
        );
        const errorMsg = getErrorMessage(
          error,
          "⚠️ No se pudo cargar el menú inicial.",
        );
        setMessages((prev) => [
          ...prev,
          {
            id: generateClientMessageId(),
            text: errorMsg,
            isBot: true,
            timestamp: new Date(),
            isError: true,
          },
        ]);
        setIsTyping(false);
        initPendingResponseRef.current = false;
      } finally {
        initSentRef.current = false;
      }
    },
    [
      contexto,
      selectedRubro,
      skipAuth,
      tipoChat,
      tenantSlug,
      entityToken,
      shouldUsePublicFlow,
      resolvePersistentPublicContext,
    ],
  );

  const initializeConversationRef = useRef(initializeConversation);

  useEffect(() => {
    initializeConversationRef.current = initializeConversation;
  }, [initializeConversation]);

  useEffect(() => {
    if (
      messagesRef.current.length > 0 ||
      initSentRef.current ||
      initPendingResponseRef.current
    )
      return;

    const bootstrapTimer = setTimeout(() => {
      if (
        messagesRef.current.length > 0 ||
        initSentRef.current ||
        initPendingResponseRef.current
      )
        return;
      initializeConversationRef.current?.({ resetContext: true });
    }, 180);

    return () => clearTimeout(bootstrapTimer);
  }, [tipoChat, tenantSlug, selectedRubro]);

  const token = skipAuth ? null : getValidStoredToken(tokenKey);
  const isAnonimo = skipAuth || !token;

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const ultimoMensajeIdRef = useRef<number>(0);
  const clientMessageIdCounter = useRef(0);
  const leadCaptureSentRef = useRef(false);

  const generateClientMessageId = () => {
    clientMessageIdCounter.current += 1;
    return `client-${Date.now()}-${clientMessageIdCounter.current}`;
  };

  const socketRef = useRef<Socket | null>(null);
  const seenMessageFingerprintsRef = useRef<Set<string>>(new Set());

  const serializeButtons = (btns: any[] | undefined) =>
    (btns || []).map((btn) => [
      btn?.texto ?? btn?.text ?? btn?.label ?? btn?.title ?? "",
      btn?.action ?? btn?.url ?? btn?.link ?? btn?.value ?? "",
      btn?.payload ? JSON.stringify(btn.payload) : "",
    ]);

  const serializeCategories = (cats: Categoria[] | undefined) =>
    (cats || []).map((cat) => ({
      titulo: cat?.titulo ?? "",
      botones: serializeButtons(cat?.botones),
    }));

  const buildMessageFingerprint = ({
    messageIdCandidate,
    text,
    mediaUrl,
    audioUrlValue,
    attachmentInfo,
    messageType,
    action,
    dataPayload,
    structuredContent,
    listItems,
    posts,
    socialLinks,
    displayHint,
    chatBubbleStyle,
    botones,
    categorias,
  }: {
    messageIdCandidate: unknown;
    text: string | undefined;
    mediaUrl?: string;
    audioUrlValue?: string;
    attachmentInfo?: Message["attachmentInfo"];
    messageType?: string;
    action?: string;
    dataPayload?: unknown;
    structuredContent?: StructuredContentItem[];
    listItems?: string[];
    posts?: Post[];
    socialLinks?: Record<string, string>;
    displayHint?: Message["displayHint"];
    chatBubbleStyle?: Message["chatBubbleStyle"];
    botones: any[];
    categorias: Categoria[];
  }) => {
    if (
      typeof messageIdCandidate === "string" ||
      typeof messageIdCandidate === "number"
    ) {
      return `id:${messageIdCandidate}`;
    }

    const serializedAttachment = attachmentInfo
      ? JSON.stringify(attachmentInfo)
      : "";
    const serializedPayload = dataPayload ? JSON.stringify(dataPayload) : "";
    const serializedStructured = structuredContent
      ? JSON.stringify(structuredContent)
      : "";
    const serializedList = listItems ? JSON.stringify(listItems) : "";
    const serializedPosts = posts
      ? JSON.stringify(
          posts.map((p) => [
            (p as any)?.id ?? (p as any)?.post_id ?? "",
            p.url ?? (p as any)?.enlace ?? (p as any)?.link ?? "",
            (p as any)?.titulo ?? (p as any)?.title ?? "",
          ]),
        )
      : "";
    const serializedSocial = socialLinks
      ? JSON.stringify(
          Object.entries(socialLinks).sort((a, b) => a[0].localeCompare(b[0])),
        )
      : "";

    return [
      "fp",
      text?.trim() || "",
      mediaUrl || "",
      audioUrlValue || "",
      serializedAttachment,
      messageType || "",
      action || "",
      serializedPayload,
      serializedStructured,
      serializedList,
      serializedPosts,
      serializedSocial,
      displayHint || "",
      chatBubbleStyle || "",
      JSON.stringify(serializeButtons(botones)),
      JSON.stringify(serializeCategories(categorias)),
    ].join("|");
  };

  const processBotPayload = (
    rawPayload: any,
    {
      fallbackOnEmpty,
      fromInit = false,
    }: { fallbackOnEmpty: boolean; fromInit?: boolean },
  ): boolean => {
    if (!rawPayload) {
      console.warn("useChatLogic: Received empty payload from backend.");
      if (fromInit) {
        initPendingResponseRef.current = false;
        initSentRef.current = false;
      }
      if (fallbackOnEmpty) {
        setIsTyping(false);
      }
      return false;
    }

    setContexto((prevContext) =>
      updateMunicipioContext(prevContext, { llmResponse: rawPayload }),
    );

    const candidateUxContext = (() => {
      const source = Array.isArray(rawPayload)
        ? rawPayload.find(
            (item) => item?.ux_context || item?.metadata?.ux_context,
          )
        : rawPayload;
      const rawUx = source?.ux_context || source?.metadata?.ux_context;
      if (!rawUx || typeof rawUx !== "object") return null;
      const trustedOwner =
        typeof rawUx.trusted_owner === "boolean"
          ? rawUx.trusted_owner
          : undefined;
      const ownerTipoChat =
        pickFirstString(rawUx.owner_tipo_chat, rawUx.ownerTipoChat) ||
        undefined;
      const ownerName =
        pickFirstString(rawUx.owner_name, rawUx.ownerName) || undefined;
      const shouldRenderDemoShell =
        typeof rawUx.should_render_demo_shell === "boolean"
          ? rawUx.should_render_demo_shell
          : typeof rawUx.shouldRenderDemoShell === "boolean"
            ? rawUx.shouldRenderDemoShell
            : undefined;
      const demoSelector =
        rawUx.demo_selector && typeof rawUx.demo_selector === "object"
          ? rawUx.demo_selector
          : rawUx.demoSelector && typeof rawUx.demoSelector === "object"
            ? rawUx.demoSelector
            : null;
      const suggestedNextActions = Array.isArray(rawUx.suggested_next_actions)
        ? rawUx.suggested_next_actions
        : Array.isArray(rawUx.suggestedNextActions)
          ? rawUx.suggestedNextActions
          : undefined;
      const visibilityRules =
        rawUx.visibility_rules && typeof rawUx.visibility_rules === "object"
          ? rawUx.visibility_rules
          : rawUx.visibilityRules && typeof rawUx.visibilityRules === "object"
            ? rawUx.visibilityRules
            : undefined;
      return {
        ...(trustedOwner !== undefined ? { trusted_owner: trustedOwner } : {}),
        ...(ownerTipoChat ? { owner_tipo_chat: ownerTipoChat } : {}),
        ...(ownerName ? { owner_name: ownerName } : {}),
        ...(shouldRenderDemoShell !== undefined
          ? { should_render_demo_shell: shouldRenderDemoShell }
          : {}),
        ...(demoSelector ? { demo_selector: demoSelector } : {}),
        ...(suggestedNextActions
          ? { suggested_next_actions: suggestedNextActions }
          : {}),
        ...(visibilityRules ? { visibility_rules: visibilityRules } : {}),
      } as ChatUxContext;
    })();

    if (candidateUxContext) {
      setUxContext((prev) => ({ ...(prev || {}), ...candidateUxContext }));
    }

    const asArray = Array.isArray(rawPayload)
      ? rawPayload
      : Array.isArray(rawPayload?.messages)
        ? rawPayload.messages
        : Array.isArray(rawPayload?.responses)
          ? rawPayload.responses
          : [rawPayload];

    const normalizedMessages: Message[] = [];

    const extractDemoSelectorMode = (
      data: any,
      dataPayloadRaw: unknown,
    ): string | null => {
      const payloadMode =
        dataPayloadRaw && typeof dataPayloadRaw === "object"
          ? pickFirstString(
              (dataPayloadRaw as any).demo_selector_mode,
              (dataPayloadRaw as any).demoSelectorMode,
              (dataPayloadRaw as any).selector_mode,
            )
          : null;
      return pickFirstString(
        data.demo_selector_mode,
        data.demoSelectorMode,
        data.selector_mode,
        data.selectorMode,
        data.metadata?.demo_selector_mode,
        data.metadata?.demoSelectorMode,
        payloadMode,
      );
    };

    const normalizeActionToken = (value: unknown) =>
      typeof value === "string" ? value.trim().toLowerCase() : "";

    const filterDemoSelectorButtons = (
      buttons: any[],
      modeRaw: string | null,
    ) => {
      const mode = normalizeActionToken(modeRaw);
      if (!mode) return buttons;

      if (mode === "segment_categories") {
        const filtered = buttons.filter((btn) => {
          const token = normalizeActionToken(
            pickFirstString(btn.action, btn.action_id, btn.accion_interna),
          );
          return (
            token === "demo_segment:empresas" ||
            token === "demo_segment:gobiernos"
          );
        });
        return filtered.length ? filtered : buttons;
      }

      if (mode === "segment_rubros") {
        const filtered = buttons.filter((btn) => {
          const token = normalizeActionToken(
            pickFirstString(btn.action, btn.action_id, btn.accion_interna),
          );
          if (!token) return false;
          return (
            token.startsWith("demo_select_rubro:") ||
            token === "demo_segment:all"
          );
        });
        return filtered.length ? filtered : buttons;
      }

      return buttons;
    };

    const normalizeStatusCandidate = (value: unknown) => {
      if (typeof value !== "string" && typeof value !== "number") {
        return "";
      }
      return value
        .toString()
        .trim()
        .toLowerCase()
        .replace(/[\s-]+/g, "_");
    };

    asArray.forEach((data: any) => {
      if (!data || typeof data !== "object") {
        return;
      }

      const messageType = pickFirstString(
        data.message_type,
        data.messageType,
        data.tipo_mensaje,
        data.tipoMensaje,
        data.metadata?.message_type,
        data.metadata?.messageType,
      );
      const action = pickFirstString(
        data.action,
        data.accion,
        data.action_type,
        data.actionType,
        data.metadata?.action,
        data.metadata?.accion,
      );
      const dataPayloadRaw =
        data.data ??
        data.payload ??
        data.metadata?.data ??
        data.metadata?.payload ??
        null;
      const sourceName = pickFirstString(
        data.fuente,
        data.source,
        data.metadata?.fuente,
        data.metadata?.source,
      );
      const commercialSourcesForCta = new Set([
        "catalogo_qdrant_con_promos_v2",
        "catalogo_fallback_faq",
        "catalogo_fallback_web",
      ]);
      const dataPayload = (() => {
        const base =
          dataPayloadRaw && typeof dataPayloadRaw === "object"
            ? { ...(dataPayloadRaw as Record<string, unknown>) }
            : {};
        if (sourceName && !base.fuente) base.fuente = sourceName;
        if (data.pedir_info && !base.pedir_info)
          base.pedir_info = data.pedir_info;
        if (
          (data.nro_ticket || data.ticket_id || data.ticketId) &&
          !base.nro_ticket
        ) {
          base.nro_ticket = data.nro_ticket ?? data.ticket_id ?? data.ticketId;
        }
        return Object.keys(base).length ? base : null;
      })();

      const leadTicketCandidate =
        data.nro_ticket ??
        data.ticket_id ??
        data.ticketId ??
        (dataPayload as any)?.nro_ticket;
      if (sourceName === "demo_lead_capture" && leadTicketCandidate) {
        const ticketKey = String(leadTicketCandidate);
        if (!leadCompletionTrackedTicketsRef.current.has(ticketKey)) {
          leadCompletionTrackedTicketsRef.current.add(ticketKey);
          trackWidgetEvent("lead_completed", { ticket_id: ticketKey });
        }
      }

      const isDemoSelector =
        sourceName === "demo_selector" &&
        (messageType === "interactive_list" ||
          messageType === "interactive_buttons");

      const rawText = pickFirstString(
        data.comentario,
        data.message_body,
        data.messageBody,
        data.respuesta,
        data.reply,
        data.texto,
        data.text,
        data.message,
        data.content,
        data.respuesta_usuario,
        data.html_text,
        data.html,
        data.caption,
        data.descripcion,
        data.description,
        data.message_to_user,
        data.messageToUser,
      );

      const attachmentInfo = normalizeAttachmentInfo(
        data.attachment_info ??
          data.attachmentInfo ??
          data.archivo ??
          data.attachment ??
          data.file ??
          data.metadata?.attachment_info ??
          data.metadata?.attachment,
      );

      const demoSelectorMode = extractDemoSelectorMode(data, dataPayloadRaw);
      const botones = filterDemoSelectorButtons(
        mergeButtons(
          data.botones,
          data.options_list,
          data.optionsList,
          data.options,
          data.botones_sugeridos,
          data.buttons,
          data.botonesSugeridos,
          data.quick_replies,
          data.metadata,
        ),
        sourceName === "demo_selector" ? demoSelectorMode : null,
      );
      if (
        sourceName &&
        commercialSourcesForCta.has(sourceName) &&
        botones.length > 0
      ) {
        const idx = botones.findIndex((btn: any) => {
          const candidate = pickFirstString(
            btn.action_id,
            btn.action,
            btn.accion_interna,
          )?.toLowerCase();
          return candidate === "pedir_presupuesto_pyme";
        });
        if (idx > 0) {
          const [budgetBtn] = botones.splice(idx, 1);
          botones.unshift(budgetBtn);
        }
      }
      const categorias = normalizeCategories(
        data.categorias,
        data.categories,
        data.botones_categorizados,
        data.options_grouped,
        data.buttonCategories,
        data.metadata,
      );
      const structuredContent = normalizeStructuredContent(
        data.structured_content,
        data.structuredContent,
        data.contenido_estructurado,
        data.metadata?.structured_content,
        data.metadata?.structuredContent,
      );
      const listItems = normalizeListItems(
        data.list_items,
        data.listItems,
        data.lista_items,
        data.lista_opciones,
        data.items_lista,
        data.items,
        data.lista,
        data.metadata?.list_items,
      );
      const posts = normalizePosts(
        data.posts,
        data.eventos,
        data.novedades,
        data.noticias,
        data.cards,
        data.metadata?.posts,
      );
      const socialLinks = normalizeSocialLinks(
        data.social_links ||
          data.socialLinks ||
          data.redes_sociales ||
          data.socials ||
          data.metadata?.social_links,
      );
      const mediaUrl = ensureAbsoluteUrl(
        pickFirstString(
          data.media_url,
          data.mediaUrl,
          data.image_url,
          data.imageUrl,
          data.image,
          data.media?.url,
          data.metadata?.media_url,
        ),
      );
      const audioCandidate = pickFirstString(
        data.audio_url,
        data.audioUrl,
        data.audio_response_url,
        data.audio_cache_url,
        data.tts_audio_url,
        data.ttsAudioUrl,
        data.audio?.url,
        data.audio?.link,
        data.audio?.cached_url,
        data.audio?.cache_url,
        data.audio?.public_url,
        data.audio?.path,
      );
      const audioUrlValue = audioCandidate
        ? (ensureAbsoluteUrl(audioCandidate) ?? audioCandidate)
        : undefined;
      const locationData = normalizeLocation(
        data.location_data ||
          data.locationData ||
          data.location ||
          data.ubicacion ||
          data.ubicacion_usuario ||
          data.metadata?.location,
      );
      const displayHint = normalizeDisplayHint(
        pickFirstString(
          data.display_hint,
          data.displayHint,
          data.template,
          data.metadata?.display_hint,
        ),
      );
      const chatBubbleStyle = normalizeBubbleStyle(
        pickFirstString(
          data.chat_bubble_style,
          data.chatBubbleStyle,
          data.bubbleStyle,
          data.metadata?.chat_bubble_style,
        ),
      );

      const hasNonTextContent =
        botones.length > 0 ||
        categorias.length > 0 ||
        (structuredContent?.length ?? 0) > 0 ||
        (listItems?.length ?? 0) > 0 ||
        (posts?.length ?? 0) > 0 ||
        !!mediaUrl ||
        !!audioUrlValue ||
        !!attachmentInfo ||
        !!locationData ||
        !!socialLinks;

      if (!rawText && !hasNonTextContent) {
        console.warn("processBotPayload: Empty content detected", {
          data,
          audioCandidate,
          audioUrlValue,
        });
      }

      let text =
        rawText ??
        (hasNonTextContent ? "" : "⚠️ No se pudo generar una respuesta.");
      if (text && /es el Administrador de la Municipalidad/i.test(text)) {
        text = text
          .replace(
            /,?\s*[^.]*es el Administrador de la Municipalidad\.\s*/i,
            " ",
          )
          .replace(/^Hola\s+/, "Hola, ")
          .replace(/\s{2,}/g, " ")
          .trim();
      }

      const ticketCandidate =
        data.ticket_id ?? data.ticketId ?? data.ticket?.id;
      const statusCandidate = pickFirstString(
        data.status,
        data.estado,
        data.ticket?.status,
        data.ticket?.estado,
        data.ticket_status,
      );
      const normalizedStatus = normalizeStatusCandidate(statusCandidate);
      const hasLiveChatMeta = Boolean(
        data.live_chat ||
        data.liveChat ||
        data.metadata?.live_chat ||
        data.metadata?.liveChat,
      );
      let ticketId: number | undefined;
      if (
        typeof ticketCandidate === "number" &&
        Number.isFinite(ticketCandidate)
      ) {
        ticketId = ticketCandidate;
      } else if (typeof ticketCandidate === "string") {
        const parsed = Number.parseInt(ticketCandidate, 10);
        if (Number.isFinite(parsed)) {
          ticketId = parsed;
        }
      }

      if (normalizedStatus) {
        const shouldMarkLiveChat =
          LIVE_CHAT_STATUSES.has(normalizedStatus) ||
          (normalizedStatus === "en_proceso" &&
            (liveChatTicketId || hasLiveChatMeta));
        if (shouldMarkLiveChat) {
          setLiveChatStatus(normalizedStatus);
          if (ticketId) {
            setLiveChatTicketId(ticketId);
          }
        }
      }

      const messageIdCandidate = data.id ?? data.message_id ?? data.messageId;
      const fingerprint = buildMessageFingerprint({
        messageIdCandidate,
        text,
        mediaUrl,
        audioUrlValue,
        attachmentInfo,
        messageType,
        action,
        dataPayload,
        structuredContent,
        listItems,
        posts,
        socialLinks,
        displayHint,
        chatBubbleStyle,
        botones,
        categorias,
      });

      if (seenMessageFingerprintsRef.current.has(fingerprint)) {
        return;
      }
      seenMessageFingerprintsRef.current.add(fingerprint);

      if (isDemoSelector) {
        trackWidgetEvent(
          "demo_selector_rendered",
          demoSelectorMode ? { mode: demoSelectorMode } : {},
        );
      }

      const messageId =
        typeof messageIdCandidate === "number" ||
        typeof messageIdCandidate === "string"
          ? messageIdCandidate
          : generateClientMessageId();

      const timestampCandidate =
        data.fecha ??
        data.timestamp ??
        data.created_at ??
        data.createdAt ??
        data.updated_at ??
        data.updatedAt ??
        Date.now();
      const timestampValue =
        typeof timestampCandidate === "string" ||
        typeof timestampCandidate === "number"
          ? timestampCandidate
          : Date.now();

      const explicitError = (() => {
        const candidate =
          data.isError ??
          data.is_error ??
          data.error ??
          data.metadata?.isError ??
          data.metadata?.is_error;
        if (typeof candidate === "boolean") {
          return candidate;
        }
        if (typeof candidate === "string") {
          const normalized = candidate.trim().toLowerCase();
          if (["true", "1", "yes", "si", "sí"].includes(normalized))
            return true;
          if (["false", "0", "no"].includes(normalized)) return false;
        }
        return undefined;
      })();

      const botMessage: Message = {
        id: messageId,
        text,
        isBot: true,
        timestamp: new Date(timestampValue),
        origen: data.origen ?? data.source,
        ...(messageType ? { messageType } : {}),
        ...(action ? { action } : {}),
        ...(dataPayload ? { data: dataPayload } : {}),
        ...(botones.length ? { botones } : {}),
        ...(categorias.length ? { categorias } : {}),
        ...(mediaUrl ? { mediaUrl } : {}),
        ...(audioUrlValue ? { audioUrl: audioUrlValue } : {}),
        ...(locationData ? { locationData } : {}),
        ...(attachmentInfo ? { attachmentInfo } : {}),
        ...(structuredContent ? { structuredContent } : {}),
        ...(listItems ? { listItems } : {}),
        ...(displayHint ? { displayHint } : {}),
        ...(chatBubbleStyle ? { chatBubbleStyle } : {}),
        ...(posts ? { posts } : {}),
        ...(socialLinks ? { socialLinks } : {}),
        ...(ticketId ? { ticketId } : {}),
        ...(data.query ? { query: data.query } : {}),
        isError: explicitError ?? (!rawText && !hasNonTextContent),
      };

      normalizedMessages.push(botMessage);

      if (ticketId) {
        setActiveTicketId(ticketId);
      }
    });

    if (normalizedMessages.length > 0) {
      if (fromInit) {
        initPendingResponseRef.current = false;
        initSentRef.current = false;
      }
      setMessages((prev) => [...prev, ...normalizedMessages]);
      setIsTyping(false);
      return true;
    }

    if (fromInit) {
      initPendingResponseRef.current = false;
      initSentRef.current = false;
    }

    if (fallbackOnEmpty) {
      console.warn("useChatLogic: Normalized payload produced no messages.");
      setIsTyping(false);
    }

    return false;
  };

  const normalizeCategories = (...sources: any[]): Categoria[] => {
    const rawCategories: any[] = [];
    sources.forEach((source) => {
      if (!source) return;
      if (Array.isArray(source)) {
        rawCategories.push(...source);
      } else if (Array.isArray(source?.categorias)) {
        rawCategories.push(...source.categorias);
      }
    });

    const categories: Categoria[] = [];
    rawCategories.forEach((cat) => {
      if (!cat || typeof cat !== "object") return;
      const titulo =
        pickFirstString(
          cat.titulo,
          cat.title,
          cat.nombre,
          cat.name,
          cat.label,
        ) || "Opciones";
      const botones = mergeButtons(cat.botones, cat.buttons, cat.options);
      if (!botones.length && !titulo) return;
      categories.push({ titulo, botones });
    });

    return categories;
  };

  const pickFirstNumber = (...values: any[]): number | undefined => {
    for (const value of values) {
      if (typeof value === "number" && Number.isFinite(value)) {
        return value;
      }
      if (typeof value === "string") {
        const trimmed = value.trim();
        if (!trimmed) continue;
        const normalized = trimmed
          .replace(/[^0-9,.-]/g, "")
          .replace(/,(?=\d{3}(?:\D|$))/g, "")
          .replace(/,/g, ".");
        const parsed = Number.parseFloat(normalized);
        if (Number.isFinite(parsed)) {
          return parsed;
        }
      }
    }
    return undefined;
  };

  const normalizeAttachmentInfo = (raw: any) => {
    if (!raw || typeof raw !== "object") return undefined;

    const urlCandidate = pickFirstString(
      raw.url,
      raw.secure_url,
      raw.secureUrl,
      raw.attachment_url,
      raw.attachmentUrl,
      raw.file_url,
      raw.fileUrl,
      raw.archivo_url,
      raw.archivoUrl,
      raw.public_url,
      raw.publicUrl,
      raw.direct_url,
      raw.directUrl,
      raw.media_url,
      raw.mediaUrl,
      raw.download_url,
      raw.downloadUrl,
      raw.href,
      raw.link,
      raw.path,
      raw.local_url,
      raw.localUrl,
    );

    const resolvedUrl = urlCandidate
      ? (ensureAbsoluteUrl(urlCandidate) ?? urlCandidate)
      : undefined;
    if (!resolvedUrl) {
      return undefined;
    }

    const nameCandidate =
      pickFirstString(
        raw.name,
        raw.filename,
        raw.file_name,
        raw.display_name,
        raw.title,
        raw.label,
        raw.original_filename,
        raw.originalFilename,
        raw.document_name,
        raw.documentName,
      ) ||
      resolvedUrl.split("/").pop()?.split(/[?#]/)[0] ||
      "archivo";

    const mimeCandidate = pickFirstString(
      raw.mimeType,
      raw.mime_type,
      raw.content_type,
      raw.contentType,
      raw.type,
    );

    const sizeCandidate = pickFirstNumber(
      raw.size,
      raw.file_size,
      raw.fileSize,
      raw.bytes,
      raw.length,
    );

    const thumbCandidate = pickFirstString(
      raw.thumbUrl,
      raw.thumb_url,
      raw.thumbnail_url,
      raw.thumbnailUrl,
      raw.preview_url,
      raw.previewUrl,
      raw.thumb,
      raw.miniatura_url,
      raw.miniaturaUrl,
    );
    const resolvedThumb = thumbCandidate
      ? (ensureAbsoluteUrl(thumbCandidate) ?? thumbCandidate)
      : undefined;

    const derived = deriveAttachmentInfo(
      resolvedUrl,
      nameCandidate,
      mimeCandidate,
      typeof sizeCandidate === "number" ? sizeCandidate : undefined,
      resolvedThumb,
    );

    const normalized = {
      ...raw,
      ...derived,
      ...(mimeCandidate ? { mimeType: mimeCandidate } : {}),
      ...(typeof sizeCandidate === "number" ? { size: sizeCandidate } : {}),
    } as Message["attachmentInfo"];

    normalized.url = derived.url;

    if (derived.thumbUrl) {
      normalized.thumbUrl = derived.thumbUrl;
      (["thumb_url", "thumbnail_url", "thumbnailUrl"] as const).forEach(
        (key) => {
          (normalized as Record<string, unknown>)[key] = derived.thumbUrl;
        },
      );
    }

    return normalized;
  };

  const normalizeStructuredContent = (
    ...sources: any[]
  ): StructuredContentItem[] | undefined => {
    const items: StructuredContentItem[] = [];
    const pushItem = (item: any) => {
      if (
        item &&
        typeof item === "object" &&
        typeof item.label === "string" &&
        Object.prototype.hasOwnProperty.call(item, "value")
      ) {
        items.push(item as StructuredContentItem);
      }
    };

    sources.forEach((source) => {
      if (!source) return;
      if (Array.isArray(source)) {
        source.forEach(pushItem);
      } else if (Array.isArray(source?.items)) {
        source.items.forEach(pushItem);
      }
    });

    return items.length > 0 ? items : undefined;
  };

  const normalizeListItems = (...sources: any[]): string[] | undefined => {
    const items: string[] = [];
    const pushValue = (value: any) => {
      if (typeof value === "string" && value.trim()) {
        items.push(value);
      } else if (value && typeof value === "object") {
        const text = pickFirstString(
          value.texto,
          value.text,
          value.label,
          value.title,
          value.value,
        );
        if (text && text.trim()) {
          items.push(text);
        }
      }
    };

    sources.forEach((source) => {
      if (!source) return;
      if (Array.isArray(source)) {
        source.forEach(pushValue);
      } else if (Array.isArray(source?.items)) {
        source.items.forEach(pushValue);
      }
    });

    return items.length > 0 ? items : undefined;
  };

  const collectPosts = (source: any): any[] => {
    if (!source) return [];
    if (Array.isArray(source)) return source;
    if (Array.isArray(source?.posts)) return source.posts;
    if (Array.isArray(source?.eventos)) return source.eventos;
    if (Array.isArray(source?.novedades)) return source.novedades;
    if (Array.isArray(source?.noticias)) return source.noticias;
    return [];
  };

  const normalizePosts = (...sources: any[]): Post[] | undefined => {
    const posts: Post[] = [];
    sources.forEach((source) => {
      collectPosts(source).forEach((post: any) => {
        if (!post || typeof post !== "object") return;
        const normalized: Post = { ...post };

        const imageCandidate = pickFirstString(
          post.imagen_url,
          post.image,
          post.imageUrl,
          post.thumbnail_url,
          post.thumbnailUrl,
        );
        const resolvedImage = ensureAbsoluteUrl(imageCandidate);
        if (resolvedImage) {
          normalized.imagen_url = resolvedImage;
          normalized.image = resolvedImage;
          normalized.imageUrl = resolvedImage;
        }

        const resolvedThumb = ensureAbsoluteUrl(
          pickFirstString(post.thumbnail_url, post.thumbnailUrl),
        );
        if (resolvedThumb) {
          normalized.thumbnail_url = resolvedThumb;
          normalized.thumbnailUrl = resolvedThumb;
        }

        const resolvedMainLink = ensureAbsoluteUrl(
          pickFirstString(post.url, post.enlace, post.link),
        );
        if (resolvedMainLink) {
          normalized.url = resolvedMainLink;
          normalized.enlace = resolvedMainLink;
          normalized.link = resolvedMainLink;
        } else {
          if (post.url)
            normalized.url = ensureAbsoluteUrl(post.url) ?? post.url;
          if (post.enlace)
            normalized.enlace = ensureAbsoluteUrl(post.enlace) ?? post.enlace;
          if (post.link)
            normalized.link = ensureAbsoluteUrl(post.link) ?? post.link;
        }

        posts.push(normalized);
      });
    });

    return posts.length > 0 ? posts : undefined;
  };

  const normalizeSocialLinks = (
    raw: any,
  ): Record<string, string> | undefined => {
    if (!raw || typeof raw !== "object") return undefined;
    const entries: [string, string][] = [];
    Object.entries(raw).forEach(([key, value]) => {
      if (typeof value === "string" && value.trim()) {
        entries.push([key, ensureAbsoluteUrl(value) ?? value]);
      }
    });
    return entries.length > 0 ? Object.fromEntries(entries) : undefined;
  };

  const normalizeLocation = (raw: any) => {
    if (!raw || typeof raw !== "object") return undefined;
    const latValue = raw.lat ?? raw.latitude;
    const lonValue = raw.lon ?? raw.lng ?? raw.longitude ?? raw.long;
    const lat =
      typeof latValue === "number"
        ? latValue
        : typeof latValue === "string"
          ? parseFloat(latValue)
          : NaN;
    const lon =
      typeof lonValue === "number"
        ? lonValue
        : typeof lonValue === "string"
          ? parseFloat(lonValue)
          : NaN;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return undefined;
    const name = pickFirstString(raw.name, raw.nombre, raw.title);
    const address = pickFirstString(
      raw.address,
      raw.direccion,
      raw.formatted_address,
    );
    return {
      lat,
      lon,
      ...(name ? { name } : {}),
      ...(address ? { address } : {}),
    };
  };

  const DISPLAY_HINTS = new Set<Message["displayHint"]>([
    "default",
    "pymeProductCard",
    "municipalInfoSummary",
    "genericTable",
    "compactList",
  ]);

  const CHAT_BUBBLE_STYLES = new Set<Message["chatBubbleStyle"]>([
    "standard",
    "compact",
    "emphasis",
    "alert",
  ]);

  const normalizeDisplayHint = (
    value?: string,
  ): Message["displayHint"] | undefined => {
    if (!value) return undefined;
    const trimmed = value.trim() as Message["displayHint"];
    return DISPLAY_HINTS.has(trimmed) ? trimmed : undefined;
  };

  const normalizeBubbleStyle = (
    value?: string,
  ): Message["chatBubbleStyle"] | undefined => {
    if (!value) return undefined;
    const trimmed = value.trim() as Message["chatBubbleStyle"];
    return CHAT_BUBBLE_STYLES.has(trimmed) ? trimmed : undefined;
  };

  const resolveTransportHintKey = (slug?: string | null) =>
    `chatboc_socket_transport_hint:${slug || "default"}`;
  const resolveTransportListKey = (slug?: string | null) =>
    `chatboc_socket_transports:${slug || "default"}`;

  const isChatbocDomain = (): boolean => {
    if (typeof window === "undefined") return false;
    const host = window.location.hostname.toLowerCase();
    return (
      host === "chatboc.ar" ||
      host.endsWith(".chatboc.ar") ||
      host === "www.chatboc.ar"
    );
  };

  const [socketTransportRetryKey, setSocketTransportRetryKey] = useState(0);

  const getPreferredSocketTransports = (): Array<"websocket" | "polling"> => {
    if (isChatbocDomain()) return ["polling"];

    const rawTransports = safeLocalStorage.getItem(
      resolveTransportListKey(tenantSlug),
    );
    if (rawTransports) {
      try {
        const parsed = JSON.parse(rawTransports);
        const valid = Array.isArray(parsed)
          ? parsed.filter(
              (item): item is "websocket" | "polling" =>
                item === "websocket" || item === "polling",
            )
          : [];
        if (valid.length > 0) {
          if (valid.length === 1 && valid[0] === "polling") return ["polling"];
          if (valid.length === 1 && valid[0] === "websocket")
            return ["websocket", "polling"];
          return valid;
        }
      } catch {
        // ignore invalid cache and fallback to hint/domain
      }
    }

    const hint = safeLocalStorage.getItem(resolveTransportHintKey(tenantSlug));
    if (hint === "polling") return ["polling"];
    if (hint === "websocket") return ["websocket", "polling"];
    return ["websocket", "polling"];
  };

  useEffect(() => {
    if (!entityToken && !tenantSlug) {
      console.log(
        "useChatLogic: No entityToken and no tenantSlug, socket connection deferred.",
      );
      return;
    }
    if (!tipoChat) {
      console.log(
        "useChatLogic: Deferring socket connection until tipoChat is available.",
      );
      return;
    }

    // Setup Socket.IO
    const socketUrl = getSocketUrl();
    const userAuthToken = skipAuth ? null : safeLocalStorage.getItem(tokenKey);

    const transports = getPreferredSocketTransports();

    console.log("useChatLogic: Initializing socket", {
      socketUrl,
      entityToken,
      tenantSlug,
      hasUserToken: !!userAuthToken,
      transports,
    });

    const socket = io(socketUrl, {
      transports,
      withCredentials: true,
      path: SOCKET_PATH,
      auth: {
        ...(userAuthToken && { token: userAuthToken }), // Prioritize user JWT for auth
        entityToken: entityToken, // Pass entity token for context
        tenantSlug: tenantSlug, // Pass tenant slug if entity token is missing (public tenant)
      },
    });

    if (!socket || typeof (socket as any).on !== "function") {
      console.error("Socket.io returned an invalid client", socket);
      return;
    }

    socketRef.current = socket;
    const sessionId = getOrCreateChatSessionId();

    const handleConnect = () => {
      console.log("Socket.IO connected, joining room with web channel...");
      socket.emit("join", { room: sessionId, channel: "web" });

      initializeConversationRef.current?.({ resetContext: true });
    };

    const handleConnectError = (err: any) => {
      console.error("Socket.IO connection error:", err.message);
      const lowered = String(err?.message || "").toLowerCase();
      if (
        lowered.includes("websocket") ||
        lowered.includes("transport") ||
        lowered.includes("xhr poll error")
      ) {
        safeLocalStorage.setItem(
          resolveTransportHintKey(tenantSlug),
          "polling",
        );
        safeLocalStorage.setItem(
          resolveTransportListKey(tenantSlug),
          JSON.stringify(["polling"]),
        );
        setSocketTransportRetryKey((prev) => prev + 1);
      }
    };

    assertEventSource(socket, "socket");
    safeOn(socket, "connect", handleConnect);
    safeOn(socket, "connect_error", handleConnectError);

    const handleBotMessage = (rawPayload: any) => {
      console.log("Bot response received:", rawPayload);
      processBotPayload(rawPayload, { fallbackOnEmpty: true });
    };

    const handleDisconnect = () => {
      console.log("Socket.IO disconnected.");
    };

    safeOn(socket, "bot_response", handleBotMessage);
    safeOn(socket, "message", handleBotMessage);
    safeOn(socket, "disconnect", handleDisconnect);

    // Cleanup on component unmount
    return () => {
      socket.off?.("connect", handleConnect);
      socket.off?.("connect_error", handleConnectError);
      socket.off?.("bot_response", handleBotMessage);
      socket.off?.("message", handleBotMessage);
      socket.off?.("disconnect", handleDisconnect);
      socket.disconnect();
    };
  }, [
    entityToken,
    tenantSlug,
    tipoChat,
    skipAuth,
    tokenKey,
    socketTransportRetryKey,
  ]);

  useEffect(() => {
    if (
      contexto.estado_conversacion === "confirmando_reclamo" &&
      !activeTicketId
    ) {
      const newKey = uuidv4();
      setCurrentClaimIdempotencyKey(newKey);
      console.log(
        "useChatLogic: Generated idempotency key for claim confirmation:",
        newKey,
      );
    }
  }, [contexto.estado_conversacion, activeTicketId]);

  const addSystemMessage = useCallback(
    (text: string, type: "error" | "info" = "info") => {
      const systemMessage: Message = {
        id: generateClientMessageId(),
        text,
        isBot: true,
        timestamp: new Date(),
        isError: type === "error",
      };
      setMessages((prev) => [...prev, systemMessage]);
      setIsTyping(false); // Ensure typing indicator is turned off for system messages
    },
    [],
  );

  const handleSend = useCallback(
    async (payload: string | TypeSendPayload) => {
      const actualPayload: TypeSendPayload =
        typeof payload === "string"
          ? { text: payload.trim(), source: "system" }
          : { ...payload, text: payload.text?.trim() || "" };

      const originalText = actualPayload.text || "";

      const {
        text: userMessageText,
        attachmentInfo,
        ubicacion_usuario,
        action,
        action_id,
        location,
      } = actualPayload;
      const actionPayload =
        "payload" in actualPayload ? actualPayload.payload : undefined;

      if (actionPayload && typeof actionPayload === "object") {
        const incomingPin = pickFirstString(
          (actionPayload as Record<string, unknown>).pin,
          (actionPayload as Record<string, unknown>).consulta_pin,
          (actionPayload as Record<string, unknown>).consultaPin,
        )?.trim();
        const incomingTicketId =
          (actionPayload as Record<string, unknown>).ticketId ??
          (actionPayload as Record<string, unknown>).ticket_id ??
          null;
        const incomingTicketNumber = pickFirstString(
          (actionPayload as Record<string, unknown>).ticketNumber,
          (actionPayload as Record<string, unknown>).ticket_number,
          (actionPayload as Record<string, unknown>).nro_ticket,
        )?.trim();

        if (incomingPin || incomingTicketId || incomingTicketNumber) {
          safeLocalStorage.setItem(
            PUBLIC_CHAT_CONTEXT_KEY,
            JSON.stringify({
              ...(readStoredPublicChatContext() || {}),
              ...(actionPayload as Record<string, unknown>),
              pin: incomingPin || undefined,
              consulta_pin: incomingPin || undefined,
              ticket_id: incomingTicketId ?? undefined,
              ticket_number: incomingTicketNumber || undefined,
              tenantSlug: tenantSlug ?? undefined,
              tipoChat,
              updatedAt: new Date().toISOString(),
            }),
          );
        }
      }

      const isLikelyTypedQuestion =
        !!originalText &&
        originalText !== "__INIT__" &&
        !action &&
        !action_id &&
        actualPayload.source !== "button" &&
        (actualPayload.source === "input" ||
          typeof payload === "string" ||
          typeof actualPayload.source === "undefined");

      if (!firstRealQuestionSentRef.current && isLikelyTypedQuestion) {
        firstRealQuestionSentRef.current = true;
        trackWidgetEvent("first_real_question_sent");
      }

      const resolvedActionId =
        typeof action_id === "string" && action_id.trim()
          ? action_id.trim()
          : undefined;
      const demoActionCandidate =
        resolvedActionId || (typeof action === "string" ? action : undefined);
      if (
        demoActionCandidate &&
        demoActionCandidate.startsWith("demo_select_rubro:")
      ) {
        const demoKey = demoActionCandidate.split(":")[1]?.trim();
        trackWidgetEvent(
          "demo_option_clicked",
          demoKey ? { demo_key: demoKey } : {},
        );
      }

      const emojiFallback =
        (typeof actionPayload?.category === "string" &&
          actionPayload.category.trim()) ||
        findCategoryFromEmoji(originalText);

      // Sanitize text by removing emojis to prevent issues with backend services like Google Search.
      const emojiRegex =
        /([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g;
      const sanitizedCandidate = originalText.replace(emojiRegex, "").trim();
      const sanitizedDiffers = sanitizedCandidate !== originalText;
      const normalizedQuestionBase =
        sanitizedCandidate || emojiFallback || originalText;
      const questionForBackend =
        actualPayload.source === "button" &&
        sanitizedDiffers &&
        sanitizedCandidate
          ? originalText
          : normalizedQuestionBase;

      // Texto normalizado (sin emojis) para comparaciones locales
      const normalizedForMatching = (
        normalizedQuestionBase || ""
      ).toLowerCase();

      // Allow confirming/cancelling a claim with free text when awaiting confirmation
      let resolvedAction = action;
      const awaitingConfirmation =
        contexto.estado_conversacion === "confirmando_reclamo" ||
        contexto.reclamo_flow_v2?.state === "ESPERANDO_CONFIRMACION";
      if (!resolvedAction && awaitingConfirmation) {
        const normalized = normalizedForMatching;
        const confirmWords = [
          "1",
          "si",
          "sí",
          "s",
          "ok",
          "okay",
          "acepto",
          "aceptar",
          "confirmar",
          "confirmo",
        ];
        const cancelWords = [
          "2",
          "no",
          "n",
          "cancelar",
          "cancel",
          "rechazo",
          "rechazar",
        ];
        if (confirmWords.includes(normalized)) {
          resolvedAction = "confirmar_reclamo";
        } else if (cancelWords.includes(normalized)) {
          resolvedAction = "cancelar_reclamo";
        }
      }

      if (
        !userMessageText &&
        !attachmentInfo &&
        !ubicacion_usuario &&
        !resolvedAction &&
        !actualPayload.archivo_url &&
        !location
      )
        return;
      if (isTyping) return;

      const normalizedAction =
        typeof resolvedAction === "string"
          ? resolvedAction.toLowerCase()
          : undefined;
      const rawPayloadNombre =
        typeof actionPayload?.nombre === "string"
          ? actionPayload.nombre.trim()
          : "";
      const payloadNombre = rawPayloadNombre ? rawPayloadNombre : undefined;
      if (
        normalizedAction &&
        ["submit_personal_data", "set_user_name"].includes(normalizedAction) &&
        payloadNombre
      ) {
        setVisitorName(payloadNombre);
      }

      const isHighIntent = HIGH_INTENT_PATTERNS.some((keyword) =>
        normalizedForMatching.includes(keyword),
      );
      if (isHighIntent && !leadCaptureSentRef.current) {
        const storedUser = JSON.parse(
          safeLocalStorage.getItem("user") || "null",
        );
        const leadName = pickFirstString(
          actionPayload?.nombre,
          storedUser?.name,
          storedUser?.nombre,
          getVisitorName(),
        );
        const leadEmail = pickFirstString(
          actionPayload?.email,
          storedUser?.email,
        );
        const leadPhone = pickFirstString(
          actionPayload?.telefono,
          storedUser?.telefono,
          storedUser?.phone,
          storedUser?.whatsapp,
          storedUser?.celular,
        );

        if (leadName || leadEmail || leadPhone) {
          leadCaptureSentRef.current = true;
          enterpriseService
            .captureLead({
              tenant_slug: tenantSlug || undefined,
              name: leadName,
              email: leadEmail,
              phone: leadPhone,
              interest: userMessageText || normalizedQuestionBase,
              message: originalText,
              source: "widget_chat",
              metadata: { tipo_chat: tipoChat, action: resolvedAction || null },
            })
            .catch((captureError) => {
              leadCaptureSentRef.current = false;
              console.warn("Lead capture failed", captureError);
            });
        }
      }

      const isUrgentMessage = URGENT_PATTERNS.some((keyword) =>
        normalizedForMatching.includes(keyword),
      );
      if (
        isUrgentMessage &&
        liveChatAvailable &&
        !liveChatTicketId &&
        !resolvedAction
      ) {
        resolvedAction = "request_agent";
      }

      if (resolvedAction === "iniciar_creacion_reclamo") {
        // Check for existing user data
        const userData =
          user || JSON.parse(safeLocalStorage.getItem("user") || "null");
        if (userData?.name && userData?.email) {
          // Assume phone and DNI are not available in user object
          setContexto((prev) => ({
            ...prev,
            estado_conversacion: "confirmando_reclamo",
            datos_reclamo: {
              ...prev.datos_reclamo,
              nombre_ciudadano: userData.name,
              email_ciudadano: userData.email,
            },
          }));
          setMessages((prev) => [
            ...prev,
            {
              id: generateClientMessageId(),
              text: `Hola ${userData.name}. ¿Confirmas la creación del reclamo?`,
              isBot: true,
              timestamp: new Date(),
              botones: [
                { texto: "Confirmar Reclamo", action: "confirmar_reclamo" },
                { texto: "Cancelar", action: "cancelar_reclamo" },
              ],
            },
          ]);
        } else {
          setContexto((prev) => ({
            ...prev,
            estado_conversacion: "recolectando_datos_personales",
          }));
          setMessages((prev) => [
            ...prev,
            {
              id: generateClientMessageId(),
              text: "Para continuar, por favor completá tus datos.",
              isBot: true,
              timestamp: new Date(),
            },
          ]);
        }
        setIsTyping(false);
        return;
      }

      if (resolvedAction === "submit_personal_data" && actionPayload) {
        setContexto((prev) => ({
          ...prev,
          estado_conversacion: "confirmando_reclamo",
          datos_reclamo: {
            ...prev.datos_reclamo,
            nombre_ciudadano:
              payloadNombre ??
              (typeof actionPayload.nombre === "string"
                ? actionPayload.nombre
                : null),
            email_ciudadano: actionPayload.email,
            telefono_ciudadano: actionPayload.telefono,
            dni_ciudadano: actionPayload.dni,
          },
        }));
        setMessages((prev) => [
          ...prev,
          {
            id: generateClientMessageId(),
            text: "¡Gracias! Revisa que los datos sean correctos y confirma para generar el reclamo.",
            isBot: true,
            timestamp: new Date(),
            botones: [
              { texto: "Confirmar Reclamo", action: "confirmar_reclamo" },
              { texto: "Cancelar", action: "cancelar_reclamo" },
            ],
          },
        ]);
        setIsTyping(false);
        return;
      }

      // Create the user message object first
      const userMessage: Message = {
        id: generateClientMessageId(),
        text: userMessageText,
        isBot: false,
        timestamp: new Date(),
        attachmentInfo,
        locationData: location || ubicacion_usuario,
      };

      // Add user message to UI immediately if it has content
      if (userMessageText || attachmentInfo || location) {
        setMessages((prev) => [...prev, userMessage]);
      }

      setIsTyping(true);

      try {
        const allowRubroInference = tipoChat !== "municipio";
        const storedUser = JSON.parse(
          safeLocalStorage.getItem("user") || "null",
        );
        const resolvedRubro = allowRubroInference
          ? selectedRubro ||
            storedUser?.rubro?.clave ||
            storedUser?.rubro?.nombre ||
            safeLocalStorage.getItem("rubroSeleccionado") ||
            null
          : null;

        const tipoChatFinal = enforceTipoChatForRubro(tipoChat, resolvedRubro);
        const rubro = tipoChatFinal === "pyme" ? resolvedRubro : null;

        const updatedContext = updateMunicipioContext(contexto, {
          userInput: userMessageText,
          action: resolvedAction,
        });
        setContexto(updatedContext);

        const visitorName = getVisitorName();

        const sessionId = getOrCreateChatSessionId();
        const publicChatContext = resolvePersistentPublicContext(
          tipoChatFinal,
          tenantSlug,
        );
        const requestBody: Record<string, any> = {
          pregunta: questionForBackend,
          contexto_previo: updatedContext,
          tipo_chat: tipoChatFinal,
          ...(rubro && { rubro_clave: rubro }),
          ...(liveChatTicketId
            ? { ticket_id: liveChatTicketId, tipo_ticket: tipoChatFinal }
            : {}),
          ...(attachmentInfo && { attachment_info: attachmentInfo }),
          ...(location && { location: location }),
          ...(resolvedAction && { action: resolvedAction }),
          ...(resolvedActionId && { action_id: resolvedActionId }),
          ...(actionPayload && { payload: actionPayload }),
          ...(publicChatContext || {}),
          ...(resolvedAction === "confirmar_reclamo" &&
            currentClaimIdempotencyKey && {
              idempotency_key: currentClaimIdempotencyKey,
            }),
          ...(visitorName && { nombre_usuario: visitorName }),
          session_id: sessionId,
          tenant_slug: tenantSlug ?? "municipio",
        };

        if (sanitizedDiffers || emojiFallback) {
          requestBody.pregunta_original = originalText;
          requestBody.pregunta_sin_emojis =
            sanitizedCandidate || emojiFallback || originalText;
        }

        const legacyAttachmentUrl =
          attachmentInfo?.url || actualPayload.archivo_url;
        if (legacyAttachmentUrl) {
          requestBody.archivo_url = legacyAttachmentUrl;
        }

        const shouldMarkAsPhoto =
          actualPayload.es_foto === true ||
          (attachmentInfo?.mimeType
            ? attachmentInfo.mimeType.toLowerCase().startsWith("image/")
            : false);
        if (shouldMarkAsPhoto) {
          requestBody.es_foto = true;
        }

        if (resolvedAction === "confirmar_reclamo") {
          requestBody.datos_personales = {
            nombre: contexto.datos_reclamo.nombre_ciudadano,
            email: contexto.datos_reclamo.email_ciudadano,
            telefono: contexto.datos_reclamo.telefono_ciudadano,
            dni: contexto.datos_reclamo.dni_ciudadano,
          };
        }

        const endpoint = getAskEndpoint({ tipoChat: tipoChatFinal, rubro });

        const isPublicDemo = shouldUsePublicFlow(tipoChatFinal, tenantSlug);
        const effectiveSkipAuth = skipAuth || isPublicDemo;

        console.log("useChatLogic: Sending message to backend", {
          endpoint,
          requestBody,
        });
        const response = await apiFetch<any>(endpoint, {
          method: "POST",
          body: requestBody,
          skipAuth: effectiveSkipAuth,
          isWidgetRequest: true,
          tenantSlug: tenantSlug,
          entityToken,
        });
        console.log("useChatLogic: Backend response", response);
        processBotPayload(response, {
          fallbackOnEmpty: !socketRef.current || !socketRef.current.connected,
        });
      } catch (error: any) {
        if (error instanceof ApiError && error.status === 409) {
          resetChatSessionId();
        }
        const errorMsg = getErrorMessage(
          error,
          "⚠️ Ocurrió un error inesperado.",
        );
        setMessages((prev) => [
          ...prev,
          {
            id: generateClientMessageId(),
            text: errorMsg,
            isBot: true,
            timestamp: new Date(),
            isError: true,
          },
        ]);
        setIsTyping(false);
      }
    },
    [
      contexto,
      activeTicketId,
      liveChatTicketId,
      isTyping,
      isAnonimo,
      currentClaimIdempotencyKey,
      tipoChat,
      tenantSlug,
      entityToken,
      selectedRubro,
      user,
      shouldUsePublicFlow,
      liveChatAvailable,
      resolvePersistentPublicContext,
    ],
  );

  useEffect(() => {
    if (!uxContext) return;
    const isTrusted = uxContext.trusted_owner === true;
    const demoShellBlocked =
      isTrusted && uxContext.should_render_demo_shell === false;
    const nextState = JSON.stringify({
      trusted_owner: uxContext.trusted_owner,
      owner_name: uxContext.owner_name,
      owner_tipo_chat: uxContext.owner_tipo_chat,
      should_render_demo_shell: uxContext.should_render_demo_shell,
    });

    if (lastUxTelemetryStateRef.current === nextState) {
      return;
    }
    lastUxTelemetryStateRef.current = nextState;

    if (isTrusted) {
      trackWidgetEvent("tenant_context_restored", {
        owner_name: uxContext.owner_name,
        owner_tipo_chat: uxContext.owner_tipo_chat,
      });
    }

    if (demoShellBlocked) {
      trackWidgetEvent("demo_shell_render_blocked", {
        owner_name: uxContext.owner_name,
        owner_tipo_chat: uxContext.owner_tipo_chat,
      });
    }

    if (uxContext.trusted_owner === false) {
      trackWidgetEvent("tenant_context_lost", {
        owner_name: uxContext.owner_name,
        owner_tipo_chat: uxContext.owner_tipo_chat,
      });
    }
  }, [uxContext]);

  const isLiveChatActive = liveChatTicketId !== null;

  return {
    messages,
    isTyping,
    handleSend,
    activeTicketId,
    liveChatTicketId,
    liveChatStatus,
    isLiveChatActive,
    setMessages,
    setContexto,
    setActiveTicketId,
    contexto,
    uxContext,
    addSystemMessage,
    initializeConversation,
  };
}

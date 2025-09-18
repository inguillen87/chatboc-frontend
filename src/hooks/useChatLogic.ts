// src/hooks/useChatLogic.ts
import { useState, useEffect, useRef, useCallback } from "react";
import {
  Message,
  SendPayload as TypeSendPayload,
  Categoria,
  StructuredContentItem,
  Post,
} from "@/types/chat";
import { io, Socket } from "socket.io-client";
import { getSocketUrl } from "@/config";
import { apiFetch, getErrorMessage } from "@/utils/api";
import { getAskEndpoint } from "@/utils/chatEndpoints";
import { enforceTipoChatForRubro } from "@/utils/tipoChat";
import { safeLocalStorage } from "@/utils/safeLocalStorage";
import getOrCreateChatSessionId from "@/utils/chatSessionId";
import { getIframeToken } from "@/utils/config";
import { v4 as uuidv4 } from 'uuid';
import { MunicipioContext, updateMunicipioContext, getInitialMunicipioContext } from "@/utils/contexto_municipio";
import { useUser } from './useUser';
import { safeOn, assertEventSource } from "@/utils/safeOn";
import { getVisitorName } from "@/utils/visitorName";
import { ensureAbsoluteUrl, mergeButtons, pickFirstString } from "@/utils/chatButtons";

interface UseChatLogicOptions {
  tipoChat: 'pyme' | 'municipio';
  entityToken?: string;
  tokenKey?: string;
  skipAuth?: boolean;
}

export function useChatLogic({ tipoChat, entityToken: propToken, tokenKey = 'authToken', skipAuth = false }: UseChatLogicOptions) {
  const entityToken = propToken || getIframeToken();
  const { user } = useUser();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [contexto, setContexto] = useState<MunicipioContext>(() => getInitialMunicipioContext());
  const [activeTicketId, setActiveTicketId] = useState<number | null>(null);
  const [currentClaimIdempotencyKey, setCurrentClaimIdempotencyKey] = useState<string | null>(null);

  const token = skipAuth ? null : safeLocalStorage.getItem(tokenKey);
  const isAnonimo = skipAuth || !token;

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const ultimoMensajeIdRef = useRef<number>(0);
  const clientMessageIdCounter = useRef(0);

  const generateClientMessageId = () => {
    clientMessageIdCounter.current += 1;
    return `client-${Date.now()}-${clientMessageIdCounter.current}`;
  };

  const socketRef = useRef<Socket | null>(null);

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
      const titulo = pickFirstString(cat.titulo, cat.title, cat.nombre, cat.name, cat.label) || "Opciones";
      const botones = mergeButtons(cat.botones, cat.buttons, cat.options);
      if (!botones.length && !titulo) return;
      categories.push({ titulo, botones });
    });

    return categories;
  };

  const normalizeAttachmentInfo = (raw: any) => {
    if (!raw || typeof raw !== "object") return undefined;
    const normalized = { ...raw } as Message["attachmentInfo"];
    const normalizedUrl = ensureAbsoluteUrl(pickFirstString(raw.url));
    if (normalizedUrl) {
      normalized.url = normalizedUrl;
    }
    (['thumbUrl', 'thumb_url', 'thumbnail_url', 'thumbnailUrl'] as const).forEach((key) => {
      const absolute = ensureAbsoluteUrl(pickFirstString(raw[key]));
      if (absolute) {
        normalized[key] = absolute;
      }
    });
    return normalized;
  };

  const normalizeStructuredContent = (...sources: any[]): StructuredContentItem[] | undefined => {
    const items: StructuredContentItem[] = [];
    const pushItem = (item: any) => {
      if (item && typeof item === "object" && typeof item.label === "string" && Object.prototype.hasOwnProperty.call(item, 'value')) {
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
        const text = pickFirstString(value.texto, value.text, value.label, value.title, value.value);
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

        const imageCandidate = pickFirstString(post.imagen_url, post.image, post.imageUrl, post.thumbnail_url, post.thumbnailUrl);
        const resolvedImage = ensureAbsoluteUrl(imageCandidate);
        if (resolvedImage) {
          normalized.imagen_url = resolvedImage;
          normalized.image = resolvedImage;
          normalized.imageUrl = resolvedImage;
        }

        const resolvedThumb = ensureAbsoluteUrl(pickFirstString(post.thumbnail_url, post.thumbnailUrl));
        if (resolvedThumb) {
          normalized.thumbnail_url = resolvedThumb;
          normalized.thumbnailUrl = resolvedThumb;
        }

        const resolvedMainLink = ensureAbsoluteUrl(pickFirstString(post.url, post.enlace, post.link));
        if (resolvedMainLink) {
          normalized.url = resolvedMainLink;
          normalized.enlace = resolvedMainLink;
          normalized.link = resolvedMainLink;
        } else {
          if (post.url) normalized.url = ensureAbsoluteUrl(post.url) ?? post.url;
          if (post.enlace) normalized.enlace = ensureAbsoluteUrl(post.enlace) ?? post.enlace;
          if (post.link) normalized.link = ensureAbsoluteUrl(post.link) ?? post.link;
        }

        posts.push(normalized);
      });
    });

    return posts.length > 0 ? posts : undefined;
  };

  const normalizeSocialLinks = (raw: any): Record<string, string> | undefined => {
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
    const lat = typeof latValue === "number" ? latValue : typeof latValue === "string" ? parseFloat(latValue) : NaN;
    const lon = typeof lonValue === "number" ? lonValue : typeof lonValue === "string" ? parseFloat(lonValue) : NaN;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return undefined;
    const name = pickFirstString(raw.name, raw.nombre, raw.title);
    const address = pickFirstString(raw.address, raw.direccion, raw.formatted_address);
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

  const normalizeDisplayHint = (value?: string): Message["displayHint"] | undefined => {
    if (!value) return undefined;
    const trimmed = value.trim() as Message["displayHint"];
    return DISPLAY_HINTS.has(trimmed) ? trimmed : undefined;
  };

  const normalizeBubbleStyle = (value?: string): Message["chatBubbleStyle"] | undefined => {
    if (!value) return undefined;
    const trimmed = value.trim() as Message["chatBubbleStyle"];
    return CHAT_BUBBLE_STYLES.has(trimmed) ? trimmed : undefined;
  };

  useEffect(() => {
    if (!entityToken) {
      console.log("useChatLogic: No entityToken, socket connection deferred.");
      return;
    }
    if (!tipoChat) {
      console.log("useChatLogic: Deferring socket connection until tipoChat is available.");
      return;
    }

    // Setup Socket.IO
    const socketUrl = getSocketUrl();
    const userAuthToken = skipAuth ? null : safeLocalStorage.getItem(tokenKey);

    console.log("useChatLogic: Initializing socket", {
      socketUrl,
      entityToken,
      hasUserToken: !!userAuthToken
    });

    const socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
      auth: {
        ...(userAuthToken && { token: userAuthToken }), // Prioritize user JWT for auth
        entityToken: entityToken // Pass entity token for context
      }
    });

    if (!socket || typeof (socket as any).on !== "function") {
      console.error("Socket.io returned an invalid client", socket);
      return;
    }

    socketRef.current = socket;
    const sessionId = getOrCreateChatSessionId();

    const handleConnect = () => {
      console.log('Socket.IO connected, joining room with web channel...');
      socket.emit('join', { room: sessionId, channel: 'web' });

      // Automatically send a silent greeting to fetch the main menu on connect.
      const endpoint = getAskEndpoint({ tipoChat, rubro: null });
      const initialContext = getInitialMunicipioContext();

      console.log("useChatLogic: Sending initial greeting to fetch menu.");
      setIsTyping(true);

      const initialName = getVisitorName();
      apiFetch<any>(endpoint, {
        method: 'POST',
        skipAuth,
        body: {
          pregunta: '',
          action: 'initial_greeting',
          contexto_previo: initialContext,
          tipo_chat: tipoChat,
          ...(initialName && { nombre_usuario: initialName }),
        },
      })
        .catch(error => {
          console.error("Error sending initial greeting:", getErrorMessage(error));
          const errorMsg = getErrorMessage(error, '⚠️ No se pudo cargar el menú inicial.');
          setMessages(prev => [...prev, { id: generateClientMessageId(), text: errorMsg, isBot: true, timestamp: new Date(), isError: true }]);
          setIsTyping(false);
        });
    };

    const handleConnectError = (err: any) => {
      console.error('Socket.IO connection error:', err.message);
    };

    assertEventSource(socket, 'socket');
    safeOn(socket, 'connect', handleConnect);
    safeOn(socket, 'connect_error', handleConnectError);

    const handleBotMessage = (rawPayload: any) => {
      console.log('Bot response received:', rawPayload);

      // Actualizar el contexto con la respuesta del bot
      setContexto(prevContext => updateMunicipioContext(prevContext, { llmResponse: rawPayload }));

      const asArray = Array.isArray(rawPayload)
        ? rawPayload
        : Array.isArray(rawPayload?.messages)
          ? rawPayload.messages
          : Array.isArray(rawPayload?.responses)
            ? rawPayload.responses
            : [rawPayload];

      const normalizedMessages: Message[] = [];

      asArray.forEach((data: any) => {
        if (!data || typeof data !== 'object') {
          return;
        }

        const rawText = pickFirstString(
          data.comentario,
          data.message_body,
          data.messageBody,
          data.respuesta,
          data.reply,
          data.texto,
          data.text,
          data.respuesta_usuario,
          data.html_text,
          data.html,
          data.caption,
          data.descripcion,
          data.description
        );

        const attachmentInfo = normalizeAttachmentInfo(
          data.attachment_info ??
            data.attachmentInfo ??
            data.archivo ??
            data.attachment ??
            data.file ??
            data.metadata?.attachment_info ??
            data.metadata?.attachment
        );

        const botones = mergeButtons(
          data.botones,
          data.options_list,
          data.optionsList,
          data.options,
          data.botones_sugeridos,
          data.buttons,
          data.botonesSugeridos,
          data.quick_replies,
          data.metadata
        );
        const categorias = normalizeCategories(
          data.categorias,
          data.categories,
          data.botones_categorizados,
          data.options_grouped,
          data.buttonCategories,
          data.metadata
        );
        const structuredContent = normalizeStructuredContent(
          data.structured_content,
          data.structuredContent,
          data.contenido_estructurado,
          data.metadata?.structured_content,
          data.metadata?.structuredContent
        );
        const listItems = normalizeListItems(
          data.list_items,
          data.listItems,
          data.lista_items,
          data.lista_opciones,
          data.items_lista,
          data.items,
          data.lista,
          data.metadata?.list_items
        );
        const posts = normalizePosts(
          data.posts,
          data.eventos,
          data.novedades,
          data.noticias,
          data.cards,
          data.metadata?.posts
        );
        const socialLinks = normalizeSocialLinks(
          data.social_links ||
            data.socialLinks ||
            data.redes_sociales ||
            data.socials ||
            data.metadata?.social_links
        );
        const mediaUrl = ensureAbsoluteUrl(
          pickFirstString(
            data.media_url,
            data.mediaUrl,
            data.image_url,
            data.imageUrl,
            data.image,
            data.media?.url,
            data.metadata?.media_url
          )
        );
        const audioCandidate = pickFirstString(
          data.audio_url,
          data.audioUrl,
          data.audio_response_url,
          data.audio_cache_url,
          data.tts_audio_url,
          data.ttsAudioUrl,
          data.audio?.url,
          data.audio?.cached_url,
          data.audio?.cache_url,
          data.audio?.public_url,
          data.audio?.path
        );
        const audioUrlValue = audioCandidate ? ensureAbsoluteUrl(audioCandidate) ?? audioCandidate : undefined;
        const locationData = normalizeLocation(
          data.location_data ||
            data.locationData ||
            data.location ||
            data.ubicacion ||
            data.ubicacion_usuario ||
            data.metadata?.location
        );
        const displayHint = normalizeDisplayHint(
          pickFirstString(
            data.display_hint,
            data.displayHint,
            data.template,
            data.metadata?.display_hint
          )
        );
        const chatBubbleStyle = normalizeBubbleStyle(
          pickFirstString(
            data.chat_bubble_style,
            data.chatBubbleStyle,
            data.bubbleStyle,
            data.metadata?.chat_bubble_style
          )
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

        let text = rawText ?? (hasNonTextContent ? '' : '⚠️ No se pudo generar una respuesta.');
        if (text && /es el Administrador de la Municipalidad/i.test(text)) {
          text = text
            .replace(/,?\s*[^.]*es el Administrador de la Municipalidad\.\s*/i, ' ')
            .replace(/^Hola\s+/, 'Hola, ')
            .replace(/\s{2,}/g, ' ')
            .trim();
        }

        const ticketCandidate = data.ticket_id ?? data.ticketId ?? data.ticket?.id;
        let ticketId: number | undefined;
        if (typeof ticketCandidate === 'number' && Number.isFinite(ticketCandidate)) {
          ticketId = ticketCandidate;
        } else if (typeof ticketCandidate === 'string') {
          const parsed = Number.parseInt(ticketCandidate, 10);
          if (Number.isFinite(parsed)) {
            ticketId = parsed;
          }
        }

        const messageIdCandidate = data.id ?? data.message_id ?? data.messageId;
        const messageId =
          typeof messageIdCandidate === 'number' || typeof messageIdCandidate === 'string'
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
          typeof timestampCandidate === 'string' || typeof timestampCandidate === 'number'
            ? timestampCandidate
            : Date.now();

        const explicitError = (() => {
          const candidate =
            data.isError ?? data.is_error ?? data.error ?? data.metadata?.isError ?? data.metadata?.is_error;
          if (typeof candidate === 'boolean') {
            return candidate;
          }
          if (typeof candidate === 'string') {
            const normalized = candidate.trim().toLowerCase();
            if (['true', '1', 'yes', 'si', 'sí'].includes(normalized)) return true;
            if (['false', '0', 'no'].includes(normalized)) return false;
          }
          return undefined;
        })();

        const botMessage: Message = {
          id: messageId,
          text,
          isBot: true,
          timestamp: new Date(timestampValue),
          origen: data.origen ?? data.source,
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
        setMessages(prev => [...prev, ...normalizedMessages]);
      } else {
        setMessages(prev => [
          ...prev,
          {
            id: generateClientMessageId(),
            text: '⚠️ No se pudo procesar la respuesta del servidor.',
            isBot: true,
            timestamp: new Date(),
            isError: true,
          },
        ]);
      }

      setIsTyping(false);
    };

    const handleDisconnect = () => {
      console.log('Socket.IO disconnected.');
    };

    safeOn(socket, 'bot_response', handleBotMessage);
    safeOn(socket, 'message', handleBotMessage);
    safeOn(socket, 'disconnect', handleDisconnect);

    // Cleanup on component unmount
    return () => {
      socket.off?.('connect', handleConnect);
      socket.off?.('connect_error', handleConnectError);
      socket.off?.('bot_response', handleBotMessage);
      socket.off?.('message', handleBotMessage);
      socket.off?.('disconnect', handleDisconnect);
      socket.disconnect();
    };
}, [entityToken, tipoChat]);

  useEffect(() => {
    if (contexto.estado_conversacion === 'confirmando_reclamo' && !activeTicketId) {
      const newKey = uuidv4();
      setCurrentClaimIdempotencyKey(newKey);
      console.log("useChatLogic: Generated idempotency key for claim confirmation:", newKey);
    }
  }, [contexto.estado_conversacion, activeTicketId]);

  const addSystemMessage = useCallback((text: string, type: 'error' | 'info' = 'info') => {
    const systemMessage: Message = {
      id: generateClientMessageId(),
      text,
      isBot: true,
      timestamp: new Date(),
      isError: type === 'error',
    };
    setMessages(prev => [...prev, systemMessage]);
    setIsTyping(false); // Ensure typing indicator is turned off for system messages
  }, []);

  const handleSend = useCallback(async (payload: string | TypeSendPayload) => {
    const actualPayload: TypeSendPayload = typeof payload === 'string' ? { text: payload.trim() } : { ...payload, text: payload.text?.trim() || "" };

    // Sanitize text by removing emojis to prevent issues with backend services like Google Search.
    const emojiRegex = /([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g;
    let sanitizedText = (actualPayload.text || "").replace(emojiRegex, '').trim();

    const { text: userMessageText, attachmentInfo, ubicacion_usuario, action, location } = actualPayload;
    const actionPayload = 'payload' in actualPayload ? actualPayload.payload : undefined;

    // Allow confirming/cancelling a claim with free text when awaiting confirmation
    let resolvedAction = action;
    const awaitingConfirmation =
      contexto.estado_conversacion === 'confirmando_reclamo' ||
      contexto.reclamo_flow_v2?.state === 'ESPERANDO_CONFIRMACION';
    if (!resolvedAction && awaitingConfirmation) {
      const normalized = sanitizedText.toLowerCase();
      const confirmWords = ['1', 'si', 'sí', 's', 'ok', 'okay', 'acepto', 'aceptar', 'confirmar', 'confirmo'];
      const cancelWords = ['2', 'no', 'n', 'cancelar', 'cancel', 'rechazo', 'rechazar'];
      if (confirmWords.includes(normalized)) {
        resolvedAction = 'confirmar_reclamo';
      } else if (cancelWords.includes(normalized)) {
        resolvedAction = 'cancelar_reclamo';
      }
    }


    if (!userMessageText && !attachmentInfo && !ubicacion_usuario && !resolvedAction && !actualPayload.archivo_url && !location) return;
    if (isTyping) return;

    if (resolvedAction === 'iniciar_creacion_reclamo') {
      // Check for existing user data
      const userData = user || JSON.parse(safeLocalStorage.getItem('user') || 'null');
      if (userData?.name && userData?.email) { // Assume phone and DNI are not available in user object
        setContexto(prev => ({
          ...prev,
          estado_conversacion: 'confirmando_reclamo',
          datos_reclamo: {
            ...prev.datos_reclamo,
            nombre_ciudadano: userData.name,
            email_ciudadano: userData.email,
          }
        }));
        setMessages(prev => [...prev, {
          id: generateClientMessageId(),
          text: `Hola ${userData.name}. ¿Confirmas la creación del reclamo?`,
          isBot: true,
          timestamp: new Date(),
          botones: [
              { texto: "Confirmar Reclamo", action: "confirmar_reclamo" },
              { texto: "Cancelar", action: "cancelar_reclamo" },
          ]
        }]);
      } else {
        setContexto(prev => ({
          ...prev,
          estado_conversacion: 'recolectando_datos_personales'
        }));
        setMessages(prev => [...prev, {
          id: generateClientMessageId(),
          text: "Para continuar, por favor completá tus datos.",
          isBot: true,
          timestamp: new Date(),
        }]);
      }
      setIsTyping(false);
      return;
    }

    if (resolvedAction === 'submit_personal_data' && actionPayload) {
      setContexto(prev => ({
        ...prev,
        estado_conversacion: 'confirmando_reclamo',
        datos_reclamo: {
          ...prev.datos_reclamo,
          nombre_ciudadano: actionPayload.nombre,
          email_ciudadano: actionPayload.email,
          telefono_ciudadano: actionPayload.telefono,
          dni_ciudadano: actionPayload.dni,
        }
      }));
       setMessages(prev => [...prev, {
        id: generateClientMessageId(),
        text: "¡Gracias! Revisa que los datos sean correctos y confirma para generar el reclamo.",
        isBot: true,
        timestamp: new Date(),
        botones: [
            { texto: "Confirmar Reclamo", action: "confirmar_reclamo" },
            { texto: "Cancelar", action: "cancelar_reclamo" },
        ]
      }]);
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
      setMessages(prev => [...prev, userMessage]);
    }

    setIsTyping(true);

    try {
      const storedUser = JSON.parse(safeLocalStorage.getItem('user') || 'null');
      const rubro = storedUser?.rubro?.clave || storedUser?.rubro?.nombre || safeLocalStorage.getItem("rubroSeleccionado") || null;
      const tipoChatFinal = enforceTipoChatForRubro(tipoChat, rubro);

      const updatedContext = updateMunicipioContext(contexto, { userInput: userMessageText, action: resolvedAction });
      setContexto(updatedContext);

      const visitorName = getVisitorName();

      const requestBody: Record<string, any> = {
        pregunta: sanitizedText,
        contexto_previo: updatedContext,
        tipo_chat: tipoChatFinal,
        ...(rubro && { rubro_clave: rubro }),
        ...(attachmentInfo && { attachment_info: attachmentInfo }),
        ...(location && { location: location }),
        ...(resolvedAction && { action: resolvedAction }),
        ...(actionPayload && { payload: actionPayload }),
        ...(resolvedAction === "confirmar_reclamo" && currentClaimIdempotencyKey && { idempotency_key: currentClaimIdempotencyKey }),
        ...(visitorName && { nombre_usuario: visitorName }),
      };

      const legacyAttachmentUrl = attachmentInfo?.url || actualPayload.archivo_url;
      if (legacyAttachmentUrl) {
        requestBody.archivo_url = legacyAttachmentUrl;
      }

      const shouldMarkAsPhoto =
        actualPayload.es_foto === true ||
        (attachmentInfo?.mimeType ? attachmentInfo.mimeType.toLowerCase().startsWith('image/') : false);
      if (shouldMarkAsPhoto) {
        requestBody.es_foto = true;
      }

      if (resolvedAction === 'confirmar_reclamo') {
        requestBody.datos_personales = {
          nombre: contexto.datos_reclamo.nombre_ciudadano,
          email: contexto.datos_reclamo.email_ciudadano,
          telefono: contexto.datos_reclamo.telefono_ciudadano,
          dni: contexto.datos_reclamo.dni_ciudadano,
        }
      }

      const endpoint = getAskEndpoint({ tipoChat: tipoChatFinal, rubro });

      console.log('useChatLogic: Sending message to backend', { endpoint, requestBody });
      // Fire-and-forget the POST request. The response will be handled by the Socket.IO listener.
      apiFetch<any>(endpoint, { method: 'POST', body: requestBody, skipAuth })
        .then(res => {
          console.log('useChatLogic: Backend response', res);
        })
        .catch(error => {
          console.error("Error sending message:", error);
          const errorMsg = getErrorMessage(error, '⚠️ No se pudo enviar tu mensaje.');
          setMessages(prev => [...prev, { id: generateClientMessageId(), text: errorMsg, isBot: true, timestamp: new Date(), isError: true }]);
          setIsTyping(false);
        });

    } catch (error: any) {
      const errorMsg = getErrorMessage(error, '⚠️ Ocurrió un error inesperado.');
      setMessages(prev => [...prev, { id: generateClientMessageId(), text: errorMsg, isBot: true, timestamp: new Date(), isError: true }]);
      setIsTyping(false);
    }
  }, [contexto, activeTicketId, isTyping, isAnonimo, currentClaimIdempotencyKey, tipoChat]);

  return { messages, isTyping, handleSend, activeTicketId, setMessages, setContexto, setActiveTicketId, contexto, addSystemMessage };
}
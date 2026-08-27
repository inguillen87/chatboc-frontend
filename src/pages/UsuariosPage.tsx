import React, { useEffect, useState } from "react";
import { apiFetch, getErrorMessage } from "@/utils/api";
import { safeLocalStorage } from "@/utils/safeLocalStorage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import useRequireRole from "@/hooks/useRequireRole";
import type { Role } from "@/utils/roles";
import { toast } from "@/components/ui/use-toast";
import { getTenant } from "@/utils/tenant";
import { useUser } from "@/hooks/useUser";
import { useSocket } from "@/context/SocketContext";
import { Bell, Clock3, Flame, History, MessageSquare, Phone, Target } from "lucide-react";
import CampaignPreparationPanel from "@/components/admin/CampaignPreparationPanel";
import type { CampaignChannel } from "@/features/campaigns/campaignPreparationTypes";
import { shouldRenderProfileImage } from "@/utils/avatarConsent";
import CrmPeopleWorkspace from "@/features/crm/people/CrmPeopleWorkspace";
import {
  hasSensitiveCrmContent,
  redactSensitiveCrmText,
} from "@/features/crm/people/sensitiveContent";
import {
  useCrmWorkspaceState,
  useDebouncedValue,
} from "@/features/crm/people/useCrmWorkspaceState";

type RawUsuario = Record<string, any>;

export interface Usuario {
  id: number | string;
  nombre: string;
  email: string;
  emailRaw?: string | null;
  emailIsPlaceholder?: boolean;
  telefono?: string | null;
  whatsappNumber?: string | null;
  whatsappExplicit?: boolean;
  etiquetas: string[];
  canal?: string | null;
  origen?: string | null;
  createdAt?: string | null;
  lastSeen?: string | null;
  marketing?: boolean;
  profileExcerpt?: string | null;
  nameQuality?: string | null;
  totalOrders?: number;
  ltv?: number;
  contactId?: string | null;
  resumen?: string | null;
  motivo?: string | null;
  lastIntent?: string | null;
  leadTemperature?: "hot" | "warm" | "cold" | string | null;
  leadScore?: number;
  conversationStatus?: string | null;
  suggestedActions?: string[];
  interactionCount?: number | null;
  lastMessageExcerpt?: string | null;
  avatarUrl?: string | null;
  avatarSource?: string | null;
  avatarConsent?: boolean | string | number | null;
}

interface CampaignHistoryItem {
  campaign_id?: string;
  channel?: string;
  message_preview?: string;
  first_at?: string | null;
  last_at?: string | null;
  scheduled_for?: string | null;
  status_counts?: Record<string, number>;
  sent_count?: number;
  delivered_count?: number;
  read_count?: number;
  registered_without_delivery_evidence_count?: number;
  blocked_count?: number;
  contacts_count?: number;
}

interface CampaignLedgerItem {
  id: number | string;
  campaign_id?: string;
  event_type?: string;
  channel?: string;
  status?: string;
  reason?: string;
  content_preview?: string;
  created_at?: string | null;
  contact?: {
    id?: string;
    name?: string;
    phone?: string | null;
    email?: string | null;
    service_window_until?: string | null;
  } | null;
}

interface NotificationCenterItem {
  id: number | string;
  channel?: string | null;
  recipient?: string | null;
  subject?: string | null;
  body_preview?: string | null;
  status?: string | null;
  attempt_count?: number | null;
  next_retry_at?: string | null;
  sent_at?: string | null;
  last_error?: string | null;
  metadata?: Record<string, any>;
  created_at?: string | null;
}

const phoneCandidates = [
  "telefono",
  "phone",
  "phone_number",
  "phoneNumber",
  "celular",
  "celular_numero",
  "telefono_celular",
  "tel",
  "numero",
  "numero_contacto",
];

const whatsappCandidates = ["whatsapp", "whatsapp_number", "whatsapp_numero", "whatsappNumber"];

const labelCandidates = ["etiquetas", "tags", "labels"];
const nameCandidates = ["display_name", "name", "full_name", "nombre"];
const emailCandidates = ["email", "correo", "mail"];
const placeholderEmailSuffixes = ["@whatsapp.chatboc.com", "@anon.chatboc.com"];

const normalizeString = (value: unknown): string | null => {
  if (typeof value === "string" && value.trim()) return value.trim();
  return null;
};

const pickFirstString = (keys: string[], source: RawUsuario): string | null => {
  for (const key of keys) {
    const candidate = normalizeString(source[key]);
    if (candidate) return candidate;
  }
  return null;
};

const isPlaceholderEmail = (value?: string | null): boolean => {
  const email = (value || "").trim().toLowerCase();
  return placeholderEmailSuffixes.some((suffix) => email.endsWith(suffix));
};

const normalizeEmail = (value?: string | null): string | null => {
  const email = (value || "").trim().toLowerCase();
  if (!email || isPlaceholderEmail(email)) return null;
  return email;
};

const normalizePhone = (value?: string | null): string | null => {
  const raw = (value || "").trim();
  if (!raw) return null;
  const digits = raw.replace(/[^\d+]/g, "");
  if (!digits) return null;
  return digits;
};

const normalizeStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.map(normalizeString).filter(Boolean) as string[];
};

const looksLikeConversationName = (value?: string | null): boolean => {
  const text = (value || "").trim().toLowerCase();
  if (!text) return false;
  const markers = [
    " es tu codigo",
    " es tu código",
    "no lo compartas",
    "quisiera saber",
    "para que servis",
    "para qué servís",
    "hola hola",
    "hola.",
  ];
  return (
    text.length > 80 ||
    markers.some((marker) => text.includes(marker)) ||
    hasSensitiveCrmContent(text)
  );
};

const humanizeChannel = (value?: string | null): string => {
  const raw = (value || "").trim().toLowerCase();
  if (!raw) return "Sin canal";
  if (raw.includes("whatsapp") || raw === "wa") return "WhatsApp";
  if (raw.includes("widget") || raw.includes("web")) return "Widget web";
  if (raw.includes("voice") || raw.includes("voz")) return "Voz";
  if (raw.includes("email")) return "Email";
  return raw.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
};

const humanizeIntent = (value?: string | null): string => {
  const raw = (value || "").trim();
  if (!raw) return "Sin motivo";
  const labels: Record<string, string> = {
    lead_hot: "Interes comercial",
    reclamo: "Reclamo",
    encuestas: "Encuestas",
    pedido_catalogo: "Pedido o catalogo",
    educacion: "Educacion",
    soporte: "Soporte",
    saludo: "Primer contacto",
    consulta_general: "Consulta general",
  };
  return labels[raw] || raw.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
};

export const getCrmProfileScore = (usuario: Pick<
  Usuario,
  | "nombre"
  | "email"
  | "telefono"
  | "marketing"
  | "resumen"
  | "motivo"
  | "lastIntent"
  | "interactionCount"
  | "lastSeen"
  | "avatarUrl"
  | "avatarSource"
  | "avatarConsent"
>): number => {
  const realName = Boolean(usuario.nombre && !["Sin nombre", "Contacto WhatsApp", "Contacto sin identificar"].includes(usuario.nombre));
  const realEmail = Boolean(normalizeEmail(usuario.email));
  const hasPhone = Boolean(usuario.telefono);
  const hasContext = Boolean(usuario.resumen || usuario.motivo || usuario.lastIntent);
  const hasHistory = Number(usuario.interactionCount ?? 0) > 0;
  const hasRecentContact = Boolean(usuario.lastSeen);
  const hasConsentedAvatar = shouldRenderProfileImage({
    avatarUrl: usuario.avatarUrl,
    source: usuario.avatarSource,
    consented: usuario.avatarConsent,
  });

  const score =
    (realName ? 15 : 0) +
    (hasPhone ? 22 : 0) +
    (realEmail ? 16 : 0) +
    (hasConsentedAvatar ? 10 : 0) +
    (usuario.marketing ? 10 : 0) +
    (hasContext ? 17 : 0) +
    (hasHistory ? 6 : 0) +
    (hasRecentContact ? 4 : 0);

  return Math.max(0, Math.min(100, score));
};

export const crmProfileTone = (score: number) => {
  if (score >= 75) {
    return {
      label: "Perfil completo",
      className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-100",
      barClassName: "bg-emerald-500",
    };
  }
  if (score >= 50) {
    return {
      label: "Perfil accionable",
      className: "border-sky-500/40 bg-sky-500/10 text-sky-100",
      barClassName: "bg-sky-500",
    };
  }
  return {
    label: "Perfil incompleto",
    className: "border-amber-500/40 bg-amber-500/10 text-amber-100",
    barClassName: "bg-amber-500",
  };
};

export const resolveCrmNextAction = (usuario: Pick<
  Usuario,
  | "telefono"
  | "email"
  | "marketing"
  | "leadTemperature"
  | "resumen"
  | "motivo"
  | "lastIntent"
  | "avatarUrl"
  | "avatarSource"
  | "avatarConsent"
>): string => {
  const hasPhone = Boolean(usuario.telefono);
  const realEmail = Boolean(normalizeEmail(usuario.email));
  const hasConsentedAvatar = shouldRenderProfileImage({
    avatarUrl: usuario.avatarUrl,
    source: usuario.avatarSource,
    consented: usuario.avatarConsent,
  });

  if (!hasPhone && !realEmail) return "Pedir dato de contacto";
  if ((usuario.leadTemperature || "").toLowerCase() === "hot") return "Priorizar respuesta comercial";
  if (!usuario.resumen && !usuario.motivo && !usuario.lastIntent) return "Completar contexto con IA";
  if (!hasConsentedAvatar) return "Invitar a completar perfil";
  if (!usuario.marketing) return "Solicitar opt-in";
  return "Listo para seguimiento";
};

export const normalizeUsuario = (raw: RawUsuario, index: number): Usuario => {
  const genericPhone =
    pickFirstString(phoneCandidates, raw) ||
    normalizeString(raw?.contacto?.telefono) ||
    normalizeString(raw?.datos_contacto?.telefono) ||
    normalizeString(raw?.datos_contacto?.celular) ||
    normalizeString(raw?.profile?.telefono);
  const explicitWhatsappPhone =
    pickFirstString(whatsappCandidates, raw) ||
    normalizeString(raw?.contacto?.whatsapp) ||
    normalizeString(raw?.datos_contacto?.whatsapp) ||
    normalizeString(raw?.profile?.whatsapp);
  const canal = normalizeString(raw.canal || raw.channel || raw.via || raw.platform);
  const whatsappChannelExplicit = humanizeChannel(canal) === "WhatsApp";
  const telefono = genericPhone || explicitWhatsappPhone;
  const whatsappNumber = explicitWhatsappPhone || (whatsappChannelExplicit ? telefono : null);
  const whatsappExplicit = Boolean(explicitWhatsappPhone || whatsappChannelExplicit);

  const etiquetas = labelCandidates.reduce<string[]>((acc, key) => {
    const value = raw[key];
    if (Array.isArray(value)) {
      const normalized = value
        .map(normalizeString)
        .filter(Boolean) as string[];
      return [...acc, ...normalized];
    }
    return acc;
  }, []);

  const emailRaw = pickFirstString(emailCandidates, raw);
  const email = normalizeEmail(emailRaw);
  const rawNameCandidate = pickFirstString(nameCandidates, raw);
  const nameLooksLikeMessage = looksLikeConversationName(rawNameCandidate);
  const rawName = nameLooksLikeMessage
    ? (whatsappExplicit ? "Contacto WhatsApp" : "Contacto sin identificar")
    : (rawNameCandidate || "Sin nombre");
  const nameQuality = normalizeString(raw.name_quality || raw.nameQuality);
  const profileExcerpt =
    redactSensitiveCrmText(raw.profile_excerpt || raw.profileExcerpt) ||
    (nameLooksLikeMessage ? redactSensitiveCrmText(rawNameCandidate) : null);
  const resumen = redactSensitiveCrmText(
    raw.summary || raw.conversation_summary || raw.conversationSummary || raw.resumen,
  );
  const motivo = redactSensitiveCrmText(
    raw.motivo || raw.reason || raw.last_reason || raw.lastReason,
  );
  const lastIntent = redactSensitiveCrmText(
    raw.last_intent || raw.lastIntent || raw.intent,
  );
  const suggestedActions = normalizeStringArray(
    raw.suggested_actions || raw.suggestedActions,
  )
    .map(redactSensitiveCrmText)
    .filter(Boolean) as string[];
  const contactId = normalizeString(raw.contact_id || raw.contactId);
  const profile = raw.profile || raw.customer_profile || raw.contact_profile || raw.identity || {};
  const avatarUrl =
    normalizeString(raw.avatar_url || raw.profile_picture_url || raw.picture) ||
    normalizeString(profile.avatar_url || profile.profile_picture_url || profile.picture);
  const avatarSource =
    normalizeString(raw.avatar_source || raw.profile_picture_source || raw.picture_source) ||
    normalizeString(profile.avatar_source || profile.profile_picture_source || profile.source);
  const avatarConsent =
    raw.avatar_consent ??
    raw.profile_picture_consent ??
    profile.avatar_consent ??
    profile.profile_picture_consent ??
    false;

  return {
    id: raw.id ?? raw.user_id ?? index,
    nombre: rawName,
    email: email || "Sin email real",
    emailRaw,
    emailIsPlaceholder: Boolean(raw.email_is_placeholder ?? isPlaceholderEmail(emailRaw)),
    telefono: normalizePhone(telefono),
    whatsappNumber: normalizePhone(whatsappNumber),
    whatsappExplicit,
    etiquetas,
    canal,
    origen: normalizeString(raw.origen || raw.source || raw.data_source || raw.dataSource || raw.origin),
    createdAt:
      normalizeString(raw.created_at) ||
      normalizeString(raw.fecha_creacion) ||
      normalizeString(raw.createdAt),
    lastSeen:
      normalizeString(raw.last_seen) ||
      normalizeString(raw.ultima_interaccion) ||
      normalizeString(raw.updated_at) ||
      normalizeString(raw.updatedAt),
    marketing: Boolean(raw.acepta_marketing ?? raw.marketing ?? raw.opt_in_marketing),
    profileExcerpt,
    nameQuality,
    totalOrders: Number(raw.total_orders ?? raw.totalOrders ?? 0) || 0,
    ltv: Number(raw.ltv ?? 0) || 0,
    contactId,
    resumen,
    motivo,
    lastIntent,
    leadTemperature: normalizeString(raw.lead_temperature || raw.leadTemperature),
    leadScore: Number(raw.lead_score ?? raw.leadScore ?? 0) || 0,
    conversationStatus: normalizeString(raw.conversation_status || raw.conversationStatus),
    suggestedActions,
    interactionCount: raw.interaction_count ?? raw.interactionCount ?? null,
    lastMessageExcerpt: redactSensitiveCrmText(
      raw.last_message_excerpt || raw.lastMessageExcerpt,
    ),
    avatarUrl,
    avatarSource,
    avatarConsent,
  };
};

export const hasExplicitWhatsApp = (
  usuario: Pick<Usuario, "canal" | "whatsappExplicit" | "whatsappNumber" | "telefono">,
): boolean => {
  const explicitChannel = humanizeChannel(usuario.canal) === "WhatsApp";
  const number = usuario.whatsappNumber || (explicitChannel ? usuario.telefono : null);
  return Boolean(number && (usuario.whatsappExplicit || explicitChannel));
};

export const getExplicitWhatsAppUrl = (
  usuario: Pick<Usuario, "canal" | "whatsappExplicit" | "whatsappNumber" | "telefono">,
): string | null => {
  if (!hasExplicitWhatsApp(usuario)) return null;
  const explicitChannel = humanizeChannel(usuario.canal) === "WhatsApp";
  const number = usuario.whatsappNumber || (explicitChannel ? usuario.telefono : null);
  if (!number?.startsWith("+")) return null;
  const digits = number.replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}` : null;
};

const normalizeTenantIdentity = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return normalized || null;
};

export const eventBelongsToTenant = (payload: RawUsuario, tenantSlug?: string | null): boolean => {
  const expected = normalizeTenantIdentity(tenantSlug);
  if (!expected) return false;
  const record = payload?.contact || payload?.cliente || payload;
  const received = normalizeTenantIdentity(
    payload?.tenant_slug ||
      payload?.tenantSlug ||
      payload?.tenant ||
      payload?.payload?.tenant_slug ||
      record?.tenant_slug ||
      record?.tenantSlug ||
      record?.tenant,
  );
  return Boolean(received && received === expected);
};

export interface UsuariosPageProps {
  tenantSlugOverride?: string | null;
}

export default function UsuariosPage({ tenantSlugOverride }: UsuariosPageProps = {}) {
  useRequireRole(['tenant_admin', 'employee', 'superadmin'] as Role[]);
  const navigate = useNavigate();
  const { user } = useUser();
  const { socket, isConnected } = useSocket();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const search = useDebouncedValue(searchInput, 350);
  const [marketingOnly, setMarketingOnly] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [campaignHistory, setCampaignHistory] = useState<CampaignHistoryItem[]>([]);
  const [campaignLedger, setCampaignLedger] = useState<CampaignLedgerItem[]>([]);
  const [notificationCenter, setNotificationCenter] = useState<NotificationCenterItem[]>([]);
  const [campaignActivityLoading, setCampaignActivityLoading] = useState(false);
  const [realtimeEvents, setRealtimeEvents] = useState(0);
  const fetchSequenceRef = React.useRef(0);
  const { activeView, selectedContactId, setActiveView, setSelectedContactId } = useCrmWorkspaceState();

  const tenantSlug = React.useMemo(
    () =>
      getTenant({
        userTenant:
          tenantSlugOverride ||
          user?.tenantSlug ||
          (user as any)?.tenant_slug ||
          safeLocalStorage.getItem('tenantSlug'),
      }),
    [tenantSlugOverride, user],
  );

  const getPersonKey = React.useCallback(
    (usuario: Usuario) => usuario.contactId || String(usuario.id),
    [],
  );

  const sortedUsuarios = React.useMemo(
    () =>
      [...usuarios].sort((a, b) => {
        const aTime = a.lastSeen ? Date.parse(a.lastSeen) : 0;
        const bTime = b.lastSeen ? Date.parse(b.lastSeen) : 0;
        if (aTime !== bTime) return bTime - aTime;
        return a.nombre.localeCompare(b.nombre, "es");
      }),
    [usuarios],
  );

  const selectedUsuarios = React.useMemo(
    () => usuarios.filter((usuario) => selectedIds.has(String(usuario.id))),
    [selectedIds, usuarios],
  );

  const selectedCampaignContactIds = React.useMemo(
    () =>
      selectedUsuarios
        .map(
          (usuario) =>
            usuario.contactId ||
            (String(usuario.id).startsWith("contact:")
              ? String(usuario.id).replace("contact:", "")
              : null),
        )
        .filter((id): id is string => Boolean(id)),
    [selectedUsuarios],
  );

  const hasRealEmail = (usuario: Usuario) => Boolean(usuario.email && usuario.email !== "Sin email real");

  const fetchData = React.useCallback(async (options: { silent?: boolean } = {}) => {
    const requestSequence = ++fetchSequenceRef.current;
    const token = safeLocalStorage.getItem("authToken");
    if (!token) {
      navigate("/login");
      return;
    }
    if (!options.silent) setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('q', search.trim());
      if (marketingOnly) params.set('marketing', 'true');
      const url = `/api/crm/clientes${params.toString() ? `?${params.toString()}` : ''}`;
      const data = await apiFetch<RawUsuario[]>(url);
      if (requestSequence !== fetchSequenceRef.current) return;
      if (Array.isArray(data)) {
        setUsuarios(data.map((item, index) => normalizeUsuario(item, index)));
      }
      setError(null);
    } catch (e) {
      if (requestSequence !== fetchSequenceRef.current) return;
      setError(getErrorMessage(e, 'No se pudieron cargar los usuarios'));
    } finally {
      if (requestSequence === fetchSequenceRef.current && !options.silent) setLoading(false);
    }
  }, [navigate, search, marketingOnly]);

  const fetchCampaignActivity = React.useCallback(async () => {
    if (!tenantSlug) return;
    setCampaignActivityLoading(true);
    try {
      const encoded = encodeURIComponent(tenantSlug);
      const [historyResponse, ledgerResponse, notificationResponse] = await Promise.all([
        apiFetch<{ items?: CampaignHistoryItem[] }>(`/api/admin/tenants/${encoded}/campaigns/history?limit=6&days=30`),
        apiFetch<{ items?: CampaignLedgerItem[] }>(`/api/admin/tenants/${encoded}/campaigns/ledger?limit=10&days=30`),
        apiFetch<{ items?: NotificationCenterItem[]; counts?: Record<string, number> }>(`/api/admin/tenants/${encoded}/notifications/center?limit=8`),
      ]);
      setCampaignHistory(Array.isArray(historyResponse?.items) ? historyResponse.items : []);
      setCampaignLedger(Array.isArray(ledgerResponse?.items) ? ledgerResponse.items : []);
      setNotificationCenter(Array.isArray(notificationResponse?.items) ? notificationResponse.items : []);
    } catch (activityError) {
      console.warn("No se pudo cargar actividad de campanas CRM", activityError);
    } finally {
      setCampaignActivityLoading(false);
    }
  }, [tenantSlug]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (activeView === "campanas" || activeView === "actividad") {
      void fetchCampaignActivity();
    }
  }, [activeView, fetchCampaignActivity]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      fetchData({ silent: true });
    }, 30000);
    return () => window.clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    if (!socket) return;

    const upsertFromRealtime = (payload: any) => {
      // Realtime is fail-closed: a contact event must prove the same tenant as
      // the active workspace. Polling remains the fallback for legacy events
      // without tenant identity.
      if (!eventBelongsToTenant(payload, tenantSlug)) return;
      if (search.trim() || marketingOnly) {
        void fetchData({ silent: true });
        return;
      }
      const raw = payload?.contact || payload?.cliente || payload;
      if (!raw || typeof raw !== "object") return;
      const incoming = normalizeUsuario(raw, usuarios.length);
      setUsuarios((prev) => {
        const incomingKey = incoming.contactId || String(incoming.id);
        const idx = prev.findIndex((u) => {
          const key = u.contactId || String(u.id);
          return key === incomingKey || (incoming.telefono && u.telefono === incoming.telefono);
        });
        if (idx === -1) return [incoming, ...prev];
        const next = [...prev];
        next[idx] = { ...next[idx], ...incoming };
        return next;
      });
    };

    const refreshActivityFromRealtime = (payload: any) => {
      const payloadSlug =
        payload?.tenant_slug ||
        payload?.tenant ||
        payload?.payload?.tenant_slug ||
        payload?.notification?.tenant_slug;
      if (payloadSlug && tenantSlug && payloadSlug !== tenantSlug) return;
      setRealtimeEvents((prev) => prev + 1);
      if (activeView === "campanas" || activeView === "actividad") {
        void fetchCampaignActivity();
      }
    };

    socket.on("crm.contact.updated", upsertFromRealtime);
    socket.on("crm_contact_updated", upsertFromRealtime);
    socket.on("crm.notification.updated", refreshActivityFromRealtime);
    socket.on("crm_notification_updated", refreshActivityFromRealtime);
    socket.on("notification.updated", refreshActivityFromRealtime);
    socket.on("notification.sent", refreshActivityFromRealtime);
    socket.on("notification.failed", refreshActivityFromRealtime);
    return () => {
      socket.off("crm.contact.updated", upsertFromRealtime);
      socket.off("crm_contact_updated", upsertFromRealtime);
      socket.off("crm.notification.updated", refreshActivityFromRealtime);
      socket.off("crm_notification_updated", refreshActivityFromRealtime);
      socket.off("notification.updated", refreshActivityFromRealtime);
      socket.off("notification.sent", refreshActivityFromRealtime);
      socket.off("notification.failed", refreshActivityFromRealtime);
    };
  }, [activeView, fetchCampaignActivity, fetchData, marketingOnly, search, socket, tenantSlug, usuarios.length]);

  useEffect(() => {
    setSelectedIds((prev) => {
      const validIds = new Set(usuarios.map((usuario) => String(usuario.id)));
      const next = new Set([...prev].filter((id) => validIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [usuarios]);

  useEffect(() => {
    if (activeView !== "personas" || usuarios.length === 0) return;
    const selectionExists = usuarios.some((usuario) => getPersonKey(usuario) === selectedContactId);
    if (!selectionExists) setSelectedContactId(getPersonKey(usuarios[0]));
  }, [activeView, getPersonKey, selectedContactId, setSelectedContactId, usuarios]);

  const toggleSelected = (id: number | string) => {
    const key = String(id);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const selectMarketingContacts = (channel: CampaignChannel) => {
    setSelectedIds(
      new Set(
        usuarios
          .filter((usuario) =>
            usuario.marketing && (channel === 'email' ? hasRealEmail(usuario) : hasExplicitWhatsApp(usuario)),
          )
          .map((usuario) => String(usuario.id)),
      ),
    );
  };

  const formatDate = (value?: string | null) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const ledgerTone = (item: CampaignLedgerItem) => {
    const status = (item.status || "").toLowerCase();
    if (status === "blocked") return "border-amber-500/40 bg-amber-500/10 text-amber-100";
    if (status === "scheduled") return "border-sky-500/40 bg-sky-500/10 text-sky-100";
    return "border-emerald-500/40 bg-emerald-500/10 text-emerald-100";
  };

  const notificationStatusLabel = (value?: string | null) => {
    const raw = (value || "pending").toLowerCase();
    const labels: Record<string, string> = {
      sent: "Enviada",
      delivered: "Entregada",
      failed: "Fallida",
      pending: "Pendiente",
      queued: "En cola",
      retrying: "Reintentando",
    };
    return labels[raw] || raw.replace(/[_-]+/g, " ");
  };

  const notificationTone = (item: NotificationCenterItem) => {
    const status = (item.status || "").toLowerCase();
    if (status === "failed") return "border-red-500/40 bg-red-500/10 text-red-100";
    if (status === "sent" || status === "delivered") return "border-emerald-500/40 bg-emerald-500/10 text-emerald-100";
    return "border-sky-500/40 bg-sky-500/10 text-sky-100";
  };

  const marketingCount = React.useMemo(
    () => usuarios.filter((u) => u.marketing).length,
    [usuarios],
  );

  const hotLeadCount = React.useMemo(
    () => usuarios.filter((u) => (u.leadTemperature || "").toLowerCase() === "hot").length,
    [usuarios],
  );

  const summaryCount = React.useMemo(
    () => usuarios.filter((u) => Boolean(u.resumen || u.motivo || u.lastMessageExcerpt)).length,
    [usuarios],
  );

  const phoneCount = React.useMemo(
    () => usuarios.filter((u) => Boolean(u.telefono)).length,
    [usuarios],
  );

  const channelStats = React.useMemo(() => {
    const counts: Record<string, number> = {};
    usuarios.forEach((u) => {
      const channel = humanizeChannel(u.canal);
      counts[channel] = (counts[channel] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([label, total]) => ({ label, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 4);
  }, [usuarios]);

  const whatsappCount = usuarios.filter(hasExplicitWhatsApp).length;
  const crmScoreAverage = React.useMemo(
    () =>
      usuarios.length
        ? Math.round(usuarios.reduce((total, usuario) => total + getCrmProfileScore(usuario), 0) / usuarios.length)
        : 0,
    [usuarios],
  );
  const crmCompleteProfiles = React.useMemo(
    () => usuarios.filter((usuario) => getCrmProfileScore(usuario) >= 75).length,
    [usuarios],
  );
  const nextActionStats = React.useMemo(() => {
    const counts = new Map<string, number>();
    usuarios.forEach((usuario) => {
      const action = resolveCrmNextAction(usuario);
      counts.set(action, (counts.get(action) || 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([label, total]) => ({ label, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 4);
  }, [usuarios]);

  const copyToClipboard = async (value?: string | null, label = 'Dato') => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      toast({ title: `${label} copiado`, description: value });
    } catch {
      toast({ variant: 'destructive', title: 'No se pudo copiar', description: value });
    }
  };

  const whatsappUrl = (usuario: Usuario | string | null | undefined) =>
    typeof usuario === "object" && usuario ? getExplicitWhatsAppUrl(usuario) : null;

  if (loading) return <div className="p-8">Cargando...</div>;
  if (error) return <div className="p-8 text-destructive">{error}</div>;

  return (
      <CrmPeopleWorkspace
        activeView={activeView}
        onViewChange={setActiveView}
        people={sortedUsuarios}
        selectedContactId={selectedContactId}
        onSelectContact={setSelectedContactId}
        selectedIds={selectedIds}
        onToggleSelected={toggleSelected}
        search={searchInput}
        onSearchChange={setSearchInput}
        marketingOnly={marketingOnly}
        onMarketingOnlyChange={setMarketingOnly}
        onRefresh={() => {
          void fetchData({ silent: true });
          if (activeView === "campanas" || activeView === "actividad") {
            void fetchCampaignActivity();
          }
        }}
        onBack={() => navigate("/perfil")}
        isConnected={isConnected}
        metrics={[
          { label: "Personas", value: usuarios.length, helper: "registros disponibles" },
          { label: "Canal WhatsApp", value: whatsappCount, helper: "solo evidencia explícita" },
          { label: "Opt-in", value: marketingCount, helper: "consentimientos registrados" },
          { label: "Calidad CRM", value: `${crmScoreAverage}%`, helper: `${crmCompleteProfiles} perfiles completos` },
        ]}
        getPersonKey={getPersonKey}
        hasRealEmail={hasRealEmail}
        hasExplicitWhatsApp={hasExplicitWhatsApp}
        whatsappUrl={(usuario) => whatsappUrl(usuario as Usuario)}
        profileScore={(usuario) => getCrmProfileScore(usuario as Usuario)}
        nextAction={(usuario) => resolveCrmNextAction(usuario as Usuario)}
        formatDate={formatDate}
        copyToClipboard={copyToClipboard}
        segmentsPanel={(
          <div className="space-y-4" data-testid="crm-segments-panel">
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Segmentos operativos</p>
                <h2 className="mt-1 text-xl font-bold">Audiencias accionables</h2>
                <p className="mt-1 text-sm text-muted-foreground">Grupos calculados sobre los datos publicados por el backend.</p>
              </div>
              <Badge variant="outline">{usuarios.length} personas analizadas</Badge>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: "Con teléfono", value: phoneCount, helper: "Canal telefónico general", icon: Phone },
                { label: "WhatsApp explícito", value: whatsappCount, helper: "No inferido por teléfono", icon: MessageSquare },
                { label: "Con contexto", value: summaryCount, helper: "Motivo o resumen CRM", icon: Target },
                { label: "Leads calientes", value: hotLeadCount, helper: "Prioridad comercial", icon: Flame },
              ].map(({ label, value, helper, icon: Icon }) => (
                <Card key={label} className="border-border/70">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-2"><p className="text-sm font-semibold">{label}</p><Icon className="h-4 w-4 text-primary" /></div>
                    <p className="mt-3 text-3xl font-bold">{value}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{helper}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              <Card className="border-border/70">
                <CardHeader className="pb-2"><CardTitle className="text-base">Distribución por canal</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {channelStats.length ? channelStats.map((item) => (
                    <div key={item.label} className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2 text-sm"><span>{item.label}</span><Badge variant="secondary">{item.total}</Badge></div>
                  )) : <p className="text-sm text-muted-foreground">Sin canales publicados.</p>}
                </CardContent>
              </Card>
              <Card className="border-border/70">
                <CardHeader className="pb-2"><CardTitle className="text-base">Cola de próxima acción</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {nextActionStats.length ? nextActionStats.map((item) => (
                    <div key={item.label} className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2 text-sm"><span>{item.label}</span><Badge variant="outline">{item.total}</Badge></div>
                  )) : <p className="text-sm text-muted-foreground">Sin acciones pendientes.</p>}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
        campaignsPanel={(
          <div className="space-y-4" data-testid="crm-campaigns-panel">
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Campañas</p>
                <h2 className="mt-1 text-xl font-bold">Preparación y consentimiento</h2>
                <p className="mt-1 text-sm text-muted-foreground">Seleccioná destinatarios desde Personas y validá el canal antes de preparar una campaña.</p>
              </div>
              <Badge variant="secondary">{selectedUsuarios.length} seleccionados</Badge>
            </div>
            <CampaignPreparationPanel
              tenantSlug={tenantSlug}
              selectedContactIds={selectedCampaignContactIds}
              selectedCount={selectedUsuarios.length}
              onSelectMarketingContacts={selectMarketingContacts}
            />
          </div>
        )}
        activityPanel={(
          <div className="space-y-4" data-testid="crm-activity-panel">
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Actividad multicanal</p>
                <h2 className="mt-1 text-xl font-bold">Eventos, campañas y entrega</h2>
                <p className="mt-1 text-sm text-muted-foreground">Un registro interno no se presenta como entrega si no existe recibo del proveedor.</p>
              </div>
              <div className="flex flex-wrap gap-2"><Badge variant={isConnected ? "default" : "outline"}>{isConnected ? "Socket conectado" : "Polling activo"}</Badge><Badge variant="secondary">{realtimeEvents} eventos live</Badge></div>
            </div>
            {campaignActivityLoading ? (
              <Card><CardContent className="p-5 text-sm text-muted-foreground">Cargando actividad operativa...</CardContent></Card>
            ) : (
              <div className="grid gap-3 xl:grid-cols-3">
                <Card className="border-border/70 xl:col-span-2">
                  <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Bell className="h-4 w-4 text-primary" />Centro de notificaciones</CardTitle></CardHeader>
                  <CardContent className="grid gap-2 md:grid-cols-2">
                    {notificationCenter.length ? notificationCenter.map((item) => (
                      <div key={item.id} className={`rounded-xl border p-3 text-sm ${notificationTone(item)}`}>
                        <div className="flex items-center justify-between gap-2"><Badge variant="outline">{item.channel || "canal"}</Badge><span className="text-xs">{notificationStatusLabel(item.status)}</span></div>
                        <p className="mt-2 truncate font-medium">{item.recipient || item.subject || "Destino sin publicar"}</p>
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{redactSensitiveCrmText(item.last_error || item.body_preview) || "Evento registrado por backend."}</p>
                      </div>
                    )) : <p className="text-sm text-muted-foreground md:col-span-2">Sin notificaciones recientes.</p>}
                  </CardContent>
                </Card>
                <Card className="border-border/70">
                  <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Clock3 className="h-4 w-4 text-primary" />Ledger 24 h</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {campaignLedger.length ? campaignLedger.slice(0, 6).map((item) => (
                      <div key={item.id} className={`rounded-lg border p-3 text-sm ${ledgerTone(item)}`}><div className="flex items-center justify-between gap-2"><span className="font-semibold">{item.status === "blocked" ? "Bloqueado" : "Registrado"}</span><Badge variant="outline">{item.channel || "canal"}</Badge></div><p className="mt-1 truncate text-xs text-muted-foreground">{item.contact?.name || item.contact?.phone || item.contact?.email || "Contacto sin nombre"}</p></div>
                    )) : <p className="text-sm text-muted-foreground">Sin eventos recientes.</p>}
                  </CardContent>
                </Card>
                <Card className="border-border/70 xl:col-span-3">
                  <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><History className="h-4 w-4 text-primary" />Historial de campañas</CardTitle></CardHeader>
                  <CardContent className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                    {campaignHistory.length ? campaignHistory.map((item) => (
                      <div key={item.campaign_id || `${item.channel}-${item.first_at}`} className="rounded-xl border border-border/70 p-3"><div className="flex items-center justify-between gap-2"><Badge variant="secondary">{item.channel || "canal"}</Badge><span className="text-xs text-muted-foreground">{item.contacts_count || 0} contactos</span></div><p className="mt-2 line-clamp-2 text-sm font-medium">{redactSensitiveCrmText(item.message_preview) || "Campaña sin texto publicado."}</p><p className="mt-2 text-xs text-muted-foreground">{formatDate(item.last_at)}</p></div>
                    )) : <p className="text-sm text-muted-foreground">Todavía no hay campañas registradas.</p>}
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        )}
      />
  );
}

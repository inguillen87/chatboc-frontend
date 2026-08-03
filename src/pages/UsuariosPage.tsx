import React, { useEffect, useState } from "react";
import { apiFetch, getErrorMessage } from "@/utils/api";
import { safeLocalStorage } from "@/utils/safeLocalStorage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import useRequireRole from "@/hooks/useRequireRole";
import type { Role } from "@/utils/roles";
import { toast } from "@/components/ui/use-toast";
import { getTenant } from "@/utils/tenant";
import { useUser } from "@/hooks/useUser";
import { useSocket } from "@/context/SocketContext";
import { Activity, AlertTriangle, Bell, CheckCircle, Clock3, Copy, ExternalLink, Flame, History, ListChecks, Mail, MessageSquare, Phone, RefreshCw, Search, ShieldCheck, Tags, Target, UserRound, Users } from "lucide-react";
import IdentityAvatar from "@/components/identity/IdentityAvatar";
import CampaignPreparationPanel from "@/components/admin/CampaignPreparationPanel";
import type { CampaignChannel } from "@/features/campaigns/campaignPreparationTypes";
import { shouldRenderProfileImage } from "@/utils/avatarConsent";

type RawUsuario = Record<string, any>;

interface Usuario {
  id: number | string;
  nombre: string;
  email: string;
  emailRaw?: string | null;
  emailIsPlaceholder?: boolean;
  telefono?: string | null;
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
  "whatsapp",
  "whatsapp_number",
  "whatsapp_numero",
  "telefono_celular",
  "tel",
  "numero",
  "numero_contacto",
];

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
  return text.length > 80 || markers.some((marker) => text.includes(marker));
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

const humanizeSource = (value?: string | null): string => {
  const raw = (value || "").trim().toLowerCase();
  if (!raw) return "CRM";
  if (raw.includes("whatsapp_auto")) return "WhatsApp auto";
  if (raw.includes("legacy")) return "Registro legacy";
  if (raw.includes("widget")) return "Widget";
  if (raw.includes("demo")) return "Demo";
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

const temperatureMeta = (value?: string | null) => {
  const raw = (value || "cold").toLowerCase();
  if (raw === "hot") return { label: "Caliente", className: "border-red-500/40 bg-red-500/10 text-red-200" };
  if (raw === "warm") return { label: "Tibio", className: "border-amber-500/40 bg-amber-500/10 text-amber-100" };
  return { label: "Frio", className: "border-slate-500/40 bg-slate-500/10 text-slate-200" };
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

const normalizeUsuario = (raw: RawUsuario, index: number): Usuario => {
  const telefono =
    pickFirstString(phoneCandidates, raw) ||
    normalizeString(raw?.contacto?.telefono) ||
    normalizeString(raw?.contacto?.whatsapp) ||
    normalizeString(raw?.datos_contacto?.telefono) ||
    normalizeString(raw?.datos_contacto?.celular) ||
    normalizeString(raw?.profile?.telefono) ||
    normalizeString(raw?.profile?.whatsapp);

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
    ? (telefono ? "Contacto WhatsApp" : "Contacto sin identificar")
    : (rawNameCandidate || "Sin nombre");
  const nameQuality = normalizeString(raw.name_quality || raw.nameQuality);
  const profileExcerpt =
    normalizeString(raw.profile_excerpt || raw.profileExcerpt) ||
    (nameLooksLikeMessage ? rawNameCandidate : null);
  const resumen = normalizeString(raw.summary || raw.conversation_summary || raw.conversationSummary || raw.resumen);
  const motivo = normalizeString(raw.motivo || raw.reason || raw.last_reason || raw.lastReason);
  const lastIntent = normalizeString(raw.last_intent || raw.lastIntent || raw.intent);
  const suggestedActions = normalizeStringArray(raw.suggested_actions || raw.suggestedActions);
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
    etiquetas,
    canal: normalizeString(raw.canal || raw.channel || raw.via || raw.platform),
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
    lastMessageExcerpt: normalizeString(raw.last_message_excerpt || raw.lastMessageExcerpt),
    avatarUrl,
    avatarSource,
    avatarConsent,
  };
};

export default function UsuariosPage() {
  useRequireRole(['tenant_admin', 'employee', 'superadmin'] as Role[]);
  const navigate = useNavigate();
  const { user } = useUser();
  const { socket, isConnected } = useSocket();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [marketingOnly, setMarketingOnly] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: keyof Usuario; direction: 'asc' | 'desc' } | null>(null);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [campaignHistory, setCampaignHistory] = useState<CampaignHistoryItem[]>([]);
  const [campaignLedger, setCampaignLedger] = useState<CampaignLedgerItem[]>([]);
  const [notificationCenter, setNotificationCenter] = useState<NotificationCenterItem[]>([]);
  const [notificationCounts, setNotificationCounts] = useState<Record<string, number>>({});
  const [campaignActivityLoading, setCampaignActivityLoading] = useState(false);
  const [lastLiveUpdate, setLastLiveUpdate] = useState<string | null>(null);
  const [realtimeEvents, setRealtimeEvents] = useState(0);
  const pageSize = 25;

  const tenantSlug = React.useMemo(
    () =>
      getTenant({
        userTenant:
          user?.tenantSlug ||
          (user as any)?.tenant_slug ||
          safeLocalStorage.getItem('tenantSlug'),
      }),
    [user],
  );

  const sortedUsuarios = React.useMemo(() => {
    let sortableItems = [...usuarios];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];
        const aStr = (aVal ?? "").toString().toLowerCase();
        const bStr = (bVal ?? "").toString().toLowerCase();
        if (aStr < bStr) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aStr > bStr) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [usuarios, sortConfig]);

  const paginatedUsuarios = React.useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedUsuarios.slice(start, start + pageSize);
  }, [sortedUsuarios, page]);

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

  const pageIds = React.useMemo(
    () => paginatedUsuarios.map((usuario) => String(usuario.id)),
    [paginatedUsuarios],
  );

  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));

  const totalPages = Math.max(1, Math.ceil(sortedUsuarios.length / pageSize));
  const hasRealEmail = (usuario: Usuario) => Boolean(usuario.email && usuario.email !== "Sin email real");
  const hasPhone = (usuario: Usuario) => Boolean(usuario.telefono);

  const requestSort = (key: keyof Usuario) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const fetchData = React.useCallback(async (options: { silent?: boolean } = {}) => {
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
      if (Array.isArray(data)) {
        setUsuarios(data.map((item, index) => normalizeUsuario(item, index)));
      }
      setError(null);
    } catch (e) {
      setError(getErrorMessage(e, 'No se pudieron cargar los usuarios'));
    } finally {
      if (!options.silent) setLoading(false);
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
      setNotificationCounts(notificationResponse?.counts || {});
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
    fetchCampaignActivity();
  }, [fetchCampaignActivity]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      fetchData({ silent: true });
    }, 30000);
    return () => window.clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    if (!socket) return;

    const upsertFromRealtime = (payload: any) => {
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
      setLastLiveUpdate(new Date().toISOString());
    };

    const refreshActivityFromRealtime = (payload: any) => {
      const payloadSlug =
        payload?.tenant_slug ||
        payload?.tenant ||
        payload?.payload?.tenant_slug ||
        payload?.notification?.tenant_slug;
      if (payloadSlug && tenantSlug && payloadSlug !== tenantSlug) return;
      setRealtimeEvents((prev) => prev + 1);
      setLastLiveUpdate(new Date().toISOString());
      void fetchCampaignActivity();
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
  }, [fetchCampaignActivity, socket, tenantSlug, usuarios.length]);

  useEffect(() => {
    setPage(1);
  }, [sortedUsuarios.length]);

  useEffect(() => {
    setSelectedIds((prev) => {
      const validIds = new Set(usuarios.map((usuario) => String(usuario.id)));
      const next = new Set([...prev].filter((id) => validIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [usuarios]);

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

  const togglePageSelected = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allPageSelected) {
        pageIds.forEach((id) => next.delete(id));
      } else {
        pageIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const selectMarketingContacts = (channel: CampaignChannel) => {
    setSelectedIds(
      new Set(
        usuarios
          .filter((usuario) => usuario.marketing && (channel === 'email' ? hasRealEmail(usuario) : hasPhone(usuario)))
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

  const humanizeCampaignReason = (value?: string | null) => {
    const raw = (value || "").trim().toLowerCase();
    const labels: Record<string, string> = {
      opt_out: "Opt-out",
      missing_whatsapp: "Sin WhatsApp",
      missing_email: "Sin email",
      frequency_window: "Limite 24h",
    };
    return labels[raw] || raw.replace(/[_-]+/g, " ") || "Registrado";
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

  const emailCount = React.useMemo(
    () => usuarios.filter(hasRealEmail).length,
    [usuarios],
  );

  const contactCoverage = usuarios.length ? Math.round((phoneCount / usuarios.length) * 100) : 0;
  const whatsappCount = usuarios.filter((u) => humanizeChannel(u.canal) === 'WhatsApp' || Boolean(u.telefono)).length;
  const pendingEmailCount = Math.max(usuarios.length - emailCount, 0);
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
  const consentedAvatarCount = React.useMemo(
    () =>
      usuarios.filter((usuario) =>
        shouldRenderProfileImage({
          avatarUrl: usuario.avatarUrl,
          source: usuario.avatarSource,
          consented: usuario.avatarConsent,
        }),
      ).length,
    [usuarios],
  );
  const contactsMissingPrimaryChannel = React.useMemo(
    () => usuarios.filter((usuario) => !usuario.telefono && !hasRealEmail(usuario)).length,
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

  const whatsappUrl = (telefono?: string | null) => {
    if (!telefono?.startsWith('+')) return null;
    const digits = telefono.replace(/\D/g, '');
    return digits ? `https://wa.me/${digits}` : null;
  };

  if (loading) return <div className="p-8">Cargando...</div>;
  if (error) return <div className="p-8 text-destructive">{error}</div>;

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4 p-4 md:p-6">
      <header className="rounded-[28px] border border-border/70 bg-gradient-to-br from-background via-primary/5 to-sky-500/10 p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight">Usuarios y contactos</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              Centro de contactos con motivo de conversacion, temperatura del lead, consentimiento y campanas trazables.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={isConnected ? "default" : "outline"} className="gap-2">
              <Activity className="h-3.5 w-3.5" />
              {isConnected ? "Realtime activo" : "Auto-sync 30s"}
            </Badge>
            {lastLiveUpdate && (
              <Badge variant="secondary">Ultima senal {formatDate(lastLiveUpdate)}</Badge>
            )}
            <Button variant="outline" onClick={() => fetchData({ silent: true })} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Actualizar
            </Button>
            <Button variant="outline" onClick={() => navigate("/perfil")}>Volver</Button>
          </div>
        </div>
      </header>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <Users className="h-4 w-4" />
              Total
            </CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold">{usuarios.length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground">Con teléfono</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold">{phoneCount}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground">Opt-in marketing</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold">{marketingCount}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground">WhatsApp</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold">{whatsappCount}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <Flame className="h-4 w-4" />
              Leads calientes
            </CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold">{hotLeadCount}</CardContent>
        </Card>
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-border/70 bg-card p-3 text-sm">
          <div className="flex items-center gap-2 font-semibold">
            <Phone className="h-4 w-4 text-primary" />
            Cobertura de telefono
          </div>
          <p className="mt-1 text-2xl font-bold">{contactCoverage}%</p>
          <p className="text-xs text-muted-foreground">Contactos con telefono publicado.</p>
        </div>
        <div className="rounded-2xl border border-border/70 bg-card p-3 text-sm">
          <div className="flex items-center gap-2 font-semibold">
            <Mail className="h-4 w-4 text-primary" />
            Emails utilizables
          </div>
          <p className="mt-1 text-2xl font-bold">{emailCount.toLocaleString('es-AR')}</p>
          <p className="text-xs text-muted-foreground">{pendingEmailCount} sin email real.</p>
        </div>
        <div className="rounded-2xl border border-border/70 bg-card p-3 text-sm">
          <div className="font-semibold">Marketing</div>
          <p className="mt-1 text-2xl font-bold">{marketingCount.toLocaleString('es-AR')}</p>
          <p className="text-xs text-muted-foreground">Opt-in disponible para campanas.</p>
        </div>
        <div className="rounded-2xl border border-border/70 bg-card p-3 text-sm">
          <div className="flex items-center gap-2 font-semibold">
            <Target className="h-4 w-4 text-primary" />
            Con contexto CRM
          </div>
          <p className="mt-1 text-2xl font-bold">{summaryCount.toLocaleString('es-AR')}</p>
          <p className="text-xs text-muted-foreground">Contactos con motivo o resumen automatico.</p>
        </div>
      </div>
      {channelStats.length > 0 && (
        <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
          {channelStats.map((c) => (
            <Badge key={c.label} variant="secondary" className="gap-2">
              <span className="font-semibold text-foreground">{c.total}</span>
              <span>{c.label}</span>
            </Badge>
          ))}
        </div>
      )}
      <section
        data-testid="crm-profile-intelligence"
        className="overflow-hidden rounded-2xl border border-primary/20 bg-[linear-gradient(135deg,hsl(var(--card)),hsl(var(--primary)/0.08),hsl(var(--card)))] shadow-sm"
      >
        <div className="flex flex-col gap-3 border-b border-border/70 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Perfil 360 CRM</p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight">Identidad, consentimiento y proxima accion</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
              El CRM prioriza contactos reales, fotos consentidas, canales disponibles y contexto IA sin usar scraping ni imagenes inventadas.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{crmScoreAverage}% score medio</Badge>
            <Badge variant="outline">{crmCompleteProfiles} perfiles completos</Badge>
            <Badge variant="outline">{consentedAvatarCount} imagenes consentidas</Badge>
          </div>
        </div>
        <div className="grid divide-y divide-border/70 lg:grid-cols-[1fr_1fr_1.2fr] lg:divide-x lg:divide-y-0">
          <div className="p-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Calidad de datos
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-background">
              <div className="h-full rounded-full bg-primary" style={{ width: `${crmScoreAverage}%` }} />
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {contactsMissingPrimaryChannel} contactos sin telefono ni email real necesitan enriquecimiento antes de campanas.
            </p>
          </div>
          <div className="p-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <UserRound className="h-4 w-4 text-primary" />
              Identidad segura
            </div>
            <p className="mt-2 text-2xl font-bold">{consentedAvatarCount.toLocaleString('es-AR')}</p>
            <p className="text-sm text-muted-foreground">
              Fotos reales solo con login social, carga propia o fuente autorizada; el resto usa avatar deterministico.
            </p>
          </div>
          <div className="p-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Target className="h-4 w-4 text-primary" />
              Cola de proxima accion
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {nextActionStats.length ? (
                nextActionStats.map((item) => (
                  <Badge key={item.label} variant="secondary" className="gap-2">
                    <span className="font-semibold text-foreground">{item.total}</span>
                    {item.label}
                  </Badge>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">Sin contactos para priorizar todavia.</span>
              )}
            </div>
          </div>
        </div>
      </section>
      <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-3 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar nombre o email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 pl-9"
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={marketingOnly} onCheckedChange={(v) => setMarketingOnly(Boolean(v))} />
          Solo con marketing
        </label>
      </div>
      <CampaignPreparationPanel
        tenantSlug={tenantSlug}
        selectedContactIds={selectedCampaignContactIds}
        selectedCount={selectedUsuarios.length}
        onSelectMarketingContacts={selectMarketingContacts}
      />
      <Card className="border-border/70 bg-card/95 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Bell className="h-5 w-5 text-primary" />
                Centro realtime
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Senales de campanas, notificaciones y reintentos del tenant sin refrescar la pagina.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant={isConnected ? "default" : "outline"}>
                {isConnected ? "Socket conectado" : "Polling activo"}
              </Badge>
              <Badge variant="secondary">{realtimeEvents} eventos live</Badge>
              {Object.entries(notificationCounts).slice(0, 3).map(([status, count]) => (
                <Badge key={status} variant="outline">
                  {notificationStatusLabel(status)}: {count}
                </Badge>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {notificationCenter.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/70 bg-background/60 p-4 text-sm text-muted-foreground">
              Sin notificaciones operativas recientes. Cuando haya envios, errores o reintentos van a aparecer aca.
            </div>
          ) : (
            <div className="grid gap-2 md:grid-cols-2">
              {notificationCenter.map((item) => (
                <div key={item.id} className={`rounded-xl border p-3 text-sm ${notificationTone(item)}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="bg-background/60">
                          {item.channel || "canal"}
                        </Badge>
                        <span className="font-semibold">{notificationStatusLabel(item.status)}</span>
                      </div>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {item.recipient || item.subject || "Destino sin publicar"}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatDate(item.created_at)}
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs">
                    {item.last_error || item.body_preview || "Evento registrado por backend."}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.85fr)]">
        <Card className="border-border/70 bg-card/95 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <History className="h-5 w-5 text-primary" />
              Historial de campanas
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Separa registros legacy, bloqueos y evidencia real de transporte. Un registro queued no se cuenta como enviado.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {campaignActivityLoading ? (
              <div className="rounded-xl border border-border/70 bg-background/60 p-3 text-sm text-muted-foreground">
                Cargando actividad comercial...
              </div>
            ) : campaignHistory.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/70 bg-background/60 p-4 text-sm text-muted-foreground">
                Todavia no hay campanas registradas para este tenant.
              </div>
            ) : (
              campaignHistory.map((item) => (
                <div
                  key={item.campaign_id || `${item.channel}-${item.first_at}`}
                  className="rounded-xl border border-border/70 bg-background/60 p-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary" className="gap-1">
                          <ListChecks className="h-3.5 w-3.5" />
                          {item.channel || "canal"}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {item.last_at ? formatDate(item.last_at) : "Sin fecha"}
                        </span>
                      </div>
                      <p className="mt-2 line-clamp-2 text-sm font-medium">
                        {item.message_preview || "Campana sin texto publicado."}
                      </p>
                    </div>
                    <Badge variant="outline">{item.contacts_count ?? 0} contactos</Badge>
                  </div>
                  <div className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
                    <div className="rounded-lg bg-emerald-500/10 px-3 py-2 text-emerald-200">
                      <span className="block text-muted-foreground">Registrados sin evidencia</span>
                      <strong className="text-base text-emerald-100">
                        {item.registered_without_delivery_evidence_count ?? 0}
                      </strong>
                    </div>
                    <div className="rounded-lg bg-amber-500/10 px-3 py-2 text-amber-100">
                      <span className="block text-muted-foreground">Bloqueados</span>
                      <strong className="text-base">{item.blocked_count ?? 0}</strong>
                    </div>
                    <div className="rounded-lg bg-primary/10 px-3 py-2 text-primary">
                      <span className="block text-muted-foreground">ID</span>
                      <strong className="text-xs">{(item.campaign_id || "-").slice(0, 12)}</strong>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/95 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Clock3 className="h-5 w-5 text-primary" />
              Ledger 24h
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Ultimos registros o bloqueos. No implica envio ni entrega si no existe recibo del proveedor.
            </p>
          </CardHeader>
          <CardContent className="space-y-2">
            {campaignLedger.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/70 bg-background/60 p-4 text-sm text-muted-foreground">
                Sin eventos recientes de campana.
              </div>
            ) : (
              campaignLedger.map((item) => (
                <div key={item.id} className={`rounded-xl border p-3 text-sm ${ledgerTone(item)}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {item.status === "blocked" ? (
                          <AlertTriangle className="h-4 w-4 text-amber-300" />
                        ) : (
                          <CheckCircle className="h-4 w-4 text-emerald-300" />
                        )}
                        <span className="font-semibold">
                          {item.status === "blocked" ? "Bloqueado" : "Registrado"}
                        </span>
                        <Badge variant="outline" className="bg-background/60">
                          {item.channel || "canal"}
                        </Badge>
                      </div>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {item.contact?.name || item.contact?.phone || item.contact?.email || "Contacto sin nombre"}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {item.created_at ? formatDate(item.created_at) : ""}
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs">
                    {item.status === "blocked"
                      ? humanizeCampaignReason(item.reason)
                      : item.content_preview || "Registro CRM sin evidencia de entrega."}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
      {usuarios.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex min-h-[220px] flex-col items-center justify-center gap-3 text-center">
            <Users className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="font-semibold">Todavia no hay contactos registrados.</p>
              <p className="text-sm text-muted-foreground">
                Cuando entren conversaciones, tickets o pedidos, van a aparecer aca como base CRM.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden border-border/70">
          <CardHeader className="border-b border-border/70 pb-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Users className="h-5 w-5 text-primary" />
                  Base CRM
                </CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Contactos normalizados por canal, con emails tecnicos ocultos y acciones rapidas.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2 rounded-full border border-border/70 bg-background/60 px-3 py-2 text-sm">
                  <Checkbox
                    checked={allPageSelected}
                    aria-label="Seleccionar pagina"
                    onCheckedChange={togglePageSelected}
                  />
                  Seleccionar pagina
                </label>
                <Button type="button" variant="outline" size="sm" onClick={() => requestSort('nombre')}>
                  Nombre {sortConfig?.key === 'nombre' ? sortConfig.direction : ''}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => requestSort('lastSeen')}>
                  Ultimo contacto {sortConfig?.key === 'lastSeen' ? sortConfig.direction : ''}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border/70">
              {paginatedUsuarios.map((u) => {
                const channel = humanizeChannel(u.canal);
                const source = humanizeSource(u.origen);
                const realEmail = hasRealEmail(u);
                const waUrl = whatsappUrl(u.telefono);
                const temp = temperatureMeta(u.leadTemperature);
                const crmScore = getCrmProfileScore(u);
                const crmTone = crmProfileTone(crmScore);
                const nextAction = resolveCrmNextAction(u);
                const reason = u.motivo || humanizeIntent(u.lastIntent);
                const summary =
                  u.resumen ||
                  u.lastMessageExcerpt ||
                  u.profileExcerpt ||
                  "Sin resumen todavia. Se completa automaticamente con la proxima conversacion.";
                const primaryAction = u.suggestedActions?.[0];
                const hasVisibleAvatar = shouldRenderProfileImage({
                  avatarUrl: u.avatarUrl,
                  source: u.avatarSource,
                  consented: u.avatarConsent,
                });

                return (
                  <article
                    key={u.id}
                    className="grid gap-4 p-4 transition-colors hover:bg-muted/30 lg:grid-cols-[32px_minmax(0,1fr)_minmax(260px,0.95fr)_minmax(280px,0.9fr)_minmax(180px,0.55fr)] lg:items-start"
                  >
                    <div className="flex items-start pt-1">
                      <Checkbox
                        checked={selectedIds.has(String(u.id))}
                        aria-label={`Seleccionar ${u.nombre}`}
                        onCheckedChange={() => toggleSelected(u.id)}
                      />
                    </div>

                    <div className="min-w-0 space-y-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <IdentityAvatar
                          name={u.nombre || u.email || u.telefono || "Contacto"}
                          avatarUrl={u.avatarUrl}
                          source={u.avatarSource}
                          consented={u.avatarConsent}
                          size="lg"
                        />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="break-words text-base font-semibold leading-tight">{u.nombre}</h3>
                            <Badge variant="outline" className="gap-1">
                              <MessageSquare className="h-3 w-3" />
                              {channel}
                            </Badge>
                            <Badge variant="secondary" className="gap-1">
                              <ShieldCheck className="h-3 w-3" />
                              {source}
                            </Badge>
                            <Badge variant="outline" className="gap-1">
                              <UserRound className="h-3 w-3" />
                              {hasVisibleAvatar ? "Imagen consentida" : "Avatar seguro"}
                            </Badge>
                            <Badge variant="outline" className={crmTone.className}>
                              CRM {crmScore}%
                            </Badge>
                          </div>
                          {u.profileExcerpt && (
                            <p className="mt-1 line-clamp-2 max-w-2xl text-sm text-muted-foreground">
                              Primer mensaje: {u.profileExcerpt}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {u.marketing ? (
                          <Badge variant="default">Opt-in marketing</Badge>
                        ) : (
                          <Badge variant="outline">Sin opt-in</Badge>
                        )}
                        {u.etiquetas.length > 0 ? (
                          u.etiquetas.slice(0, 4).map((tag, idx) => (
                            <Badge key={`${u.id}-${tag}-${idx}`} variant="outline" className="gap-1">
                              <Tags className="h-3 w-3" />
                              {tag}
                            </Badge>
                          ))
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            Sin etiquetas
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="flex items-center gap-2 text-sm font-semibold">
                          <Target className="h-4 w-4 text-primary" />
                          Contexto CRM
                        </span>
                        <Badge variant="outline" className={temp.className}>
                          {temp.label}
                          {u.leadScore ? ` ${u.leadScore}` : ""}
                        </Badge>
                      </div>
                      <div className="rounded-lg border border-border/70 bg-background/70 p-2">
                        <div className="flex items-center justify-between gap-3 text-xs">
                          <span className="font-semibold text-muted-foreground">{crmTone.label}</span>
                          <span className="font-mono font-semibold">{crmScore}%</span>
                        </div>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                          <div className={`h-full rounded-full ${crmTone.barClassName}`} style={{ width: `${crmScore}%` }} />
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <Badge variant="secondary" className="gap-1">
                            <CheckCircle className="h-3 w-3" />
                            {nextAction}
                          </Badge>
                        </div>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Motivo</p>
                        <p className="mt-1 text-sm font-semibold leading-snug">{reason}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Resumen automatico
                        </p>
                        <p className="mt-1 line-clamp-3 text-sm leading-relaxed text-muted-foreground">{summary}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {primaryAction ? (
                          <Badge variant="secondary" className="gap-1">
                            <CheckCircle className="h-3 w-3" />
                            {humanizeIntent(primaryAction)}
                          </Badge>
                        ) : null}
                        {u.interactionCount ? (
                          <Badge variant="outline">{u.interactionCount} interacciones</Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            Sin historial
                          </Badge>
                        )}
                        {u.conversationStatus ? (
                          <Badge variant="outline">{humanizeIntent(u.conversationStatus)}</Badge>
                        ) : null}
                      </div>
                    </div>

                    <div className="space-y-2 rounded-xl border border-border/70 bg-background/50 p-3">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <Phone className="h-4 w-4 text-primary" />
                        <span className="font-medium">{u.telefono || 'Sin telefono'}</span>
                        {u.telefono && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2"
                            onClick={() => copyToClipboard(u.telefono || '', 'Telefono')}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {waUrl && (
                          <Button type="button" variant="outline" size="sm" className="h-7 gap-1 px-2" asChild>
                            <a href={waUrl} target="_blank" rel="noreferrer">
                              WhatsApp
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          </Button>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <Mail className="h-4 w-4 text-primary" />
                        {realEmail ? (
                          <>
                            <span className="break-all font-medium">{u.email}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2"
                              onClick={() => copyToClipboard(u.email, 'Email')}
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        ) : (
                          <span className="text-muted-foreground">
                            {u.emailIsPlaceholder ? 'Email tecnico oculto' : 'Sin email real'}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-sm lg:grid-cols-1">
                      <div className="rounded-xl border border-border/70 bg-background/50 p-3">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Creado</p>
                        <p className="font-semibold">{formatDate(u.createdAt)}</p>
                      </div>
                      <div className="rounded-xl border border-border/70 bg-background/50 p-3">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Ultimo contacto</p>
                        <p className="font-semibold">{formatDate(u.lastSeen)}</p>
                      </div>
                      {(u.totalOrders || u.ltv) ? (
                        <div className="col-span-2 rounded-xl border border-border/70 bg-background/50 p-3 lg:col-span-1">
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">Actividad</p>
                          <p className="font-semibold">
                            {u.totalOrders || 0} pedidos
                            {u.ltv ? ` - $${u.ltv.toLocaleString('es-AR')}` : ''}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="flex flex-col gap-2 border-t border-border/70 p-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <span>
                Mostrando {(page - 1) * pageSize + 1}-
                {Math.min(page * pageSize, sortedUsuarios.length)} de {sortedUsuarios.length}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                >
                  Anterior
                </Button>
                <span className="text-xs font-semibold">Pagina {page} / {totalPages}</span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      {false && (
        <>
      {usuarios.length === 0 ? (
        <p>No hay usuarios registrados.</p>
      ) : (
        <Card className="overflow-hidden">
          <CardContent>
            <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead>
                <tr className="text-left font-semibold">
                  <th className="w-10 p-2">
                    <Checkbox
                      checked={allPageSelected}
                      aria-label="Seleccionar pagina"
                      onCheckedChange={togglePageSelected}
                    />
                  </th>
                  <th className="p-2 cursor-pointer" onClick={() => requestSort('nombre')}>
                    Nombre {sortConfig?.key === 'nombre' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                  </th>
                  <th className="p-2 cursor-pointer" onClick={() => requestSort('email')}>
                    Email {sortConfig?.key === 'email' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                  </th>
                  <th className="p-2 cursor-pointer" onClick={() => requestSort('telefono')}>
                    Teléfono {sortConfig?.key === 'telefono' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                  </th>
                  <th className="p-2">Canal</th>
                  <th className="p-2">Origen</th>
                  <th className="p-2">Etiquetas</th>
                  <th className="p-2">Creado</th>
                  <th className="p-2">Último contacto</th>
                  <th className="p-2 text-center">Marketing</th>
                </tr>
              </thead>
              <tbody>
                {paginatedUsuarios.map(u => (
                  <tr key={u.id} className="border-t">
                    <td className="p-2">
                      <Checkbox
                        checked={selectedIds.has(String(u.id))}
                        aria-label={`Seleccionar ${u.nombre}`}
                        onCheckedChange={() => toggleSelected(u.id)}
                      />
                    </td>
                    <td className="p-2">{u.nombre}</td>
                    <td className="p-2">{u.email}</td>
                    <td className="p-2">{u.telefono || '-'}</td>
                    <td className="p-2">{u.canal || '-'}</td>
                    <td className="p-2">{u.origen || '-'}</td>
                    <td className="p-2">
                      {u.etiquetas && u.etiquetas.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {u.etiquetas.map((tag, idx) => (
                            <Badge key={`${u.id}-${tag}-${idx}`} variant="outline">{tag}</Badge>
                          ))}
                        </div>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="p-2 whitespace-nowrap">{formatDate(u.createdAt)}</td>
                    <td className="p-2 whitespace-nowrap">{formatDate(u.lastSeen)}</td>
                    <td className="p-2 text-center">
                      {u.marketing ? <Badge variant="secondary">Sí</Badge> : <Badge variant="outline">No</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            <div className="mt-4 flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <span>
                Mostrando {(page - 1) * pageSize + 1}–
                {Math.min(page * pageSize, sortedUsuarios.length)} de {sortedUsuarios.length}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                >
                  Anterior
                </Button>
                <span className="text-xs font-semibold">Página {page} / {totalPages}</span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
        </>
      )}
    </div>
  );
}

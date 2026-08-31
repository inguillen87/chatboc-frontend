import React, { useEffect, useState } from "react";
import { apiFetch, getErrorMessage } from "@/utils/api";
import { safeLocalStorage } from "@/utils/safeLocalStorage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import useRequireRole from "@/hooks/useRequireRole";
import type { Role } from "@/utils/roles";
import { toast } from "@/components/ui/use-toast";
import { getTenant } from "@/utils/tenant";
import { useUser } from "@/hooks/useUser";
import { useSocket } from "@/context/SocketContext";
import { AlertTriangle, Bell, Clock3, Flame, History, MessageSquare, Phone, RefreshCw, Target } from "lucide-react";
import CampaignPreparationPanel from "@/components/admin/CampaignPreparationPanel";
import type { CampaignChannel } from "@/features/campaigns/campaignPreparationTypes";
import CrmPeopleWorkspace from "@/features/crm/people/CrmPeopleWorkspace";
import {
  hasSensitiveCrmContent,
  redactSensitiveCrmText,
} from "@/features/crm/people/sensitiveContent";
import {
  useCrmWorkspaceState,
  useDebouncedValue,
} from "@/features/crm/people/useCrmWorkspaceState";
import {
  type CrmPeopleDirectoryItem,
  useCrmPeopleDirectory,
} from "@/features/crm/people/useCrmPeopleDirectory";
import { cn } from "@/lib/utils";

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
  piiMasked?: boolean;
  possibleDuplicate?: boolean;
  directorySource?: string | null;
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

const normalizePersistentIdentity = (value: unknown): string | null => {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) return String(value);
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

export const getCrmOperationalDataQualityScore = (usuario: Pick<
  Usuario,
  | "nombre"
  | "email"
  | "telefono"
  | "contactId"
  | "resumen"
  | "motivo"
  | "lastIntent"
  | "interactionCount"
  | "lastSeen"
  | "piiMasked"
>): number => {
  if (usuario.piiMasked) return 0;
  const realName = Boolean(usuario.nombre && !["Sin nombre", "Contacto WhatsApp", "Contacto sin identificar"].includes(usuario.nombre));
  const realEmail = Boolean(normalizeEmail(usuario.email));
  const hasPhone = Boolean(usuario.telefono);
  const hasExactIdentity = Boolean(usuario.contactId?.trim());
  const hasContext = Boolean(usuario.resumen || usuario.motivo || usuario.lastIntent);
  const hasHistory = Number(usuario.interactionCount ?? 0) > 0;
  const hasRecentContact = Boolean(usuario.lastSeen);

  const score =
    (realName ? 15 : 0) +
    (hasExactIdentity ? 30 : 0) +
    (hasPhone ? 15 : 0) +
    (realEmail ? 10 : 0) +
    (hasContext ? 15 : 0) +
    (hasHistory ? 10 : 0) +
    (hasRecentContact ? 5 : 0);

  return Math.max(0, Math.min(100, score));
};

// Compatibility export for callers outside the Persona workspace. The score is
// now operational data quality; it does not reward avatars or marketing opt-in.
export const getCrmProfileScore = getCrmOperationalDataQualityScore;

export const crmProfileTone = (score: number) => {
  if (score >= 75) {
    return {
      label: "Calidad alta",
      className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-100",
      barClassName: "bg-emerald-500",
    };
  }
  if (score >= 50) {
    return {
      label: "Calidad media",
      className: "border-sky-500/40 bg-sky-500/10 text-sky-100",
      barClassName: "bg-sky-500",
    };
  }
  return {
    label: "Requiere revisión",
    className: "border-amber-500/40 bg-amber-500/10 text-amber-100",
    barClassName: "bg-amber-500",
  };
};

export const resolveCrmNextAction = (usuario: Pick<
  Usuario,
  | "contactId"
  | "telefono"
  | "email"
  | "resumen"
  | "motivo"
  | "lastIntent"
  | "interactionCount"
  | "piiMasked"
>): string => {
  if (usuario.piiMasked) return "Datos protegidos — requiere permiso";
  const hasPhone = Boolean(usuario.telefono);
  const realEmail = Boolean(normalizeEmail(usuario.email));

  if (!usuario.contactId?.trim()) return "Vincular identidad CRM";
  if (!hasPhone && !realEmail) return "Completar canal de contacto";
  if (!usuario.resumen && !usuario.motivo && !usuario.lastIntent) return "Completar contexto operativo";
  if (Number(usuario.interactionCount || 0) === 0) return "Revisar primera interacción";
  return "Registro operativo disponible";
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
  const contactId = normalizePersistentIdentity(raw.contact_id ?? raw.contactId);
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

export const normalizeDirectoryPerson = (item: CrmPeopleDirectoryItem, index: number): Usuario => {
  if (!item.pii_masked) {
    return {
      ...normalizeUsuario({
        id: item.id,
        user_id: item.user_id,
        contact_id: item.contact_id,
        name: item.name,
        email: item.email,
        phone: item.phone,
        channel: item.channel,
        marketing: item.marketing,
        tags: item.tags,
        last_seen: item.last_seen,
        source: item.source,
      }, index),
      piiMasked: false,
      possibleDuplicate: item.possible_duplicate,
      directorySource: item.source,
    };
  }

  // Masked fields are presentation-safe values from the backend. Keep them
  // verbatim: normalizing ***1234 into 1234 would turn a protected suffix into
  // a fake actionable phone number.
  return {
    id: item.id,
    contactId: null,
    nombre: item.name || "Contacto protegido",
    email: item.email || "Dato protegido",
    emailRaw: item.email || null,
    emailIsPlaceholder: false,
    telefono: item.phone || null,
    whatsappNumber: null,
    whatsappExplicit: false,
    etiquetas: item.tags,
    canal: item.channel,
    origen: item.source,
    lastSeen: item.last_seen,
    marketing: item.marketing,
    piiMasked: true,
    possibleDuplicate: item.possible_duplicate,
    directorySource: item.source,
    resumen: "Datos protegidos. El detalle requiere un permiso explícito y una identidad resoluble publicada por el backend.",
    interactionCount: null,
  };
};

export const normalizeLegacyDirectoryPerson = (raw: RawUsuario, index: number): Usuario => {
  const normalized = normalizeUsuario(raw, index);
  return {
    ...normalized,
    id: `legacy-protected:${index + 1}`,
    contactId: null,
    nombre: "Contacto protegido",
    email: "Dato protegido",
    emailRaw: null,
    emailIsPlaceholder: true,
    telefono: null,
    whatsappNumber: null,
    whatsappExplicit: false,
    etiquetas: [],
    marketing: false,
    piiMasked: true,
    possibleDuplicate: false,
    directorySource: "legacy_directory",
    resumen: "Directorio heredado sin contrato explícito de PII. El detalle y las acciones permanecen protegidos.",
    interactionCount: null,
  };
};

export const hasExplicitWhatsApp = (
  usuario: Pick<Usuario, "canal" | "whatsappExplicit" | "whatsappNumber" | "telefono" | "piiMasked">,
): boolean => {
  if (usuario.piiMasked) return false;
  const explicitChannel = humanizeChannel(usuario.canal) === "WhatsApp";
  const number = usuario.whatsappNumber || (explicitChannel ? usuario.telefono : null);
  return Boolean(number && (usuario.whatsappExplicit || explicitChannel));
};

export const getExplicitWhatsAppUrl = (
  usuario: Pick<Usuario, "canal" | "whatsappExplicit" | "whatsappNumber" | "telefono" | "piiMasked">,
): string | null => {
  if (!hasExplicitWhatsApp(usuario)) return null;
  const explicitChannel = humanizeChannel(usuario.canal) === "WhatsApp";
  const number = usuario.whatsappNumber || (explicitChannel ? usuario.telefono : null);
  if (!number?.startsWith("+")) return null;
  const digits = number.replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}` : null;
};

export const canDeepLinkCrmPerson = (
  usuario: Pick<Usuario, "contactId" | "piiMasked">,
): boolean => Boolean(!usuario.piiMasked && usuario.contactId?.trim());

export const getCrmTransportPresentation = (connected: boolean, signalCount: number) => ({
  statusLabel: connected ? "Transporte conectado" : "Actualización manual",
  signalLabel: `${Math.max(0, signalCount)} señales recibidas`,
});

export const getCrmLoadedDirectoryScopeLabel = (loaded: number): string =>
  `sobre ${Math.max(0, loaded)} cargadas`;

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

export const upsertCrmContactByIdentity = (
  current: Usuario[],
  incoming: Usuario,
): Usuario[] => {
  const incomingContactId = normalizeString(incoming.contactId);
  const incomingLegacyKey = String(incoming.id);
  const index = current.findIndex((existing) => {
    const existingContactId = normalizeString(existing.contactId);

    // Once either record carries a persistent identity, personal attributes
    // must never be used to merge it. Shared family/office phones are valid.
    if (incomingContactId || existingContactId) {
      return Boolean(
        incomingContactId &&
        existingContactId &&
        incomingContactId === existingContactId,
      );
    }

    if (String(existing.id) === incomingLegacyKey) return true;
    return Boolean(
      incoming.telefono &&
      existing.telefono &&
      incoming.telefono === existing.telefono,
    );
  });

  if (index === -1) return [incoming, ...current];
  const next = [...current];
  next[index] = { ...next[index], ...incoming };
  return next;
};

export const buildCrmDirectoryPath = ({
  tenantSlug,
  search,
  marketingOnly,
}: {
  tenantSlug?: string | null;
  search?: string;
  marketingOnly?: boolean;
}): string | null => {
  const normalizedTenant = normalizeTenantIdentity(tenantSlug);
  if (!normalizedTenant) return null;

  const params = new URLSearchParams({
    tenant_slug: normalizedTenant,
    tenant: normalizedTenant,
  });
  if (search?.trim()) params.set("q", search.trim());
  if (marketingOnly) params.set("marketing", "true");
  return `/api/crm/clientes?${params.toString()}`;
};

export interface UsuariosPageProps {
  tenantSlugOverride?: string | null;
  embedded?: boolean;
}

export default function UsuariosPage({ tenantSlugOverride, embedded = false }: UsuariosPageProps = {}) {
  useRequireRole(['tenant_admin', 'employee', 'superadmin'] as Role[]);
  const navigate = useNavigate();
  const { user } = useUser();
  const { socket, isConnected } = useSocket();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [protectedSelectionId, setProtectedSelectionId] = useState<string | null>(null);
  const [campaignHistory, setCampaignHistory] = useState<CampaignHistoryItem[]>([]);
  const [campaignLedger, setCampaignLedger] = useState<CampaignLedgerItem[]>([]);
  const [notificationCenter, setNotificationCenter] = useState<NotificationCenterItem[]>([]);
  const [campaignActivityLoading, setCampaignActivityLoading] = useState(false);
  const [realtimeEvents, setRealtimeEvents] = useState(0);
  const transportPresentation = getCrmTransportPresentation(isConnected, realtimeEvents);
  const {
    activeView,
    selectedContactId,
    peopleQueueView,
    peopleSort,
    peopleSearch,
    peopleMarketingOnly,
    peopleChannel,
    setActiveView,
    setSelectedContactId,
    setPeopleQueueView,
    setPeopleSort,
    setPeopleSearch,
    setPeopleMarketingOnly,
    setPeopleChannel,
  } = useCrmWorkspaceState();
  const search = useDebouncedValue(peopleSearch, 350);

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
  const directoryQuery = useCrmPeopleDirectory({
    tenantSlug,
    q: search,
    marketing: peopleMarketingOnly ? "true" : "all",
    channel: peopleChannel,
  });
  const directoryPages = directoryQuery.data?.pages || [];
  const usuarios = React.useMemo(
    () => directoryPages.flatMap((page) => page.contractVersion === "crm.people.directory.v2"
      ? page.items.map(normalizeDirectoryPerson)
      : page.legacyItems.map(normalizeLegacyDirectoryPerson)),
    [directoryPages],
  );
  const directoryTotal = directoryPages[0]?.page.total ?? usuarios.length;
  const directoryIsLegacy = directoryPages[0]?.contractVersion === "legacy.crm.clientes";
  const loading = directoryQuery.isPending;
  const error = !tenantSlug
    ? "Falta una organización activa para cargar Personas de forma segura."
    : directoryQuery.error
      ? getErrorMessage(directoryQuery.error, "No se pudieron cargar las personas")
      : null;
  const effectiveSelectedContactId = selectedContactId || protectedSelectionId;
  const previousTenantSlugRef = React.useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const normalizedTenant = normalizeTenantIdentity(tenantSlug);
    const previousTenant = previousTenantSlugRef.current;
    previousTenantSlugRef.current = normalizedTenant;
    if (previousTenant === undefined || previousTenant === normalizedTenant) return;

    // Contact ids and list selections are tenant-bound. Clear the previous
    // workspace before a new scoped request can populate it.
    setSelectedIds(new Set());
    setProtectedSelectionId(null);
    setSelectedContactId(null);
  }, [setSelectedContactId, tenantSlug]);

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

  const actionablePersonIds = React.useMemo(
    () => new Set(
      usuarios
        .filter((usuario) => !usuario.piiMasked)
        .map((usuario) => String(usuario.id)),
    ),
    [usuarios],
  );

  const selectedUsuarios = React.useMemo(
    () => usuarios.filter(
      (usuario) => !usuario.piiMasked && selectedIds.has(String(usuario.id)),
    ),
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

  const hasRealEmail = React.useCallback(
    (usuario: Usuario) => Boolean(!usuario.piiMasked && usuario.email && usuario.email !== "Sin email real"),
    [],
  );

  const fetchCampaignActivity = React.useCallback(async () => {
    if (!tenantSlug) return;
    setCampaignActivityLoading(true);
    try {
      const encoded = encodeURIComponent(tenantSlug);
      const [historyResponse, ledgerResponse, notificationResponse] = await Promise.all([
        apiFetch<{ items?: CampaignHistoryItem[] }>(`/api/admin/tenants/${encoded}/campaigns/history?limit=6&days=30`, { tenantSlug }),
        apiFetch<{ items?: CampaignLedgerItem[] }>(`/api/admin/tenants/${encoded}/campaigns/ledger?limit=10&days=30`, { tenantSlug }),
        apiFetch<{ items?: NotificationCenterItem[]; counts?: Record<string, number> }>(`/api/admin/tenants/${encoded}/notifications/center?limit=8`, { tenantSlug }),
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
    if (activeView === "campanas" || activeView === "actividad") {
      void fetchCampaignActivity();
    }
  }, [activeView, fetchCampaignActivity]);

  useEffect(() => {
    if (!socket) return;

    const upsertFromRealtime = (payload: any) => {
      // Realtime is only a tenant-scoped invalidation signal. The v2 directory
      // remains the authority for masking, duplicate flags and cursor order.
      if (!eventBelongsToTenant(payload, tenantSlug)) return;
      void directoryQuery.refetch();
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
  }, [activeView, directoryQuery.refetch, fetchCampaignActivity, socket, tenantSlug]);

  useEffect(() => {
    setSelectedIds((prev) => {
      const validIds = new Set(
        usuarios.filter((usuario) => !usuario.piiMasked).map((usuario) => String(usuario.id)),
      );
      const next = new Set([...prev].filter((id) => validIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [usuarios]);

  useEffect(() => {
    setProtectedSelectionId(null);
  }, [peopleChannel, peopleMarketingOnly, search]);

  const handleSelectPerson = React.useCallback((personKey: string | null) => {
    if (!personKey) {
      setProtectedSelectionId(null);
      setSelectedContactId(null);
      return;
    }
    const person = usuarios.find((candidate) => getPersonKey(candidate) === personKey);
    if (person && canDeepLinkCrmPerson(person)) {
      setProtectedSelectionId(null);
      setSelectedContactId(personKey);
      return;
    }
    setSelectedContactId(null);
    setProtectedSelectionId(personKey);
  }, [getPersonKey, setSelectedContactId, usuarios]);

  useEffect(() => {
    if (activeView !== "personas" || usuarios.length === 0 || effectiveSelectedContactId) return;
    handleSelectPerson(getPersonKey(usuarios[0]));
  }, [activeView, effectiveSelectedContactId, getPersonKey, handleSelectPerson, usuarios]);

  const toggleSelected = (id: number | string) => {
    const key = String(id);
    if (!actionablePersonIds.has(key)) return;
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

  const setSelectedForIds = React.useCallback((ids: Array<number | string>, selected: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => {
        const key = String(id);
        if (selected && actionablePersonIds.has(key)) next.add(key);
        else next.delete(key);
      });
      return next;
    });
  }, [actionablePersonIds]);

  const clearSelected = React.useCallback(() => setSelectedIds(new Set()), []);

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
    () => usuarios.filter((u) => !u.piiMasked && Boolean(u.resumen || u.motivo || u.lastMessageExcerpt)).length,
    [usuarios],
  );

  const phoneCount = React.useMemo(
    () => usuarios.filter((u) => !u.piiMasked && Boolean(u.telefono)).length,
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
  const loadedDirectoryScopeLabel = getCrmLoadedDirectoryScopeLabel(usuarios.length);
  const evaluableUsuarios = React.useMemo(
    () => usuarios.filter((usuario) => !usuario.piiMasked),
    [usuarios],
  );
  const crmScoreAverage = React.useMemo(
    () =>
      evaluableUsuarios.length
        ? Math.round(evaluableUsuarios.reduce((total, usuario) => total + getCrmProfileScore(usuario), 0) / evaluableUsuarios.length)
        : 0,
    [evaluableUsuarios],
  );
  const crmCompleteProfiles = React.useMemo(
    () => evaluableUsuarios.filter((usuario) => getCrmProfileScore(usuario) >= 75).length,
    [evaluableUsuarios],
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

  const whatsappUrl = React.useCallback(
    (usuario: Usuario | string | null | undefined) =>
      typeof usuario === "object" && usuario ? getExplicitWhatsAppUrl(usuario) : null,
    [],
  );

  const openTicketDesk = React.useCallback(
    (exactHref: string) => navigate(exactHref),
    [navigate],
  );

  if (loading) {
    return (
      <div
        className={cn(
          "mx-auto flex w-full max-w-[1680px] flex-col gap-3",
          embedded ? "h-full min-h-0 max-w-none overflow-hidden p-0" : "p-3 md:p-4",
        )}
        aria-label="Cargando CRM de personas"
      >
        <section className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-2">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-7 w-56" />
              <Skeleton className="h-4 w-80 max-w-full" />
            </div>
            <Skeleton className="h-9 w-28" />
          </div>
        </section>
        <section className={cn("grid overflow-hidden rounded-2xl border border-border/70 bg-card lg:grid-cols-[320px_minmax(0,1fr)_280px]", embedded ? "min-h-0 flex-1" : "min-h-[560px]")}>
          <div className="space-y-3 border-r border-border/70 p-3">
            {Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-[70px] w-full" />)}
          </div>
          <div className="space-y-4 p-5"><Skeleton className="h-16 w-full" /><Skeleton className="h-44 w-full" /><Skeleton className="h-32 w-full" /></div>
          <div className="hidden space-y-3 border-l border-border/70 p-4 lg:block"><Skeleton className="h-20 w-full" /><Skeleton className="h-32 w-full" /></div>
        </section>
      </div>
    );
  }
  if (error) {
    return (
      <div className={cn("mx-auto flex w-full max-w-[1680px] items-center justify-center p-4", embedded ? "h-full min-h-0" : "min-h-[60dvh]")}>
        <Card className="w-full max-w-lg border-destructive/30 shadow-sm" role="alert">
          <CardContent className="flex flex-col items-center p-8 text-center">
            <div className="rounded-2xl bg-destructive/10 p-3 text-destructive"><AlertTriangle className="h-6 w-6" /></div>
            <h1 className="mt-4 text-xl font-bold">No pudimos cargar Personas</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{error}</p>
            <Button className="mt-5 gap-2" onClick={() => void directoryQuery.refetch()}>
              <RefreshCw className="h-4 w-4" />
              Reintentar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
      <CrmPeopleWorkspace
        embedded={embedded}
        tenantSlug={tenantSlug}
        activeView={activeView}
        onViewChange={setActiveView}
        people={sortedUsuarios}
        selectedContactId={effectiveSelectedContactId}
        onSelectContact={handleSelectPerson}
        selectedIds={selectedIds}
        onToggleSelected={toggleSelected}
        onSetSelected={setSelectedForIds}
        onClearSelected={clearSelected}
        queueView={peopleQueueView}
        onQueueViewChange={setPeopleQueueView}
        peopleSort={peopleSort}
        onPeopleSortChange={setPeopleSort}
        search={peopleSearch}
        onSearchChange={setPeopleSearch}
        marketingOnly={peopleMarketingOnly}
        onMarketingOnlyChange={setPeopleMarketingOnly}
        channelFilter={peopleChannel}
        onChannelFilterChange={setPeopleChannel}
        peopleTotal={directoryTotal}
        hasMore={Boolean(directoryQuery.hasNextPage)}
        isLoadingMore={directoryQuery.isFetchingNextPage}
        onLoadMore={() => void directoryQuery.fetchNextPage()}
        directoryIsLegacy={directoryIsLegacy}
        onRefresh={() => {
          void directoryQuery.refetch();
          if (activeView === "campanas" || activeView === "actividad") {
            void fetchCampaignActivity();
          }
        }}
        onBack={() => navigate("/perfil")}
        onOpenTicketDesk={openTicketDesk}
        isConnected={isConnected}
        metrics={[
          { label: "Personas", value: directoryTotal, helper: `${usuarios.length} cargadas` },
          { label: "Canal WhatsApp", value: whatsappCount, helper: `${loadedDirectoryScopeLabel} · solo evidencia explícita` },
          { label: "Consentimiento declarado", value: marketingCount, helper: `${loadedDirectoryScopeLabel} · sin historial versionado` },
          { label: "Calidad de datos", value: `${crmScoreAverage}%`, helper: `${loadedDirectoryScopeLabel} · ${evaluableUsuarios.length} evaluables · ${crmCompleteProfiles} con calidad alta` },
        ]}
        getPersonKey={getPersonKey}
        hasRealEmail={hasRealEmail}
        hasExplicitWhatsApp={hasExplicitWhatsApp}
        whatsappUrl={(usuario) => whatsappUrl(usuario as Usuario)}
        dataQualityScore={getCrmOperationalDataQualityScore}
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
              <div className="flex flex-wrap gap-2"><Badge variant={isConnected ? "default" : "outline"}>{transportPresentation.statusLabel}</Badge><Badge variant="secondary">{transportPresentation.signalLabel}</Badge></div>
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

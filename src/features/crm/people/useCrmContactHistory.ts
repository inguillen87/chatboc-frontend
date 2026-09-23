import { useQuery } from "@tanstack/react-query";

import { redactSensitiveCrmText } from "./sensitiveContent";
import { apiFetch, getErrorMessage } from "@/utils/api";
import {
  buildTerritorialTicketHref,
  resolveTerritorialTicketIdentity,
  TERRITORIAL_TICKET_SOURCE_MODELS,
  type TerritorialTicketSourceModel,
} from "@/utils/territorialTicketIdentity";

export const CRM_CONTACT_CASES_CONTRACT_VERSION = "crm.contact_cases.v1";

export interface CrmContactHistoryInteraction {
  channel: string | null;
  direction: string | null;
  content: string;
  timestamp: string | null;
}

export interface CrmContactCase {
  caseKey: string;
  sourceModel: TerritorialTicketSourceModel;
  ticketId: string;
  tenantSlug: string;
  title: string;
  category: string | null;
  status: string | null;
  channel: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  assigneeName: string | null;
  slaStatus: string | null;
  slaDueAt: string | null;
  href: string;
}

export type CrmContactCasesContractStatus = "verified" | "unavailable" | "unsupported";

export interface CrmContactHistory {
  contactId: string;
  interactions: CrmContactHistoryInteraction[];
  cases: CrmContactCase[];
  casesContractStatus: CrmContactCasesContractStatus;
  casesRejected: number;
  casesTotal: number;
  casesTotalIsExact: boolean;
  casesTruncated: boolean;
}

interface UseCrmContactHistoryOptions {
  tenantSlug?: string | null;
  contactId?: string | null;
  enabled: boolean;
}

const normalizeIdentity = (value?: string | null): string | null => {
  const normalized = value?.trim();
  return normalized || null;
};

const normalizeString = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

const isAllowedSourceModel = (value: unknown): value is TerritorialTicketSourceModel =>
  typeof value === "string" && TERRITORIAL_TICKET_SOURCE_MODELS.some((source) => source === value);

const normalizeCase = (raw: unknown, tenantSlug: string): CrmContactCase | null => {
  const record = raw && typeof raw === "object" && !Array.isArray(raw)
    ? raw as Record<string, unknown>
    : null;
  if (!record || !isAllowedSourceModel(record.source_model)) return null;
  const assignee = record.assignee && typeof record.assignee === "object" && !Array.isArray(record.assignee)
    ? record.assignee as Record<string, unknown>
    : null;
  const sla = record.sla && typeof record.sla === "object" && !Array.isArray(record.sla)
    ? record.sla as Record<string, unknown>
    : null;
  if (
    typeof record.ticket_id !== "string"
    || !/^[1-9]\d*$/.test(record.ticket_id)
  ) {
    return null;
  }
  if (
    typeof record.tenant_slug !== "string"
    || record.tenant_slug !== record.tenant_slug.trim()
    || record.tenant_slug.toLowerCase() !== tenantSlug
  ) {
    return null;
  }

  const resolution = resolveTerritorialTicketIdentity(
    {
      source_model: record.source_model,
      ticket_id: record.ticket_id,
      tenant_slug: record.tenant_slug,
      tenantSlug: record.tenantSlug,
    },
    tenantSlug,
  );
  if (resolution.status !== "valid") return null;

  const href = buildTerritorialTicketHref(resolution.identity, tenantSlug);
  if (!href || !resolution.identity.tenantSlug) return null;

  const title = normalizeString(record.title);
  return {
    caseKey: resolution.identity.opaqueKey,
    sourceModel: resolution.identity.sourceModel,
    ticketId: resolution.identity.ticketId,
    tenantSlug: resolution.identity.tenantSlug,
    title: title
      ? redactSensitiveCrmText(title) || "Caso con contenido protegido"
      : `Caso ${resolution.identity.sourceModel}`,
    category: redactSensitiveCrmText(normalizeString(record.category)),
    status: redactSensitiveCrmText(normalizeString(record.status)),
    channel: redactSensitiveCrmText(normalizeString(record.channel)),
    createdAt: normalizeString(record.created_at),
    updatedAt: normalizeString(record.updated_at),
    assigneeName:
      normalizeString(record.assignee_name) ||
      normalizeString(record.responsible_name) ||
      normalizeString(record.owner_name) ||
      normalizeString(assignee?.name),
    slaStatus:
      normalizeString(record.sla_status) ||
      normalizeString(sla?.status),
    slaDueAt:
      normalizeString(record.sla_due_at) ||
      normalizeString(record.sla_deadline) ||
      normalizeString(sla?.due_at),
    href,
  };
};

const normalizeHistory = (
  payload: unknown,
  contactId: string,
  tenantSlug: string,
): CrmContactHistory => {
  const record = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  const rawInteractions = Array.isArray(record.interactions) ? record.interactions : [];
  const contractVersion = normalizeString(record.cases_contract_version);
  const casesEnvelopeRows = Array.isArray(record.cases) ? record.cases : null;
  const hasCasesArray = casesEnvelopeRows !== null;
  const hasCasesMetadata = Number.isSafeInteger(record.cases_total)
    && typeof record.cases_total_is_exact === "boolean"
    && typeof record.cases_truncated === "boolean";
  const casesEnvelopeCountIsCoherent = casesEnvelopeRows !== null
    && hasCasesMetadata
    && Number(record.cases_total) >= casesEnvelopeRows.length
    && !(
      record.cases_total_is_exact === true
      && record.cases_truncated === false
      && Number(record.cases_total) !== casesEnvelopeRows.length
    );
  const hasValidCasesEnvelope = hasCasesArray && hasCasesMetadata && casesEnvelopeCountIsCoherent;
  const casesContractStatus: CrmContactCasesContractStatus = contractVersion === CRM_CONTACT_CASES_CONTRACT_VERSION
    ? hasValidCasesEnvelope ? "verified" : "unsupported"
    : contractVersion
      ? "unsupported"
      : "unavailable";
  const rawCases = casesContractStatus === "verified" && casesEnvelopeRows
    ? casesEnvelopeRows
    : [];
  const casesByIdentity = new Map<string, CrmContactCase>();
  let casesRejected = 0;
  rawCases.forEach((rawCase) => {
    const normalized = normalizeCase(rawCase, tenantSlug);
    if (!normalized || casesByIdentity.has(normalized.caseKey)) {
      casesRejected += 1;
      return;
    }
    casesByIdentity.set(normalized.caseKey, normalized);
  });

  const casesTotalIsExact = casesContractStatus === "verified"
    && record.cases_total_is_exact === true
    && casesRejected === 0;

  return {
    contactId,
    interactions: rawInteractions.map((raw): CrmContactHistoryInteraction => {
      const interaction = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
      const rawContent = normalizeString(interaction.content);
      return {
        channel: normalizeString(interaction.channel),
        direction: normalizeString(interaction.direction),
        content: rawContent
          ? redactSensitiveCrmText(rawContent) || "Contenido no disponible."
          : "Evento sin contenido textual.",
        timestamp:
          normalizeString(interaction.ts) ||
          normalizeString(interaction.created_at) ||
          normalizeString(interaction.timestamp),
      };
    }),
    cases: Array.from(casesByIdentity.values()),
    casesContractStatus,
    casesRejected,
    casesTotal: casesContractStatus === "verified" ? Number(record.cases_total) : 0,
    casesTotalIsExact,
    casesTruncated: casesContractStatus === "verified" && record.cases_truncated === true,
  };
};

export const useCrmContactHistory = ({
  tenantSlug,
  contactId,
  enabled,
}: UseCrmContactHistoryOptions) => {
  const normalizedTenantSlug = normalizeIdentity(tenantSlug)?.toLowerCase() || null;
  const normalizedContactId = normalizeIdentity(contactId);
  const canLoad = Boolean(enabled && normalizedTenantSlug && normalizedContactId);

  const query = useQuery({
    queryKey: [
      "crm",
      "contact-history",
      normalizedTenantSlug || "missing-tenant",
      normalizedContactId || "missing-contact",
    ],
    enabled: canLoad,
    retry: false,
    staleTime: 30_000,
    queryFn: async () => {
      if (!normalizedTenantSlug || !normalizedContactId) {
        throw new Error("Falta el contexto tenant/contacto para cargar el historial CRM.");
      }
      const payload = await apiFetch<unknown>(
        `/api/admin/tenants/${encodeURIComponent(normalizedTenantSlug)}/contacts/${encodeURIComponent(normalizedContactId)}/history`,
        { tenantSlug: normalizedTenantSlug },
      );
      return normalizeHistory(payload, normalizedContactId, normalizedTenantSlug);
    },
  });

  const dataMatchesSelection = Boolean(
    normalizedContactId && query.data?.contactId === normalizedContactId,
  );

  return {
    data: dataMatchesSelection ? query.data : null,
    isLoading: canLoad && query.isPending,
    isFetching: canLoad && query.isFetching,
    error: canLoad && query.error
      ? getErrorMessage(query.error, "No se pudo cargar el historial multicanal")
      : null,
    refetch: query.refetch,
  };
};

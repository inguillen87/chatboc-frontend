import { useInfiniteQuery } from "@tanstack/react-query";

import { ApiError, apiFetch } from "@/utils/api";

export const CRM_PEOPLE_DIRECTORY_CONTRACT_VERSION = "crm.people.directory.v2";
export const CRM_PEOPLE_DIRECTORY_LIMIT = 50;
export const CRM_PEOPLE_PII_PERMISSION = "crm_contacts_pii_read";

export const CRM_PEOPLE_CHANNEL_FILTERS = [
  "all",
  "whatsapp",
  "email",
  "web",
  "widget",
  "voice",
  "unknown",
] as const;

export type CrmPeopleChannelFilter = (typeof CRM_PEOPLE_CHANNEL_FILTERS)[number];
export type CrmPeopleMarketingFilter = "all" | "true";

export interface CrmPeopleDirectoryItem {
  id: string;
  user_id?: number | null;
  contact_id?: string | null;
  name: string;
  email: string;
  phone: string;
  channel: string;
  marketing: boolean;
  tags: string[];
  last_seen: string | null;
  source: "user_contact" | "contact" | "user" | string;
  pii_masked: boolean;
  possible_duplicate: boolean;
}

export interface CrmPeopleDirectoryPage {
  contractVersion: typeof CRM_PEOPLE_DIRECTORY_CONTRACT_VERSION | "legacy.crm.clientes";
  items: CrmPeopleDirectoryItem[];
  legacyItems: Array<Record<string, unknown>>;
  page: {
    limit: number;
    total: number;
    has_more: boolean;
    next_cursor: string | null;
  };
  pii: {
    requested: boolean;
    masked: boolean;
    granted: boolean;
    permission: string | null;
    reason_code: string | null;
  };
}

export interface CrmPeopleDirectoryFilters {
  q: string;
  marketing: CrmPeopleMarketingFilter;
  channel: CrmPeopleChannelFilter;
}

interface FetchDirectoryPageOptions extends CrmPeopleDirectoryFilters {
  tenantSlug: string;
  cursor?: string | null;
  limit?: number;
}

export class CrmPeopleDirectoryContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CrmPeopleDirectoryContractError";
  }
}

const cleanString = (value: unknown): string => typeof value === "string" ? value.trim() : "";

const protectDirectoryItem = (item: CrmPeopleDirectoryItem): CrmPeopleDirectoryItem => {
  const contradictedMask = item.pii_masked !== true;
  return {
    ...item,
    user_id: null,
    contact_id: null,
    name: contradictedMask ? "Contacto protegido" : item.name,
    email: contradictedMask ? "Dato protegido" : item.email,
    phone: contradictedMask ? "" : item.phone,
    tags: [],
    pii_masked: true,
  };
};

const sanitizeLegacyDirectoryItem = (_value: Record<string, unknown>, index: number): Record<string, unknown> => ({
  id: `legacy-protected:${index + 1}`,
  name: "Contacto protegido",
  email: "Dato protegido",
  phone: "",
  channel: "unknown",
  marketing: false,
  tags: [],
  source: "legacy_directory",
  pii_masked: true,
  possible_duplicate: false,
});

const parseDirectoryItem = (value: unknown): CrmPeopleDirectoryItem => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new CrmPeopleDirectoryContractError("Persona 360 recibió un registro inválido.");
  }
  const record = value as Record<string, unknown>;
  const id = cleanString(record.id);
  if (!id) throw new CrmPeopleDirectoryContractError("Persona 360 recibió una persona sin identidad estable.");
  if (typeof record.pii_masked !== "boolean") {
    throw new CrmPeopleDirectoryContractError("Persona 360 no pudo verificar la política de datos personales.");
  }

  return {
    id,
    user_id: typeof record.user_id === "number" ? record.user_id : null,
    contact_id: cleanString(record.contact_id) || null,
    name: cleanString(record.name) || "Contacto protegido",
    email: cleanString(record.email),
    phone: cleanString(record.phone),
    channel: cleanString(record.channel) || "unknown",
    marketing: record.marketing === true,
    tags: Array.isArray(record.tags)
      ? record.tags.map(cleanString).filter(Boolean)
      : [],
    last_seen: cleanString(record.last_seen) || null,
    source: cleanString(record.source) || "unknown",
    pii_masked: record.pii_masked,
    possible_duplicate: record.possible_duplicate === true,
  };
};

export const parseCrmPeopleDirectoryPage = (value: unknown): CrmPeopleDirectoryPage => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new CrmPeopleDirectoryContractError("Persona 360 recibió una respuesta inválida.");
  }
  const payload = value as Record<string, unknown>;
  if (payload.contract_version !== CRM_PEOPLE_DIRECTORY_CONTRACT_VERSION) {
    throw new CrmPeopleDirectoryContractError("El backend no publicó crm.people.directory.v2.");
  }
  if (!Array.isArray(payload.items) || !payload.page || typeof payload.page !== "object") {
    throw new CrmPeopleDirectoryContractError("El directorio no publicó items y paginación verificables.");
  }
  const rawPage = payload.page as Record<string, unknown>;
  const limit = Number(rawPage.limit);
  const total = Number(rawPage.total);
  const hasMore = rawPage.has_more;
  const nextCursor = cleanString(rawPage.next_cursor) || null;
  if (!Number.isInteger(limit) || limit < 1 || !Number.isInteger(total) || total < 0 || typeof hasMore !== "boolean") {
    throw new CrmPeopleDirectoryContractError("El directorio publicó metadatos de paginación inválidos.");
  }
  if (hasMore && !nextCursor) {
    throw new CrmPeopleDirectoryContractError("El directorio informó más personas sin publicar un cursor.");
  }
  if (!payload.pii || typeof payload.pii !== "object") {
    throw new CrmPeopleDirectoryContractError("El directorio omitió la política de datos personales.");
  }
  const rawPii = payload.pii as Record<string, unknown>;
  if (
    typeof rawPii.requested !== "boolean"
    || typeof rawPii.masked !== "boolean"
    || typeof rawPii.granted !== "boolean"
  ) {
    throw new CrmPeopleDirectoryContractError("El directorio publicó una política de datos personales inválida.");
  }

  const parsedItems = payload.items.map(parseDirectoryItem);
  const piiRequested = rawPii.requested;
  const pageMasked = rawPii.masked;
  const pageGranted = rawPii.granted;
  const permission = cleanString(rawPii.permission) || null;
  const reasonCode = cleanString(rawPii.reason_code) || null;
  if (permission !== CRM_PEOPLE_PII_PERMISSION) {
    throw new CrmPeopleDirectoryContractError("El directorio no publicó el permiso PII esperado.");
  }
  if (pageMasked === pageGranted) {
    throw new CrmPeopleDirectoryContractError("El directorio publicó una política de datos personales contradictoria.");
  }
  const fullPiiGranted = pageGranted === true && pageMasked === false;
  const maskedByDefault = piiRequested === false
    && pageMasked === true
    && pageGranted === false
    && reasonCode === "pii_masked_by_default";
  const permissionDenied = piiRequested === true
    && pageMasked === true
    && pageGranted === false
    && reasonCode === "pii_permission_required";
  const permissionGranted = piiRequested === true
    && fullPiiGranted
    && reasonCode === null;
  if (!maskedByDefault && !permissionDenied && !permissionGranted) {
    throw new CrmPeopleDirectoryContractError("El directorio publicó una matriz PII incoherente.");
  }
  if (fullPiiGranted && parsedItems.some((item) => item.pii_masked)) {
    throw new CrmPeopleDirectoryContractError("El directorio declaró PII completa con registros todavía enmascarados.");
  }

  return {
    contractVersion: CRM_PEOPLE_DIRECTORY_CONTRACT_VERSION,
    items: fullPiiGranted ? parsedItems : parsedItems.map(protectDirectoryItem),
    legacyItems: [],
    page: { limit, total, has_more: hasMore, next_cursor: nextCursor },
    pii: {
      requested: piiRequested,
      masked: pageMasked,
      granted: pageGranted,
      permission,
      reason_code: reasonCode,
    },
  };
};

export const buildLegacyCrmPeoplePath = ({
  tenantSlug,
  q,
  marketing,
}: Pick<FetchDirectoryPageOptions, "tenantSlug" | "q" | "marketing">): string => {
  const params = new URLSearchParams({ tenant_slug: tenantSlug, tenant: tenantSlug });
  if (q) params.set("q", q);
  if (marketing === "true") params.set("marketing", "true");
  return `/api/crm/clientes?${params.toString()}`;
};

export const fetchCrmPeopleDirectoryPage = async ({
  tenantSlug,
  q,
  marketing,
  channel,
  cursor = null,
  limit = CRM_PEOPLE_DIRECTORY_LIMIT,
}: FetchDirectoryPageOptions): Promise<CrmPeopleDirectoryPage> => {
  const params = new URLSearchParams({
    limit: String(limit),
    marketing,
    channel,
    sort: "recent_desc",
  });
  if (q) params.set("q", q);
  if (cursor) params.set("cursor", cursor);

  try {
    const response = await apiFetch<unknown>(`/api/v2/crm/people?${params.toString()}`, { tenantSlug });
    return parseCrmPeopleDirectoryPage(response);
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 404 || cursor) throw error;
    const legacyItems = await apiFetch<Array<Record<string, unknown>>>(
      buildLegacyCrmPeoplePath({ tenantSlug, q, marketing }),
      { tenantSlug },
    );
    if (!Array.isArray(legacyItems)) {
      throw new CrmPeopleDirectoryContractError("El directorio heredado publicó una respuesta inválida.");
    }
    return {
      contractVersion: "legacy.crm.clientes",
      items: [],
      legacyItems: legacyItems.map(sanitizeLegacyDirectoryItem),
      page: {
        limit: legacyItems.length || limit,
        total: legacyItems.length,
        has_more: false,
        next_cursor: null,
      },
      pii: {
        requested: false,
        masked: true,
        granted: false,
        permission: null,
        reason_code: "legacy_directory_fallback",
      },
    };
  }
};

export const useCrmPeopleDirectory = ({
  tenantSlug,
  q,
  marketing,
  channel,
}: CrmPeopleDirectoryFilters & { tenantSlug?: string | null }) => {
  const normalizedTenant = cleanString(tenantSlug).toLowerCase();
  const normalizedQuery = q.trim();
  return useInfiniteQuery({
    queryKey: [
      "crm-people-directory-v2",
      normalizedTenant || "missing-tenant",
      normalizedQuery,
      marketing,
      channel,
      CRM_PEOPLE_DIRECTORY_LIMIT,
    ],
    queryFn: ({ pageParam }) => fetchCrmPeopleDirectoryPage({
      tenantSlug: normalizedTenant,
      q: normalizedQuery,
      marketing,
      channel,
      cursor: pageParam,
      limit: CRM_PEOPLE_DIRECTORY_LIMIT,
    }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.page.has_more
      ? lastPage.page.next_cursor ?? undefined
      : undefined,
    enabled: Boolean(normalizedTenant),
    retry: 0,
    staleTime: 30_000,
    refetchInterval: false,
  });
};

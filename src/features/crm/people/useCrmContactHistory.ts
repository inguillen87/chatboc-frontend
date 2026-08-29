import { useQuery } from "@tanstack/react-query";

import { redactSensitiveCrmText } from "./sensitiveContent";
import { apiFetch, getErrorMessage } from "@/utils/api";

export interface CrmContactHistoryInteraction {
  channel: string | null;
  direction: string | null;
  content: string;
  timestamp: string | null;
}

export interface CrmContactHistory {
  contactId: string;
  interactions: CrmContactHistoryInteraction[];
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

const normalizeHistory = (payload: unknown, contactId: string): CrmContactHistory => {
  const record = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  const rawInteractions = Array.isArray(record.interactions) ? record.interactions : [];

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
      return normalizeHistory(payload, normalizedContactId);
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

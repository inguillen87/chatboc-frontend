import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CRM_SENSITIVE_CONTENT_PLACEHOLDER } from "./sensitiveContent";
import {
  CRM_CONTACT_CASES_CONTRACT_VERSION,
  useCrmContactHistory,
} from "./useCrmContactHistory";

const apiFetchMock = vi.hoisted(() => vi.fn());

vi.mock("@/utils/api", () => ({
  apiFetch: apiFetchMock,
  getErrorMessage: (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback,
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("useCrmContactHistory", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it("stays idle until explicitly enabled and requests the scoped endpoint", async () => {
    apiFetchMock.mockResolvedValue({ interactions: [] });
    const { result, rerender } = renderHook(
      ({ enabled }) => useCrmContactHistory({
        tenantSlug: "Junin",
        contactId: "contact/42",
        enabled,
      }),
      { initialProps: { enabled: false }, wrapper: createWrapper() },
    );

    expect(result.current.isLoading).toBe(false);
    expect(apiFetchMock).not.toHaveBeenCalled();

    rerender({ enabled: true });
    await waitFor(() => expect(result.current.data).not.toBeNull());

    expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/admin/tenants/junin/contacts/contact%2F42/history",
      { tenantSlug: "junin" },
    );
  });

  it("defensively redacts sensitive interaction content", async () => {
    apiFetchMock.mockResolvedValue({
      interactions: [{
        channel: "whatsapp",
        direction: "inbound",
        content: "PIN: 8432",
        ts: "2026-08-29T18:00:00Z",
      }],
    });
    const { result } = renderHook(
      () => useCrmContactHistory({ tenantSlug: "junin", contactId: "42", enabled: true }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.data).not.toBeNull());
    expect(result.current.data?.interactions[0].content).toBe(CRM_SENSITIVE_CONTENT_PLACEHOLDER);
    expect(result.current.data?.interactions[0].content).not.toContain("8432");
  });

  it("accepts only exact tenant-scoped case identities and rebuilds their href", async () => {
    apiFetchMock.mockResolvedValue({
      cases_contract_version: CRM_CONTACT_CASES_CONTRACT_VERSION,
      cases_total: 9,
      cases_total_is_exact: true,
      cases_truncated: false,
      cases: [
        {
          source_model: "MunicipioTicket",
          ticket_id: "419",
          tenant_slug: "junin",
          title: "Luminaria apagada",
          category: "luminarias",
          status: "nuevo",
          detail_href: "https://evil.example/perfil?tab=tickets&q=telefono",
        },
        {
          source_model: "MunicipioTicket",
          ticket_id: "419",
          tenant_slug: "junin",
          title: "Duplicado",
        },
        {
          source_model: "TenantTicket",
          ticket_id: "88",
          tenant_slug: "otro-tenant",
          title: "Fuera de tenant",
        },
        { source_model: "UnknownTicket", ticket_id: "91", tenant_slug: "junin", title: "Fuente inválida" },
        { source_model: "PymeTicket", ticket_id: " 92 ", tenant_slug: "junin", title: "ID ambiguo" },
        { source_model: "TenantTicket", ticket_id: "93", title: "Tenant ausente" },
        { source_model: "TenantTicket", ticket_id: "0", tenant_slug: "junin", title: "ID cero" },
        { source_model: "TenantTicket", ticket_id: "-1", tenant_slug: "junin", title: "ID negativo" },
        { source_model: "TenantTicket", ticket_id: "abc", tenant_slug: "junin", title: "ID textual" },
      ],
      interactions: [],
    });
    const { result } = renderHook(
      () => useCrmContactHistory({ tenantSlug: "JUNIN", contactId: "42", enabled: true }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.data).not.toBeNull());

    expect(result.current.data?.casesContractStatus).toBe("verified");
    expect(result.current.data?.cases).toEqual([
      expect.objectContaining({
        caseKey: "junin:MunicipioTicket:419",
        sourceModel: "MunicipioTicket",
        ticketId: "419",
        tenantSlug: "junin",
        title: "Luminaria apagada",
        href: "/perfil?tab=tickets&source_model=MunicipioTicket&ticket_id=419&tenant_slug=junin&tenant=junin",
      }),
    ]);
    expect(result.current.data?.cases[0].href).not.toContain("q=");
    expect(result.current.data?.cases[0].href).not.toContain("evil.example");
    expect(result.current.data?.casesRejected).toBe(8);
    expect(result.current.data?.casesTotal).toBe(9);
    expect(result.current.data?.casesTotalIsExact).toBe(false);
    expect(result.current.data?.casesTruncated).toBe(false);
  });

  it("fails closed when the backend does not publish crm.contact_cases.v1", async () => {
    apiFetchMock.mockResolvedValue({
      cases_contract_version: "crm.contact_cases.v0",
      cases: [{ source_model: "TenantTicket", ticket_id: "7", tenant_slug: "junin" }],
      interactions: [],
    });
    const { result } = renderHook(
      () => useCrmContactHistory({ tenantSlug: "junin", contactId: "42", enabled: true }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.data).not.toBeNull());
    expect(result.current.data?.casesContractStatus).toBe("unsupported");
    expect(result.current.data?.cases).toEqual([]);
  });

  it("fails closed when crm.contact_cases.v1 omits the required cases array", async () => {
    apiFetchMock.mockResolvedValue({
      cases_contract_version: CRM_CONTACT_CASES_CONTRACT_VERSION,
      cases_total: 1,
      interactions: [],
    });
    const { result } = renderHook(
      () => useCrmContactHistory({ tenantSlug: "junin", contactId: "42", enabled: true }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.data).not.toBeNull());
    expect(result.current.data?.casesContractStatus).toBe("unsupported");
    expect(result.current.data?.cases).toEqual([]);
    expect(result.current.data?.casesTotal).toBe(0);
  });

  it("fails closed when crm.contact_cases.v1 omits exactness metadata", async () => {
    apiFetchMock.mockResolvedValue({
      cases_contract_version: CRM_CONTACT_CASES_CONTRACT_VERSION,
      cases_total: 1,
      cases: [{ source_model: "TenantTicket", ticket_id: "7", tenant_slug: "junin" }],
      interactions: [],
    });
    const { result } = renderHook(
      () => useCrmContactHistory({ tenantSlug: "junin", contactId: "42", enabled: true }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.data).not.toBeNull());
    expect(result.current.data?.casesContractStatus).toBe("unsupported");
    expect(result.current.data?.cases).toEqual([]);
    expect(result.current.data?.casesTotal).toBe(0);
  });

  it("fails closed when an exact non-truncated envelope contradicts its visible rows", async () => {
    apiFetchMock.mockResolvedValue({
      cases_contract_version: CRM_CONTACT_CASES_CONTRACT_VERSION,
      cases_total: 5,
      cases_total_is_exact: true,
      cases_truncated: false,
      cases: [{ source_model: "TenantTicket", ticket_id: "7", tenant_slug: "junin" }],
      interactions: [],
    });
    const { result } = renderHook(
      () => useCrmContactHistory({ tenantSlug: "junin", contactId: "42", enabled: true }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.data).not.toBeNull());
    expect(result.current.data?.casesContractStatus).toBe("unsupported");
    expect(result.current.data?.cases).toEqual([]);
    expect(result.current.data?.casesTotalIsExact).toBe(false);
  });

  it("fails closed without a tenant or contact identity", () => {
    const { result } = renderHook(
      () => useCrmContactHistory({ tenantSlug: null, contactId: "42", enabled: true }),
      { wrapper: createWrapper() },
    );

    expect(result.current.data).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(apiFetchMock).not.toHaveBeenCalled();
  });
});

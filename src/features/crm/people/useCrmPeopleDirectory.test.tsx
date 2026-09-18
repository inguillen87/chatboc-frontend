import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/utils/api";
import {
  CrmPeopleDirectoryContractError,
  fetchCrmPeopleDirectoryPage,
  parseCrmPeopleDirectoryPage,
  useCrmPeopleDirectory,
} from "./useCrmPeopleDirectory";

const mocks = vi.hoisted(() => ({ apiFetch: vi.fn() }));

vi.mock("@/utils/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utils/api")>()),
  apiFetch: mocks.apiFetch,
}));

const response = ({
  id = "person_masked_1",
  total = 51,
  hasMore = true,
  nextCursor = "cursor-2",
}: {
  id?: string;
  total?: number;
  hasMore?: boolean;
  nextCursor?: string | null;
} = {}) => ({
  contract_version: "crm.people.directory.v2",
  items: [{
    id,
    name: "M*** A***",
    email: "m***@example.com",
    phone: "***8608",
    channel: "whatsapp",
    marketing: false,
    last_seen: "2026-08-31T12:00:00Z",
    source: "contact",
    pii_masked: true,
    possible_duplicate: true,
  }],
  page: { limit: 50, total, has_more: hasMore, next_cursor: nextCursor },
  filters: { q: "mar", marketing: "all", channel: "whatsapp", sort: "recent_desc" },
  pii: { requested: false, masked: true, permission: "crm_contacts_pii_read", granted: false, reason_code: "pii_masked_by_default" },
});

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const [client] = React.useState(() => new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  }));
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
};

describe("crm.people.directory.v2", () => {
  beforeEach(() => mocks.apiFetch.mockReset());

  it("parses masked people and duplicate review evidence without inventing a contact id", () => {
    const page = parseCrmPeopleDirectoryPage(response());

    expect(page.items[0]).toMatchObject({
      id: "person_masked_1",
      contact_id: null,
      phone: "***8608",
      pii_masked: true,
      possible_duplicate: true,
    });
    expect(page.page).toEqual({ limit: 50, total: 51, has_more: true, next_cursor: "cursor-2" });
  });

  it("lets page PII policy dominate a contradictory unmasked item", () => {
    const payload = response();
    payload.items[0] = {
      ...payload.items[0],
      name: "Marcelo Visible",
      email: "marcelo@example.com",
      phone: "+5492613168608",
      pii_masked: false,
      contact_id: "42",
      user_id: 7,
      tags: ["sensible"],
    };

    const page = parseCrmPeopleDirectoryPage(payload);

    expect(page.items[0]).toMatchObject({
      name: "Contacto protegido",
      email: "Dato protegido",
      phone: "",
      pii_masked: true,
      contact_id: null,
      user_id: null,
      tags: [],
    });
  });

  it("accepts fully granted PII only when page and item policy are coherent", () => {
    const maskedPayload = response({ hasMore: false, nextCursor: null });
    const fullPayload = {
      ...maskedPayload,
      items: [{
        ...maskedPayload.items[0],
        name: "Marcelo Visible",
        email: "marcelo@example.com",
        phone: "+5492613168608",
        pii_masked: false,
        contact_id: "42",
      }],
      pii: { ...maskedPayload.pii, requested: true, masked: false, granted: true, reason_code: null },
    };

    expect(parseCrmPeopleDirectoryPage(fullPayload).items[0]).toMatchObject({
      pii_masked: false,
      contact_id: "42",
      phone: "+5492613168608",
    });
    expect(() => parseCrmPeopleDirectoryPage({
      ...fullPayload,
      items: [{ ...fullPayload.items[0], pii_masked: true }],
    })).toThrow(/todavía enmascarados/i);
    expect(() => parseCrmPeopleDirectoryPage({
      ...fullPayload,
      pii: { ...fullPayload.pii, masked: true, granted: true },
    })).toThrow(/contradictoria/i);
    expect(() => parseCrmPeopleDirectoryPage({
      ...fullPayload,
      pii: { ...fullPayload.pii, requested: false },
    })).toThrow(/matriz PII incoherente/i);
  });

  it("validates every masked PII policy field against the backend contract", () => {
    const maskedByDefault = response({ hasMore: false, nextCursor: null });
    expect(parseCrmPeopleDirectoryPage(maskedByDefault).pii).toEqual({
      requested: false,
      masked: true,
      granted: false,
      permission: "crm_contacts_pii_read",
      reason_code: "pii_masked_by_default",
    });

    const denied = {
      ...maskedByDefault,
      pii: {
        ...maskedByDefault.pii,
        requested: true,
        reason_code: "pii_permission_required",
      },
    };
    expect(parseCrmPeopleDirectoryPage(denied).pii.reason_code).toBe("pii_permission_required");

    expect(() => parseCrmPeopleDirectoryPage({
      ...maskedByDefault,
      pii: { ...maskedByDefault.pii, permission: null },
    })).toThrow(/permiso PII esperado/i);
    expect(() => parseCrmPeopleDirectoryPage({
      ...maskedByDefault,
      pii: { ...maskedByDefault.pii, permission: "otro_permiso" },
    })).toThrow(/permiso PII esperado/i);
    expect(() => parseCrmPeopleDirectoryPage({
      ...maskedByDefault,
      pii: { ...maskedByDefault.pii, reason_code: null },
    })).toThrow(/matriz PII incoherente/i);
    expect(() => parseCrmPeopleDirectoryPage({
      ...denied,
      pii: { ...denied.pii, reason_code: "pii_masked_by_default" },
    })).toThrow(/matriz PII incoherente/i);
  });

  it("fails closed for an unknown contract or a broken cursor page", () => {
    expect(() => parseCrmPeopleDirectoryPage({ ...response(), contract_version: "crm.people.directory.v1" }))
      .toThrow(CrmPeopleDirectoryContractError);
    expect(() => parseCrmPeopleDirectoryPage({
      ...response(),
      page: { limit: 50, total: 51, has_more: true, next_cursor: null },
    })).toThrow(/cursor/i);
  });

  it("uses server-side URL filters, masked PII and the cursor returned by the accepted page", async () => {
    mocks.apiFetch
      .mockResolvedValueOnce(response())
      .mockResolvedValueOnce(response({ id: "person_masked_2", hasMore: false, nextCursor: null }));

    const { result } = renderHook(() => useCrmPeopleDirectory({
      tenantSlug: "JUNIN",
      q: "mar",
      marketing: "all",
      channel: "whatsapp",
    }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mocks.apiFetch.mock.calls[0][0]).toContain("/api/v2/crm/people?");
    expect(mocks.apiFetch.mock.calls[0][0]).toContain("limit=50");
    expect(mocks.apiFetch.mock.calls[0][0]).toContain("q=mar");
    expect(mocks.apiFetch.mock.calls[0][0]).toContain("marketing=all");
    expect(mocks.apiFetch.mock.calls[0][0]).toContain("channel=whatsapp");
    expect(mocks.apiFetch.mock.calls[0][0]).not.toContain("pii=full");
    expect(mocks.apiFetch.mock.calls[0][1]).toEqual({ tenantSlug: "junin" });

    let nextPageResult: Awaited<ReturnType<typeof result.current.fetchNextPage>> | undefined;
    await act(async () => { nextPageResult = await result.current.fetchNextPage(); });
    expect(mocks.apiFetch.mock.calls[1][0]).toContain("cursor=cursor-2");
    expect(nextPageResult?.data?.pages).toHaveLength(2);
    expect(nextPageResult?.data?.pages.flatMap((page) => page.items).map((item) => item.id))
      .toEqual(["person_masked_1", "person_masked_2"]);
    expect(nextPageResult?.hasNextPage).toBe(false);
  });

  it("falls back to legacy only when v2 is absent with 404", async () => {
    mocks.apiFetch
      .mockRejectedValueOnce(new ApiError("Not found", 404))
      .mockResolvedValueOnce([{ id: 7, name: "Persona heredada" }]);

    const page = await fetchCrmPeopleDirectoryPage({
      tenantSlug: "junin",
      q: "",
      marketing: "all",
      channel: "all",
    });

    expect(page.contractVersion).toBe("legacy.crm.clientes");
    expect(page.legacyItems).toHaveLength(1);
    expect(page.pii).toMatchObject({ masked: true, granted: false });
    expect(page.legacyItems[0]).toMatchObject({
      name: "Contacto protegido",
      email: "Dato protegido",
      pii_masked: true,
    });
    expect(page.legacyItems[0]).not.toHaveProperty("name", "Persona heredada");
    expect(mocks.apiFetch).toHaveBeenCalledTimes(2);
  });

  it("does not hide v2 authorization, server or contract failures behind legacy data", async () => {
    mocks.apiFetch.mockRejectedValueOnce(new ApiError("Server error", 500));

    await expect(fetchCrmPeopleDirectoryPage({
      tenantSlug: "junin",
      q: "",
      marketing: "all",
      channel: "all",
    })).rejects.toMatchObject({ status: 500 });
    expect(mocks.apiFetch).toHaveBeenCalledTimes(1);
  });
});

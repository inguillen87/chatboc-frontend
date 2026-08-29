import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CRM_SENSITIVE_CONTENT_PLACEHOLDER } from "./sensitiveContent";
import { useCrmContactHistory } from "./useCrmContactHistory";

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

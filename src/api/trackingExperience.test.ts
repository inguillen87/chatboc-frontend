import { beforeEach, describe, expect, it, vi } from "vitest";

const apiFetchMock = vi.fn();

vi.mock("@/utils/api", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

import { fetchTrackingExperience, sendTrackingSupportMessage } from "./trackingExperience";

describe("trackingExperience api", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    apiFetchMock.mockResolvedValue({ ok: true });
  });

  it("loads public claim tracking with pin without panel credentials", async () => {
    await fetchTrackingExperience({
      kind: "claim",
      code: "M-123456",
      pin: "654321",
      tenantSlug: "junin",
    });

    expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/public/tracking/experience?kind=claim&code=M-123456&pin=654321&tenant_slug=junin",
      expect.objectContaining({
        skipAuth: true,
        omitCredentials: true,
        omitEntityToken: true,
        omitTenant: true,
        pin: "654321",
      }),
    );
  });

  it("loads signed public order tracking with the access token", async () => {
    await fetchTrackingExperience({
      kind: "order",
      code: "pc-77",
      tenantSlug: "junin",
      token: "signed-token-123",
    });

    expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/public/tracking/experience?kind=order&code=pc-77&token=signed-token-123&tenant_slug=junin",
      expect.objectContaining({
        skipAuth: true,
        omitCredentials: true,
        omitEntityToken: true,
        omitTenant: true,
        pin: null,
      }),
    );
  });

  it("sends ticket-bound support messages to the live claim endpoint", async () => {
    await sendTrackingSupportMessage({
      endpoint: "/api/public/tracking/claims/42/messages",
      pin: "654321",
      message: "Necesito hablar con alguien",
      code: "M-123456",
    });

    expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/public/tracking/claims/42/messages?pin=654321",
      expect.objectContaining({
        method: "POST",
        body: {
          comentario: "Necesito hablar con alguien",
          mensaje: "Necesito hablar con alguien",
          texto: "Necesito hablar con alguien",
        },
        skipAuth: true,
        omitCredentials: true,
      }),
    );
  });

  it("keeps the legacy claim message endpoint compatible", async () => {
    await sendTrackingSupportMessage({
      endpoint: "/tracking/api/send-claim-message",
      pin: "654321",
      message: "Sumo informacion",
      code: "M-123456",
    });

    expect(apiFetchMock).toHaveBeenCalledWith(
      "/tracking/api/send-claim-message?pin=654321",
      expect.objectContaining({
        method: "POST",
        body: {
          nro_ticket: "123456",
          mensaje: "Sumo informacion",
          comentario: "Sumo informacion",
        },
      }),
    );
  });
});

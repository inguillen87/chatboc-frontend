import { describe, expect, it, vi } from "vitest";

import {
  MUNICIPAL_CHAT_IDEMPOTENCY_KEY_PATTERN,
  createMunicipalChatIdempotencyKey,
  resolveMunicipalInitIdempotencyState,
  resolveMunicipalChatIdempotencyKey,
} from "./municipalChatIdempotency";

describe("municipal chat idempotency", () => {
  it("creates a new backend-compatible UUID for every ordinary municipal turn", () => {
    const first = resolveMunicipalChatIdempotencyKey({
      tipoChat: "municipio",
      action: "info_tramite",
    });
    const second = resolveMunicipalChatIdempotencyKey({
      tipoChat: "municipio",
      action: "info_tramite",
    });

    expect(first).toMatch(MUNICIPAL_CHAT_IDEMPOTENCY_KEY_PATTERN);
    expect(second).toMatch(MUNICIPAL_CHAT_IDEMPOTENCY_KEY_PATTERN);
    expect(first).not.toBe(second);
    expect(createMunicipalChatIdempotencyKey()).toMatch(
      MUNICIPAL_CHAT_IDEMPOTENCY_KEY_PATTERN,
    );
  });

  it("reuses the exact claim key across ambiguous confirmation retries", () => {
    const createKey = vi.fn(() => "unused-generated-key");
    const currentClaimIdempotencyKey =
      "667f4278-beb8-4655-9515-e680a24aef45";

    const first = resolveMunicipalChatIdempotencyKey({
      tipoChat: "municipio",
      action: "confirmar_reclamo",
      currentClaimIdempotencyKey,
      createKey,
    });
    const retry = resolveMunicipalChatIdempotencyKey({
      tipoChat: "municipio",
      action: "confirmar_reclamo",
      currentClaimIdempotencyKey,
      createKey,
    });

    expect(first).toBe(currentClaimIdempotencyKey);
    expect(retry).toBe(currentClaimIdempotencyKey);
    expect(createKey).not.toHaveBeenCalled();
  });

  it("keeps the municipal init key stable for retries in the same session scope", () => {
    const createKey = vi
      .fn()
      .mockReturnValueOnce("municipio-init-key-0001")
      .mockReturnValueOnce("municipio-init-key-0002");
    const first = resolveMunicipalInitIdempotencyState({
      tipoChat: "municipio",
      scope: "sid-1:junin",
      createKey,
    });
    const retry = resolveMunicipalInitIdempotencyState({
      tipoChat: "municipio",
      scope: "sid-1:junin",
      current: first,
      createKey,
    });
    const nextSession = resolveMunicipalInitIdempotencyState({
      tipoChat: "municipio",
      scope: "sid-2:junin",
      current: retry,
      createKey,
    });

    expect(retry).toBe(first);
    expect(retry?.key).toBe("municipio-init-key-0001");
    expect(nextSession?.key).toBe("municipio-init-key-0002");
    expect(createKey).toHaveBeenCalledTimes(2);
  });

  it("never generates an idempotency key for PYME chat", () => {
    const createKey = vi.fn(() => "should-never-be-used");

    expect(
      resolveMunicipalChatIdempotencyKey({
        tipoChat: "pyme",
        action: "confirmar_reclamo",
        currentClaimIdempotencyKey:
          "667f4278-beb8-4655-9515-e680a24aef45",
        createKey,
      }),
    ).toBeNull();
    expect(createKey).not.toHaveBeenCalled();
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";

import { getLandingExperience } from "./landingExperience";
import { publicApi } from "@/api/v2/client";

describe("getLandingExperience", () => {
  afterEach(() => vi.restoreAllMocks());

  it("never lets a token left in the browser choose the landing", async () => {
    const get = vi.spyOn(publicApi, "get").mockResolvedValue({ hero: {} });

    await getLandingExperience();

    expect(get).toHaveBeenCalledWith(
      "/api/public/landing-experience",
      expect.objectContaining({ omitEntityToken: true, omitCredentials: true }),
    );
  });

  it("names the organization in the URL when one is asked for", async () => {
    const get = vi.spyOn(publicApi, "get").mockResolvedValue({ hero: {} });

    await getLandingExperience({ tenantSlug: "junin" });

    expect(get.mock.calls[0][0]).toBe("/api/public/landing-experience?tenant_slug=junin");
  });
});

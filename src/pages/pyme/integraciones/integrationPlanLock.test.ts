import { describe, expect, it } from "vitest";

import { buildIntegrationPlanLockView, lockMatchesChannel } from "./integrationPlanLock";

describe("integration plan lock helpers", () => {
  it("normalizes a marketplace sync lock from ApiError body", () => {
    const lock = buildIntegrationPlanLockView({
      body: {
        error: "plan_required",
        feature_id: "marketplace_sync",
        message: "Marketplaces externos requieren plan Full.",
        feature: {
          id: "marketplace_sync",
          label: "Marketplaces y catalogos externos",
          action: "connect_marketplace",
          required_plan: "full",
        },
        frontend_contract: {
          feature_id: "marketplace_sync",
          render_as: "integration_locked",
          current_plan: "free",
          required_plan: "full",
          primary_action: "upgrade_to_full",
        },
        upgrade: {
          label: "Solicitar upgrade a Full",
          url: "https://www.chatboc.ar/#precios",
        },
      },
    });

    expect(lock).toMatchObject({
      featureId: "marketplace_sync",
      featureLabel: "Marketplaces y catalogos externos",
      featureAction: "connect_marketplace",
      currentPlan: "free",
      requiredPlan: "full",
      renderAs: "integration_locked",
    });
    expect(lockMatchesChannel(lock, "mercadolibre")).toBe(true);
    expect(lockMatchesChannel(lock, "tiendanube")).toBe(true);
    expect(lockMatchesChannel(lock, "whatsapp")).toBe(false);
  });

  it("normalizes a WhatsApp sender lock", () => {
    const lock = buildIntegrationPlanLockView({
      error: "plan_required",
      feature_id: "whatsapp_sender_management",
      feature: {
        label: "Gestion de sender y plantillas",
        action: "manage_whatsapp_sender",
      },
      access: {
        current_plan: "free",
        required_plan: "full",
      },
    });

    expect(lock?.featureId).toBe("whatsapp_sender_management");
    expect(lock?.featureAction).toBe("manage_whatsapp_sender");
    expect(lockMatchesChannel(lock, "whatsapp")).toBe(true);
    expect(lockMatchesChannel(lock, "mercadolibre")).toBe(false);
  });

  it("keeps payment gateway metadata visible for payment locks", () => {
    const lock = buildIntegrationPlanLockView({
      error: "plan_required",
      feature_id: "mercadopago_checkout",
      feature: {
        label: "Cobros y checkout seguro",
        action: "configure_payment_gateway",
      },
      frontend_contract: {
        feature_label: "Cobros y checkout seguro",
      },
    });

    expect(lock?.featureId).toBe("mercadopago_checkout");
    expect(lock?.featureLabel).toBe("Cobros y checkout seguro");
    expect(lock?.featureAction).toBe("configure_payment_gateway");
    expect(lockMatchesChannel(lock, "mercadopago")).toBe(true);
    expect(lockMatchesChannel(lock, "mercadolibre")).toBe(false);
  });
});

export type IntegrationPlanLockView = {
  featureId: string;
  featureLabel: string;
  featureAction: string;
  message: string;
  currentPlan: string;
  requiredPlan: string;
  reasonCode: string;
  lockReasonCode: string;
  primaryAction: string;
  renderAs: string;
  upgradeLabel: string;
  upgradeUrl: string;
  tenantSlug?: string | null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const readText = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
};

export const extractIntegrationPlanLockPayload = (source: unknown): Record<string, unknown> | null => {
  if (isRecord(source) && source.error === "plan_required") return source;
  if (isRecord(source) && isRecord(source.body) && source.body.error === "plan_required") return source.body;
  return null;
};

export const buildIntegrationPlanLockView = (
  source: unknown,
  fallbackFeatureId = "marketplace_sync",
): IntegrationPlanLockView | null => {
  const payload = extractIntegrationPlanLockPayload(source);
  if (!payload) return null;

  const feature = isRecord(payload.feature) ? payload.feature : {};
  const frontend = isRecord(payload.frontend_contract) ? payload.frontend_contract : {};
  const access = isRecord(payload.access) ? payload.access : {};
  const upgrade = isRecord(payload.upgrade) ? payload.upgrade : {};

  const featureId = readText(payload.feature_id, frontend.feature_id, feature.id, fallbackFeatureId) || fallbackFeatureId;
  const featureLabel =
    readText(feature.label, frontend.feature_label, featureId.replace(/_/g, " ")) || "Integracion productiva";
  const message =
    readText(
      payload.message,
      access.message,
      "Esta integracion requiere plan Full activo para operar en produccion.",
    ) || "Esta integracion requiere plan Full activo para operar en produccion.";

  return {
    featureId,
    featureLabel,
    featureAction: readText(feature.action, frontend.feature_action, payload.action_hint, "upgrade_to_full"),
    message,
    currentPlan: readText(frontend.current_plan, access.current_plan, "free") || "free",
    requiredPlan: readText(frontend.required_plan, feature.required_plan, access.required_plan, "full") || "full",
    reasonCode: readText(payload.reason_code, frontend.reason_code, feature.reason_code, "plan_full_required"),
    lockReasonCode: readText(payload.lock_reason_code, frontend.lock_reason_code, feature.lock_reason_code),
    primaryAction: readText(frontend.primary_action, payload.action_hint, "upgrade_to_full") || "upgrade_to_full",
    renderAs: readText(frontend.render_as, "integration_locked") || "integration_locked",
    upgradeLabel: readText(upgrade.label, "Solicitar upgrade") || "Solicitar upgrade",
    upgradeUrl: readText(upgrade.url, "https://www.chatboc.ar/#precios") || "https://www.chatboc.ar/#precios",
    tenantSlug: readText(payload.tenant_slug) || null,
  };
};

export const lockMatchesChannel = (lock: IntegrationPlanLockView | null, channel: string) => {
  if (!lock) return false;
  const normalized = channel.trim().toLowerCase();
  if (normalized === "whatsapp") return lock.featureId === "whatsapp_sender_management";
  if (normalized === "mercadolibre" || normalized === "tiendanube") return lock.featureId === "marketplace_sync";
  return false;
};

import type { BotSettingsPayload } from '@/services/enterpriseService';

const HEX_COLOR_REGEX = /^#(?:[0-9a-fA-F]{3}){1,2}$/;

export interface BotSettingsValidationResult {
  name?: string;
  tone?: string;
  system_prompt?: string;
  logo_url?: string;
  primary_color?: string;
  secondary_color?: string;
  fallback_behavior?: string;
}

const trimOrUndefined = (value?: string) => {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
};

const isValidUrl = (value: string) => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

const isValidColor = (value: string) => HEX_COLOR_REGEX.test(value);

export const validateBotSettings = (form: BotSettingsPayload): BotSettingsValidationResult => {
  const result: BotSettingsValidationResult = {};

  const allowedFallbacks = new Set(['derivar_humano', 'auto_reply', 'silent']);
  if (form.fallback_behavior && !allowedFallbacks.has(form.fallback_behavior)) {
    result.fallback_behavior = 'Fallback inválido. Elegí una opción permitida.';
  }

  if ((form.name || '').length > 120) {
    result.name = 'Máximo 120 caracteres.';
  }

  if ((form.tone || '').length > 120) {
    result.tone = 'Máximo 120 caracteres.';
  }

  if ((form.system_prompt || '').length > 4000) {
    result.system_prompt = 'Máximo 4000 caracteres.';
  }

  const logoUrl = trimOrUndefined(form.branding?.logo_url);
  if (logoUrl && !isValidUrl(logoUrl)) {
    result.logo_url = 'Ingresá una URL válida (http/https).';
  }

  const primaryColor = trimOrUndefined(form.branding?.primary_color);
  if (primaryColor && !isValidColor(primaryColor)) {
    result.primary_color = 'Usá formato hexadecimal, por ejemplo #123456.';
  }

  const secondaryColor = trimOrUndefined(form.branding?.secondary_color);
  if (secondaryColor && !isValidColor(secondaryColor)) {
    result.secondary_color = 'Usá formato hexadecimal, por ejemplo #abcdef.';
  }

  return result;
};

export const hasBotSettingsErrors = (validation: BotSettingsValidationResult) =>
  Object.values(validation).some(Boolean);

export const sanitizeBotSettingsPayload = (form: BotSettingsPayload, tenantId: number): BotSettingsPayload => {
  const branding = {
    logo_url: trimOrUndefined(form.branding?.logo_url),
    primary_color: trimOrUndefined(form.branding?.primary_color),
    secondary_color: trimOrUndefined(form.branding?.secondary_color),
  };

  return {
    tenant_id: tenantId,
    name: trimOrUndefined(form.name),
    tone: trimOrUndefined(form.tone),
    system_prompt: trimOrUndefined(form.system_prompt),
    fallback_behavior: form.fallback_behavior || 'auto_reply',
    branding,
  };
};

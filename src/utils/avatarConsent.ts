const CONSENTED_SOURCE_VALUES = new Set([
  'consent',
  'consentida',
  'consented',
  'imagen_consentida',
  'profile_url',
  'profile_upload',
  'profile_picture',
  'user_upload',
  'uploaded',
  'social',
  'social_login',
  'oauth',
  'clerk',
  'google',
  'facebook',
  'linkedin',
  'agent_profile',
  'staff_profile',
  'employee_profile',
]);

const CONSENTED_SOURCE_PREFIXES = [
  'profile_upload',
  'profile_url',
  'user_upload',
  'social_login',
  'oauth',
  'clerk',
  'google',
  'facebook',
  'linkedin',
  'agent_profile',
  'staff_profile',
  'employee_profile',
];

const BLOCKED_SOURCE_KEYWORDS = [
  'no_consent',
  'without_consent',
  'not_consented',
  'unconsented',
  'consent_denied',
  'consent_rejected',
  'whatsapp_profile',
  'whatsapp_avatar',
  'whatsapp_photo',
  'wa_profile',
  'wa_avatar',
  'scrape',
  'scraping',
  'scraped',
  'profile_scrape',
  'mock',
  'fake',
  'synthetic',
  'realistic_generated',
];

const EXPLICIT_CONSENT_KEYS = [
  'avatar_consent',
  'avatarConsent',
  'avatar_is_consented',
  'avatarIsConsented',
  'avatar_consented',
  'avatarConsented',
  'profile_picture_consent',
  'profilePictureConsent',
  'picture_consent',
  'pictureConsent',
  'photo_consent',
  'photoConsent',
  'consented_avatar',
  'consentedAvatar',
];

const AVATAR_URL_KEYS = [
  'avatarUrl',
  'avatar_url',
  'contact_avatar_url',
  'profile_picture_url',
  'picture',
  'profile_avatar_url',
];

const AVATAR_SOURCE_KEYS = [
  'avatar_source',
  'avatarSource',
  'profile_picture_source',
  'profilePictureSource',
  'picture_source',
  'pictureSource',
  'profile_avatar_source',
];

const NESTED_AVATAR_RECORD_KEYS = [
  'identity',
  'contact_identity',
  'contactIdentity',
  'contact',
  'profile',
  'user',
  'customer_profile',
  'customerProfile',
  'customer_identity',
  'customerIdentity',
  'metadata',
  'source_metadata',
  'sourceMetadata',
];

type AvatarRecord = Record<string, unknown>;

export interface AvatarConsentInput {
  avatarUrl?: string | null;
  source?: string | null;
  consented?: unknown;
}

export interface ResolvedAvatar {
  avatarUrl?: string;
  source?: string;
  consented: boolean;
}

const normalizeToken = (value?: string | null): string =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

const normalizeSourceValue = (value?: string | null): string =>
  normalizeToken(value).replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

export const normalizeAvatarUrl = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
};

const INTERNAL_AVATAR_PREFIXES = ['/uploads/', '/media/', '/static/', '/avatars/', '/profile/'];

export const isSafeAvatarUrl = (value: unknown): boolean => {
  const avatarUrl = normalizeAvatarUrl(value);
  if (!avatarUrl || avatarUrl.length > 512) return false;

  if (avatarUrl.startsWith('/') && !avatarUrl.startsWith('//') && !avatarUrl.includes('\\')) {
    return INTERNAL_AVATAR_PREFIXES.some((prefix) => avatarUrl.startsWith(prefix));
  }

  try {
    const parsed = new URL(avatarUrl);
    if (parsed.protocol === 'https:' && parsed.hostname) return true;
    if (
      parsed.protocol === 'http:' &&
      ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname)
    ) {
      return true;
    }
  } catch {
    return false;
  }

  return false;
};

const readConsentState = (value: unknown): boolean | null => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'si', 's', 'consented', 'accepted'].includes(normalized)) {
      return true;
    }
    if (['0', 'false', 'no', 'n', 'denied', 'rejected', 'unconsented'].includes(normalized)) {
      return false;
    }
  }
  return null;
};

export const isConsentedAvatarSource = (source?: string | null): boolean => {
  const normalized = normalizeSourceValue(source);
  if (!normalized) return false;

  if (BLOCKED_SOURCE_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
    return false;
  }

  if (CONSENTED_SOURCE_VALUES.has(normalized)) return true;

  return CONSENTED_SOURCE_PREFIXES.some((prefix) => (
    normalized === prefix ||
    normalized.startsWith(`${prefix}_`)
  ));
};

export const shouldRenderProfileImage = ({
  avatarUrl,
  source,
  consented,
}: AvatarConsentInput): boolean => {
  const normalizedUrl = normalizeAvatarUrl(avatarUrl);
  if (!normalizedUrl) return false;
  if (!isSafeAvatarUrl(normalizedUrl)) return false;

  const normalizedSource = normalizeSourceValue(source);
  if (BLOCKED_SOURCE_KEYWORDS.some((keyword) => normalizedSource.includes(keyword))) {
    return false;
  }

  const explicitConsent = readConsentState(consented);
  if (explicitConsent === false) return false;
  if (explicitConsent !== true) return false;

  return isConsentedAvatarSource(source);
};

const firstString = (record: AvatarRecord | undefined, keys: string[]): string | undefined => {
  if (!record) return undefined;
  for (const key of keys) {
    const value = normalizeAvatarUrl(record[key]);
    if (value) return value;
  }
  return undefined;
};

const firstExplicitConsent = (record: AvatarRecord | undefined): boolean | undefined => {
  if (!record) return undefined;
  for (const key of EXPLICIT_CONSENT_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(record, key)) continue;
    const consent = readConsentState(record[key]);
    if (consent !== null) return consent;
  }
  return undefined;
};

const isAvatarRecord = (value: unknown): value is AvatarRecord =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const collectAvatarRecords = (
  record: AvatarRecord,
  output: AvatarRecord[],
  seen: WeakSet<object>,
): void => {
  if (seen.has(record)) return;
  seen.add(record);
  output.push(record);

  for (const key of NESTED_AVATAR_RECORD_KEYS) {
    const nested = record[key];
    if (isAvatarRecord(nested)) {
      collectAvatarRecords(nested, output, seen);
    }
  }
};

export const resolveConsentedAvatar = (...records: Array<AvatarRecord | null | undefined>): ResolvedAvatar => {
  const candidates: AvatarRecord[] = [];
  const seen = new WeakSet<object>();
  for (const record of records) {
    if (!record) continue;
    collectAvatarRecords(record, candidates, seen);
  }

  for (const record of candidates) {
    const avatarUrl = firstString(record, AVATAR_URL_KEYS);
    if (!avatarUrl) continue;

    const source = firstString(record, AVATAR_SOURCE_KEYS);
    const consented = firstExplicitConsent(record);

    if (shouldRenderProfileImage({ avatarUrl, source, consented })) {
      return {
        avatarUrl,
        source: source || 'imagen consentida',
        consented: true,
      };
    }
  }

  return { consented: false };
};

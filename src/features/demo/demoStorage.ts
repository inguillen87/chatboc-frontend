import { safeLocalStorage, safeSessionStorage } from '@/utils/safeLocalStorage';

export const DEMO_MODE_STORAGE_KEY = 'demoMode';
export const DEMO_SESSION_STORAGE_KEY = 'chatboc_demo_session_id';
export const LEGACY_DEMO_SESSION_STORAGE_KEY = 'demoSessionId';
export const DEMO_CHAT_SESSION_STORAGE_KEY = 'chatboc_demo_chat_session_id';
export const LEGACY_DEMO_CHAT_SESSION_STORAGE_KEY = 'demoChatSessionId';
export const DEMO_TENANT_STORAGE_KEY = 'chatboc_demo_tenant_slug';
export const DEMO_WHATSAPP_PROFILE_STORAGE_KEY = 'chatboc_demo_whatsapp_profile_v1';
export const DEMO_WHATSAPP_PROFILE_CHANGE_EVENT = 'chatboc:demo-whatsapp-profile-change';

const DEMO_WHATSAPP_PROFILE_MAX_AGE_MS = 30 * 60 * 1000;

type DemoRuntimeSessionLike = {
  chat_session_id?: string | null;
  session_id?: string | null;
  demo_session_id?: string | null;
  tenant_slug?: string | null;
  tenant?: {
    slug?: string | null;
  } | null;
};

const readShortSessionId = (value: unknown): string | null => {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed || trimmed.length > 64 || trimmed.includes('.')) return null;
  return trimmed;
};

const readCleanString = (value: unknown): string | null => {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed || null;
};

const readSelectionValue = (value: unknown): string | null => {
  const trimmed = readCleanString(value);
  if (!trimmed || trimmed.length > 128 || /[\u0000-\u001f\u007f]/.test(trimmed)) return null;
  return trimmed;
};

const normalizedScope = (value: unknown) => readCleanString(value)?.toLocaleLowerCase() ?? null;

const currentNavigationPath = () => {
  if (typeof window === 'undefined') return null;
  return `${window.location.pathname}${window.location.search}`;
};

const notifyDemoWhatsappProfileSelectionChange = () => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(DEMO_WHATSAPP_PROFILE_CHANGE_EVENT));
};

export const subscribeDemoWhatsappProfileSelection = (listener: () => void) => {
  if (typeof window === 'undefined') return () => undefined;
  window.addEventListener(DEMO_WHATSAPP_PROFILE_CHANGE_EVENT, listener);
  return () => window.removeEventListener(DEMO_WHATSAPP_PROFILE_CHANGE_EVENT, listener);
};

export const readDemoWhatsappProfileSelection = ({
  sector,
  tenantSlug,
}: {
  sector?: string | null;
  tenantSlug?: string | null;
} = {}): string | null => {
  const raw = safeSessionStorage.getItem(DEMO_WHATSAPP_PROFILE_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const key = readSelectionValue(parsed.key);
    const navigationPath = readCleanString(parsed.navigation_path);
    const savedAt = typeof parsed.saved_at === 'number' ? parsed.saved_at : Number.NaN;
    if (
      !key ||
      !Number.isFinite(savedAt) ||
      savedAt > Date.now() + 60_000 ||
      Date.now() - savedAt > DEMO_WHATSAPP_PROFILE_MAX_AGE_MS
    ) {
      safeSessionStorage.removeItem(DEMO_WHATSAPP_PROFILE_STORAGE_KEY);
      return null;
    }
    if (!navigationPath || navigationPath !== currentNavigationPath()) return null;
    const requestedSector = normalizedScope(sector);
    const storedSector = normalizedScope(parsed.sector);
    if (requestedSector && storedSector && requestedSector !== storedSector) return null;
    const requestedTenant = normalizedScope(tenantSlug);
    const storedTenant = normalizedScope(parsed.tenant_slug);
    if (requestedTenant && storedTenant && requestedTenant !== storedTenant) return null;
    return key;
  } catch {
    safeSessionStorage.removeItem(DEMO_WHATSAPP_PROFILE_STORAGE_KEY);
    return null;
  }
};

export const persistDemoWhatsappProfileSelection = ({
  key,
  sector,
  tenantSlug,
}: {
  key: string;
  sector?: string | null;
  tenantSlug?: string | null;
}) => {
  const cleanKey = readSelectionValue(key);
  if (!cleanKey) return;
  safeSessionStorage.setItem(
    DEMO_WHATSAPP_PROFILE_STORAGE_KEY,
    JSON.stringify({
      key: cleanKey,
      sector: normalizedScope(sector),
      tenant_slug: normalizedScope(tenantSlug),
      navigation_path: currentNavigationPath(),
      saved_at: Date.now(),
    }),
  );
  notifyDemoWhatsappProfileSelectionChange();
};

export const clearDemoWhatsappProfileSelection = () => {
  safeSessionStorage.removeItem(DEMO_WHATSAPP_PROFILE_STORAGE_KEY);
  notifyDemoWhatsappProfileSelectionChange();
};

const hasRegisteredSession = () =>
  Boolean(
    safeLocalStorage.getItem('authToken') ||
      safeLocalStorage.getItem('chatAuthToken') ||
      safeLocalStorage.getItem('entityToken') ||
      safeLocalStorage.getItem('user'),
  );

const clearLegacyTenantIfItOnlyCameFromDemo = (demoTenantSlug: string | null) => {
  if (!demoTenantSlug || hasRegisteredSession()) return;
  const storedTenant = readCleanString(safeLocalStorage.getItem('tenantSlug'));
  if (storedTenant === demoTenantSlug) {
    safeLocalStorage.removeItem('tenantSlug');
  }
};

export const persistDemoRuntimeStorage = (session?: DemoRuntimeSessionLike | null) => {
  if (!session) return;

  const chatSessionId = readShortSessionId(session.chat_session_id) ?? readShortSessionId(session.session_id);
  if (chatSessionId) {
    safeLocalStorage.setItem(DEMO_CHAT_SESSION_STORAGE_KEY, chatSessionId);
    safeLocalStorage.setItem(LEGACY_DEMO_CHAT_SESSION_STORAGE_KEY, chatSessionId);
  }

  const demoSessionId = readCleanString(session.demo_session_id);
  if (demoSessionId) {
    safeLocalStorage.setItem(DEMO_SESSION_STORAGE_KEY, demoSessionId);
    safeLocalStorage.setItem(LEGACY_DEMO_SESSION_STORAGE_KEY, demoSessionId);
  } else {
    safeLocalStorage.removeItem(LEGACY_DEMO_SESSION_STORAGE_KEY);
  }

  const demoTenantSlug = readCleanString(session.tenant_slug) ?? readCleanString(session.tenant?.slug);
  if (demoTenantSlug) {
    safeLocalStorage.setItem(DEMO_TENANT_STORAGE_KEY, demoTenantSlug);
    clearLegacyTenantIfItOnlyCameFromDemo(demoTenantSlug);
  }
};

export const clearDemoRuntimeStorage = () => {
  safeLocalStorage.removeItem(DEMO_SESSION_STORAGE_KEY);
  safeLocalStorage.removeItem(LEGACY_DEMO_SESSION_STORAGE_KEY);
  safeLocalStorage.removeItem(DEMO_CHAT_SESSION_STORAGE_KEY);
  safeLocalStorage.removeItem(LEGACY_DEMO_CHAT_SESSION_STORAGE_KEY);
  safeLocalStorage.removeItem(DEMO_TENANT_STORAGE_KEY);
};

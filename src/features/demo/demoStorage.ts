import { safeLocalStorage } from '@/utils/safeLocalStorage';

export const DEMO_MODE_STORAGE_KEY = 'demoMode';
export const DEMO_SESSION_STORAGE_KEY = 'chatboc_demo_session_id';
export const LEGACY_DEMO_SESSION_STORAGE_KEY = 'demoSessionId';
export const DEMO_CHAT_SESSION_STORAGE_KEY = 'chatboc_demo_chat_session_id';
export const LEGACY_DEMO_CHAT_SESSION_STORAGE_KEY = 'demoChatSessionId';
export const DEMO_TENANT_STORAGE_KEY = 'chatboc_demo_tenant_slug';

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

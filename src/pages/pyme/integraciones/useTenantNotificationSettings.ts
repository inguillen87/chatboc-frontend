import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { apiClient } from '@/api/client';
import { ApiError } from '@/utils/api';
import { captureChatbocSessionRevision, isChatbocSessionRevisionCurrent } from '@/utils/chatbocSessionRevision';
import type { NotificationPreferences } from '@/features/notifications/tenantNotificationSettingsContract';

type Channel = 'email' | 'telegram' | 'whatsapp';
export interface NotificationDraft {
  owner_phone: string | null;
  telegram_chat_id: string | null;
  notification_settings: NotificationPreferences & Record<Channel, boolean>;
}
type State = { key: string | null; tenant: string | null; attempt: number; revision: number | null; draft: NotificationDraft;
  changes: Partial<Record<Channel, boolean>>; status: 'loading' | 'ready' | 'failed'; saving: boolean; error: string | null };
const emptyDraft = (): NotificationDraft => ({ owner_phone: '', telegram_chat_id: '',
  notification_settings: { email: false, telegram: false, whatsapp: false } });
const normalizeDraft = (value: unknown): NotificationDraft | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const data = value as Partial<NotificationDraft>;
  const preferences = data.notification_settings;
  if (!preferences || typeof preferences !== 'object' || Array.isArray(preferences)) return null;
  if (['email', 'telegram', 'whatsapp'].some(channel => {
    const value = preferences[channel as Channel]; return value !== undefined && value !== null && typeof value !== 'boolean';
  })) return null;
  return { owner_phone: data.owner_phone === null || typeof data.owner_phone === 'string' ? data.owner_phone : '',
    telegram_chat_id: data.telegram_chat_id === null || typeof data.telegram_chat_id === 'string' ? data.telegram_chat_id : '',
    notification_settings: { ...preferences, email: preferences.email ?? true, telegram: preferences.telegram ?? false, whatsapp: preferences.whatsapp ?? false } };
};

/** Drafts and acknowledgements belong to one verified tenant/session scope. */
export function useTenantNotificationSettings(tenantSlug: string | null | undefined, scopeKey: string | null) {
  const scope = useRef({ key: scopeKey, tenant: tenantSlug });
  const generation = useRef(0);
  const mounted = useRef(false);
  const saving = useRef(false);
  const reading = useRef(false);
  if (scope.current.key !== scopeKey || scope.current.tenant !== tenantSlug) {
    scope.current = { key: scopeKey, tenant: tenantSlug }; generation.current += 1; saving.current = false; reading.current = false;
  }
  const [state, setState] = useState<State>({ key: null, tenant: null, attempt: -1, revision: null, draft: emptyDraft(), changes: {}, status: 'loading', saving: false, error: null });
  useLayoutEffect(() => { mounted.current = true; return () => {
    mounted.current = false; generation.current += 1; saving.current = false; reading.current = false;
  }; }, []);
  const reload = useCallback(async () => {
    if (!mounted.current || !scopeKey || !tenantSlug || scope.current.key !== scopeKey || scope.current.tenant !== tenantSlug || saving.current || reading.current) return;
    reading.current = true;
    const attempt = ++generation.current, revision = captureChatbocSessionRevision();
    const current = () => mounted.current && generation.current === attempt && scope.current.key === scopeKey
      && scope.current.tenant === tenantSlug && isChatbocSessionRevisionCurrent(revision);
    setState(previous => ({ key: scopeKey, tenant: tenantSlug, attempt, revision,
      draft: previous.key === scopeKey && previous.tenant === tenantSlug && previous.revision === revision ? previous.draft : emptyDraft(),
      changes: previous.key === scopeKey && previous.tenant === tenantSlug && previous.revision === revision ? previous.changes : {},
      status: 'loading', saving: false, error: null }));
    try {
      const draft = normalizeDraft(await apiClient.adminGetNotificationSettings(tenantSlug));
      if (!current()) return;
      if (!draft) throw new Error('notification_settings_unavailable');
      setState({ key: scopeKey, tenant: tenantSlug, attempt, revision, draft, changes: {}, status: 'ready', saving: false, error: null });
    } catch (error) {
      const denied = error instanceof ApiError && [401, 403].includes(error.status);
      if (current()) setState(previous => ({ key: scopeKey, tenant: tenantSlug, attempt, revision,
        draft: denied ? emptyDraft() : previous.draft, changes: denied ? {} : previous.changes, status: 'failed', saving: false,
        error: 'No pudimos leer las preferencias de esta organización. Reintentá antes de guardar.' }));
    } finally { if (current()) reading.current = false; }
  }, [tenantSlug, scopeKey]);
  useEffect(() => { void reload(); }, [reload]);
  const visible = scopeKey && state.key === scopeKey && state.tenant === tenantSlug && state.attempt === generation.current ? state : null;
  const canEdit = Boolean(visible?.status === 'ready' && !visible.saving && visible.revision !== null && isChatbocSessionRevisionCurrent(visible.revision));
  const setPreference = (channel: Channel, value: boolean) => {
    if (!canEdit || saving.current || scope.current.key !== scopeKey || scope.current.tenant !== tenantSlug || visible?.attempt !== generation.current) return;
    setState(previous => previous.key === scopeKey && previous.status === 'ready' && previous.attempt === visible.attempt ? { ...previous, error: null,
      changes: { ...previous.changes, [channel]: value },
      draft: { ...previous.draft, notification_settings: { ...previous.draft.notification_settings, [channel]: value } } } : previous);
  };
  const save = async (): Promise<'saved' | 'failed' | 'retired'> => {
    if (!scopeKey || !tenantSlug || scope.current.key !== scopeKey || scope.current.tenant !== tenantSlug || !canEdit || saving.current || !visible) return 'retired';
    saving.current = true;
    const attempt = visible.attempt, revision = visible.revision!, draft = visible.draft;
    const current = () => mounted.current && generation.current === attempt && scope.current.key === scopeKey
      && scope.current.tenant === tenantSlug && isChatbocSessionRevisionCurrent(revision);
    if (!current()) { saving.current = false; return 'retired'; }
    setState(previous => ({ ...previous, saving: true, error: null }));
    try {
      await apiClient.adminUpdateNotificationSettings(tenantSlug, { notification_settings: visible.changes }, draft);
      if (!current()) return 'retired';
      setState(previous => ({ ...previous, saving: false, changes: {} })); return 'saved';
    } catch (error) {
      if (!current()) return 'retired';
      const denied = error instanceof ApiError && [401, 403].includes(error.status);
      setState(previous => ({ ...previous, saving: false, status: denied ? 'failed' : 'ready',
        draft: denied ? emptyDraft() : previous.draft,
        changes: denied ? {} : previous.changes,
        error: denied ? 'No pudimos confirmar tu acceso. Volvé a leer las preferencias antes de guardar.'
          : 'No pudimos confirmar el guardado. Tu borrador sigue disponible para reintentar.' }));
      return 'failed';
    } finally { if (current()) saving.current = false; }
  };
  return { draft: visible?.draft ?? emptyDraft(), canEdit, saving: Boolean(visible?.saving),
    loading: Boolean(scopeKey && (!visible || visible.status === 'loading')), error: visible?.error ?? null,
    canRetry: Boolean(scopeKey && visible?.status === 'failed'), verified: Boolean(scopeKey), setPreference, save, reload };
}

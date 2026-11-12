import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { apiClient } from '@/api/client';
import type { NotificationChannel, TenantNotificationSettings, TenantNotificationSettingsUpdate } from '@/features/notifications/tenantNotificationSettingsContract';
import { ApiError } from '@/utils/api';
import { captureChatbocSessionRevision, isChatbocSessionRevisionCurrent } from '@/utils/chatbocSessionRevision';

type Destination = 'owner_phone' | 'telegram_chat_id';
type State = {
  key: string; tenant: string; attempt: number; revision: number;
  draft: TenantNotificationSettings; changes: TenantNotificationSettingsUpdate;
  status: 'loading' | 'ready' | 'failed'; saving: boolean; error: string | null; saved: boolean;
};
const emptyDraft = (): TenantNotificationSettings => ({ owner_phone: null, telegram_chat_id: null, notification_settings: {} });
const emptyChanges = (): TenantNotificationSettingsUpdate => ({ notification_settings: {} });
const denied = (error: unknown) => error instanceof ApiError && [401, 403].includes(error.status);

/** Reads, destination edits and acknowledgements belong to one authenticated scope. */
export function useMunicipalNotificationSettings(tenantSlug: string | null, scopeKey: string | null, tenantId?: number) {
  const scope = useRef({ key: scopeKey, tenant: tenantSlug, tenantId });
  const generation = useRef(0);
  const mounted = useRef(false);
  const saving = useRef(false);
  const reading = useRef(false);
  const [state, setState] = useState<State | null>(null);
  if (scope.current.key !== scopeKey || scope.current.tenant !== tenantSlug || scope.current.tenantId !== tenantId) {
    scope.current = { key: scopeKey, tenant: tenantSlug, tenantId };
    generation.current += 1; saving.current = false; reading.current = false;
  }
  useLayoutEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; generation.current += 1; saving.current = false; reading.current = false; };
  }, []);
  const reload = useCallback(async () => {
    if (!mounted.current || !scopeKey || !tenantSlug || scope.current.key !== scopeKey || scope.current.tenant !== tenantSlug || saving.current || reading.current) return;
    reading.current = true;
    const attempt = ++generation.current, revision = captureChatbocSessionRevision();
    const current = () => mounted.current && generation.current === attempt && scope.current.key === scopeKey
      && scope.current.tenant === tenantSlug && scope.current.tenantId === tenantId && isChatbocSessionRevisionCurrent(revision);
    setState(previous => {
      const same = previous?.key === scopeKey && previous.tenant === tenantSlug && previous.revision === revision;
      return { key: scopeKey, tenant: tenantSlug, attempt, revision,
        draft: same ? previous.draft : emptyDraft(), changes: same ? previous.changes : emptyChanges(),
        status: 'loading', saving: false, error: null, saved: false };
    });
    try {
      const draft = await apiClient.adminGetNotificationSettings(tenantSlug, { isCurrent: current, expectedTenantId: tenantId });
      if (current()) setState({ key: scopeKey, tenant: tenantSlug, attempt, revision, draft, changes: emptyChanges(),
        status: 'ready', saving: false, error: null, saved: false });
    } catch (error) {
      if (current()) setState(previous => ({ key: scopeKey, tenant: tenantSlug, attempt, revision,
        draft: denied(error) ? emptyDraft() : previous?.draft ?? emptyDraft(),
        changes: denied(error) ? emptyChanges() : previous?.changes ?? emptyChanges(),
        status: 'failed', saving: false, saved: false,
        error: denied(error) ? 'No pudimos confirmar tu acceso. Volvé a leer las preferencias antes de guardar.'
          : 'No pudimos leer las preferencias de esta organización. Reintentá antes de guardar.' }));
    } finally { if (current()) reading.current = false; }
  }, [tenantSlug, scopeKey, tenantId]);
  useEffect(() => { void reload(); }, [reload]);
  const visible = scopeKey && state?.key === scopeKey && state.tenant === tenantSlug && state.attempt === generation.current
    && isChatbocSessionRevisionCurrent(state.revision) ? state : null;
  const canEdit = Boolean(visible?.status === 'ready' && !visible.saving);
  const dirty = Boolean(visible && (Object.keys(visible.changes.notification_settings).length
    || Object.prototype.hasOwnProperty.call(visible.changes, 'owner_phone')
    || Object.prototype.hasOwnProperty.call(visible.changes, 'telegram_chat_id')));
  const edit = (update: (previous: State) => State) => {
    if (!canEdit || !visible || saving.current || scope.current.key !== scopeKey || scope.current.tenant !== tenantSlug
      || !isChatbocSessionRevisionCurrent(visible.revision)) return;
    setState(previous => previous?.attempt === visible.attempt && previous.key === scopeKey ? update(previous) : previous);
  };
  const setPreference = (channel: NotificationChannel, value: boolean) => edit(previous => ({ ...previous, error: null, saved: false,
    draft: { ...previous.draft, notification_settings: { ...previous.draft.notification_settings, [channel]: value } },
    changes: { ...previous.changes, notification_settings: { ...previous.changes.notification_settings, [channel]: value } } }));
  const setDestination = (destination: Destination, value: string) => edit(previous => ({ ...previous, error: null, saved: false,
    draft: { ...previous.draft, [destination]: value }, changes: { ...previous.changes, [destination]: value } }));
  const save = async (): Promise<'saved' | 'failed' | 'retired'> => {
    if (!scopeKey || !tenantSlug || !visible || !canEdit || !dirty || saving.current
      || scope.current.key !== scopeKey || scope.current.tenant !== tenantSlug) return 'retired';
    const attempt = visible.attempt, revision = visible.revision;
    const current = () => mounted.current && generation.current === attempt && scope.current.key === scopeKey
      && scope.current.tenant === tenantSlug && scope.current.tenantId === tenantId && isChatbocSessionRevisionCurrent(revision);
    if (!current()) return 'retired';
    saving.current = true;
    setState(previous => previous ? { ...previous, saving: true, saved: false, error: null } : previous);
    try {
      const ack = await apiClient.adminUpdateNotificationSettings(tenantSlug, visible.changes, visible.draft,
        { isCurrent: current, expectedTenantId: tenantId });
      if (!current()) return 'retired';
      setState(previous => previous ? { ...previous, draft: 'notification_settings' in ack ? ack : previous.draft,
        changes: emptyChanges(), saving: false, saved: true } : previous);
      return 'saved';
    } catch (error) {
      if (!current()) return 'retired';
      setState(previous => previous ? { ...previous, saving: false, saved: false,
        status: denied(error) ? 'failed' : 'ready',
        draft: denied(error) ? emptyDraft() : previous.draft, changes: denied(error) ? emptyChanges() : previous.changes,
        error: denied(error) ? 'No pudimos confirmar tu acceso. Volvé a leer las preferencias antes de guardar.'
          : 'No pudimos confirmar el guardado. Tu borrador sigue disponible para reintentar.' } : previous);
      return 'failed';
    } finally { if (current()) saving.current = false; }
  };
  return { draft: visible?.draft ?? emptyDraft(), canEdit, canSave: canEdit && dirty, saving: Boolean(visible?.saving),
    loading: Boolean(scopeKey && (!visible || visible.status === 'loading')), verified: Boolean(scopeKey),
    error: visible?.error ?? null, saved: Boolean(visible?.saved), canRetry: Boolean(visible?.status === 'failed'),
    setPreference, setDestination, save, reload };
}

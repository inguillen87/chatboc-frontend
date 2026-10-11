import { ApiError } from '@/utils/api';

export type NotificationChannel = 'email' | 'telegram' | 'whatsapp';
export type NotificationPreferences = Record<string, unknown> & Partial<Record<NotificationChannel, boolean>>;
export interface TenantNotificationSettings {
  owner_phone: string | null;
  telegram_chat_id: string | null;
  notification_settings: NotificationPreferences;
}
export type TenantNotificationSettingsUpdate = Partial<Omit<TenantNotificationSettings, 'notification_settings'>> & {
  notification_settings: NotificationPreferences;
};
export type TenantNotificationSettingsAck = TenantNotificationSettings | { status: 'ok' };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const invalid = (): never => {
  // Do not attach private destination/preference values to diagnostics.
  throw new ApiError('No pudimos validar la respuesta de preferencias de notificación.', 502);
};
const readPreferences = (value: unknown): NotificationPreferences => {
  if (!isRecord(value) || ['email', 'telegram', 'whatsapp'].some(channel =>
    Object.prototype.hasOwnProperty.call(value, channel) && typeof value[channel] !== 'boolean')) return invalid();
  // Hidden preferences may be structured values. Preserve them without flattening.
  return { ...value } as NotificationPreferences;
};
const readDestination = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  return typeof value === 'string' ? value : invalid();
};

/** Canonical GET and POST ACK share a tenant-bound v1 envelope. */
export const readNotificationHooksSettings = (value: unknown, tenantSlug: string): TenantNotificationSettings => {
  if (!isRecord(value) || value.error !== undefined || value.contract_version !== 'notifications.hooks.v1'
    || !isRecord(value.tenant) || !Number.isSafeInteger(value.tenant.id) || Number(value.tenant.id) <= 0
    || value.tenant.slug !== tenantSlug || !isRecord(value.delivery)) return invalid();
  return {
    owner_phone: readDestination(value.delivery.owner_phone),
    telegram_chat_id: readDestination(value.delivery.telegram_chat_id),
    notification_settings: readPreferences(value.preferences),
  };
};

/** Legacy reads have their own shape, selected only by an unsupported HTTP route. */
export const readLegacyNotificationSettings = (value: unknown): TenantNotificationSettings => {
  if (!isRecord(value) || value.error !== undefined || value.contract_version !== undefined
    || (value.status !== undefined && value.status !== 'ok')
    || !Object.prototype.hasOwnProperty.call(value, 'owner_phone')
    || !Object.prototype.hasOwnProperty.call(value, 'telegram_chat_id')) return invalid();
  return {
    owner_phone: readDestination(value.owner_phone),
    telegram_chat_id: readDestination(value.telegram_chat_id),
    notification_settings: readPreferences(value.notification_settings),
  };
};
export const readLegacyNotificationSettingsAck = (value: unknown): { status: 'ok' } => {
  if (!isRecord(value) || value.status !== 'ok' || value.error !== undefined || value.contract_version !== undefined) return invalid();
  return { status: 'ok' };
};

export const serializeNotificationSettings = (settings: TenantNotificationSettingsUpdate) => {
  const preferences = readPreferences(settings.notification_settings);
  const delivery: { owner_phone?: string | null; telegram_chat_id?: string | null } = {};
  for (const key of ['owner_phone', 'telegram_chat_id'] as const) {
    if (Object.prototype.hasOwnProperty.call(settings, key)) delivery[key] = readDestination(settings[key]);
  }
  return {
    // The switches own only these keys. Hidden preferences remain server-owned.
    preferences: Object.fromEntries(Object.entries(preferences).filter(([key]) => ['email', 'telegram', 'whatsapp'].includes(key))),
    ...(Object.keys(delivery).length ? { delivery } : {}),
  };
};

/** A canonical ACK must confirm each submitted value, without comparing untouched fields. */
export const readNotificationHooksSettingsAck = (
  value: unknown, tenantSlug: string, submitted: ReturnType<typeof serializeNotificationSettings>,
): TenantNotificationSettings => {
  const settings = readNotificationHooksSettings(value, tenantSlug);
  for (const [channel, enabled] of Object.entries(submitted.preferences)) {
    if (settings.notification_settings[channel] !== enabled) return invalid();
  }
  if (submitted.delivery) {
    const delivery = isRecord(value) && isRecord(value.delivery) ? value.delivery : invalid();
    for (const key of ['owner_phone', 'telegram_chat_id'] as const) {
      if (Object.prototype.hasOwnProperty.call(submitted.delivery, key)
        && (!Object.prototype.hasOwnProperty.call(delivery, key) || settings[key] !== submitted.delivery[key])) return invalid();
    }
  }
  return settings;
};

/** Old PUT replaces preferences, so a channel-only update needs its full read snapshot. */
export const serializeLegacyNotificationSettings = (
  settings: TenantNotificationSettingsUpdate, snapshot?: TenantNotificationSettings,
): TenantNotificationSettings => {
  if (!snapshot && (!Object.prototype.hasOwnProperty.call(settings, 'owner_phone')
    || !Object.prototype.hasOwnProperty.call(settings, 'telegram_chat_id'))) return invalid();
  return {
    owner_phone: readDestination(Object.prototype.hasOwnProperty.call(settings, 'owner_phone') ? settings.owner_phone : snapshot?.owner_phone),
    telegram_chat_id: readDestination(Object.prototype.hasOwnProperty.call(settings, 'telegram_chat_id') ? settings.telegram_chat_id : snapshot?.telegram_chat_id),
    notification_settings: { ...readPreferences(snapshot?.notification_settings ?? {}), ...readPreferences(settings.notification_settings) },
  };
};

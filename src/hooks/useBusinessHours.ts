import { useState, useEffect } from 'react';
import { safeLocalStorage } from '@/utils/safeLocalStorage';

interface LiveChatSchedule {
  enabled?: boolean;
  socket_transport_hint?: 'polling' | 'websocket' | 'disabled';
  socket_transports?: Array<'polling' | 'websocket'>;
  socket_fallback_enabled?: boolean;
  fallback_mode?: string;
  available?: boolean;
  description?: string;
  days?: string[];
  start_time?: string;
  end_time?: string;
  timezone?: string;
}

const resolveTransportHintKey = (tenantSlug?: string | null) =>
  `chatboc_socket_transport_hint:${tenantSlug || 'default'}`;
const resolveTransportListKey = (tenantSlug?: string | null) =>
  `chatboc_socket_transports:${tenantSlug || 'default'}`;
const resolveTransportFallbackEnabledKey = (tenantSlug?: string | null) =>
  `chatboc_socket_fallback_enabled:${tenantSlug || 'default'}`;

interface BusinessHours {
  isLiveChatEnabled: boolean;
  horariosAtencion: string;
  availabilityLabel: string;
  timezone?: string;
}

interface UseBusinessHoursOptions {
  enabled?: boolean;
  scheduleEndpoint?: string | null;
}

const DEFAULT_BUSINESS_HOURS: BusinessHours = {
  isLiveChatEnabled: false,
  horariosAtencion: '',
  availabilityLabel: '',
  timezone: '',
};

const RELATIVE_URL_BASE = 'http://chatboc.local';

const normalizeRelativeScheduleEndpoint = (value?: string | null) => {
  const endpoint = value?.trim();
  if (
    !endpoint ||
    endpoint.includes('\\') ||
    endpoint.startsWith('//') ||
    /^[a-z][a-z\d+.-]*:/i.test(endpoint)
  ) {
    return null;
  }

  try {
    const url = new URL(endpoint, `${RELATIVE_URL_BASE}/`);
    if (url.origin !== RELATIVE_URL_BASE || url.pathname === '/') {
      return null;
    }
    return `${url.pathname}${url.search}`;
  } catch {
    return null;
  }
};

export const useBusinessHours = (
  entityToken?: string,
  tenantSlug?: string | null,
  options?: UseBusinessHoursOptions,
): BusinessHours => {
  const [businessHours, setBusinessHours] = useState<BusinessHours>({
    ...DEFAULT_BUSINESS_HOURS,
  });

  useEffect(() => {
    setBusinessHours({ ...DEFAULT_BUSINESS_HOURS });

    if (options?.enabled === false) {
      return;
    }

    if (!tenantSlug) {
      return;
    }

    const normalizedTenantSlug = tenantSlug.trim();
    if (!normalizedTenantSlug) {
      return;
    }

    const abortController = new AbortController();
    let isCurrentRequest = true;
    const canApplyResponse = () => isCurrentRequest && !abortController.signal.aborted;

    const fetchProfile = async () => {
      try {
        const encodedTenantSlug = encodeURIComponent(normalizedTenantSlug);
        const params = new URLSearchParams({
          tenant_slug: normalizedTenantSlug,
          tenant: normalizedTenantSlug,
        });
        const schedulePath =
          normalizeRelativeScheduleEndpoint(options?.scheduleEndpoint) ??
          `/api/${encodedTenantSlug}/live-chat/schedule?${params.toString()}`;
        const headers: Record<string, string> = {
          Accept: 'application/json',
          'X-Tenant-Slug': normalizedTenantSlug,
        };
        if (entityToken?.trim()) {
          headers['X-Entity-Token'] = entityToken.trim();
          headers['X-Token'] = entityToken.trim();
        }

        const response = await fetch(schedulePath, {
          method: 'GET',
          headers,
          credentials: 'omit',
          cache: 'no-store',
          signal: abortController.signal,
        });

        if (!canApplyResponse()) {
          return;
        }

        if (!response.ok) {
          if (import.meta.env.DEV) {
            console.debug('Live chat schedule unavailable', {
              status: response.status,
              path: schedulePath,
            });
          }
          return;
        }

        const schedule = (await response.json()) as LiveChatSchedule;
        if (!canApplyResponse()) {
          return;
        }

        const description =
          typeof schedule?.description === 'string' && schedule.description.trim()
            ? schedule.description.trim()
            : (() => {
                const days = Array.isArray(schedule?.days)
                  ? schedule.days.filter((day) => typeof day === 'string' && day.trim())
                  : [];
                const start = typeof schedule?.start_time === 'string' ? schedule.start_time.trim() : '';
                const end = typeof schedule?.end_time === 'string' ? schedule.end_time.trim() : '';
                const timeRange = [start, end].filter(Boolean).join(' - ');
                const parts = [days.length ? days.join(', ') : '', timeRange].filter(Boolean);
                return parts.join(' ');
              })();

        const available = Boolean(schedule?.enabled && schedule?.available);
        const transportHint =
          schedule?.socket_transport_hint === 'polling' || schedule?.socket_transport_hint === 'websocket'
            ? schedule.socket_transport_hint
            : null;
        if (transportHint) {
          safeLocalStorage.setItem(resolveTransportHintKey(normalizedTenantSlug), transportHint);
        }

        const transportList = Array.isArray(schedule?.socket_transports)
          ? schedule.socket_transports.filter(
              (transport): transport is 'polling' | 'websocket' =>
                transport === 'polling' || transport === 'websocket',
            )
          : [];
        if (transportList.length > 0) {
          safeLocalStorage.setItem(
            resolveTransportListKey(normalizedTenantSlug),
            JSON.stringify(transportList),
          );
        }

        if (typeof schedule?.socket_fallback_enabled === 'boolean') {
          safeLocalStorage.setItem(
            resolveTransportFallbackEnabledKey(normalizedTenantSlug),
            schedule.socket_fallback_enabled ? '1' : '0',
          );
        }

        setBusinessHours({
          isLiveChatEnabled: available,
          horariosAtencion: description,
          availabilityLabel: available ? 'Asesores en linea' : 'Te respondemos en horario',
          timezone: typeof schedule?.timezone === 'string' ? schedule.timezone : '',
        });
      } catch (error) {
        if (!canApplyResponse()) {
          return;
        }
        setBusinessHours({ ...DEFAULT_BUSINESS_HOURS });
        if (import.meta.env.DEV) {
          console.debug('Live chat schedule disabled or unavailable', error);
        }
      }
    };

    fetchProfile();

    return () => {
      isCurrentRequest = false;
      abortController.abort();
    };
  }, [entityToken, tenantSlug, options?.enabled, options?.scheduleEndpoint]);

  return businessHours;
};

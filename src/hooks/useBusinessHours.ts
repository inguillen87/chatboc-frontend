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
}

const DEFAULT_BUSINESS_HOURS: BusinessHours = {
  isLiveChatEnabled: false,
  horariosAtencion: '',
  availabilityLabel: '',
  timezone: '',
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
    if (options?.enabled === false) {
      setBusinessHours({ ...DEFAULT_BUSINESS_HOURS });
      return;
    }

    const fetchProfile = async () => {
      try {
        if (!tenantSlug) {
          return;
        }

        const normalizedTenantSlug = tenantSlug.trim();
        if (!normalizedTenantSlug) {
          return;
        }

        const encodedTenantSlug = encodeURIComponent(normalizedTenantSlug);
        const params = new URLSearchParams({
          tenant_slug: normalizedTenantSlug,
          tenant: normalizedTenantSlug,
        });
        const schedulePath = `/api/${encodedTenantSlug}/live-chat/schedule?${params.toString()}`;
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
        });

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
          safeLocalStorage.setItem(resolveTransportHintKey(tenantSlug), transportHint);
        }

        const transportList = Array.isArray(schedule?.socket_transports)
          ? schedule.socket_transports.filter(
              (transport): transport is 'polling' | 'websocket' =>
                transport === 'polling' || transport === 'websocket',
            )
          : [];
        if (transportList.length > 0) {
          safeLocalStorage.setItem(resolveTransportListKey(tenantSlug), JSON.stringify(transportList));
        }

        if (typeof schedule?.socket_fallback_enabled === 'boolean') {
          safeLocalStorage.setItem(
            resolveTransportFallbackEnabledKey(tenantSlug),
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
        if (import.meta.env.DEV) {
          console.debug('Live chat schedule disabled or unavailable', error);
        }
      }
    };

    fetchProfile();
  }, [entityToken, tenantSlug, options?.enabled]);

  return businessHours;
};

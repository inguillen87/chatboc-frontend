import { useState, useEffect } from 'react';
import { apiFetch } from '@/utils/api';
import { safeLocalStorage } from '@/utils/safeLocalStorage';

interface LiveChatSchedule {
  enabled?: boolean;
  socket_transport_hint?: 'polling' | 'websocket';
  socket_transports?: Array<'polling' | 'websocket'>;
  socket_fallback_enabled?: boolean;
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
        const authToken = safeLocalStorage.getItem('authToken');

        if (!authToken && !entityToken && !tenantSlug) {
          return;
        }

        const tenantAwarePath = tenantSlug ? `/api/${tenantSlug}/live-chat/schedule` : null;
        const candidatePaths = tenantSlug
          ? [
              tenantAwarePath,
              '/api/demo/live-chat/schedule',
              '/api/live-chat/schedule',
              '/live-chat/schedule',
            ].filter((path): path is string => Boolean(path))
          : ['/live-chat/schedule', '/api/live-chat/schedule'];

        let schedule: LiveChatSchedule | null = null;
        let lastError: unknown = null;

        for (const path of candidatePaths) {
          try {
            schedule = await apiFetch<LiveChatSchedule>(path, {
              skipAuth: !authToken,
              entityToken,
              tenantSlug,
            });
            break;
          } catch (error) {
            lastError = error;
          }
        }

        if (!schedule) {
          if (import.meta.env.DEV) {
            console.debug('Live chat schedule unavailable', lastError);
          }
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

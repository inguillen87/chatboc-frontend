import { useState, useEffect } from 'react';
import { apiFetch } from '@/utils/api';
import { safeLocalStorage } from '@/utils/safeLocalStorage';
interface LiveChatSchedule {
  enabled?: boolean;
  socket_transport_hint?: 'polling' | 'websocket';
  available?: boolean;
  description?: string;
  days?: string[];
  start_time?: string;
  end_time?: string;
  timezone?: string;
}


const resolveTransportHintKey = (tenantSlug?: string | null) =>
  `chatboc_socket_transport_hint:${tenantSlug || 'default'}`;

interface BusinessHours {
  isLiveChatEnabled: boolean;
  horariosAtencion: string;
  availabilityLabel: string;
  timezone?: string;
}

export const useBusinessHours = (entityToken?: string, tenantSlug?: string | null): BusinessHours => {
  const [businessHours, setBusinessHours] = useState<BusinessHours>({
    isLiveChatEnabled: false,
    horariosAtencion: '',
    availabilityLabel: '',
    timezone: '',
  });

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const authToken = safeLocalStorage.getItem('authToken');

        if (!authToken && !entityToken && !tenantSlug) {
          return;
        }

        const tenantAwarePath = tenantSlug ? `/api/${tenantSlug}/live-chat/schedule` : null;
        const candidatePaths = [
          '/api/live-chat/schedule',
          tenantAwarePath,
          '/api/demo/live-chat/schedule',
          '/live-chat/schedule',
        ].filter((path): path is string => Boolean(path));

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
          throw lastError ?? new Error('No se pudo cargar el horario de atención');
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

        setBusinessHours({
          isLiveChatEnabled: available,
          horariosAtencion: description,
          availabilityLabel: available ? 'Asesores en línea' : 'Te respondemos en horario',
          timezone: typeof schedule?.timezone === 'string' ? schedule.timezone : '',
        });
      } catch (error) {
        console.error('Error fetching profile:', error);
      }
    };

    fetchProfile();
  }, [entityToken, tenantSlug]);

  return businessHours;
};

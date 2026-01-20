import { useState, useEffect } from 'react';
import { apiFetch } from '@/utils/api';
import { safeLocalStorage } from '@/utils/safeLocalStorage';
interface LiveChatSchedule {
  enabled?: boolean;
  available?: boolean;
  description?: string;
  days?: string[];
  start_time?: string;
  end_time?: string;
  timezone?: string;
}

interface BusinessHours {
  isLiveChatEnabled: boolean;
  horariosAtencion: string;
}

export const useBusinessHours = (entityToken?: string): BusinessHours => {
  const [businessHours, setBusinessHours] = useState<BusinessHours>({
    isLiveChatEnabled: false,
    horariosAtencion: '',
  });

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const authToken = safeLocalStorage.getItem('authToken');

        if (!authToken && !entityToken) {
          return;
        }

        const schedule = await apiFetch<LiveChatSchedule>('/live-chat/schedule', {
          skipAuth: !authToken,
          entityToken,
        });

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

        setBusinessHours({
          isLiveChatEnabled: Boolean(schedule?.enabled && schedule?.available),
          horariosAtencion: description,
        });
      } catch (error) {
        console.error('Error fetching profile:', error);
      }
    };

    fetchProfile();
  }, [entityToken]);

  return businessHours;
};

import { useState, useEffect } from 'react';
import { apiFetch } from '@/utils/api';
import { Horario } from '@/types/tickets';

interface BusinessHours {
  isLiveChatEnabled: boolean;
  horariosAtencion: string;
}

export const useBusinessHours = (): BusinessHours => {
  const [businessHours, setBusinessHours] = useState<BusinessHours>({
    isLiveChatEnabled: false,
    horariosAtencion: '',
  });

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const profile = await apiFetch<any>('/auth/profile');
        if (profile && profile.horario) {
          const { start_hour, end_hour } = profile.horario as Horario;
          if (typeof start_hour === 'number' && typeof end_hour === 'number') {
            const now = new Date();
            const currentHour = now.getHours();
            const isLiveChatEnabled = currentHour >= start_hour && currentHour < end_hour;
            const horariosAtencion = `Lunes a Viernes de ${start_hour}:00 a ${end_hour}:00`;

            setBusinessHours({
              isLiveChatEnabled,
              horariosAtencion,
            });
          }
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
      }
    };

    fetchProfile();
  }, []);

  return businessHours;
};

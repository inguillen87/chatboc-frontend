import { useEffect } from 'react';
import { apiFetch } from '@/utils/api';
import { toast } from '@/components/ui/use-toast';
import { useUser } from './useUser';

interface TicketUpdate {
  ticket_id: number;
  estado: string;
  mensaje?: string | null;
}

export default function useTicketUpdates() {
  const { user } = useUser();

  useEffect(() => {
    let es: EventSource | null = null;
    let active = true;

    const init = async () => {
      if (!user) return;
      try {
        const settings = await apiFetch<{ ticket: boolean }>('/notifications');
        if (!active || !settings.ticket) return;
        const base = import.meta.env.VITE_API_URL || '/api';
        es = new EventSource(`${base}/tickets/updates`, { withCredentials: true });
        es.onmessage = (ev) => {
          try {
            const data: TicketUpdate = JSON.parse(ev.data);
            toast({
              title: `Ticket #${data.ticket_id}`,
              description: data.mensaje || `Estado: ${data.estado}`,
            });
          } catch (err) {
            console.error('Error parsing update', err);
          }
        };
        es.onerror = () => {
          if (es) es.close();
          es = null;
        };
      } catch (err) {
        console.error('No se pudo inicializar notificaciones de tickets', err);
      }
    };

    init();

    return () => {
      active = false;
      if (es) es.close();
    };
  }, [user]);
}

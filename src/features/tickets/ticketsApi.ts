import { panelApi } from '@/api/v2/client';
import type { V2Ticket } from './ticketTypes';

export const listV2Tickets = (tenantSlug?: string | null) =>
  panelApi.get<{ items: V2Ticket[] }>('/api/v2/tickets', {
    tenantSlug,
    legacyFallbackPath: '/tickets',
  });

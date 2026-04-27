import React from 'react';
import { Badge } from '@/components/ui/badge';

export default function TicketSlaBadge({ state }: { state?: string }) {
  if (!state) return <Badge variant="outline">sin SLA</Badge>;
  return <Badge variant={state === 'breached' ? 'destructive' : 'secondary'}>{state}</Badge>;
}

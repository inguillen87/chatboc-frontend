import React, { useId, useRef, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { enterpriseService } from '@/services/enterpriseService';
import { ApiError, getErrorMessage } from '@/utils/api';
import {
  assignmentRecord,
  assignmentTargetKey,
  exactAssignmentId,
  resolveLeadAssignmentTarget,
  type TicketAssignmentTarget,
} from '@/utils/ticketAssignmentSnapshot';

export interface LeadAssignmentRoutingSnapshot {
  tenantSlug: string;
  raw: unknown;
}

interface Props {
  lead: unknown;
  tenantSlug: string;
  routingSnapshot: LeadAssignmentRoutingSnapshot | null;
  requiredPermission?: string;
  onConfirmed?: () => void | Promise<void>;
}

export default function LeadAutoAssignmentButton({ lead, tenantSlug, routingSnapshot, requiredPermission, onConfirmed }: Props) {
  const blockReasonId = useId();
  const [pending, setPending] = useState(false);
  const [confirmedKey, setConfirmedKey] = useState<string | null>(null);
  const [invalidatedSnapshot, setInvalidatedSnapshot] = useState<LeadAssignmentRoutingSnapshot | null>(null);
  const inFlight = useRef(false);
  const currentSnapshot = useRef(routingSnapshot);
  currentSnapshot.current = routingSnapshot;
  let target: TicketAssignmentTarget | null = null;
  let blockReason: string | null = null;
  try {
    if (!routingSnapshot || routingSnapshot.tenantSlug !== tenantSlug) {
      throw new Error('Volvé a cargar los casos de esta organización para verificar su responsable.');
    }
    if (routingSnapshot === invalidatedSnapshot) {
      throw new Error('Actualizá la lista antes de volver a intentar la asignación.');
    }
    target = resolveLeadAssignmentTarget(lead, routingSnapshot.raw, tenantSlug);
  } catch (error) {
    blockReason = getErrorMessage(error, 'No se pudo verificar el responsable actual.');
  }
  const key = target ? `${tenantSlug}:${assignmentTargetKey(target)}:${target.expected_assignee_id}` : '';
  const currentKey = useRef(key);
  currentKey.current = key;

  const assign = async () => {
    if (!target || blockReason || inFlight.current || confirmedKey === key) return;
    inFlight.current = true;
    setPending(true);
    const isCurrent = () => currentSnapshot.current === routingSnapshot && currentKey.current === key;
    const ticketType = target.source_model === 'MunicipioTicket' ? 'municipio' : 'pyme';
    try {
      const result = assignmentRecord(await enterpriseService.autoAssignTenantTicket(
        tenantSlug,
        ticketType,
        target.id,
        { expected_assignee_id: target.expected_assignee_id, required_permission: requiredPermission || undefined },
      ));
      if (!isCurrent()) return;
      if (result.ok !== true || result.assigned !== true) {
        throw new Error('No se confirmó una asignación compatible. Actualizá la lista para revisar el caso.');
      }
      if (String(exactAssignmentId(result.ticket_id)) !== String(target.id) || result.ticket_type !== ticketType) {
        throw new Error('La confirmación no corresponde al caso seleccionado. Actualizá la lista antes de reintentar.');
      }
      const employee = assignmentRecord(result.employee);
      exactAssignmentId(employee.id);
      setConfirmedKey(key);
      toast.success(typeof employee.name === 'string' ? `Caso asignado a ${employee.name}` : 'Asignación confirmada');
      try {
        await onConfirmed?.();
      } catch {
        toast.error('La asignación se confirmó, pero no pudimos actualizar la lista. Volvé a cargarla.');
      }
    } catch (error) {
      if (isCurrent()) {
        setInvalidatedSnapshot(routingSnapshot);
        toast.error(error instanceof ApiError && error.status === 409
          ? 'El responsable cambió en otro puesto. Actualizá la lista antes de reintentar.'
          : error instanceof ApiError && error.status === 403
            ? 'Tu usuario no tiene permiso para autoasignar este caso.'
            : getErrorMessage(error, 'No recibimos confirmación de la asignación. Actualizá la lista.'));
      }
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  };

  return <div className="space-y-1">
    <Button size="sm" variant="outline"
      aria-label={`Autoasignar empleado — caso #${String(assignmentRecord(lead).ticket_id ?? 'no verificado')}`}
      aria-describedby={blockReason ? blockReasonId : undefined}
      disabled={pending || Boolean(blockReason) || confirmedKey === key} onClick={() => void assign()}>
      {pending ? 'Asignando…' : confirmedKey === key ? 'Asignación confirmada' : 'Autoasignar empleado'}
    </Button>
    {blockReason ? <p id={blockReasonId} className="max-w-64 text-xs text-muted-foreground">{blockReason}</p> : null}
  </div>;
}

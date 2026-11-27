import React from 'react';
import { AlertTriangle, ClipboardList, MapPin, RadioTower, UserRound } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Ticket } from '@/types/tickets';
import { cn } from '@/lib/utils';
import { normalizeTicketLocation } from '@/utils/location';
import { getContactPhone, getTicketChannel } from '@/utils/ticket';
import { buildFullAddress } from '@/utils/ticketLocationAddress';
import {
  formatTicketDisplayLabel,
  formatTicketOptionalLabel,
  formatTicketStatusLabel,
} from '@/utils/ticketStatus';
import { deriveTicketOperationalGuidance } from './ticketOperationalGuidance';
import type { TicketPresentationCategory } from './ticketPresentationCategory';

interface CaseStripProps {
  ticket: Ticket | null;
  presentationCategory?: TicketPresentationCategory | null;
  isDetailsVisible?: boolean;
  onOpenDetails?: () => void;
  className?: string;
}

const readText = (...values: unknown[]): string => {
  for (const value of values) {
    if (typeof value !== 'string' && typeof value !== 'number') continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return '';
};

const CONTACT_NAME_PLACEHOLDERS = new Set([
  'asistente virtual',
  'demo municipio',
  'municipio',
  'municipio inteligente',
  'no especificado',
  'sin nombre',
  'tu municipio',
]);

const resolveContactName = (ticket: Ticket): string => {
  const candidates = [
    (ticket as any).display_name,
    (ticket as any).name,
    ticket.informacion_personal_vecino?.nombre,
    (ticket as any).contact?.name,
    ticket.user?.nombre_usuario,
    ticket.email,
  ];

  for (const candidate of candidates) {
    const value = readText(candidate);
    if (!value || CONTACT_NAME_PLACEHOLDERS.has(value.toLocaleLowerCase('es-AR'))) continue;
    return value;
  }

  return 'Contacto sin nombre';
};

const resolveAssignedLabel = (ticket: Ticket): string =>
  readText(
    ticket.assignedAgent?.nombre_usuario,
    ticket.assignedAgent?.email,
    (ticket as any).assigned_user_name,
    (ticket as any).assignedUserName,
  ) || 'Sin responsable';

const resolveLocationLabel = (ticket: Ticket): string => {
  const normalized = normalizeTicketLocation(ticket);
  const address = buildFullAddress({
    ...ticket,
    direccion: normalized.direccion || ticket.direccion,
    distrito: normalized.distrito || ticket.distrito,
  });
  return address || normalized.direccion || 'Sin ubicación';
};

export const CaseStrip: React.FC<CaseStripProps> = ({
  ticket,
  presentationCategory,
  isDetailsVisible = false,
  onOpenDetails,
  className,
}) => {
  if (!ticket || isDetailsVisible) return null;

  const guidance = deriveTicketOperationalGuidance(ticket);
  const contactName = resolveContactName(ticket);
  const contactPhone = getContactPhone(ticket);
  const channel = formatTicketDisplayLabel(getTicketChannel(ticket), 'Canal no informado');
  const assignedLabel = resolveAssignedLabel(ticket);
  const locationLabel = resolveLocationLabel(ticket);
  const priority = formatTicketOptionalLabel(ticket.priority);
  const categoryLabel = formatTicketOptionalLabel(
    presentationCategory?.label || ticket.categoria,
  ) || 'Categoría no informada';
  const ticketRef = ticket.nro_ticket || `#${ticket.id}`;

  return (
    <section
      className={cn(
        'shrink-0 border-b border-border/70 bg-background/95 px-3 py-2 shadow-sm',
        className,
      )}
      data-testid="ticket-case-strip"
      aria-label="Resumen operativo del caso"
    >
      <div className="flex min-w-0 flex-col gap-2 min-[920px]:flex-row min-[920px]:items-center min-[920px]:justify-between">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary">
            <ClipboardList className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <span className="truncate text-sm font-semibold text-foreground" title={ticketRef}>
                {ticketRef}
              </span>
              <Badge variant="secondary" className="max-w-[9rem] truncate text-[11px] capitalize">
                {formatTicketStatusLabel(ticket.estado)}
              </Badge>
              <Badge
                variant="outline"
                className="max-w-[10rem] truncate text-[11px]"
                aria-label={`${categoryLabel}. ${presentationCategory?.detail || 'Sin evidencia de categoría.'}`}
              >
                <span title={presentationCategory?.detail}>
                  {categoryLabel}
                </span>
              </Badge>
            </div>
            <p className="mt-0.5 truncate text-xs text-muted-foreground" title={formatTicketDisplayLabel(guidance.label)}>
              {formatTicketDisplayLabel(guidance.label)}
            </p>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 pb-0.5 pr-1">
          <Badge variant="outline" className="shrink-0 gap-1.5 text-[11px]">
            <UserRound className="h-3 w-3" />
            <span className="max-w-[9rem] truncate" title={contactName}>
              {contactName}
            </span>
          </Badge>
          {contactPhone && (
            <Badge variant="outline" className="shrink-0 max-w-[8rem] truncate text-[11px]" title={contactPhone}>
              {contactPhone}
            </Badge>
          )}
          <Badge variant="outline" className="shrink-0 gap-1.5 text-[11px]">
            <RadioTower className="h-3 w-3" />
            {channel}
          </Badge>
          <Badge variant={assignedLabel === 'Sin responsable' ? 'destructive' : 'secondary'} className="shrink-0 max-w-[10rem] truncate text-[11px]" title={assignedLabel}>
            {assignedLabel}
          </Badge>
          {priority && (
            <Badge variant="outline" className="shrink-0 gap-1.5 text-[11px]">
              <AlertTriangle className="h-3 w-3" />
              {priority}
            </Badge>
          )}
          <Badge variant="outline" className="shrink-0 gap-1.5 text-[11px]">
            <MapPin className="h-3 w-3" />
            <span className="max-w-[12rem] truncate" title={locationLabel}>
              {locationLabel}
            </span>
          </Badge>
          {onOpenDetails && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="min-h-11 shrink-0 px-3 text-xs"
              onClick={onOpenDetails}
            >
              Detalles
            </Button>
          )}
        </div>
      </div>
    </section>
  );
};

export default CaseStrip;

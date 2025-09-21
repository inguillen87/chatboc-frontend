import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import TicketStatusBar from './TicketStatusBar';
import TicketMap from '../TicketMap';
import { Ticket, TicketHistoryEvent } from '@/types/tickets';
import { fmtAR } from '@/utils/date';
import { getTicketChannel } from '@/utils/ticket';
import { cn } from '@/lib/utils';
import {
  CalendarClock,
  Clock3,
  MapPin,
  Building,
  Hash,
  MessageCircle,
  Tag,
  ExternalLink,
} from 'lucide-react';

interface TicketLogisticsSummaryProps {
  ticket: Ticket;
  className?: string;
  statusOverride?: string | null;
  historyOverride?: TicketHistoryEvent[] | null;
  onOpenMap?: () => void;
}

type IconType = React.ComponentType<React.SVGProps<SVGSVGElement>>;

const formatStatus = (status?: string | null) =>
  status
    ? status
        .replace(/[_-]+/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase())
    : 'Sin estado';

const pickHistoryDate = (entry: unknown): string | number | Date | null => {
  if (!entry || typeof entry !== 'object') {
    return null;
  }

  const record = entry as Record<string, unknown>;
  const candidateKeys = ['date', 'fecha', 'created_at', 'updated_at', 'timestamp'];

  for (const key of candidateKeys) {
    const raw = record[key];
    if (
      typeof raw === 'string' ||
      typeof raw === 'number' ||
      raw instanceof Date
    ) {
      return raw;
    }
  }

  return null;
};

const formatHistoryDate = (value: string | number | Date | null | undefined) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  try {
    return new Intl.DateTimeFormat('es-AR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch (error) {
    console.error('Error formatting history date', error);
    return null;
  }
};

const hasCoordinateValue = (value?: number | null) =>
  typeof value === 'number' && Number.isFinite(value) && value !== 0;

const TicketLogisticsSummary: React.FC<TicketLogisticsSummaryProps> = ({
  ticket,
  className,
  statusOverride,
  historyOverride,
  onOpenMap,
}) => {
  const historyEntries = Array.isArray(historyOverride)
    ? historyOverride
    : Array.isArray(ticket.history)
      ? ticket.history
      : [];
  const statusFlow = historyEntries.map((h) => h.status).filter(Boolean);

  const channelLabel = getTicketChannel(ticket);
  const createdAtLabel = fmtAR(ticket.fecha);
  const estimatedArrival = ticket.tiempo_estimado;
  const currentStatus = statusOverride ?? ticket.estado;

  const metaItems = [
    {
      label: 'Creado el',
      value: createdAtLabel,
      icon: CalendarClock,
      valueClassName: 'text-foreground',
    },
    {
      label: 'Canal',
      value: channelLabel,
      icon: MessageCircle,
      valueClassName:
        channelLabel === 'N/A'
          ? 'uppercase tracking-wide text-muted-foreground'
          : 'capitalize text-foreground',
    },
    estimatedArrival
      ? {
          label: 'Tiempo estimado',
          value: estimatedArrival,
          icon: Clock3,
          valueClassName: 'text-foreground',
        }
      : null,
  ].filter(Boolean) as { label: string; value: string; icon: IconType; valueClassName?: string }[];

  const detailItems = [
    ticket.categoria
      ? { label: 'Categoría', value: ticket.categoria, icon: Tag }
      : null,
    ticket.direccion
      ? { label: 'Dirección', value: ticket.direccion, icon: MapPin }
      : null,
    ticket.esquinas_cercanas
      ? { label: 'Esquinas', value: ticket.esquinas_cercanas, icon: Hash }
      : null,
    ticket.distrito
      ? { label: 'Distrito', value: ticket.distrito, icon: Building }
      : null,
  ].filter(Boolean) as { label: string; value: string; icon?: IconType }[];

  const hasLocation = Boolean(
    ticket.direccion ||
      hasCoordinateValue(ticket.latitud) ||
      hasCoordinateValue(ticket.longitud) ||
      hasCoordinateValue(ticket.lat_destino) ||
      hasCoordinateValue(ticket.lon_destino) ||
      hasCoordinateValue(ticket.lat_origen) ||
      hasCoordinateValue(ticket.lon_origen) ||
      hasCoordinateValue(ticket.lat_actual) ||
      hasCoordinateValue(ticket.lon_actual) ||
      hasCoordinateValue(ticket.origen_latitud) ||
      hasCoordinateValue(ticket.origen_longitud) ||
      hasCoordinateValue(ticket.municipio_latitud) ||
      hasCoordinateValue(ticket.municipio_longitud)
  );

  const heading = ticket.categoria || ticket.asunto || 'Seguimiento del reclamo';

  const statusTimeline = historyEntries
    .map((entry, index) => {
      if (!entry || typeof entry.status !== 'string') {
        return null;
      }

      const formattedDate = formatHistoryDate(pickHistoryDate(entry));

      return {
        key: `${entry.status}-${index}`,
        status: entry.status,
        label: formatStatus(entry.status),
        formattedDate,
      };
    })
    .filter(Boolean) as {
      key: string;
      status: string;
      label: string;
      formattedDate: string | null;
    }[];

  const recentStatusTimeline = statusTimeline.slice(-3).reverse();
  const lastUpdatedLabel =
    recentStatusTimeline.find((item) => item.formattedDate)?.formattedDate ||
    (createdAtLabel || undefined);

  return (
    <Card className={cn('bg-card/90 border border-primary/20 shadow-lg backdrop-blur-sm', className)}>
      <CardContent className="space-y-5 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Ticket #{ticket.nro_ticket || '—'}
            </p>
            <h3 className="text-lg font-semibold leading-tight text-foreground">{heading}</h3>
          </div>
        </div>

        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-3 sm:p-4 shadow-inner">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Estado del reclamo
              </p>
              <p className="text-base font-semibold text-primary">
                {formatStatus(currentStatus)}
              </p>
            </div>
            {lastUpdatedLabel && (
              <div className="rounded-full bg-background/70 px-3 py-1 text-[11px] font-medium text-muted-foreground">
                Última actualización: <span className="text-foreground">{lastUpdatedLabel}</span>
              </div>
            )}
          </div>
          <TicketStatusBar
            status={currentStatus}
            flow={statusFlow}
            history={historyEntries}
            className="my-3"
          />
          {recentStatusTimeline.length > 0 && (
            <div className="mt-3 space-y-2">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Últimos movimientos
              </p>
              <ul className="space-y-2">
                {recentStatusTimeline.map((item) => (
                  <li
                    key={item.key}
                    className="flex items-start justify-between gap-3 text-xs sm:text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <span className="mt-1 h-2 w-2 rounded-full bg-primary" aria-hidden />
                      <span className="font-medium text-foreground">{item.label}</span>
                    </div>
                    {item.formattedDate && (
                      <span className="text-muted-foreground">{item.formattedDate}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {metaItems.length > 0 && (
          <div className="flex flex-wrap gap-2 sm:gap-3">
            {metaItems.map((item) => (
              <div
                key={item.label}
                className="flex items-center gap-2 rounded-full bg-muted/70 px-3 py-1.5 text-xs sm:text-sm text-muted-foreground"
              >
                <item.icon className="h-4 w-4 text-primary" />
                <span className="font-medium text-foreground">{item.label}:</span>
                <span className={cn('text-foreground', item.valueClassName)}>{item.value}</span>
              </div>
            ))}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <div className="space-y-4 text-sm">
            {detailItems.length > 0 && (
              <div className="grid gap-3">
                {detailItems.map((item) => (
                  <div key={item.label} className="flex items-start gap-2">
                    {item.icon && <item.icon className="mt-0.5 h-4 w-4 text-primary" />}
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        {item.label}
                      </p>
                      <p className="font-medium leading-snug text-foreground">{item.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {hasLocation && (
            <div className="relative overflow-hidden rounded-xl border border-border bg-muted/40 shadow-sm">
              {onOpenMap && (
                <button
                  type="button"
                  onClick={onOpenMap}
                  className="absolute right-3 top-3 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full bg-background/90 text-muted-foreground shadow transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  aria-label="Abrir ubicación en Google Maps"
                >
                  <ExternalLink className="h-4 w-4" />
                </button>
              )}
              <TicketMap
                ticket={ticket}
                hideTitle
                heightClassName="h-[160px] sm:h-[180px]"
                showAddressHint={false}
              />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default TicketLogisticsSummary;

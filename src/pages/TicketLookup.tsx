import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { getTicketByNumber, getTicketTimeline, sendTicketHistory } from '@/services/ticketService';
import { Ticket, Message, TicketHistoryEvent } from '@/types/tickets';
import { fmtAR } from '@/utils/date';
import TicketTimeline from '@/components/tickets/TicketTimeline';
import TicketMap from '@/components/TicketMap';
import { Separator } from '@/components/ui/separator';
import { getErrorMessage, ApiError } from '@/utils/api';
import { getContactPhone, getCitizenDni } from '@/utils/ticket';
import { getSpecializedContact, SpecializedContact } from '@/utils/contacts';
import TicketStatusBar from '@/components/tickets/TicketStatusBar';
import { collectAttachmentsFromTicket, getPrimaryImageUrl } from '@/components/tickets/DetailsPanel';
import { Maximize2, X, ExternalLink, Building, Hash } from 'lucide-react';
export default function TicketLookup() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [ticketNumber, setTicketNumber] = useState(ticketId || '');
  const [pin, setPin] = useState(searchParams.get('pin') || '');
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [timelineHistory, setTimelineHistory] = useState<TicketHistoryEvent[]>([]);
  const [timelineMessages, setTimelineMessages] = useState<Message[]>([]);
  const [estadoChat, setEstadoChat] = useState('');
  const [specialContact, setSpecialContact] = useState<SpecializedContact | null>(null);
  const [completionSent, setCompletionSent] = useState(false);
  const attachments = React.useMemo(
    () => collectAttachmentsFromTicket(ticket, timelineMessages),
    [ticket, timelineMessages],
  );
  const primaryImageUrl = React.useMemo(
    () => getPrimaryImageUrl(ticket, attachments),
    [attachments, ticket],
  );
  const [imageError, setImageError] = useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const statusFlow = React.useMemo(
    () => timelineHistory.map((h) => h.status).filter(Boolean),
    [timelineHistory],
  );
  const currentStatus = React.useMemo(
    () => estadoChat || ticket?.estado || statusFlow[statusFlow.length - 1] || '',
    [estadoChat, ticket?.estado, statusFlow],
  );
  const hasLocation = React.useMemo(() => {
    if (!ticket) return false;
    const hasCoords =
      (typeof ticket.latitud === 'number' && typeof ticket.longitud === 'number') ||
      (typeof ticket.lat_destino === 'number' && typeof ticket.lon_destino === 'number');
    return Boolean(ticket.direccion || hasCoords);
  }, [ticket]);
  const estimatedArrival =
    ticket?.tiempo_estimado ||
    (currentStatus.toLowerCase().replace(/\s+/g, '_') === 'en_proceso' ? '4h' : null);

  const performSearch = useCallback(async (searchId?: string, searchPin?: string) => {
    const id = (searchId || '').trim();
    const pinVal = (searchPin || '').trim();
    if (!id) return;
    if (!pinVal) {
      setError('El PIN es obligatorio para consultar el ticket');
      setTicket(null);
      return;
    }
    setLoading(true);
    setError(null);
    setTimelineHistory([]);
    setTimelineMessages([]);
    setEstadoChat('');
    setCompletionSent(false);
    try {
      const data = await getTicketByNumber(id, pinVal);
      setTicket(data);
      getSpecializedContact(data.categoria).then(setSpecialContact);

      // Usar el historial y mensajes incluidos en el ticket si están presentes
      if (data.history || data.messages) {
        setTimelineHistory(data.history || []);
        setTimelineMessages(data.messages || []);
      }

      try {
        const timeline = await getTicketTimeline(data.id, data.tipo, { public: true });
        setTimelineHistory(timeline.history);
        setTimelineMessages(timeline.messages);
        setEstadoChat(timeline.estado_chat);
      } catch (msgErr) {
        console.error('Error fetching timeline for ticket', msgErr);
      }
    } catch (err) {
      const apiErr = err as ApiError;
      let message: string;
      if (apiErr?.status === 404) {
        message = 'No se encontró el ticket';
      } else if (apiErr?.status === 400) {
        message = 'El PIN es obligatorio para consultar el ticket';
      } else {
        message = getErrorMessage(err, 'No se encontró el ticket');
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const paramPin = searchParams.get('pin') || '';
    setTicketNumber(ticketId || '');
    setPin(paramPin);
    if (ticketId) {
      performSearch(ticketId, paramPin);
    }
  }, [ticketId, searchParams, performSearch]);

  useEffect(() => {
    if (!ticket) return;
    const interval = setInterval(() => {
      performSearch(ticket.nro_ticket, pin);
    }, 30000);
    return () => clearInterval(interval);
  }, [ticket, pin, performSearch]);

  useEffect(() => {
    setImageError(false);
    setIsImageModalOpen(false);
  }, [primaryImageUrl]);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = ticketNumber.trim();
    const trimmedPin = pin.trim();
    if (!trimmed || !trimmedPin) return;
    const currentPin = searchParams.get('pin') || '';
    if (trimmed === (ticketId || '') && trimmedPin === currentPin) {
      performSearch(trimmed, trimmedPin);
    } else {
      navigate(`/ticket/${encodeURIComponent(trimmed)}?pin=${encodeURIComponent(trimmedPin)}`);
    }
  };

  const openGoogleMaps = useCallback(() => {
    if (typeof window === 'undefined' || !ticket) return;
    if (typeof ticket.latitud === 'number' && typeof ticket.longitud === 'number') {
      window.open(
        `https://www.google.com/maps/search/?api=1&query=${ticket.latitud},${ticket.longitud}`,
        '_blank',
        'noopener',
      );
      return;
    }
    if (typeof ticket.lat_destino === 'number' && typeof ticket.lon_destino === 'number') {
      window.open(
        `https://www.google.com/maps/search/?api=1&query=${ticket.lat_destino},${ticket.lon_destino}`,
        '_blank',
        'noopener',
      );
      return;
    }
    if (ticket.direccion) {
      window.open(
        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ticket.direccion)}`,
        '_blank',
        'noopener',
      );
    }
  }, [ticket]);

  useEffect(() => {
    const normalizeStatus = (s?: string | null) =>
      s ? s.toLowerCase().replace(/\s+/g, '_') : '';
    if (!ticket) return;
    if (
      (normalizeStatus(currentStatus) === 'completado' ||
        normalizeStatus(currentStatus) === 'resuelto') &&
      !completionSent
    ) {
      sendTicketHistory(ticket).catch((err) =>
        console.error('Error sending completion email:', err),
      );
      setCompletionSent(true);
    }
  }, [ticket, currentStatus, completionSent]);

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold">Consulta de Estado de Reclamo</h1>
        <p className="text-muted-foreground">Ingresá tu número de ticket y PIN para ver el progreso.</p>
      </div>
      <form onSubmit={handleFormSubmit} className="flex flex-col sm:flex-row gap-2">
        <Input
          placeholder="Ej: M-816293"
          value={ticketNumber}
          onChange={(e) => setTicketNumber(e.target.value)}
          className="text-lg flex-1"
        />
        <Input
          placeholder="PIN"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          className="text-lg flex-1 sm:max-w-[8rem]"
        />
        <Button
          type="submit"
          disabled={loading || !ticketNumber.trim() || !pin.trim()}
          size="lg"
          className="w-full sm:w-auto"
        >
          {loading ? 'Buscando...' : 'Buscar'}
        </Button>
      </form>
      {error && <p className="text-destructive text-sm text-center">{error}</p>}
      {ticket && (
        <>
          <div className="border rounded-xl p-4 sm:p-6 space-y-6 bg-card shadow-lg">
            <div className="space-y-2 text-justify">
              <p className="text-sm text-muted-foreground">Ticket #{ticket.nro_ticket}</p>
              <h2 className="text-2xl font-semibold break-words">{ticket.asunto}</h2>
              <p className="pt-1">
                <span className="font-medium">Estado actual:</span>{' '}
                <span className="text-primary font-semibold">{currentStatus}</span>
              </p>
              <TicketStatusBar status={currentStatus} flow={statusFlow} />
              {(primaryImageUrl || hasLocation) && (
                <div className="grid gap-4 pt-4 sm:grid-cols-2">
                  {primaryImageUrl && (
                    <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
                      <h4 className="text-base font-semibold">Imagen del reclamo</h4>
                      {imageError ? (
                        <p className="text-sm text-muted-foreground">
                          No se pudo cargar la imagen proporcionada.
                        </p>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setIsImageModalOpen(true)}
                          className="group relative aspect-video w-full overflow-hidden rounded-md border bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                          aria-label="Ampliar imagen del reclamo"
                        >
                          <img
                            src={primaryImageUrl}
                            alt="Foto enviada en el reclamo"
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                            loading="lazy"
                            onError={() => {
                              setImageError(true);
                              setIsImageModalOpen(false);
                            }}
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/20">
                            <Maximize2 className="h-6 w-6 text-white opacity-0 transition-opacity group-hover:opacity-100" />
                          </div>
                        </button>
                      )}
                    </div>
                  )}
                  {hasLocation && (
                    <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-base font-semibold">Ubicación</h4>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={openGoogleMaps}
                          aria-label="Abrir ubicación en Google Maps"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                      {ticket.direccion && (
                        <p className="text-sm font-medium text-primary break-words">{ticket.direccion}</p>
                      )}
                      {ticket.distrito && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Building className="h-4 w-4" />
                          <span className="break-words">Distrito: {ticket.distrito}</span>
                        </div>
                      )}
                      {ticket.esquinas_cercanas && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Hash className="h-4 w-4" />
                          <span className="break-words">Esquinas: {ticket.esquinas_cercanas}</span>
                        </div>
                      )}
                      <div className="aspect-video overflow-hidden rounded-md border border-border bg-muted/40">
                        <TicketMap
                          ticket={ticket}
                          hideTitle
                          className="mb-0"
                          heightClassName="h-full"
                          showAddressHint={false}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
              <dl className="text-sm text-muted-foreground grid grid-cols-[auto_1fr] gap-x-2 gap-y-1">
                <dt>Creado el:</dt>
                <dd>{fmtAR(ticket.fecha)}</dd>
                <dt>Canal:</dt>
                <dd className="capitalize">{ticket.channel || 'N/A'}</dd>
                {estimatedArrival && (
                  <>
                    <dt>Tiempo estimado:</dt>
                    <dd>{estimatedArrival}</dd>
                  </>
                )}
                {ticket.categoria && (
                  <>
                    <dt>Categoría:</dt>
                    <dd>{ticket.categoria}</dd>
                  </>
                )}
                {ticket.direccion && (
                  <>
                    <dt>Dirección:</dt>
                    <dd>{ticket.direccion}</dd>
                  </>
                )}
                {ticket.esquinas_cercanas && (
                  <>
                    <dt>Esquinas:</dt>
                    <dd className="break-words">{ticket.esquinas_cercanas}</dd>
                  </>
                )}
              </dl>
              {(ticket.description || ticket.detalles) && (
                <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap break-words text-justify">
                  {ticket.description || ticket.detalles}
                </p>
              )}
              {(getContactPhone(ticket) || ticket.email || ticket.dni || ticket.informacion_personal_vecino) && (
                <div className="mt-4 text-sm space-y-1 text-justify">
                  {(ticket.informacion_personal_vecino?.nombre || ticket.display_name) && (
                    <p className="break-words">
                      Nombre: {ticket.informacion_personal_vecino?.nombre || ticket.display_name}
                    </p>
                  )}
                  {getCitizenDni(ticket) && (
                    <p className="break-words">DNI: {getCitizenDni(ticket)}</p>
                  )}
                  {(ticket.informacion_personal_vecino?.email || ticket.email) && (
                    <p className="break-words">
                      Email: {ticket.informacion_personal_vecino?.email || ticket.email}
                    </p>
                  )}
                  {getContactPhone(ticket) && (
                    <p className="break-words">Teléfono: {getContactPhone(ticket)}</p>
                  )}
                </div>
              )}
            </div>

            <Separator />

            <div>
              <h3 className="text-xl font-semibold mb-4">Historial del Reclamo</h3>
              <TicketTimeline history={timelineHistory} messages={timelineMessages} ticket={ticket} />
            </div>
          </div>
          {isImageModalOpen && primaryImageUrl && !imageError && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
              role="dialog"
              aria-modal="true"
              onClick={() => setIsImageModalOpen(false)}
            >
              <div className="relative" onClick={(event) => event.stopPropagation()}>
                <img
                  src={primaryImageUrl}
                  alt="Foto ampliada del reclamo"
                  className="max-h-[90vh] max-w-[90vw] rounded-lg shadow-2xl"
                />
                <button
                  type="button"
                  onClick={() => setIsImageModalOpen(false)}
                  className="absolute top-2 right-2 rounded-full bg-black/60 p-1 text-white transition hover:bg-black/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  aria-label="Cerrar imagen ampliada"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { getTicketByNumber, getTicketTimeline, sendTicketHistory } from '@/services/ticketService';
import { Ticket, Message, TicketHistoryEvent } from '@/types/tickets';
import { fmtAR } from '@/utils/date';
import TicketTimeline from '@/components/tickets/TicketTimeline';
import TicketLogisticsSummary from '@/components/tickets/TicketLogisticsSummary';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getErrorMessage, ApiError } from '@/utils/api';
import { getContactPhone, getCitizenDni, getTicketChannel } from '@/utils/ticket';
import { getSpecializedContact, SpecializedContact } from '@/utils/contacts';
import { collectAttachmentsFromTicket, getPrimaryImageUrl } from '@/components/tickets/DetailsPanel';
import { Maximize2, X } from 'lucide-react';
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
  const channelLabel = React.useMemo(() => getTicketChannel(ticket), [ticket]);
  const hasLocation = React.useMemo(() => {
    if (!ticket) return false;
    const hasCoords =
      (typeof ticket.latitud === 'number' && typeof ticket.longitud === 'number') ||
      (typeof ticket.lat_destino === 'number' && typeof ticket.lon_destino === 'number');
    return Boolean(ticket.direccion || hasCoords);
  }, [ticket]);
  const historyForSummary = React.useMemo(
    () => (timelineHistory.length ? timelineHistory : ticket?.history || []),
    [timelineHistory, ticket?.history],
  );
  const normalizedStatus = React.useMemo(
    () => (currentStatus || '').toLowerCase().replace(/\s+/g, '_'),
    [currentStatus],
  );
  const ticketForSummary = React.useMemo(() => {
    if (!ticket) return null;
    const fallbackEta =
      ticket.tiempo_estimado || (normalizedStatus === 'en_proceso' ? '4h' : undefined);
    return {
      ...ticket,
      ...(fallbackEta ? { tiempo_estimado: fallbackEta } : {}),
      history: historyForSummary,
    };
  }, [ticket, normalizedStatus, historyForSummary]);
  const contactInfo = React.useMemo(() => {
    if (!ticket) {
      return { name: '', dni: '', email: '', phone: '', address: '' };
    }
    const normalize = (value?: string | number | null) => {
      if (typeof value === 'number') return String(value).trim();
      if (typeof value === 'string') return value.trim();
      return '';
    };
    return {
      name:
        normalize(ticket.informacion_personal_vecino?.nombre) ||
        normalize(ticket.display_name),
      dni: normalize(getCitizenDni(ticket)),
      email:
        normalize(ticket.informacion_personal_vecino?.email) ||
        normalize(ticket.email),
      phone: normalize(getContactPhone(ticket)),
      address:
        normalize(ticket.informacion_personal_vecino?.direccion) ||
        normalize(ticket.direccion),
    };
  }, [ticket]);
  const contactEmailHref = contactInfo.email ? `mailto:${contactInfo.email}` : undefined;
  const contactPhoneHref = contactInfo.phone
    ? `https://wa.me/${contactInfo.phone.replace(/\D/g, '')}`
    : undefined;

  const hasDescriptionContent = React.useMemo(() => {
    if (!ticketForSummary) return false;
    const normalize = (value?: string | null) =>
      typeof value === 'string' ? value.trim() : '';
    return Boolean(
      normalize(ticketForSummary.description) ||
        normalize((ticketForSummary as Ticket & { detalles?: string }).detalles),
    );
  }, [ticketForSummary]);

  const showDetailsCard = Boolean(primaryImageUrl) || hasDescriptionContent;

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
      setTicket({ ...data, history: data.history || [] });
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
        setTicket((prev) => (prev ? { ...prev, history: timeline.history } : prev));
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
      {ticketForSummary && (
        <>
          <div className="space-y-6">
            <TicketLogisticsSummary
              ticket={ticketForSummary}
              statusOverride={currentStatus}
              historyOverride={historyForSummary}
              onOpenMap={hasLocation ? openGoogleMaps : undefined}
            />
            <div className={`grid gap-6 ${showDetailsCard ? 'md:grid-cols-2' : ''}`}>
              {showDetailsCard && (
                <Card className="overflow-hidden">
                  <CardHeader>
                    <CardTitle className="text-xl font-semibold">Detalle del reclamo</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-5 text-sm leading-relaxed">
                    {primaryImageUrl && (
                      <div className="space-y-2">
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
                    {hasDescriptionContent && (
                      <div className="space-y-2">
                        <h4 className="text-base font-semibold">Descripción</h4>
                        {(ticketForSummary.description || ticketForSummary.detalles || '—')
                          .split('\n')
                          .map((line, index) => (
                            <p key={index} className="text-sm text-muted-foreground leading-relaxed break-words">
                              {line}
                            </p>
                          ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
              <div className="space-y-6">
                <Card className="overflow-hidden">
                  <CardHeader>
                    <CardTitle className="text-xl font-semibold">Datos de contacto</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 text-sm">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Nombre</p>
                      <p
                        className={
                          contactInfo.name
                            ? 'text-sm font-medium text-foreground break-words'
                            : 'text-sm text-muted-foreground'
                        }
                      >
                        {contactInfo.name || 'No especificado'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">DNI</p>
                      <p
                        className={
                          contactInfo.dni
                            ? 'text-sm font-medium text-foreground break-words'
                            : 'text-sm text-muted-foreground'
                        }
                      >
                        {contactInfo.dni || 'No especificado'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Email</p>
                      {contactInfo.email ? (
                        <a
                          href={contactEmailHref}
                          className="text-sm font-medium text-foreground break-all hover:underline"
                        >
                          {contactInfo.email}
                        </a>
                      ) : (
                        <p className="text-sm text-muted-foreground">No especificado</p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Teléfono</p>
                      {contactInfo.phone ? (
                        <a
                          href={contactPhoneHref}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm font-medium text-foreground hover:underline"
                        >
                          {contactInfo.phone}
                        </a>
                      ) : (
                        <p className="text-sm text-muted-foreground">No especificado</p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Dirección</p>
                      <p
                        className={
                          contactInfo.address
                            ? 'text-sm font-medium text-foreground break-words'
                            : 'text-sm text-muted-foreground'
                        }
                      >
                        {contactInfo.address || 'No especificado'}
                      </p>
                    </div>
                  </CardContent>
                  {specialContact && (
                    <CardContent className="border-t bg-muted/40 pt-4 text-sm space-y-1">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Contacto sugerido</p>
                      <p className="font-semibold text-foreground">{specialContact.nombre}</p>
                      {specialContact.titulo && <p className="text-muted-foreground">{specialContact.titulo}</p>}
                      {specialContact.telefono && (
                        <p className="text-muted-foreground">Teléfono: {specialContact.telefono}</p>
                      )}
                      {specialContact.horario && (
                        <p className="text-muted-foreground">Horario: {specialContact.horario}</p>
                      )}
                      {specialContact.email && (
                        <p className="text-muted-foreground">Email: {specialContact.email}</p>
                      )}
                    </CardContent>
                  )}
                </Card>
              </div>
            </div>
            <Card className="overflow-hidden">
              <CardHeader>
                <CardTitle className="text-xl font-semibold">Historial del reclamo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <TicketTimeline history={timelineHistory} messages={timelineMessages} ticket={ticketForSummary} />
              </CardContent>
            </Card>
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

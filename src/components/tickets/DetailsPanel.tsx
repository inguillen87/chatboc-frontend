import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  Mail,
  MapPin,
  Info,
  FileDown,
  User,
  Copy,
  X,
  Maximize2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import { buildFullAddress } from '../TicketMap';
import TicketTimeline from './TicketTimeline';
import TicketAttachments from './TicketAttachments';
import TicketLogisticsSummary from './TicketLogisticsSummary';
import { useTickets } from '@/context/TicketContext';
import { exportToPdf, exportToXlsx } from '@/services/exportService';
import { sendTicketHistory, getTicketById, getTicketMessages } from '@/services/ticketService';
import { Ticket, Message, TicketHistoryEvent, Attachment } from '@/types/tickets';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { FaWhatsapp } from 'react-icons/fa';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { getContactPhone, getCitizenDni, getTicketChannel } from '@/utils/ticket';
import { fmtARWithOffset } from '@/utils/date';
import { getSpecializedContact, SpecializedContact } from '@/utils/contacts';
import { deriveAttachmentInfo } from '@/utils/attachment';
import { formatTicketStatusLabel, normalizeTicketStatus } from '@/utils/ticketStatus';
import { pickFirstCoordinate } from '@/utils/location';

const sanitizeMediaUrl = (value?: string | null): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  let result = value.trim();

  if (!result) {
    return undefined;
  }

  if (result.startsWith('//')) {
    result = `https:${result}`;
  }

  if (result.startsWith('http://')) {
    result = `https://${result.slice('http://'.length)}`;
  }

  const hasScheme = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(result);

  if (hasScheme) {
    return result;
  }

  if (typeof window !== 'undefined') {
    try {
      return new URL(result, window.location.origin).toString();
    } catch {
      return undefined;
    }
  }

  return result;
};

const pickFirstString = (...values: unknown[]): string | undefined => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
  }
  return undefined;
};

const pickFirstNumber = (...values: unknown[]): number | undefined => {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string' && value.trim().length > 0) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return undefined;
};

const normalizeAttachment = (raw: any, fallbackIndex: number): Attachment | null => {
  const rawUrl = pickFirstString(
    raw?.url,
    raw?.archivo_url,
    raw?.attachment_url,
    raw?.file_url,
    raw?.fileUrl,
    raw?.media_url,
    raw?.location_url
  );

  const url = sanitizeMediaUrl(rawUrl);

  if (!url) {
    return null;
  }

  const filename =
    pickFirstString(raw?.filename, raw?.nombre, raw?.name, raw?.original_filename, raw?.file_name) ||
    url.split('/').pop()?.split(/[?#]/)[0] ||
    `archivo_${fallbackIndex + 1}`;

  const size = pickFirstNumber(raw?.size, raw?.size_bytes, raw?.bytes);
  const mimeType = pickFirstString(raw?.mime_type, raw?.mimeType, raw?.tipo_mime, raw?.content_type);
  const thumbUrl = sanitizeMediaUrl(pickFirstString(
    raw?.thumbUrl,
    raw?.thumb_url,
    raw?.thumbnail_url,
    raw?.thumbnailUrl,
    raw?.analisis?.datos_estructurados?.thumbnail_url,
    raw?.analisis?.datos_estructurados?.url,
    raw?.analysis?.datos_estructurados?.thumbnail_url,
    raw?.analysis?.datos_estructurados?.url,
    raw?.analysis?.structured_data?.thumbnail_url,
    raw?.analysis?.structured_data?.url,
    raw?.datos_estructurados?.thumbnail_url,
    raw?.datos_estructurados?.url
  ));

  const id =
    pickFirstNumber(raw?.id, raw?.file_id, raw?.archivo_id, raw?.media_id, raw?.attachment_id) ??
    fallbackIndex + 1;

  return {
    id,
    filename,
    url,
    size,
    mime_type: mimeType,
    mimeType,
    thumbUrl: thumbUrl || undefined,
    thumb_url: sanitizeMediaUrl(raw?.thumb_url) || undefined,
    thumbnail_url: sanitizeMediaUrl(raw?.thumbnail_url) || undefined,
    thumbnailUrl: sanitizeMediaUrl(raw?.thumbnailUrl) || undefined,
    analisis: raw?.analisis,
    analysis: raw?.analysis,
    datos_estructurados: raw?.datos_estructurados,
  };
};

export const collectAttachmentsFromTicket = (ticket?: Ticket | null, extraMessages?: Message[]): Attachment[] => {
  if (!ticket && !extraMessages?.length) {
    return [];
  }

  const sources: any[] = [];
  const pushIfArray = (value: unknown) => {
    if (Array.isArray(value)) {
      sources.push(value);
    }
  };

  if (ticket) {
    pushIfArray(ticket.archivos_adjuntos);
    pushIfArray((ticket as any)?.archivosAdjuntos);
    pushIfArray(ticket.attachments);

    const additionalCollections = [
      (ticket as any)?.media,
      (ticket as any)?.mediaItems,
      (ticket as any)?.imagenes,
      (ticket as any)?.imagenes_adjuntas,
      (ticket as any)?.fotos,
      (ticket as any)?.fotos_adjuntas,
      (ticket as any)?.photos,
      (ticket as any)?.evidencias,
      (ticket as any)?.evidences,
    ];

    additionalCollections.forEach(pushIfArray);

    if (Array.isArray(ticket.messages)) {
      sources.push(
        ticket.messages.flatMap((msg) => [
          ...(Array.isArray(msg.attachments) ? msg.attachments : []),
          ...(Array.isArray((msg as any)?.archivos_adjuntos) ? (msg as any).archivos_adjuntos : []),
        ]),
      );
    }
  }

  if (Array.isArray(extraMessages) && extraMessages.length > 0) {
    sources.push(
      extraMessages.flatMap((msg) => [
        ...(Array.isArray(msg.attachments) ? msg.attachments : []),
        ...(Array.isArray((msg as any)?.archivos_adjuntos) ? (msg as any).archivos_adjuntos : []),
      ]),
    );
  }

  const seen = new Set<string>();
  const normalized: Attachment[] = [];
  let fallbackIndex = 0;

  for (const list of sources) {
    if (!Array.isArray(list)) continue;
    for (const raw of list) {
      const attachment = normalizeAttachment(raw, fallbackIndex);
      fallbackIndex += 1;
      if (!attachment) continue;
      const key = `${attachment.url}|${attachment.filename}`;
      if (seen.has(key)) continue;
      seen.add(key);
      normalized.push(attachment);
    }
  }

  return normalized;
};

export const getPrimaryImageUrl = (ticket: Ticket | null, attachments: Attachment[]): string | undefined => {
  if (!ticket) {
    return undefined;
  }

  const directPhoto = sanitizeMediaUrl(
    pickFirstString(
      ticket.foto_url_directa,
      (ticket as any)?.foto_url_directa,
      (ticket as any)?.foto_url
    )
  );

  if (directPhoto) {
    return directPhoto;
  }

  for (const attachment of attachments) {
    const info = deriveAttachmentInfo(
      attachment.url,
      attachment.filename,
      attachment.mime_type || attachment.mimeType,
      attachment.size,
      attachment.thumbUrl || attachment.thumb_url || attachment.thumbnail_url || attachment.thumbnailUrl
    );

    if (info.type === 'image') {
      const candidate = sanitizeMediaUrl(
        info.thumbUrl ||
          attachment.thumbUrl ||
          attachment.thumb_url ||
          attachment.thumbnail_url ||
          attachment.thumbnailUrl ||
          attachment.analisis?.datos_estructurados?.thumbnail_url ||
          attachment.analisis?.datos_estructurados?.url ||
          attachment.analysis?.datos_estructurados?.thumbnail_url ||
          attachment.analysis?.datos_estructurados?.url ||
          attachment.analysis?.structured_data?.thumbnail_url ||
          attachment.analysis?.structured_data?.url ||
          attachment.datos_estructurados?.thumbnail_url ||
          attachment.datos_estructurados?.url ||
          attachment.url
      );

      if (candidate) {
        return candidate;
      }
    }
  }

  return undefined;
};


interface DetailsPanelProps {
  onClose?: () => void;
  className?: string;
}

const DetailsPanel: React.FC<DetailsPanelProps> = ({ onClose, className }) => {
  const { selectedTicket: ticket, updateTicket } = useTickets();
  const [isSendingEmail, setIsSendingEmail] = React.useState(false);

  const [timelineHistory, setTimelineHistory] = React.useState<TicketHistoryEvent[]>([]);
  const [timelineMessages, setTimelineMessages] = React.useState<Message[]>([]);

  const attachments = React.useMemo(
    () => collectAttachmentsFromTicket(ticket, timelineMessages),
    [ticket, timelineMessages]
  );
  const primaryImageUrl = React.useMemo(
    () => getPrimaryImageUrl(ticket, attachments),
    [attachments, ticket]
  );
  const neighborAvatarUrl = React.useMemo(
    () =>
      sanitizeMediaUrl(
        pickFirstString(
          ticket?.avatarUrl,
          ticket?.user?.avatarUrl,
          (ticket as any)?.nombre_y_avatar_whatsapp?.avatar
        )
      ),
    [ticket]
  );
  const [imageError, setImageError] = React.useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = React.useState(false);
  const [specialContact, setSpecialContact] = React.useState<SpecializedContact | null>(null);
  const [completionSent, setCompletionSent] = React.useState(false);
  const currentStatus = React.useMemo(() => {
    if (ticket?.estado) {
      return ticket.estado;
    }

    const lastHistoryStatus = timelineHistory[timelineHistory.length - 1]?.status;
    return typeof lastHistoryStatus === 'string' ? lastHistoryStatus : '';
  }, [ticket?.estado, timelineHistory]);
  const normalizedCurrentStatus = normalizeTicketStatus(currentStatus);
  const currentStatusLabel = formatTicketStatusLabel(currentStatus);

  const locationTicket = React.useMemo(() => {
    if (!ticket) {
      return null;
    }

    const normalizedAddress =
      (typeof ticket.direccion === 'string' ? ticket.direccion.trim() : '') ||
      (typeof ticket.informacion_personal_vecino?.direccion === 'string'
        ? ticket.informacion_personal_vecino.direccion.trim()
        : '');

    if (!normalizedAddress || normalizedAddress === ticket.direccion) {
      return ticket;
    }

    return {
      ...ticket,
      direccion: normalizedAddress,
    };
  }, [ticket]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast.success(`${label} copiado al portapapeles`);
    }).catch(err => {
      toast.error('Error al copiar');
      console.error('Error al copiar: ', err);
    });
  };

  React.useEffect(() => {
    if (ticket?.categoria) {
      getSpecializedContact(ticket.categoria).then(setSpecialContact);
    } else {
      setSpecialContact(null);
    }
    setCompletionSent(false);
  }, [ticket?.categoria, ticket?.id]);

  const getInitials = (name: string) => {
    return name ? name.split(' ').map(n => n[0]).join('').toUpperCase() : '??';
  };

  const normalizePersonalValue = (value?: string | number | null) => {
    if (typeof value === 'number') return String(value).trim();
    if (typeof value === 'string') return value.trim();
    return '';
  };
  const personal = {
    nombre:
      normalizePersonalValue(ticket?.informacion_personal_vecino?.nombre) ||
      normalizePersonalValue(ticket?.display_name),
    telefono: normalizePersonalValue(getContactPhone(ticket)),
    email:
      normalizePersonalValue(ticket?.informacion_personal_vecino?.email) ||
      normalizePersonalValue(ticket?.email),
    direccion:
      normalizePersonalValue(ticket?.informacion_personal_vecino?.direccion) ||
      normalizePersonalValue(ticket?.direccion),
    dni: normalizePersonalValue(getCitizenDni(ticket)),
  };
  const emailHref = personal.email ? `mailto:${personal.email}` : undefined;
  const phoneHref = personal.telefono
    ? `https://wa.me/${personal.telefono.replace(/\D/g, '')}`
    : undefined;
  const displayName = personal?.nombre || ticket?.display_name || '';

  React.useEffect(() => {
    setImageError(false);
    setIsImageModalOpen(false);
  }, [primaryImageUrl]);

  const renderSpecialContact = (withSeparator = false) => {
    if (!specialContact) {
      return null;
    }

    return (
      <div className={cn('space-y-1', withSeparator && 'border-t pt-3')}>
        <p>{specialContact.nombre}</p>
        {specialContact.titulo && <p>{specialContact.titulo}</p>}
        {specialContact.telefono && <p>Teléfono: {specialContact.telefono}</p>}
        {specialContact.horario && <p>Horario: {specialContact.horario}</p>}
        {specialContact.email && <p>Email: {specialContact.email}</p>}
      </div>
    );
  };

  if (!ticket) {
    return (
       <aside className="hidden h-full w-full flex-col items-center justify-center border-l border-border bg-muted/20 p-6 lg:flex">
         <div className="text-center text-muted-foreground">
            <Info className="h-12 w-12 mx-auto mb-4" />
            <h3 className="font-semibold">Detalles del Ticket</h3>
            <p className="text-sm">Selecciona un ticket para ver los detalles del cliente y del caso.</p>
         </div>
       </aside>
    );
  }
  const handleExportPdf = () => {
    exportToPdf(ticket, ticket.messages || []);
  };

  const handleExportXlsx = () => {
    exportToXlsx(ticket, ticket.messages || []);
  };

  const handleSendHistory = async () => {
    if (!ticket) return;
    setIsSendingEmail(true);
    toast.info('Enviando historial por correo...');
    try {
        await sendTicketHistory(ticket);
        toast.success('Historial enviado por correo con éxito.');
    } catch (error) {
        toast.error('Error al enviar el historial por correo.');
        console.error('Error sending ticket history:', error);
    } finally {
        setIsSendingEmail(false);
    }
  };

  React.useEffect(() => {
    if (normalizedCurrentStatus === 'resuelto' && !completionSent) {
      sendTicketHistory(ticket).catch((err) =>
        console.error('Error sending completion email:', err),
      );
      setCompletionSent(true);
    }
  }, [normalizedCurrentStatus, completionSent, ticket]);

  const openGoogleMaps = () => {
    if (!ticket) return;

    const destLat = pickFirstCoordinate(ticket.lat_destino, ticket.latitud);
    const destLon = pickFirstCoordinate(ticket.lon_destino, ticket.longitud);
    const originLat = pickFirstCoordinate(
      ticket.lat_actual,
      ticket.lat_origen,
      ticket.origen_latitud,
      ticket.municipio_latitud,
    );
    const originLon = pickFirstCoordinate(
      ticket.lon_actual,
      ticket.lon_origen,
      ticket.origen_longitud,
      ticket.municipio_longitud,
    );

    if (typeof destLat === 'number' && typeof destLon === 'number') {
      if (typeof originLat === 'number' && typeof originLon === 'number') {
        window.open(
          `https://www.google.com/maps/dir/?api=1&origin=${originLat},${originLon}&destination=${destLat},${destLon}`,
          '_blank',
        );
        return;
      }

      window.open(
        `https://www.google.com/maps/search/?api=1&query=${destLat},${destLon}`,
        '_blank',
      );
      return;
    }

    const addressTicket = locationTicket ?? ticket;
    const address = buildFullAddress(addressTicket);

    if (!address) {
      return;
    }

    window.open(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`,
      '_blank',
    );
  };

  React.useEffect(() => {
    const fetchTimeline = async () => {
      if (!ticket) {
        setTimelineHistory([]);
        setTimelineMessages([]);
        return;
      }

      // Si el ticket ya incluye historial y mensajes, los usamos directamente
      if (ticket.history || ticket.messages) {
        setTimelineHistory(ticket.history || []);
        setTimelineMessages(ticket.messages || []);
        return;
      }

      try {
        const detailed = await getTicketById(ticket.id.toString());
        updateTicket(ticket.id, detailed);
        setTimelineHistory(detailed.history || []);
        setTimelineMessages(detailed.messages || []);
      } catch (error) {
        console.error('Error fetching ticket timeline:', error);
        setTimelineHistory([]);
        try {
          const msgs = await getTicketMessages(ticket.id, ticket.tipo);
          setTimelineMessages(msgs);
        } catch (msgErr) {
          console.error('Error fetching ticket messages:', msgErr);
          setTimelineMessages([]);
        }
      }
    };
    fetchTimeline();
  }, [ticket, updateTicket]);


  const formatCategory = (t: typeof ticket) => {
    if (!t?.categoria) return 'No informada';
    let base = `Reclamo por ${t.categoria}`;
    if (t.direccion) {
      base += ` en ${t.direccion}`;
    }
    return base;
  };

  const formatDate = (dateString?: string) => fmtARWithOffset(dateString ?? '', -3);
  const channelLabel = React.useMemo(() => getTicketChannel(ticket), [ticket]);


  return (
    <motion.aside
        key={ticket.id}
        initial={{ opacity: 0.5 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className={cn(
          'flex h-full min-w-0 max-w-full shrink-0 flex-col border-border bg-muted/20',
          onClose ? 'w-full border-0 md:border-l' : 'w-full border-l',
          className,
        )}
    >
      <header className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-border p-4 bg-muted/80 backdrop-blur supports-[backdrop-filter]:bg-muted/60">
        <div className="flex items-center gap-2">
          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={onClose}
              aria-label="Cerrar detalles del ticket"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
          <h3 className="font-semibold text-base md:text-lg">Detalles del Ticket</h3>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2" aria-label="Opciones de exportación">
              <FileDown className="h-4 w-4" />
              <span className="hidden sm:inline">Exportar</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleExportPdf}>Exportar a PDF</DropdownMenuItem>
            <DropdownMenuItem onClick={handleExportXlsx}>Exportar a Excel</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSendHistory} disabled={isSendingEmail}>
              {isSendingEmail ? 'Enviando...' : 'Enviar historial por correo'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>
      <ScrollArea className="flex-1">
        <div className="space-y-4 p-4 pb-24 md:pb-6">
          <TicketLogisticsSummary
            ticket={locationTicket || ticket}
            statusOverride={currentStatus}
            historyOverride={timelineHistory}
            onOpenMap={openGoogleMaps}
          />
          <Card>
            <CardHeader className="p-4">
              <div className="flex items-start gap-4">
                <Avatar className="h-14 w-14 flex-shrink-0">
                  <AvatarImage src={neighborAvatarUrl || undefined} alt={displayName} />
                  <AvatarFallback>{getInitials(displayName)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <h2
                    className={cn(
                      'break-words text-lg font-semibold',
                      !displayName && 'text-muted-foreground',
                    )}
                  >
                    {displayName || 'No especificado'}
                  </h2>
                  <p className="text-xs text-muted-foreground">Vecino/a</p>
                </div>
              </div>
            </CardHeader>
          </Card>

          <Accordion
            type="multiple"
            defaultValue={['info-personal', 'info-ticket']}
            className="w-full"
          >
            <AccordionItem value="info-personal">
              <AccordionTrigger className="text-base font-semibold">
                Información Personal
              </AccordionTrigger>
              <AccordionContent className="pt-2">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-background/70 p-3 shadow-sm">
                    <User className="mt-1 h-4 w-4 flex-shrink-0 text-primary" />
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Nombre
                      </p>
                      <p
                        className={cn(
                          'break-words text-sm leading-snug',
                          personal.nombre
                            ? 'font-medium text-foreground'
                            : 'text-muted-foreground',
                        )}
                      >
                        {personal.nombre || 'No especificado'}
                      </p>
                    </div>
                    {personal.nombre && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="ml-auto h-8 w-8 shrink-0 text-muted-foreground transition hover:text-foreground"
                        onClick={() => copyToClipboard(personal.nombre, 'Nombre')}
                        aria-label="Copiar nombre"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-background/70 p-3 shadow-sm">
                    <Info className="mt-1 h-4 w-4 flex-shrink-0 text-primary" />
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">DNI</p>
                      <p
                        className={cn(
                          'break-words text-sm leading-snug',
                          personal.dni ? 'font-medium text-foreground' : 'text-muted-foreground',
                        )}
                      >
                        {personal.dni || 'No especificado'}
                      </p>
                    </div>
                    {personal.dni && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="ml-auto h-8 w-8 shrink-0 text-muted-foreground transition hover:text-foreground"
                        onClick={() => copyToClipboard(personal.dni, 'DNI')}
                        aria-label="Copiar DNI"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-background/70 p-3 shadow-sm sm:col-span-2">
                    <Mail className="mt-1 h-4 w-4 flex-shrink-0 text-primary" />
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Email
                      </p>
                      {personal.email ? (
                        <a
                          href={emailHref}
                          className="break-all text-sm font-medium text-foreground hover:underline"
                        >
                          {personal.email}
                        </a>
                      ) : (
                        <p className="text-sm text-muted-foreground">No especificado</p>
                      )}
                    </div>
                    {personal.email && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="ml-auto h-8 w-8 shrink-0 text-muted-foreground transition hover:text-foreground"
                        onClick={() => copyToClipboard(personal.email, 'Email')}
                        aria-label="Copiar email"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-background/70 p-3 shadow-sm">
                    <FaWhatsapp className="mt-1 h-4 w-4 flex-shrink-0 text-green-500" />
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Teléfono
                      </p>
                      {personal.telefono ? (
                        <a
                          href={phoneHref}
                          target="_blank"
                          rel="noreferrer"
                          className="break-all text-sm font-medium text-foreground hover:underline"
                        >
                          {personal.telefono}
                        </a>
                      ) : (
                        <p className="text-sm text-muted-foreground">No especificado</p>
                      )}
                    </div>
                    {personal.telefono && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="ml-auto h-8 w-8 shrink-0 text-muted-foreground transition hover:text-foreground"
                        onClick={() => copyToClipboard(personal.telefono, 'Teléfono')}
                        aria-label="Copiar teléfono"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-background/70 p-3 shadow-sm sm:col-span-2">
                    <MapPin className="mt-1 h-4 w-4 flex-shrink-0 text-primary" />
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Dirección
                      </p>
                      <p
                        className={cn(
                          'break-words text-sm leading-snug',
                          personal.direccion
                            ? 'font-medium text-foreground'
                            : 'text-muted-foreground',
                        )}
                      >
                        {personal.direccion || 'No especificado'}
                      </p>
                    </div>
                    {personal.direccion && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="ml-auto h-8 w-8 shrink-0 text-muted-foreground transition hover:text-foreground"
                        onClick={() => copyToClipboard(personal.direccion, 'Dirección')}
                        aria-label="Copiar dirección"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="info-ticket">
              <AccordionTrigger className="text-base font-semibold">
                Detalles del Ticket
              </AccordionTrigger>
              <AccordionContent className="space-y-3 pt-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">ID:</span>
                  <span className="font-mono text-xs">{ticket.nro_ticket || 'N/A'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Estado:</span>
                  <Badge variant="outline" className="capitalize">
                    {currentStatusLabel}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Canal:</span>
                  <span
                    className={cn(
                      'font-medium',
                      channelLabel === 'N/A'
                        ? 'uppercase tracking-wide text-muted-foreground'
                        : 'capitalize text-foreground',
                    )}
                  >
                    {channelLabel}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Creado:</span>
                  <span>{formatDate(ticket.fecha)}</span>
                </div>
                <div className="space-y-1">
                  <span className="text-muted-foreground">Categoría:</span>
                  <p className="font-medium">{ticket.categoria || 'No informada'}</p>
                </div>
                {(ticket.description || ticket.detalles) && (
                  <div className="space-y-1">
                    <span className="text-muted-foreground">Descripción:</span>
                    {(ticket.description || ticket.detalles || '—')
                      .split('\n')
                      .map((line, index) => (
                        <p key={index} className="break-words text-justify text-sm">
                          {line}
                        </p>
                      ))}
                  </div>
                )}
                 {ticket.assignedAgent && (
                    <div className="space-y-2 pt-2">
                        <h4 className="font-semibold">Agente Asignado</h4>
                        <div className="flex items-center gap-3">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span>{ticket.assignedAgent.nombre_usuario}</span>
                        </div>
                    </div>
                )}
              </AccordionContent>
            </AccordionItem>

            {(attachments.length > 0 || primaryImageUrl) && (
              <AccordionItem value="archivos">
                <AccordionTrigger className="text-base font-semibold">
                  Archivos Adjuntos
                </AccordionTrigger>
                <AccordionContent className="space-y-4 pt-2">
                  {attachments.length > 0 && <TicketAttachments attachments={attachments} />}

                  {primaryImageUrl && (
                    <div className="space-y-3 text-sm">
                      <h4 className="font-semibold">Imagen del reclamo</h4>
                      {imageError ? (
                        <div className="rounded-md border bg-muted/50 p-4 text-muted-foreground">
                          No se pudo cargar la imagen proporcionada.
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setIsImageModalOpen(true)}
                          className="group relative max-h-32 max-w-full overflow-hidden rounded-md border bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
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
                      {renderSpecialContact(true)}
                    </div>
                  )}

                  {!primaryImageUrl && specialContact && (
                    <div className="space-y-1 text-sm">
                      <h4 className="font-semibold">Contacto sugerido</h4>
                      {renderSpecialContact()}
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            )}

            <AccordionItem value="historial">
              <AccordionTrigger className="text-base font-semibold">
                Historial del Ticket
              </AccordionTrigger>
              <AccordionContent>
                <TicketTimeline
                  history={timelineHistory}
                  messages={timelineMessages}
                  ticket={ticket}
                />
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {isImageModalOpen && primaryImageUrl && !imageError && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
              onClick={() => setIsImageModalOpen(false)}
              role="dialog"
              aria-modal="true"
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
                  className="absolute right-2 top-2 rounded-full bg-black/60 p-1 text-white transition hover:bg-black/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  aria-label="Cerrar imagen ampliada"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </motion.aside>
  );
};

export default DetailsPanel;
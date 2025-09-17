import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Mail, MapPin, Ticket as TicketIcon, Info, FileDown, User, ExternalLink, MessageCircle, Building, Hash, Copy, ChevronDown, ChevronUp, UserCheck, Bot } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import TicketMap, { buildFullAddress } from '../TicketMap';
import TicketTimeline from './TicketTimeline';
import TicketStatusBar from './TicketStatusBar';
import TicketAttachments from './TicketAttachments';
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
import { getContactPhone, getCitizenDni } from '@/utils/ticket';
import { fmtAR } from '@/utils/date';
import { getSpecializedContact, SpecializedContact } from '@/utils/contacts';
import { deriveAttachmentInfo } from '@/utils/attachment';

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

const collectAttachmentsFromTicket = (ticket?: Ticket | null): Attachment[] => {
  if (!ticket) {
    return [];
  }

  const sources: any[] = [];

  if (Array.isArray(ticket.archivos_adjuntos)) {
    sources.push(ticket.archivos_adjuntos);
  }

  const legacyArchivos = (ticket as any)?.archivosAdjuntos;
  if (Array.isArray(legacyArchivos)) {
    sources.push(legacyArchivos);
  }

  if (Array.isArray(ticket.attachments)) {
    sources.push(ticket.attachments);
  }

  if (Array.isArray(ticket.messages)) {
    sources.push(ticket.messages.flatMap((msg) => msg.attachments || []));
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

const getPrimaryImageUrl = (ticket: Ticket | null, attachments: Attachment[]): string | undefined => {
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


const DetailsPanel: React.FC = () => {
  const { selectedTicket: ticket, updateTicket } = useTickets();
  const [isSendingEmail, setIsSendingEmail] = React.useState(false);

  const attachments = React.useMemo(() => collectAttachmentsFromTicket(ticket), [ticket]);
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
  const [timelineHistory, setTimelineHistory] = React.useState<TicketHistoryEvent[]>([]);
  const [timelineMessages, setTimelineMessages] = React.useState<Message[]>([]);
  const [specialContact, setSpecialContact] = React.useState<SpecializedContact | null>(null);
  const [completionSent, setCompletionSent] = React.useState(false);
  const statusFlow = React.useMemo(
    () => timelineHistory.map((h) => h.status).filter(Boolean),
    [timelineHistory],
  );
  const currentStatus = React.useMemo(
    () => ticket?.estado || statusFlow[statusFlow.length - 1] || '',
    [ticket?.estado, statusFlow],
  );

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

  const personal = {
    nombre: ticket?.informacion_personal_vecino?.nombre || ticket?.display_name,
    telefono: getContactPhone(ticket),
    email: ticket?.informacion_personal_vecino?.email || ticket?.email,
    direccion: ticket?.informacion_personal_vecino?.direccion || ticket?.direccion,
    dni: getCitizenDni(ticket),
  };
  const isSpecified = (value?: string) => value && value.toLowerCase() !== 'no especificado';
  const displayName = personal?.nombre || ticket?.display_name || '';

  React.useEffect(() => {
    setImageError(false);
  }, [primaryImageUrl]);

  if (!ticket) {
    return (
       <aside className="w-full border-l border-border flex-col h-screen bg-muted/20 shrink-0 hidden lg:flex items-center justify-center p-6">
         <div className="text-center text-muted-foreground">
            <Info className="h-12 w-12 mx-auto mb-4" />
            <h3 className="font-semibold">Detalles del Ticket</h3>
            <p className="text-sm">Selecciona un ticket para ver los detalles del cliente y del caso.</p>
         </div>
       </aside>
    );
  }


  const hasLocation = ticket.direccion || (ticket.latitud && ticket.longitud);

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
    const normalizeStatus = (s?: string | null) =>
      s ? s.toLowerCase().replace(/\s+/g, '_') : '';
    const normalized = normalizeStatus(currentStatus);
    if (
      (normalized === 'completado' || normalized === 'resuelto') &&
      !completionSent
    ) {
      sendTicketHistory(ticket).catch((err) =>
        console.error('Error sending completion email:', err),
      );
      setCompletionSent(true);
    }
  }, [currentStatus, completionSent, ticket]);

  const openGoogleMaps = () => {
    if (!ticket) return;
    if (ticket.latitud && ticket.longitud) {
      window.open(
        `https://www.google.com/maps/search/?api=1&query=${ticket.latitud},${ticket.longitud}`,
        '_blank'
      );
      return;
    }
    const address = buildFullAddress(ticket);
    if (!address) return;
    window.open(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`,
      '_blank'
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

  const formatDate = (dateString: string | undefined) =>
    dateString ? fmtAR(dateString) : 'No informado';


  return (
    <motion.aside
        key={ticket.id}
        initial={{ opacity: 0.5 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full border-l border-border flex flex-col h-screen bg-muted/20 shrink-0"
    >
      <header className="p-4 border-b border-border flex items-center justify-between">
        <h3 className="font-semibold">Detalles del Ticket</h3>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <FileDown className="h-4 w-4 mr-2" />
              Exportar
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
        <div className="p-4 space-y-4">
          <Card>
            <CardHeader className="p-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-14 w-14">
                  <AvatarImage src={neighborAvatarUrl || undefined} alt={displayName} />
                  <AvatarFallback>{getInitials(displayName)}</AvatarFallback>
                </Avatar>
                <div>
                  <h2
                    className={cn(
                      "text-lg font-semibold whitespace-normal break-words",
                      !displayName && "text-muted-foreground"
                    )}
                  >
                    {displayName || 'No especificado'}
                  </h2>
                  <p className="text-xs text-muted-foreground">Vecino/a</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-3 text-sm border-t">
              <h4 className="font-semibold mb-2">Información Personal del Vecino</h4>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className={cn("flex-1", !isSpecified(personal?.nombre) && "text-muted-foreground")}>{personal?.nombre || 'No especificado'}</span>
                  {isSpecified(personal?.nombre) && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => copyToClipboard(personal?.nombre || '', 'Nombre')}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Info className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className={cn("flex-1", !isSpecified(personal?.dni) && "text-muted-foreground")}>DNI: {personal?.dni || 'No especificado'}</span>
                  {isSpecified(personal?.dni) && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => copyToClipboard(personal?.dni || '', 'DNI')}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  {isSpecified(personal?.email) ? (
                    <a
                      href={`mailto:${personal?.email}`}
                      className="flex-1 text-sm hover:underline break-words"
                    >
                      <span className="break-all">{personal?.email}</span>
                    </a>
                  ) : (
                    <span className="flex-1 text-muted-foreground">No especificado</span>
                  )}
                  {isSpecified(personal?.email) && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => copyToClipboard(personal?.email || '', 'Email')}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <FaWhatsapp className="h-4 w-4 text-green-500 flex-shrink-0" />
                  {isSpecified(personal?.telefono) ? (
                    <a
                      href={`https://wa.me/${personal?.telefono?.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 text-sm hover:underline break-words"
                    >
                      {personal?.telefono}
                    </a>
                  ) : (
                    <span className="flex-1 text-muted-foreground">No especificado</span>
                  )}
                  {isSpecified(personal?.telefono) && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => copyToClipboard(personal?.telefono || '', 'Teléfono')}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className={cn("flex-1", !isSpecified(personal?.direccion) && "text-muted-foreground")}>{personal?.direccion || 'No especificado'}</span>
                  {isSpecified(personal?.direccion) && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => copyToClipboard(personal?.direccion || '', 'Dirección')}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>

            {attachments.length > 0 && <TicketAttachments attachments={attachments} />}

            {(specialContact || (primaryImageUrl && !imageError)) && (
              <CardContent className="p-4 text-sm border-t space-y-3">
                <h4 className="font-semibold">Contacto para seguimiento</h4>
                {primaryImageUrl && !imageError && (
                  <div className="aspect-video rounded-md overflow-hidden border bg-muted">
                    <img
                      src={primaryImageUrl}
                      alt="Foto enviada en el reclamo"
                      className="h-full w-full object-cover"
                      loading="lazy"
                      onError={() => setImageError(true)}
                    />
                  </div>
                )}
                {specialContact && (
                  <div className="space-y-1">
                    <p>{specialContact.nombre}</p>
                    {specialContact.titulo && <p>{specialContact.titulo}</p>}
                    {specialContact.telefono && <p>Teléfono: {specialContact.telefono}</p>}
                    {specialContact.horario && <p>Horario: {specialContact.horario}</p>}
                    {specialContact.email && <p>Email: {specialContact.email}</p>}
                  </div>
                )}
              </CardContent>
            )}

            <CardContent className="p-4 space-y-3 text-sm border-t">
                <h4 className="font-semibold mb-2">Detalles del Ticket</h4>
                <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">ID:</span>
                    <span className="font-mono text-xs">{ticket.nro_ticket || 'N/A'}</span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Estado:</span>
                    <Badge variant="outline" className="capitalize">{currentStatus || 'N/A'}</Badge>
                </div>
                <TicketStatusBar status={currentStatus} flow={statusFlow} />
                <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Canal:</span>
                    <span className="capitalize">{ticket.channel || 'N/A'}</span>
                </div>
                <div className="flex justify-between items-center">
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
                    {(ticket.description || ticket.detalles || '—').split('\n').map((line, index) => (
                      <p key={index} className="text-sm break-words text-justify">
                        {line}
                      </p>
                    ))}
                  </div>
                )}
            </CardContent>
            {hasLocation && (
                <CardContent className="p-4 border-t">
                    <h4 className="font-semibold mb-2 flex items-center justify-between">
                        Ubicación
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={openGoogleMaps}>
                            <ExternalLink className="h-4 w-4" />
                        </Button>
                    </h4>
                    {ticket.direccion && <p className="text-sm font-medium mb-2 text-primary">{ticket.direccion}</p>}
                    {ticket.distrito && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Building className="h-4 w-4" />
                            <span>Distrito: {ticket.distrito}</span>
                        </div>
                    )}
                    {ticket.esquinas_cercanas && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Hash className="h-4 w-4" />
                            <span>Esquinas: {ticket.esquinas_cercanas}</span>
                        </div>
                    )}
                    <div className="aspect-video rounded-md overflow-hidden mt-2">
                        <TicketMap ticket={ticket} />
                    </div>
                </CardContent>
            )}

            {ticket.assignedAgent && (
                <CardContent className="p-4 border-t">
                    <h4 className="font-semibold mb-2">Agente Asignado</h4>
                     <div className="flex items-center gap-3">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span>{ticket.assignedAgent.nombre_usuario}</span>
                     </div>
                </CardContent>
            )}

            <CardContent className="p-4 border-t">
                <h4 className="font-semibold mb-2">Historial del Ticket</h4>
                <TicketTimeline history={timelineHistory} messages={timelineMessages} ticket={ticket} />
            </CardContent>

          </Card>
        </div>
      </ScrollArea>
    </motion.aside>
  );
};

export default DetailsPanel;
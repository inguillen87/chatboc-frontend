import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Card, CardContent } from '@/components/ui/card';
import {
  Mail,
  MapPin,
  Info,
  FileDown,
  User,
  Copy,
  X,
  Maximize2,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  ListChecks,
  UserRound,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import { buildFullAddress } from '@/utils/ticketLocationAddress';
import TicketTimeline from './TicketTimeline';
import TicketAttachments from './TicketAttachments';
import TicketLogisticsSummary from './TicketLogisticsSummary';
import TicketAssignment from './TicketAssignment';
import AiAssistPanel from './AiAssistPanel';
import { IdentityAvatar } from '@/components/identity/IdentityAvatar';
import { useTickets } from '@/context/TicketContext';
import { exportToPdf, exportToXlsx } from '@/services/exportService';
import {
  sendTicketHistory,
  getTicketById,
  getTicketMessages,
  isTicketHistoryDeliveryErrorResult,
  formatTicketHistoryDeliveryErrorMessage,
  normalizeTicketHistoryDeliveryError,
} from '@/services/ticketService';
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
import {
  deriveAttachmentInfo,
  getAttachmentDeliveryUrl,
  getAttachmentPreviewUrl,
  sanitizeAttachmentUrl,
} from '@/utils/attachment';
import { formatTicketStatusLabel, normalizeTicketStatus } from '@/utils/ticketStatus';
import { normalizeTicketLocation, pickFirstCoordinate } from '@/utils/location';
import { ApiError } from '@/utils/api';
import { deriveTicketOperationalGuidance } from './ticketOperationalGuidance';
import { resolveConsentedAvatar } from '@/utils/avatarConsent';
import { normalizeSaasActions } from '@/api/v2/saas';
import TicketAiHandoffControl, { isAiHandoffAction } from './TicketAiHandoffControl';
import './DetailsPanel.css';

const sanitizeMediaUrl = (value?: string | null): string | undefined => {
  return sanitizeAttachmentUrl(value) || undefined;
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

type OperationalAction = {
  id: string;
  label: string;
  description?: string;
  href?: string;
  disabled?: boolean;
  disabledReason?: string;
};

const normalizeTextValue = (value: unknown): string => {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'string') return value.trim();
  return '';
};

const STRUCTURED_DESCRIPTION_KEYS = [
  'summary',
  'resumen',
  'description',
  'descripcion',
  'consulta',
  'message',
  'mensaje',
  'question',
  'pregunta',
] as const;

const extractHumanTextFromRecord = (record: Record<string, unknown>): string => {
  for (const key of STRUCTURED_DESCRIPTION_KEYS) {
    const candidate = normalizeTextValue(record[key]);
    if (candidate) return candidate;
  }

  const events = Array.isArray(record.events) ? record.events : [];
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = asPlainRecord(events[index]);
    if (!event) continue;
    for (const key of STRUCTURED_DESCRIPTION_KEYS) {
      const candidate = normalizeTextValue(event[key]);
      if (candidate) return candidate;
    }
  }

  return '';
};

const extractHumanDescription = (value: unknown): string => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return extractHumanTextFromRecord(value as Record<string, unknown>);
  }

  const text = normalizeTextValue(value);
  if (!text) return '';
  if (!text.startsWith('{') && !text.startsWith('[')) return text;

  try {
    const parsed = JSON.parse(text) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? extractHumanTextFromRecord(parsed as Record<string, unknown>)
      : '';
  } catch {
    // JSON-looking payloads are technical or malformed. Never expose them as
    // an operator-facing case summary.
    return '';
  }
};

export const resolveTicketCaseSummary = (
  ticket: Ticket,
  assistedSummary?: unknown,
  fallbackSummary?: unknown,
): string =>
  extractHumanDescription(assistedSummary) ||
  extractHumanDescription(ticket.description) ||
  extractHumanDescription(ticket.detalles) ||
  normalizeTextValue(ticket.pregunta) ||
  normalizeTextValue(fallbackSummary) ||
  normalizeTextValue(ticket.asunto) ||
  normalizeTextValue(ticket.categoria) ||
  'Sin descripción disponible';

const formatCompactLabel = (value: unknown): string => normalizeTextValue(value).replace(/_/g, ' ');

const asPlainRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
};

const asRecordList = (value: unknown): Array<Record<string, unknown>> => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => asPlainRecord(item))
    .filter((item): item is Record<string, unknown> => Boolean(item));
};

const humanizeAssistedModule = (value: unknown): string => {
  const normalized = normalizeTextValue(value).toLowerCase();

  if (!normalized) return '';

  const moduleLabels: Record<string, string> = {
    municipal_claims: 'Reclamos municipales',
    claims: 'Reclamos',
    marketplace: 'Marketplace',
    commerce: 'Pedidos y ventas',
    orders: 'Pedidos',
    surveys: 'Encuestas',
    school: 'Colegios',
    payments: 'Pagos',
  };

  return moduleLabels[normalized] || formatCompactLabel(normalized);
};

const normalizeOperationalActions = (...sources: unknown[]): OperationalAction[] => {
  const seen = new Set<string>();
  const actions: OperationalAction[] = [];

  sources.forEach((source) => {
    if (!Array.isArray(source)) return;

    source.forEach((item, index) => {
      let id = '';
      let label = '';
      let description = '';
      let href = '';
      let disabled = false;
      let disabledReason = '';

      if (typeof item === 'string') {
        id = item.trim();
        label = item.trim();
      } else if (item && typeof item === 'object') {
        const raw = item as Record<string, unknown>;
        id = normalizeTextValue(raw.id || raw.action_id || raw.action || raw.intent || raw.key || raw.name) || `action_${index}`;
        label = normalizeTextValue(raw.label || raw.title || raw.name || raw.action_label || raw.action || raw.intent || raw.id);
        description = normalizeTextValue(raw.description || raw.help_text || raw.detail || raw.summary);
        href = normalizeTextValue(raw.href || raw.url || raw.action_url || raw.external_url);
        disabled = raw.enabled === false || raw.disabled === true;
        disabledReason = normalizeTextValue(
          raw.disabled_reason ||
          raw.disabledReason ||
          raw.unavailable_reason ||
          raw.unavailableReason ||
          raw.blocked_reason ||
          raw.blockedReason ||
          raw.reason
        );
        if (disabled && !disabledReason) {
          disabledReason = 'No disponible para este estado del ticket.';
        }
      }

      if (!label) return;
      const key = `${id || label}`.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      actions.push({
        id: id || label,
        label,
        description: description || undefined,
        href: href || undefined,
        disabled,
        disabledReason: disabledReason || undefined,
      });
    });
  });

  return actions;
};

const normalizeAttachment = (raw: any, fallbackIndex: number): Attachment | null => {
  const rawUrl = getAttachmentDeliveryUrl(raw) || pickFirstString(
    raw?.archivo_url,
    raw?.attachment_url,
    raw?.fileUrl,
    raw?.location_url,
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
  const thumbUrl = sanitizeMediaUrl(getAttachmentPreviewUrl(raw) || pickFirstString(
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
    downloadUrl: sanitizeMediaUrl(raw?.downloadUrl) || undefined,
    download_url: sanitizeMediaUrl(raw?.download_url) || undefined,
    storage_url: sanitizeMediaUrl(raw?.storage_url) || undefined,
    storage_provider: pickFirstString(raw?.storage_provider),
    storage_access: pickFirstString(raw?.storage_access) as Attachment['storage_access'],
    is_private: Boolean(raw?.is_private ?? raw?.isPrivate),
    isPrivate: Boolean(raw?.isPrivate ?? raw?.is_private),
    securityLabel: pickFirstString(raw?.securityLabel),
    source: pickFirstString(raw?.source),
    origin: pickFirstString(raw?.origin, raw?.source),
    status: pickFirstString(raw?.status),
    kind: pickFirstString(raw?.kind),
    flow_id: pickFirstString(raw?.flow_id),
    interaction_id: pickFirstString(raw?.interaction_id),
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
  operationalWorkspace?: boolean;
}

const DetailsPanel: React.FC<DetailsPanelProps> = ({ onClose, className, operationalWorkspace = false }) => {
  const { selectedTicket: ticket, updateTicket } = useTickets();
  const [isSendingEmail, setIsSendingEmail] = React.useState(false);

  const [timelineHistory, setTimelineHistory] = React.useState<TicketHistoryEvent[]>([]);
  const [timelineMessages, setTimelineMessages] = React.useState<Message[]>([]);
  const [openSections, setOpenSections] = React.useState<string[]>([]);

  const attachments = React.useMemo(
    () => collectAttachmentsFromTicket(ticket, timelineMessages),
    [ticket, timelineMessages]
  );
  const primaryImageUrl = React.useMemo(
    () => getPrimaryImageUrl(ticket, attachments),
    [attachments, ticket]
  );
  const standalonePrimaryImageUrl = React.useMemo(() => {
    if (!primaryImageUrl) return undefined;
    const normalizedPrimary = sanitizeMediaUrl(primaryImageUrl);
    const representedInAttachments = attachments.some((attachment) => {
      const delivery = sanitizeMediaUrl(getAttachmentDeliveryUrl(attachment));
      const preview = sanitizeMediaUrl(getAttachmentPreviewUrl(attachment));
      return Boolean(normalizedPrimary && (delivery === normalizedPrimary || preview === normalizedPrimary));
    });
    return representedInAttachments ? undefined : normalizedPrimary;
  }, [attachments, primaryImageUrl]);
  const neighborAvatar = React.useMemo(() => resolveConsentedAvatar(
    ticket as unknown as Record<string, unknown> | null | undefined,
    ticket?.user as unknown as Record<string, unknown> | null | undefined,
  ), [ticket]);
  const neighborAvatarUrl = sanitizeMediaUrl(neighborAvatar.avatarUrl);
  const neighborAvatarSource =
    neighborAvatar.source || ticket?.avatar_source || (neighborAvatarUrl ? 'imagen consentida' : 'iniciales');
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

    const normalizedLocation = normalizeTicketLocation(ticket);
    const normalizedAddress =
      normalizedLocation.direccion ||
      (typeof ticket.direccion === 'string' ? ticket.direccion.trim() : '') ||
      (typeof ticket.informacion_personal_vecino?.direccion === 'string'
        ? ticket.informacion_personal_vecino.direccion.trim()
        : '');

    return {
      ...ticket,
      ...normalizedLocation,
      direccion: normalizedAddress || ticket.direccion,
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
    setOpenSections([]);
  }, [ticket?.categoria, ticket?.id]);

  const normalizePersonalValue = (value?: string | number | null) => {
    if (typeof value === 'number') return String(value).trim();
    if (typeof value === 'string') return value.trim();
    return '';
  };
  const channelLabel = React.useMemo(() => getTicketChannel(ticket), [ticket]);
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
  const phoneDigits = personal.telefono.replace(/\D/g, '');
  const phoneHref = phoneDigits
    ? `https://wa.me/${phoneDigits}`
    : undefined;
  const displayName = personal?.nombre || ticket?.display_name || '';
  const ticketSubject = String(
    ticket?.asunto || ticket?.title || ticket?.categoria || 'Detalle del ticket',
  ).trim();
  const rawCaseNumber = normalizePersonalValue(ticket?.nro_ticket) || normalizePersonalValue(ticket?.id);
  const caseNumberLabel = rawCaseNumber.startsWith('#') ? rawCaseNumber : `#${rawCaseNumber}`;
  const contactRoleLabel = ticket.tipo === 'pyme' ? 'Cliente' : 'Vecino/a';
  const hasAddress = Boolean(personal.direccion || locationTicket?.latitud || locationTicket?.lat_destino);
  const hasContactCopyTarget = Boolean(displayName || personal.telefono || personal.email || personal.direccion);
  const contactActionBlockers = [
    phoneHref ? '' : 'Falta telefono para abrir WhatsApp.',
    emailHref ? '' : 'Falta email para enviar correo.',
    hasAddress ? '' : 'Falta direccion o coordenadas para abrir mapa.',
    hasContactCopyTarget ? '' : 'Faltan datos del contacto para copiar.',
  ].filter(Boolean);

  React.useEffect(() => {
    setImageError(false);
    setIsImageModalOpen(false);
  }, [standalonePrimaryImageUrl]);

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
            <p className="text-sm">Seleccioná un ticket para ver los detalles del cliente y del caso.</p>
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
        const result = await sendTicketHistory(ticket, {
          reason: 'manual',
          actor: 'agent',
        });
        if (result.status === 'sent') {
          toast.success('Historial enviado por correo con éxito.');
        } else if (isTicketHistoryDeliveryErrorResult(result)) {
          toast.warning(
            formatTicketHistoryDeliveryErrorMessage(
              result,
              'No se pudo enviar el historial por correo. Se registró un error de entrega.',
            ),
          );
          console.warn('Ticket history email delivery error:', result);
        }
    } catch (error) {
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
          toast.error('No tienes permisos para enviar el historial en este momento.');
          console.error('Error sending ticket history:', error);
          return;
        }

        const deliveryError = normalizeTicketHistoryDeliveryError(error);
        toast.warning(
          formatTicketHistoryDeliveryErrorMessage(
            deliveryError,
            'El historial no pudo enviarse por correo por un problema con el servidor de email.',
          ),
        );
        console.error('Error sending ticket history:', error);
    } finally {
        setIsSendingEmail(false);
    }
  };

  React.useEffect(() => {
    if (normalizedCurrentStatus === 'resuelto' && !completionSent) {
      sendTicketHistory(ticket, {
        reason: 'auto_completion',
        estado: normalizedCurrentStatus,
        actor: 'agent',
        notifyChannels: ['email', 'sms'],
      })
        .then((result) => {
          if (isTicketHistoryDeliveryErrorResult(result)) {
            toast.warning(
              formatTicketHistoryDeliveryErrorMessage(
                result,
                'El ticket se completó, pero no se pudo enviar el correo automático al ciudadano.',
              ),
            );
            console.warn('Completion email delivery failed:', result);
          }
        })
        .catch((err) =>
          console.error('Error sending completion email:', err),
        );
      setCompletionSent(true);
    }
  }, [normalizedCurrentStatus, completionSent, ticket]);

  const openGoogleMaps = () => {
    if (!ticket) return;

    const mapSource = locationTicket ?? ticket;
    const destLat = pickFirstCoordinate(mapSource.lat_destino, mapSource.latitud);
    const destLon = pickFirstCoordinate(mapSource.lon_destino, mapSource.longitud);
    const originLat = pickFirstCoordinate(
      mapSource.lat_actual,
      mapSource.lat_origen,
      mapSource.origen_latitud,
      mapSource.municipio_latitud,
    );
    const originLon = pickFirstCoordinate(
      mapSource.lon_actual,
      mapSource.lon_origen,
      mapSource.origen_longitud,
      mapSource.municipio_longitud,
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
        const detailed = await getTicketById(ticket.id.toString(), {
          ticket,
          tenantSlug: ticket.tenant_slug,
        });
        updateTicket(ticket.id, detailed);
        setTimelineHistory(detailed.history || []);
        setTimelineMessages(detailed.messages || []);
      } catch (error) {
        console.error('Error fetching ticket timeline:', error);
        setTimelineHistory([]);
        try {
          const msgs = await getTicketMessages(ticket.id, ticket.tipo, {
            ticket,
            tenantSlug: ticket.tenant_slug,
          });
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
  const backendActions = React.useMemo(
    () => normalizeSaasActions(ticket.allowed_actions),
    [ticket.allowed_actions],
  );
  const aiHandoffActions = React.useMemo(
    () => backendActions.filter(isAiHandoffAction),
    [backendActions],
  );
  const handoffState = React.useMemo(
    () => asPlainRecord(ticket.handoff) || asPlainRecord(ticket.datos_extra?.handoff),
    [ticket.datos_extra, ticket.handoff],
  );
  const operationalActions = React.useMemo(
    () => normalizeOperationalActions(ticket.allowed_actions, ticket.actions, ticket.next_steps)
      .filter((action) => !isAiHandoffAction(action)),
    [ticket.allowed_actions, ticket.actions, ticket.next_steps],
  );
  const operationalGuidance = React.useMemo(() => deriveTicketOperationalGuidance(ticket), [ticket]);
  const priorityLabel = normalizeTextValue(ticket.priority);
  const slaLabel = normalizeTextValue(ticket.sla_status);
  const assignedAgentLabel = normalizeTextValue(
    ticket.assignedAgent?.nombre_usuario ||
      ticket.user?.nombre_usuario ||
      ticket.assignedAgentId ||
      ticket.assigned_agent_id ||
      ticket.assigned_user_id,
  );
  const nextActionLabel = operationalGuidance.label;
  const assistedContext = React.useMemo(() => {
    const request =
      asPlainRecord(ticket.assisted_request) ||
      asPlainRecord(ticket.datos_extra?.assisted_request);
    const publicFollowUp =
      asPlainRecord(ticket.public_follow_up) ||
      asPlainRecord(request?.public_follow_up) ||
      asPlainRecord(ticket.datos_extra?.public_follow_up);
    const operatorSummary =
      asPlainRecord(request?.operator_intake_summary) ||
      asPlainRecord(ticket.datos_extra?.operator_intake_summary);
    const aiOperatorBrief =
      asPlainRecord(ticket.ai_operator_brief) ||
      asPlainRecord(ticket.datos_extra?.ai_operator_brief) ||
      operatorSummary;
    const tracking = asPlainRecord(publicFollowUp?.tracking);
    const moduleLabel = humanizeAssistedModule(
      request?.target_module ||
        request?.module ||
        request?.target ||
        publicFollowUp?.target_module,
    );
    const kindLabel = normalizeTextValue(
      request?.request_kind_label ||
        request?.request_kind ||
        request?.kind_label ||
        request?.kind,
    );
    const summary = normalizeTextValue(
      aiOperatorBrief?.summary ||
        aiOperatorBrief?.operator_summary ||
        operatorSummary?.summary ||
        request?.summary ||
        request?.description,
    );
    const recommendedAction = normalizeTextValue(
      ticket.recommended_next_action ||
        aiOperatorBrief?.recommended_next_action ||
        request?.recommended_next_action,
    );
    const trackingCode = normalizeTextValue(
      tracking?.code ||
        tracking?.id ||
        tracking?.ticket ||
        publicFollowUp?.tracking_code,
    );
    const trackingHref = normalizeTextValue(
      tracking?.href ||
        tracking?.url ||
        tracking?.path ||
        publicFollowUp?.href ||
        publicFollowUp?.url,
    );
    const trackingLabel =
      normalizeTextValue(tracking?.label || publicFollowUp?.label) ||
      'Abrir seguimiento';
    const dedupeActionKeys = new Set<string>();
    const channelActions = normalizeOperationalActions(
      asRecordList(publicFollowUp?.channels),
      trackingHref
        ? [{ id: 'open_public_follow_up', label: trackingLabel, href: trackingHref }]
        : [],
    ).filter((action) => {
      if (!action.href) return false;
      const key = `${action.href}|${action.label}`.toLowerCase();
      if (dedupeActionKeys.has(key)) return false;
      dedupeActionKeys.add(key);
      return true;
    });
    const visible = Boolean(request || publicFollowUp || summary || trackingHref);

    return {
      visible,
      moduleLabel,
      kindLabel,
      summary,
      recommendedAction,
      trackingCode,
      trackingHref,
      trackingLabel,
      channelActions,
    };
  }, [ticket]);
  const resolutionActions = React.useMemo(() => {
    const seen = new Set<string>();
    return [...operationalActions, ...assistedContext.channelActions].filter((action) => {
      const key = `${action.id}|${action.href || ''}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [assistedContext.channelActions, operationalActions]);
  const primaryResolutionActions = resolutionActions.slice(0, 3);
  const additionalResolutionActions = resolutionActions.slice(3);
  const caseSummary = resolveTicketCaseSummary(
    ticket,
    assistedContext.summary,
    formatCategory(ticket),
  );
  const resolutionNextStep =
    assistedContext.recommendedAction ||
    nextActionLabel ||
    'Revisá la información disponible y continuá la gestión desde la conversación.';
  const openActionHref = (href: string) => {
    if (!href) return;
    if (href.startsWith('/api/')) {
      toast.info('Accion disponible como endpoint JSON. Se usa dentro del panel, no como pagina.');
      return;
    }
    window.open(href, '_blank', 'noopener,noreferrer');
  };

  const refreshTicketAfterHandoff = () => {
    void getTicketById(ticket.id.toString(), {
      ticket,
      tenantSlug: ticket.tenant_slug,
    })
      .then((detailed) => updateTicket(ticket.id, detailed))
      .catch((error) => {
        console.warn('Handoff confirmado, pero no se pudo refrescar el ticket:', error);
      });
  };

  return (
    <motion.aside
      key={ticket.id}
      initial={{ opacity: 0.5 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className={cn(
        'ticket-inspector flex h-full min-w-0 max-w-full shrink-0 flex-col overflow-hidden border-border bg-muted/20',
        onClose ? 'w-full border-0 md:border-l' : 'w-full border-l',
        className,
      )}
      data-operational-workspace={operationalWorkspace ? 'true' : 'false'}
      data-testid="ticket-details-panel"
    >
      <header className="sticky top-0 z-10 flex min-w-0 items-start justify-between gap-2 border-b border-border bg-background/95 p-3 backdrop-blur supports-[backdrop-filter]:bg-background/85">
        <div className="flex min-w-0 items-center gap-2">
          {onClose ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 shrink-0"
              onClick={onClose}
              aria-label="Cerrar detalles del ticket"
            >
              <X className="h-4 w-4" />
            </Button>
          ) : null}
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Caso <span className="font-mono text-foreground">{caseNumberLabel}</span>
            </p>
            <h2 className="ticket-inspector__header-title text-base font-semibold leading-snug md:text-lg" title={ticketSubject}>
              {ticketSubject}
            </h2>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {!operationalWorkspace ? (
            <Badge variant="outline" className="hidden capitalize sm:inline-flex">
              {currentStatusLabel}
            </Badge>
          ) : null}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Exportar o enviar historial">
                <FileDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExportPdf}>Exportar a PDF</DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportXlsx}>Exportar a Excel</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSendHistory} disabled={isSendingEmail}>
                {isSendingEmail ? 'Enviando…' : 'Enviar historial por correo'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <ScrollArea className="min-h-0 min-w-0 flex-1">
        <div className="ticket-inspector__scroll-content space-y-3 p-3 pb-24 sm:p-4 md:pb-6">
          <Card className="border-primary/20 bg-background shadow-sm" data-testid="ticket-resolution-guide">
            <CardContent className="space-y-4 p-4">
              <section aria-labelledby={`case-summary-${ticket.id}`} className="space-y-2">
                <div className="flex items-center gap-2">
                  <ListChecks className="h-4 w-4 text-primary" aria-hidden="true" />
                  <h3 id={`case-summary-${ticket.id}`} className="text-sm font-semibold">
                    Resumen del caso
                  </h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="ticket-inspector__badge capitalize">{currentStatusLabel}</Badge>
                  {ticket.categoria ? <Badge variant="outline" className="ticket-inspector__badge">{ticket.categoria}</Badge> : null}
                  {priorityLabel ? (
                    <Badge variant="outline" className="ticket-inspector__badge gap-1">
                      <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                      Prioridad {formatCompactLabel(priorityLabel)}
                    </Badge>
                  ) : null}
                  {slaLabel ? <Badge variant="outline" className="ticket-inspector__badge">SLA: {slaLabel}</Badge> : null}
                  {assignedAgentLabel ? (
                    <Badge variant="secondary" className="ticket-inspector__badge gap-1">
                      <UserRound className="h-3 w-3" aria-hidden="true" />
                      {assignedAgentLabel}
                    </Badge>
                  ) : null}
                </div>
                <p className="text-sm leading-relaxed text-foreground">{caseSummary}</p>
                {assistedContext.visible ? (
                  <div className="flex flex-wrap gap-2" data-testid="ticket-assisted-context-card">
                    {assistedContext.moduleLabel ? (
                      <Badge variant="secondary">{assistedContext.moduleLabel}</Badge>
                    ) : null}
                    {assistedContext.kindLabel ? (
                      <Badge variant="outline" className="capitalize">{assistedContext.kindLabel}</Badge>
                    ) : null}
                  </div>
                ) : null}
              </section>

              <section
                aria-labelledby={`next-step-${ticket.id}`}
                className="rounded-xl border border-primary/20 bg-primary/5 p-3"
              >
                <p id={`next-step-${ticket.id}`} className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
                  Próximo paso
                </p>
                <p className="mt-1 text-sm font-medium leading-relaxed text-foreground">
                  {resolutionNextStep}
                </p>
              </section>

              {primaryResolutionActions.length ? (
                <section aria-label="Acciones operativas" className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Acciones disponibles
                  </p>
                  <div className="ticket-inspector__action-grid">
                    {primaryResolutionActions.map((action, index) => {
                      const canOpen = Boolean(action.href && !action.disabled);
                      const reasonId = `resolution-action-${ticket.id}-${index}-reason`;
                      return (
                        <div key={`${action.id}-${action.href || index}`} className="min-w-0 space-y-1">
                          <Button
                            type="button"
                            variant={index === 0 && canOpen ? 'default' : 'outline'}
                            size="sm"
                            className="ticket-inspector__action-button w-full justify-between gap-2"
                            disabled={!canOpen}
                            aria-describedby={action.disabledReason ? reasonId : undefined}
                            onClick={() => (action.href ? openActionHref(action.href) : undefined)}
                          >
                            <span>{action.label}</span>
                            {canOpen ? (
                              <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            ) : (
                              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            )}
                          </Button>
                          {action.disabledReason ? (
                            <p id={reasonId} className="text-[11px] leading-snug text-amber-700 dark:text-amber-300">
                              {action.disabledReason}
                            </p>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </section>
              ) : (
                <p className="rounded-lg border border-dashed border-border/70 p-3 text-xs leading-relaxed text-muted-foreground">
                  No hay acciones directas habilitadas para este estado. Podés revisar los datos y continuar la gestión interna.
                </p>
              )}
            </CardContent>
          </Card>

          <Accordion
            type="multiple"
            value={openSections}
            onValueChange={setOpenSections}
            className="space-y-2"
          >
            <AccordionItem value="vecino" className="rounded-xl border border-border/70 bg-background px-4">
              <AccordionTrigger className="gap-3 py-3 text-left hover:no-underline">
                <span className="flex min-w-0 items-center gap-3">
                  <IdentityAvatar
                    name={displayName || personal.telefono || personal.email || `Ticket ${ticket.id}`}
                    avatarUrl={neighborAvatarUrl}
                    source={neighborAvatarSource}
                    consented={neighborAvatar.consented}
                    size="sm"
                    className="h-9 w-9 shrink-0 text-xs"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">Datos del {contactRoleLabel.toLowerCase()}</span>
                    <span className="ticket-inspector__copy block text-xs font-normal text-muted-foreground">
                      {displayName || 'Contacto sin nombre'} · {channelLabel}
                    </span>
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionContent className="pb-4 pt-1">
                <div className="space-y-3" data-testid="ticket-operator-contact-card">
                  <div className="ticket-inspector__data-grid">
                    <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                      <p className="text-xs text-muted-foreground">Nombre</p>
                      <p className="mt-1 break-words text-sm font-medium">{personal.nombre || 'No informado'}</p>
                    </div>
                    <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                      <p className="text-xs text-muted-foreground">DNI</p>
                      <p className="mt-1 break-words text-sm font-medium">{personal.dni || 'No informado'}</p>
                    </div>
                    <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                      <p className="text-xs text-muted-foreground">Teléfono</p>
                      <p className="mt-1 break-all text-sm font-medium">{personal.telefono || 'No informado'}</p>
                    </div>
                    <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                      <p className="text-xs text-muted-foreground">Email</p>
                      <p className="mt-1 break-all text-sm font-medium">{personal.email || 'No informado'}</p>
                    </div>
                  </div>

                  <div className="ticket-inspector__contact-action-grid">
                    {phoneHref ? (
                      <Button asChild variant="outline" size="sm" className="gap-2">
                        <a href={phoneHref} target="_blank" rel="noreferrer">
                          <span className="flex h-4 w-4 items-center justify-center text-green-500"><FaWhatsapp /></span>
                          WhatsApp
                        </a>
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" className="gap-2" disabled>
                        <span className="flex h-4 w-4 items-center justify-center"><FaWhatsapp /></span>
                        WhatsApp
                      </Button>
                    )}
                    {phoneDigits ? (
                      <Button asChild variant="outline" size="sm">
                        <a href={`tel:+${phoneDigits}`}>Llamar</a>
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" disabled>Llamar</Button>
                    )}
                    {emailHref ? (
                      <Button asChild variant="outline" size="sm" className="gap-2">
                        <a href={emailHref}><Mail className="h-4 w-4" aria-hidden="true" />Email</a>
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" className="gap-2" disabled>
                        <Mail className="h-4 w-4" aria-hidden="true" />Email
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="gap-2"
                      onClick={() => copyToClipboard(
                        [displayName, personal.telefono, personal.email, personal.direccion].filter(Boolean).join(' - '),
                        'Contacto',
                      )}
                      disabled={!hasContactCopyTarget}
                    >
                      <Copy className="h-4 w-4" aria-hidden="true" />Copiar
                    </Button>
                  </div>

                  {contactActionBlockers.length ? (
                    <div
                      className="rounded-lg border border-amber-500/25 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-800 dark:text-amber-200"
                      data-testid="crm-contact-action-blockers"
                    >
                      {contactActionBlockers.map((reason) => <p key={reason}>{reason}</p>)}
                    </div>
                  ) : null}
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="ubicacion" className="rounded-xl border border-border/70 bg-background px-4">
              <AccordionTrigger className="gap-3 py-3 text-left hover:no-underline">
                <span className="flex min-w-0 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <MapPin className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">Ubicación del reclamo</span>
                    <span className="ticket-inspector__copy block text-xs font-normal text-muted-foreground">
                      {personal.direccion || 'Sin dirección informada'}
                    </span>
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionContent className="space-y-3 pb-4 pt-1">
                <div className="ticket-inspector__location-row rounded-lg border border-border/60 bg-muted/20 p-3">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Dirección registrada</p>
                    <p className="mt-1 break-words text-sm font-medium">{personal.direccion || 'No informada'}</p>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={openGoogleMaps} disabled={!hasAddress} className="gap-2">
                    <MapPin className="h-4 w-4" aria-hidden="true" />Abrir mapa
                  </Button>
                </div>
                <TicketLogisticsSummary
                  ticket={locationTicket || ticket}
                  statusOverride={currentStatus}
                  historyOverride={timelineHistory}
                  onOpenMap={openGoogleMaps}
                />
                {specialContact ? (
                  <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-sm">
                    <p className="mb-1 font-semibold">Contacto sugerido</p>
                    {renderSpecialContact()}
                  </div>
                ) : null}
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="archivos" className="rounded-xl border border-border/70 bg-background px-4">
              <AccordionTrigger className="gap-3 py-3 text-left hover:no-underline">
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">Adjuntos y evidencia</span>
                  <span className="block text-xs font-normal text-muted-foreground">
                    {attachments.length + (standalonePrimaryImageUrl ? 1 : 0)}{' '}
                    {attachments.length + (standalonePrimaryImageUrl ? 1 : 0) === 1 ? 'archivo' : 'archivos'}
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pb-4 pt-1">
                {attachments.length ? <TicketAttachments attachments={attachments} /> : null}
                {standalonePrimaryImageUrl ? (
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
                            src={standalonePrimaryImageUrl}
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
                ) : null}
                {!attachments.length && !standalonePrimaryImageUrl ? (
                  <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                    Este caso no tiene adjuntos registrados.
                  </p>
                ) : null}
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="historial" className="rounded-xl border border-border/70 bg-background px-4">
              <AccordionTrigger className="py-3 text-left hover:no-underline">
                <span>
                  <span className="block text-sm font-semibold">Historial y asignación</span>
                  <span className="block text-xs font-normal text-muted-foreground">Seguimiento interno del caso</span>
                </span>
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pb-4 pt-1">
                <TicketAssignment />
                {ticket.assignedAgent ? (
                  <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-muted/20 p-3 text-sm">
                    <User className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    <span>Agente asignado: {ticket.assignedAgent.nombre_usuario}</span>
                  </div>
                ) : null}
                <TicketTimeline
                  history={timelineHistory}
                  messages={timelineMessages}
                  ticket={ticket}
                />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="interno" className="rounded-xl border border-border/70 bg-background px-4">
              <AccordionTrigger className="py-3 text-left hover:no-underline">
                <span>
                  <span className="block text-sm font-semibold">Herramientas internas</span>
                  <span className="block text-xs font-normal text-muted-foreground">IA, acciones adicionales y datos técnicos</span>
                </span>
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pb-4 pt-1">
                <AiAssistPanel ticket={ticket} />

                {aiHandoffActions.length || handoffState ? (
                  <TicketAiHandoffControl
                    ticketId={String(ticket.id)}
                    tenantSlug={ticket.tenant_slug}
                    handoff={handoffState}
                    actions={aiHandoffActions}
                    onActionComplete={refreshTicketAfterHandoff}
                  />
                ) : null}

                {additionalResolutionActions.length ? (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-foreground">Más acciones permitidas</p>
                    <div className="ticket-inspector__secondary-action-grid">
                      {additionalResolutionActions.map((action, index) => {
                        const canOpen = Boolean(action.href && !action.disabled);
                        return (
                          <div key={`${action.id}-${action.href || index}`} className="space-y-1">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="ticket-inspector__action-button w-full justify-between gap-2"
                              disabled={!canOpen}
                              onClick={() => (action.href ? openActionHref(action.href) : undefined)}
                            >
                              <span>{action.label}</span>
                              <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            </Button>
                            {action.disabledReason ? (
                              <p className="text-[11px] text-amber-700 dark:text-amber-300">{action.disabledReason}</p>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-sm" data-testid="ticket-technical-details">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Datos técnicos
                  </p>
                  <dl className="ticket-inspector__technical-grid">
                    <div>
                      <dt className="text-xs text-muted-foreground">Número de caso</dt>
                      <dd className="break-all font-mono text-xs">{ticket.nro_ticket || 'No asignado'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">ID interno</dt>
                      <dd className="break-all font-mono text-xs">{ticket.id}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Creado</dt>
                      <dd>{formatDate(ticket.fecha)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Canal</dt>
                      <dd>{channelLabel}</dd>
                    </div>
                    {assistedContext.trackingCode ? (
                      <div>
                        <dt className="text-xs text-muted-foreground">Código de seguimiento</dt>
                        <dd className="break-all font-mono text-xs">{assistedContext.trackingCode}</dd>
                      </div>
                    ) : null}
                    {ticket.priority_score !== null && ticket.priority_score !== undefined ? (
                      <div>
                        <dt className="text-xs text-muted-foreground">Puntaje de prioridad</dt>
                        <dd>{ticket.priority_score}</dd>
                      </div>
                    ) : null}
                  </dl>
                  {ticket.priority_breakdown && typeof ticket.priority_breakdown === 'object' ? (
                    <div className="ticket-inspector__priority-grid mt-3">
                      {Object.entries(ticket.priority_breakdown)
                        .filter(([, value]) => value !== null && value !== undefined && value !== '')
                        .map(([label, value]) => (
                          <div key={`${label}-${String(value)}`} className="rounded-md border bg-background px-3 py-2">
                            <p className="text-[11px] text-muted-foreground">{formatCompactLabel(label)}</p>
                            <p className="text-sm font-medium">{String(value)}</p>
                          </div>
                        ))}
                    </div>
                  ) : null}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {isImageModalOpen && standalonePrimaryImageUrl && !imageError ? (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
              onClick={() => setIsImageModalOpen(false)}
              role="dialog"
              aria-modal="true"
            >
              <div className="relative" onClick={(event) => event.stopPropagation()}>
                <img
                  src={standalonePrimaryImageUrl}
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
          ) : null}
        </div>
      </ScrollArea>
    </motion.aside>
  );
};

export default DetailsPanel;

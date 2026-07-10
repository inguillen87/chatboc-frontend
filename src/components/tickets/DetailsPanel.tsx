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
import { deriveAttachmentInfo } from '@/utils/attachment';
import { formatTicketStatusLabel, normalizeTicketStatus } from '@/utils/ticketStatus';
import { normalizeTicketLocation, pickFirstCoordinate } from '@/utils/location';
import { ApiError } from '@/utils/api';
import { deriveTicketOperationalGuidance } from './ticketOperationalGuidance';
import { resolveConsentedAvatar } from '@/utils/avatarConsent';

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

type OperationalAction = {
  id: string;
  label: string;
  description?: string;
  href?: string;
  disabled?: boolean;
};

const normalizeTextValue = (value: unknown): string => {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'string') return value.trim();
  return '';
};

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
      });
    });
  });

  return actions;
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
  const [openSections, setOpenSections] = React.useState<string[]>([]);

  const attachments = React.useMemo(
    () => collectAttachmentsFromTicket(ticket, timelineMessages),
    [ticket, timelineMessages]
  );
  const primaryImageUrl = React.useMemo(
    () => getPrimaryImageUrl(ticket, attachments),
    [attachments, ticket]
  );
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
  const contactRoleLabel = ticket.tipo === 'pyme' ? 'Cliente' : 'Vecino/a';
  const hasAddress = Boolean(personal.direccion || locationTicket?.latitud || locationTicket?.lat_destino);
  const hasConsentAvatar = Boolean(neighborAvatarUrl && neighborAvatar.consented);
  const contactProfileSignals = [
    { id: 'name', label: 'Nombre', ready: Boolean(displayName) },
    { id: 'phone', label: 'Telefono', ready: Boolean(personal.telefono) },
    { id: 'email', label: 'Email', ready: Boolean(personal.email) },
    { id: 'address', label: 'Ubicacion', ready: hasAddress },
    { id: 'dni', label: 'DNI', ready: Boolean(personal.dni) },
    { id: 'avatar', label: 'Avatar', ready: hasConsentAvatar },
    { id: 'channel', label: 'Canal', ready: Boolean(channelLabel) },
  ];
  const completedProfileSignals = contactProfileSignals.filter((signal) => signal.ready).length;
  const contactCompleteness = Math.round((completedProfileSignals / contactProfileSignals.length) * 100);
  const contactProfileTone =
    contactCompleteness >= 85 ? 'Perfil operativo completo' :
    contactCompleteness >= 60 ? 'Perfil util para seguimiento' :
    'Perfil incompleto';
  const avatarPolicyLabel = hasConsentAvatar ? 'Imagen real autorizada' : 'Avatar seguro por identidad';

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
  const operationalActions = React.useMemo(
    () => normalizeOperationalActions(ticket.allowed_actions, ticket.actions, ticket.next_steps),
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
  const hasOperationalSignal =
    Boolean(nextActionLabel || priorityLabel || slaLabel || assignedAgentLabel || operationalActions.length);
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
  const openActionHref = (href: string) => {
    if (!href) return;
    if (href.startsWith('/api/')) {
      toast.info('Accion disponible como endpoint JSON. Se usa dentro del panel, no como pagina.');
      return;
    }
    window.open(href, '_blank', 'noopener,noreferrer');
  };


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
      <header className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-border bg-muted/80 p-3 backdrop-blur supports-[backdrop-filter]:bg-muted/60">
        <div className="flex min-w-0 items-center gap-2">
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
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold md:text-lg">Detalle</h3>
            <p className="truncate text-xs text-muted-foreground">#{ticket.nro_ticket || ticket.id}</p>
          </div>
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
          <Card className="border-primary/20 bg-background/90 shadow-sm">
            <CardContent className="space-y-4 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <ListChecks className="h-4 w-4 text-primary" />
                    <p className="text-sm font-semibold">Que hacer ahora</p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {nextActionLabel}
                  </p>
                  <p className="line-clamp-2 text-sm font-medium text-foreground">
                    {formatCategory(ticket)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={operationalGuidance.source === 'backend' ? 'secondary' : 'outline'}>
                    {operationalGuidance.source === 'backend' ? 'Accion backend' : 'Guia operativa'}
                  </Badge>
                  {operationalGuidance.tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="capitalize">
                      {tag}
                    </Badge>
                  ))}
                  {priorityLabel ? (
                    <Badge variant="outline" className="gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      {priorityLabel}
                    </Badge>
                  ) : null}
                  {slaLabel ? (
                    <Badge variant="outline">SLA: {slaLabel}</Badge>
                  ) : null}
                  {assignedAgentLabel ? (
                    <Badge variant="secondary" className="gap-1">
                      <UserRound className="h-3 w-3" />
                      {assignedAgentLabel}
                    </Badge>
                  ) : null}
                  {!hasOperationalSignal ? (
                    <Badge variant="outline">Sin senales operativas publicadas</Badge>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Estado</p>
                  <p className="mt-1 text-sm font-medium">{currentStatusLabel}</p>
                </div>
                <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Canal</p>
                  <p className="mt-1 text-sm font-medium">{channelLabel}</p>
                </div>
                <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Creado</p>
                  <p className="mt-1 text-sm font-medium">{formatDate(ticket.fecha)}</p>
                </div>
              </div>

              {operationalActions.length ? (
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Acciones permitidas</p>
                  <div className="flex flex-wrap gap-2">
                    {operationalActions.map((action) => {
                      const canOpen = Boolean(action.href && !action.disabled);
                      return (
                        <Button
                          key={action.id}
                          type="button"
                          variant={canOpen ? 'outline' : 'secondary'}
                          size="sm"
                          className="max-w-full gap-2"
                          disabled={!canOpen}
                          title={action.description}
                          onClick={() => (action.href ? openActionHref(action.href) : undefined)}
                        >
                          <span className="truncate">{action.label}</span>
                          {action.href ? <ExternalLink className="h-3 w-3 shrink-0" /> : <CheckCircle2 className="h-3 w-3 shrink-0" />}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-border/70 p-3 text-sm text-muted-foreground">
                  Sin acciones directas publicadas. El operador puede responder, asignar o cambiar estado desde esta mesa.
                </div>
              )}
            </CardContent>
          </Card>
          {assistedContext.visible ? (
            <Card
              className="border-blue-500/25 bg-blue-500/5 shadow-sm"
              data-testid="ticket-assisted-context-card"
            >
              <CardContent className="space-y-3 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <Info className="h-4 w-4 text-blue-500" />
                      <p className="text-sm font-semibold">Solicitud asistida</p>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {assistedContext.summary || 'El sistema preparo el caso para que el equipo lo atienda sin reconstruir el contexto.'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {assistedContext.moduleLabel ? (
                      <Badge variant="secondary">{assistedContext.moduleLabel}</Badge>
                    ) : null}
                    {assistedContext.kindLabel ? (
                      <Badge variant="outline" className="capitalize">
                        {assistedContext.kindLabel}
                      </Badge>
                    ) : null}
                    {assistedContext.trackingCode ? (
                      <Badge variant="outline">#{assistedContext.trackingCode}</Badge>
                    ) : null}
                  </div>
                </div>

                {assistedContext.recommendedAction ? (
                  <div className="rounded-lg border border-border/60 bg-background/70 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      Proxima accion
                    </p>
                    <p className="mt-1 text-sm font-medium text-foreground">
                      {assistedContext.recommendedAction}
                    </p>
                  </div>
                ) : null}

                {assistedContext.channelActions.length ? (
                  <div className="flex flex-wrap gap-2">
                    {assistedContext.channelActions.map((action) => (
                      <Button
                        key={action.id}
                        type="button"
                        variant="outline"
                        size="sm"
                        className="max-w-full gap-2"
                        onClick={() => (action.href ? openActionHref(action.href) : undefined)}
                      >
                        <span className="truncate">{action.label}</span>
                        <ExternalLink className="h-3 w-3 shrink-0" />
                      </Button>
                    ))}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ) : null}
          <Card className="border-border/70 bg-background/95 shadow-sm" data-testid="ticket-operator-contact-card">
            <CardContent className="space-y-3 p-4">
              <div className="flex items-start gap-3">
                <IdentityAvatar
                  name={displayName || personal.telefono || personal.email || `Ticket ${ticket.id}`}
                  avatarUrl={neighborAvatarUrl}
                  source={neighborAvatarSource}
                  consented={neighborAvatar.consented}
                  size="lg"
                  className="h-12 w-12 flex-shrink-0 text-sm"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <p className="min-w-0 truncate text-sm font-semibold text-foreground">
                      {displayName || 'Contacto sin nombre'}
                    </p>
                    <Badge variant="outline" className="shrink-0 text-[11px]">
                      {contactRoleLabel}
                    </Badge>
                    <Badge variant={contactCompleteness >= 85 ? 'secondary' : 'outline'} className="shrink-0 text-[11px]">
                      {contactProfileTone}
                    </Badge>
                  </div>
                  <div className="mt-1 grid gap-1 text-xs text-muted-foreground">
                    <p className="truncate">
                      {personal.telefono || 'Telefono no informado'}
                    </p>
                    <p className="truncate">
                      {personal.direccion || 'Direccion no informada'}
                    </p>
                  </div>
                </div>
              </div>
              <div
                className="rounded-xl border border-border/60 bg-muted/20 p-3"
                data-testid="crm-contact-profile-summary"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      Perfil CRM
                    </p>
                    <p className="mt-1 truncate text-sm font-medium text-foreground">
                      {avatarPolicyLabel} · {channelLabel}
                    </p>
                  </div>
                  <Badge variant="secondary" className="shrink-0">
                    {contactCompleteness}% completo
                  </Badge>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-background">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${contactCompleteness}%` }}
                  />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-3">
                  {contactProfileSignals.map((signal) => (
                    <span
                      key={signal.id}
                      className={cn(
                        'inline-flex min-w-0 items-center gap-1 rounded-full border px-2 py-1',
                        signal.ready
                          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                          : 'border-border/70 bg-background/70 text-muted-foreground',
                      )}
                    >
                      {signal.ready ? (
                        <CheckCircle2 className="h-3 w-3 shrink-0" />
                      ) : (
                        <AlertTriangle className="h-3 w-3 shrink-0" />
                      )}
                      <span className="truncate">{signal.label}</span>
                    </span>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {phoneHref ? (
                  <Button asChild variant="outline" size="sm" className="h-9 gap-2">
                    <a href={phoneHref} target="_blank" rel="noreferrer">
                      <span className="flex h-4 w-4 items-center justify-center text-green-500">
                        <FaWhatsapp />
                      </span>
                      WhatsApp
                    </a>
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" className="h-9 gap-2" disabled>
                    <span className="flex h-4 w-4 items-center justify-center text-muted-foreground">
                      <FaWhatsapp />
                    </span>
                    WhatsApp
                  </Button>
                )}
                {emailHref ? (
                  <Button asChild variant="outline" size="sm" className="h-9 gap-2">
                    <a href={emailHref}>
                      <Mail className="h-4 w-4" />
                      Email
                    </a>
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" className="h-9 gap-2" disabled>
                    <Mail className="h-4 w-4" />
                    Email
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 gap-2"
                  onClick={openGoogleMaps}
                  disabled={!personal.direccion && !locationTicket?.latitud && !locationTicket?.lat_destino}
                >
                  <MapPin className="h-4 w-4" />
                  Mapa
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="h-9 gap-2"
                  onClick={() => copyToClipboard(
                    [displayName, personal.telefono, personal.email, personal.direccion]
                      .filter(Boolean)
                      .join(' - '),
                    'Contacto',
                  )}
                  disabled={!displayName && !personal.telefono && !personal.email && !personal.direccion}
                >
                  <Copy className="h-4 w-4" />
                  Copiar
                </Button>
              </div>
            </CardContent>
          </Card>
          <AiAssistPanel ticket={ticket} />
          <TicketLogisticsSummary
            ticket={locationTicket || ticket}
            statusOverride={currentStatus}
            historyOverride={timelineHistory}
            onOpenMap={openGoogleMaps}
          />

          <Accordion
            type="multiple"
            value={openSections}
            onValueChange={setOpenSections}
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
                    <span className="mt-1 flex h-4 w-4 flex-shrink-0 items-center justify-center text-green-500">
                      <FaWhatsapp />
                    </span>
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
                {(ticket.priority !== null && ticket.priority !== undefined && ticket.priority !== "") ||
                ticket.priority_score !== null ||
                (ticket.priority_breakdown && typeof ticket.priority_breakdown === 'object') ||
                ticket.recommended_next_action ? (
                  <div className="space-y-2 rounded-lg border border-border/60 bg-background/70 p-3 shadow-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      {ticket.priority !== null && ticket.priority !== undefined && ticket.priority !== "" ? (
                        <Badge variant="outline" className="capitalize">
                          Prioridad {formatCompactLabel(ticket.priority)}
                        </Badge>
                      ) : null}
                      {ticket.priority_score !== null && ticket.priority_score !== undefined ? (
                        <Badge variant="secondary">Score {ticket.priority_score}</Badge>
                      ) : null}
                    </div>
                    {ticket.priority_breakdown && typeof ticket.priority_breakdown === 'object' ? (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {Object.entries(ticket.priority_breakdown)
                          .filter(([, value]) => value !== null && value !== undefined && value !== '')
                          .map(([label, value]) => (
                            <div
                              key={`${label}-${String(value)}`}
                              className="rounded-md border border-border/50 bg-muted/30 px-3 py-2"
                            >
                              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                                {formatCompactLabel(label)}
                              </p>
                              <p className="text-sm font-medium text-foreground">{String(value)}</p>
                            </div>
                          ))}
                      </div>
                    ) : null}
                    {ticket.recommended_next_action ? (
                      <div className="space-y-1">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                          Próxima acción sugerida
                        </p>
                        <p className="text-sm text-foreground">{ticket.recommended_next_action}</p>
                      </div>
                    ) : null}
                  </div>
                ) : null}
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
                <TicketAssignment className="mt-2" />
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

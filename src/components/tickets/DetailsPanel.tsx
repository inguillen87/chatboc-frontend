import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Ticket, Message, TicketHistoryEvent } from '@/types/tickets';
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


const DetailsPanel: React.FC = () => {
  const { selectedTicket: ticket } = useTickets();
  const [isSendingEmail, setIsSendingEmail] = React.useState(false);
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
  }, [ticket]);


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
            <CardHeader className="flex flex-row items-center gap-4 p-4">
              <Avatar className="h-14 w-14">
                <AvatarImage src={ticket.avatarUrl || ticket.user?.avatarUrl} alt={displayName} />
                <AvatarFallback>{getInitials(displayName)}</AvatarFallback>
              </Avatar>
              <div>
                <h2 className={cn("text-lg font-semibold whitespace-normal break-words", !displayName && "text-muted-foreground")}> 
                  {displayName || 'No especificado'}
                </h2>
                <p className="text-xs text-muted-foreground">Vecino/a</p>
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

            {specialContact && (
              <CardContent className="p-4 text-sm border-t">
                <h4 className="font-semibold mb-2">Contacto para seguimiento</h4>
                <div className="space-y-1">
                  <p>{specialContact.nombre}</p>
                  {specialContact.titulo && <p>{specialContact.titulo}</p>}
                  {specialContact.telefono && <p>Teléfono: {specialContact.telefono}</p>}
                  {specialContact.horario && <p>Horario: {specialContact.horario}</p>}
                  {specialContact.email && <p>Email: {specialContact.email}</p>}
                </div>
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
                    <div
                      className="text-sm whitespace-pre-wrap break-words text-justify"
                      dangerouslySetInnerHTML={{ __html: (ticket.description || ticket.detalles || '—').replace(/\n/g, '<br />') }}
                    />
                  </div>
                )}
            </CardContent>

            {ticket.attachments?.length ? (
              <TicketAttachments attachments={ticket.attachments} />
            ) : null}

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
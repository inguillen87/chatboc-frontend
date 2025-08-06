import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail, Phone, MapPin, Ticket as TicketIcon, Info, FileDown, User, ExternalLink, MessageCircle, Building, Hash, Clipboard, Copy, ChevronDown, ChevronUp, UserCheck, Bot } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import TicketMap from '../TicketMap';
import { useTickets } from '@/context/TicketContext';
import { exportToPdf, exportToXlsx } from '@/services/exportService';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { FaWhatsapp } from 'react-icons/fa';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const DetailsPanel: React.FC = () => {
  const { selectedTicket: ticket } = useTickets();
  const [isDescriptionExpanded, setIsDescriptionExpanded] = React.useState(false);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast.success(`${label} copiado al portapapeles`);
    }).catch(err => {
      toast.error('Error al copiar');
      console.error('Error al copiar: ', err);
    });
  };

  const getInitials = (name: string) => {
    return name ? name.split(' ').map(n => n[0]).join('').toUpperCase() : '??';
  };

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

  const extractUserNameFromSubject = (subject: string) => {
    if (!subject) return null;

    const patterns = [
      /Solicitud de Chat en Vivo por:\s*(.*)/i,
      /Reclamo \(LLM\):\s*(.*)/i,
    ];

    for (const pattern of patterns) {
      const match = subject.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return null;
  };

  const userName =
    ticket.nombre_usuario ||
    ticket.user?.nombre_usuario ||
    extractUserNameFromSubject(ticket.asunto) ||
    'Usuario Desconocido';

  const hasLocation = ticket.direccion || (ticket.latitud && ticket.longitud);

  const handleExportPdf = () => {
    exportToPdf(ticket, ticket.messages || []);
  };

  const handleExportXlsx = () => {
    exportToXlsx(ticket, ticket.messages || []);
  };

  const openGoogleMaps = () => {
    if (!ticket) return;
    const url = ticket.latitud && ticket.longitud
      ? `https://www.google.com/maps/search/?api=1&query=${ticket.latitud},${ticket.longitud}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ticket.direccion || '')}`;
    window.open(url, '_blank');
  };

  const openWhatsApp = () => {
    const phone = ticket.telefono || ticket.user?.phone;
    if (phone) {
      const phoneNumber = phone.replace(/\D/g, '');
      window.open(`https://wa.me/${phoneNumber}`, '_blank');
    }
  };

  const userEmail = ticket.email_usuario || ticket.email || ticket.user?.email_usuario || ticket.user?.email;
  const userPhone = ticket.telefono || ticket.user?.phone;

  const formatCategory = (t: typeof ticket) => {
    if (!t?.categoria) return 'No informada';
    let base = `Reclamo por ${t.categoria}`;
    if (t.direccion) {
      base += ` en ${t.direccion}`;
    }
    return base;
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'No informado';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return 'Fecha inválida';
    }
    return date.toLocaleString();
  };

  const getCustomerInfoText = () => {
    let info = `Nombre: ${userName}\n`;
    if (userEmail) info += `Email: ${userEmail}\n`;
    if (userPhone) info += `Teléfono: ${userPhone}\n`;
    if (ticket.dni) info += `DNI: ${ticket.dni}\n`;
    if (ticket.direccion) info += `Dirección: ${ticket.direccion}\n`;
    return info;
  };

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
          </DropdownMenuContent>
        </DropdownMenu>
      </header>
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center gap-4 p-4">
              <Avatar className="h-14 w-14">
                <AvatarImage src={ticket.avatarUrl || ticket.user?.avatarUrl} alt={userName} />
                <AvatarFallback>{getInitials(userName)}</AvatarFallback>
              </Avatar>
              <div>
                <h2 className="text-lg font-bold">{userName}</h2>
                <p className="text-sm text-muted-foreground">{ticket.tipo === 'municipio' ? 'Vecino/a' : 'Cliente'}</p>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-3 text-sm border-t">
               <h4 className="font-semibold mb-2">Información de Contacto</h4>
                {userEmail && (
                    <div className="flex items-center gap-3">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <a href={`mailto:${userEmail}`} className="hover:underline">{userEmail}</a>
                    </div>
                )}
                {userPhone && (
                    <div className="flex items-center gap-3">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span>{userPhone}</span>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={openWhatsApp}>
                            <FaWhatsapp className="h-4 w-4 text-green-500" />
                        </Button>
                    </div>
                )}
                 {ticket.dni && (
                    <div className="flex items-center gap-3">
                        <Info className="h-4 w-4 text-muted-foreground" />
                        <span>DNI: {ticket.dni}</span>
                    </div>
                )}
            </CardContent>

            <CardContent className="p-4 space-y-3 text-sm border-t">
                <h4 className="font-semibold mb-2">Detalles del Ticket</h4>
                <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">ID:</span>
                    <span className="font-mono text-xs">{ticket.nro_ticket || 'N/A'}</span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Estado:</span>
                    <Badge variant="outline" className="capitalize">{ticket.estado || 'N/A'}</Badge>
                </div>
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
                {ticket.description && (
                    <div className="space-y-1">
                        <span className="text-muted-foreground">Descripción:</span>
                        <p className={cn("text-sm", !isDescriptionExpanded && "line-clamp-3")}>
                            {ticket.description}
                        </p>
                        {ticket.description.length > 150 && (
                            <Button variant="link" className="p-0 h-auto text-xs" onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}>
                                {isDescriptionExpanded ? 'Ver menos' : 'Ver más'}
                            </Button>
                        )}
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

          </Card>
        </div>
      </ScrollArea>
    </motion.aside>
  );
};

export default DetailsPanel;

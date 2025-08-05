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

  const formatCategory = (ticket: any) => {
    if (!ticket.categoria) return 'No informada';
    let base = `Reclamo por ${ticket.categoria}`;
    if (ticket.direccion) {
      base += ` en ${ticket.direccion}`;
    }
    return base;
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
        <h3 className="font-semibold">Detalles del Cliente</h3>
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
        <div className="p-6 space-y-6">
          {/* User Details */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between p-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={ticket.avatarUrl || ticket.user?.avatarUrl} alt={userName} />
                  <AvatarFallback>{getInitials(userName)}</AvatarFallback>
                </Avatar>
                <div>
                  <h2 className="text-xl font-bold">{userName}</h2>
                  <p className="text-sm text-muted-foreground">{ticket.tipo === 'municipio' ? 'Vecino/a' : 'Cliente'}</p>
                  {ticket.estado_cliente && <Badge variant="secondary" className="mt-1">{ticket.estado_cliente}</Badge>}
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => copyToClipboard(getCustomerInfoText(), 'Datos del cliente')}>
                <Copy className="h-5 w-5" />
              </Button>
            </CardHeader>
            <CardContent className="p-4 space-y-4 text-sm">
              {userEmail ? (
                <div className="flex items-start gap-3">
                  <Mail className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <a href={`mailto:${userEmail}`} className="hover:underline">{userEmail}</a>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <Mail className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <span>No informado</span>
                </div>
              )}
              {userPhone ? (
                <div className="flex items-start gap-3">
                  <Phone className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div className="flex items-center justify-between w-full">
                    <span>{userPhone}</span>
                    <Button variant="ghost" size="icon" onClick={openWhatsApp}>
                      <FaWhatsapp className="h-5 w-5 text-green-500" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <Phone className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <span>No informado</span>
                </div>
              )}
              {ticket.dni && (
                <div className="flex items-start gap-3">
                  <Info className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <span>DNI: {ticket.dni}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Address */}
          {ticket.direccion && (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center justify-between text-base">
                        <div className="flex items-center gap-2">
                            <MapPin className="h-5 w-5" />
                            Dirección
                        </div>
                        <Button variant="ghost" size="icon" onClick={openGoogleMaps}>
                            <ExternalLink className="h-4 w-4" />
                        </Button>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-lg font-semibold text-primary">{ticket.direccion}</p>
                </CardContent>
            </Card>
          )}

          {/* Ticket Description */}
          {ticket.description && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Descripción del Reclamo</span>
                  <Button variant="ghost" size="icon" onClick={() => copyToClipboard(ticket.description || '', 'Descripción')}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground space-y-2">
                  <p className={cn(!isDescriptionExpanded && "line-clamp-4")}>
                    {ticket.description}
                  </p>
                  {ticket.description.length > 200 && (
                     <Button variant="link" className="p-0 h-auto" onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}>
                      {isDescriptionExpanded ? 'Ver menos' : 'Ver más'}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Location Map */}
          {hasLocation && !ticket.direccion && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Ubicación
                  <Button variant="ghost" size="icon" onClick={openGoogleMaps}>
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <TicketMap ticket={ticket} />
              </CardContent>
            </Card>
          )}

          {/* Ticket Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><TicketIcon className="h-5 w-5" /> Info del Ticket</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">ID:</span>
                <span className="font-mono">{ticket.nro_ticket || 'No informado'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Canal:</span>
                <span className="capitalize">{ticket.channel || 'No informado'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Estado:</span>
                <Badge variant="outline" className="capitalize">{ticket.estado || 'No informado'}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Creado:</span>
                <span>{new Date(ticket.fecha).toLocaleString() || 'No informado'}</span>
              </div>
              <div className="space-y-1">
                 <span className="text-muted-foreground">Categoría:</span>
                 <p className="font-semibold">{formatCategory(ticket)}</p>
              </div>
            </CardContent>
          </Card>

          {/* Assigned Agent */}
          {ticket.assignedAgent && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserCheck className="h-5 w-5" />
                  <span>Agente Asignado</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                 <div className="flex items-start gap-3">
                    <User className="h-4 w-4 mt-0.5 text-muted-foreground" />
                    <span>{ticket.assignedAgent.nombre_usuario}</span>
                 </div>
                {ticket.assignedAgent.email && (
                  <div className="flex items-start gap-3">
                    <Mail className="h-4 w-4 mt-0.5 text-muted-foreground" />
                    <a href={`mailto:${ticket.assignedAgent.email}`} className="hover:underline">{ticket.assignedAgent.email}</a>
                  </div>
                )}
                {ticket.assignedAgent.phone && (
                  <div className="flex items-start gap-3">
                    <Phone className="h-4 w-4 mt-0.5 text-muted-foreground" />
                    <div className="flex items-center justify-between w-full">
                      <span>{ticket.assignedAgent.phone}</span>
                       <Button variant="ghost" size="icon" onClick={() => window.open(`https://wa.me/${ticket.assignedAgent?.phone?.replace(/\D/g, '')}`, '_blank')}>
                        <FaWhatsapp className="h-5 w-5 text-green-500" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

        </div>
      </ScrollArea>
    </motion.aside>
  );
};

export default DetailsPanel;

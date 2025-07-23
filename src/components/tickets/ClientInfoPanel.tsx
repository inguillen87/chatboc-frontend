import React, { useMemo, useState } from 'react';
import { Ticket, Comment } from '@/pages/TicketsPanel';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { User, Mail, Phone, MapPin, FileText, Clock, ShieldCheck, MessageSquare } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useDateSettings } from '@/hooks/useDateSettings';
import { formatDate } from '@/utils/fecha';
import { formatPhoneNumberForWhatsApp } from '@/utils/phoneUtils';
import { useUser } from '@/hooks/useUser';
import AttachmentPreview, { deriveAttachmentInfo } from '@/components/chat/AttachmentPreview';
import { GoogleMap, useJsApiLoader, Marker } from '@react-google-maps/api';

interface ClientInfoPanelProps {
  ticket: Ticket;
}

const TicketTimeline: React.FC<{ ticket: Ticket; comentarios: Comment[] }> = ({ ticket, comentarios }) => {
    const { timezone, locale } = useDateSettings();
    const eventos = useMemo(() => [
        { fecha: ticket.fecha, descripcion: "Ticket creado", esAdmin: false },
        ...(comentarios || []).map((c) => ({
            fecha: c.fecha,
            descripcion: c.es_admin ? "Respuesta de Chatboc" : "Comentario de usuario",
            esAdmin: c.es_admin,
        })),
    ].sort((a,b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime()), [ticket.fecha, comentarios]);

    return (
        <ol className="relative border-l border-border dark:border-slate-700 ml-1">
            {eventos.map((ev, i) => (
                <li key={i} className="mb-3 ml-4">
                    <div className={cn("absolute w-3 h-3 rounded-full mt-1.5 -left-1.5 border border-white dark:border-slate-800", ev.esAdmin ? "bg-primary" : "bg-muted-foreground/50")} />
                    <time className="text-xs font-normal leading-none text-muted-foreground/80">{formatDate(ev.fecha, timezone, locale)}</time>
                    <p className="text-sm font-medium text-foreground whitespace-pre-wrap break-words">{ev.descripcion}</p>
                </li>
            ))}
        </ol>
    );
};

const containerStyle = {
  width: '100%',
  height: '200px'
};

const ClientInfoPanel: React.FC<ClientInfoPanelProps> = ({ ticket }) => {
    const { user } = useUser();
    const { timezone, locale } = useDateSettings();
    const { isLoaded } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY
    });

    const center = {
        lat: ticket.latitud || -34.397,
        lng: ticket.longitud || -58.644
    };

    return (
        <ScrollArea className="h-full bg-card/50 dark:bg-slate-800/50 border-l p-4">
            <div className="space-y-4">
                <Card>
                    <CardHeader className="flex flex-row items-center space-x-4 pb-4">
                        <Avatar className="h-16 w-16">
                            <AvatarImage src={ticket.municipio_nombre ? '/logo/chatboc_logo_original.png' : '/favicon/human-avatar.svg'} />
                            <AvatarFallback>{ticket.nombre_usuario?.charAt(0).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div>
                            <CardTitle>{ticket.nombre_usuario}</CardTitle>
                            <p className="text-sm text-muted-foreground">{ticket.tipo}</p>
                        </div>
                    </CardHeader>
                </Card>

                <Accordion type="multiple" defaultValue={['user-info', 'ticket-details']}>
                    <AccordionItem value="user-info">
                        <AccordionTrigger className="text-base font-semibold">Información del Usuario</AccordionTrigger>
                        <AccordionContent className="text-sm space-y-3 pt-2">
                            <div className="flex items-center"><Mail className="h-4 w-4 mr-3" /><span>{ticket.email_usuario || 'No disponible'}</span></div>
                            <div className="flex items-center"><Phone className="h-4 w-4 mr-3" /><span>{ticket.telefono || 'No disponible'}</span>
                                {ticket.telefono && formatPhoneNumberForWhatsApp(ticket.telefono) && (
                                    <a href={`https://wa.me/${formatPhoneNumberForWhatsApp(ticket.telefono)}`} target="_blank" rel="noopener noreferrer" className="ml-auto">
                                        <MessageSquare className="h-4 w-4 text-green-500" />
                                    </a>
                                )}
                            </div>
                            <div className="flex items-center"><MapPin className="h-4 w-4 mr-3" /><span>{ticket.direccion || 'No disponible'}</span></div>
                        </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="ticket-details">
                        <AccordionTrigger className="text-base font-semibold">Detalles del Ticket</AccordionTrigger>
                        <AccordionContent className="text-sm space-y-3 pt-2">
                            <p><strong>Asunto:</strong> {ticket.asunto}</p>
                            <p><strong>Categoría:</strong> {ticket.categoria || "No especificada"}</p>
                            <p><strong>Estado:</strong> <Badge variant="outline" className={cn((ticket.estado && `bg-${ticket.estado}-100 text-${ticket.estado}-800`), "text-xs")}>{ticket.estado}</Badge></p>
                            <p><strong>Prioridad:</strong> {ticket.priority || 'No asignada'}</p>
                            <p><strong>Creado:</strong> {formatDate(ticket.fecha, timezone, locale, { dateStyle: 'medium', timeStyle: 'short' })}</p>
                        </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="description">
                        <AccordionTrigger className="text-base font-semibold">Descripción</AccordionTrigger>
                        <AccordionContent className="text-sm whitespace-pre-wrap break-words pt-2">
                            {ticket.detalles || "No hay descripción detallada."}
                        </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="attachments">
                        <AccordionTrigger className="text-base font-semibold">Adjuntos</AccordionTrigger>
                        <AccordionContent className="pt-2 space-y-2">
                            {ticket.archivo_url ? (
                                <AttachmentPreview attachment={deriveAttachmentInfo(ticket.archivo_url)} />
                            ) : (<p className="text-sm text-muted-foreground">No hay archivos adjuntos.</p>)}
                        </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="location">
                        <AccordionTrigger className="text-base font-semibold">Ubicación</AccordionTrigger>
                        <AccordionContent className="pt-2">
                            {isLoaded ? (
                                <div className="w-full rounded-md overflow-hidden aspect-video border">
                                    <GoogleMap mapContainerStyle={containerStyle} center={center} zoom={15}>
                                        {ticket.latitud && ticket.longitud && <Marker position={center} />}
                                    </GoogleMap>
                                </div>
                            ) : <p>Cargando mapa...</p>}
                        </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="history">
                        <AccordionTrigger className="text-base font-semibold">Historial</AccordionTrigger>
                        <AccordionContent className="pt-2">
                            <TicketTimeline ticket={ticket} comentarios={ticket.comentarios || []} />
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            </div>
        </ScrollArea>
    );
};

export default ClientInfoPanel;

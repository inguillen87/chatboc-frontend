import React from 'react';
import { Ticket } from '@/types/tickets';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { User, Mail, Phone, MapPin, FileText, Clock, ShieldCheck, MessageSquare, AlertTriangle } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useDateSettings } from '@/hooks/useDateSettings';
import { formatDate } from '@/utils/fecha';
import { formatPhoneNumberForWhatsApp } from '@/utils/phoneUtils';
import AttachmentPreview from '@/components/chat/AttachmentPreview';
import { deriveAttachmentInfo } from '@/utils/attachment';
import { GoogleMap, useJsApiLoader, Marker } from '@react-google-maps/api';
import { Skeleton } from '@/components/ui/skeleton';

interface ClientInfoPanelProps {
  ticket: Ticket;
}

const InfoRow: React.FC<{ icon: React.ElementType; label: string; value?: string | null; action?: React.ReactNode }> = ({ icon: Icon, label, value, action }) => (
    <div className="flex items-center text-sm py-2">
        <Icon className="h-4 w-4 mr-3 text-muted-foreground flex-shrink-0" />
        <span className="font-medium text-muted-foreground">{label}</span>
        <span className="text-right flex-1 truncate ml-2" title={value || ''}>{value || 'No disponible'}</span>
        {action && <div className="ml-2">{action}</div>}
    </div>
);

const MapFallback: React.FC = () => (
    <div className="w-full aspect-video border rounded-md flex flex-col items-center justify-center bg-muted">
        <MapPin className="h-8 w-8 text-muted-foreground/50 mb-2" />
        <p className="text-sm text-muted-foreground">No se pudo cargar el mapa</p>
        <p className="text-xs text-muted-foreground/80">Verifique la API Key de Google Maps.</p>
    </div>
);

const MapComponent: React.FC<{ ticket: Ticket }> = ({ ticket }) => {
    const { isLoaded, loadError } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ""
    });

    const center = {
        lat: ticket.latitud || 0,
        lng: ticket.longitud || 0
    };

    if (loadError) return <MapFallback />;
    if (!isLoaded) return <Skeleton className="w-full h-[200px] rounded-md" />;
    if (!ticket.latitud || !ticket.longitud) return (
        <div className="w-full aspect-video border rounded-md flex items-center justify-center bg-muted">
            <p className="text-sm text-muted-foreground">Ubicación no proporcionada.</p>
        </div>
    );

    return (
        <div className="w-full rounded-md overflow-hidden aspect-video border">
            <GoogleMap mapContainerStyle={{ width: '100%', height: '100%' }} center={center} zoom={15}>
                <Marker position={center} />
            </GoogleMap>
        </div>
    );
};


const ClientInfoPanel: React.FC<ClientInfoPanelProps> = ({ ticket }) => {
    const { timezone, locale } = useDateSettings();

    return (
        <ScrollArea className="h-full bg-card/50 dark:bg-slate-800/50 border-l">
            <div className="p-4 space-y-4">
                <Card>
                    <CardHeader className="text-center items-center pt-6">
                        <Avatar className="h-20 w-20 mb-2">
                            <AvatarImage src={'/favicon/human-avatar.svg'} />
                            <AvatarFallback>{ticket.nombre_usuario?.charAt(0).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <CardTitle className="text-lg">{ticket.nombre_usuario}</CardTitle>
                        <p className="text-sm text-muted-foreground">{ticket.tipo === 'pyme' ? 'Cliente Pyme' : 'Ciudadano'}</p>
                    </CardHeader>
                    <CardContent className="divide-y">
                        <InfoRow icon={Mail} label="Email" value={ticket.email_usuario} />
                        <InfoRow
                            icon={Phone}
                            label="Teléfono"
                            value={ticket.telefono}
                            action={ticket.telefono && formatPhoneNumberForWhatsApp(ticket.telefono) && (
                                <a href={`https://wa.me/${formatPhoneNumberForWhatsApp(ticket.telefono)}`} target="_blank" rel="noopener noreferrer">
                                    <MessageSquare className="h-5 w-5 text-green-500 hover:text-green-600" />
                                </a>
                            )}
                        />
                        <InfoRow icon={MapPin} label="Dirección" value={ticket.direccion} />
                    </CardContent>
                </Card>

                <Accordion type="multiple" defaultValue={['ticket-details', 'location']} className="w-full">
                    <AccordionItem value="ticket-details">
                        <AccordionTrigger className="text-base font-semibold">Detalles del Ticket</AccordionTrigger>
                        <AccordionContent className="divide-y">
                            <InfoRow icon={FileText} label="Asunto" value={ticket.asunto} />
                            <InfoRow icon={FileText} label="Categoría" value={ticket.categoria} />
                            <InfoRow icon={Clock} label="Creado" value={formatDate(ticket.fecha, timezone, locale, { dateStyle: 'medium', timeStyle: 'short' })} />
                            <InfoRow icon={AlertTriangle} label="Prioridad" value={ticket.priority || 'No asignada'} />
                        </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="attachments">
                        <AccordionTrigger className="text-base font-semibold">Adjuntos</AccordionTrigger>
                        <AccordionContent className="pt-2 space-y-2">
                            {ticket.archivo_url ? (
                                <AttachmentPreview attachment={deriveAttachmentInfo(ticket.archivo_url)} />
                            ) : (<p className="text-sm text-muted-foreground p-2">No hay archivos adjuntos.</p>)}
                        </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="location">
                        <AccordionTrigger className="text-base font-semibold">Ubicación</AccordionTrigger>
                        <AccordionContent className="pt-2">
                           <MapComponent ticket={ticket} />
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            </div>
        </ScrollArea>
    );
};

export default ClientInfoPanel;

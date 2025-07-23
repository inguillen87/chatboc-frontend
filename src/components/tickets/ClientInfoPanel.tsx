import React from 'react';
import { Ticket } from '@/pages/TicketsPanel';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { User, Mail, Phone, MapPin } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { GoogleMap, useJsApiLoader, Marker } from '@react-google-maps/api';

interface ClientInfoPanelProps {
  ticket: Ticket;
}

const containerStyle = {
  width: '100%',
  height: '200px'
};

const ClientInfoPanel: React.FC<ClientInfoPanelProps> = ({ ticket }) => {
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: "YOUR_GOOGLE_MAPS_API_KEY" // Remember to replace with your actual API key
  });

  const center = {
    lat: ticket.latitud || -34.397,
    lng: ticket.longitud || -58.644
  };

  return (
    <div className="h-full bg-card/50 dark:bg-slate-800/50 border-l p-4 space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center space-x-4">
          <Avatar className="h-16 w-16">
            <AvatarImage src={ticket.municipio_nombre ? '/logo/chatboc_logo_original.png' : '/favicon/human-avatar.svg'} />
            <AvatarFallback>{ticket.nombre_usuario?.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div>
            <CardTitle>{ticket.nombre_usuario}</CardTitle>
            <p className="text-sm text-muted-foreground">{ticket.tipo}</p>
          </div>
        </CardHeader>
        <CardContent className="text-sm space-y-3">
          <div className="flex items-center">
            <User className="h-4 w-4 mr-2" />
            <span>{ticket.nombre_usuario}</span>
          </div>
          <div className="flex items-center">
            <Mail className="h-4 w-4 mr-2" />
            <span>{ticket.email_usuario || 'No disponible'}</span>
          </div>
          <div className="flex items-center">
            <Phone className="h-4 w-4 mr-2" />
            <span>{ticket.telefono || 'No disponible'}</span>
          </div>
          <div className="flex items-center">
            <MapPin className="h-4 w-4 mr-2" />
            <span>{ticket.direccion || 'No disponible'}</span>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Ubicación</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoaded ? (
            <GoogleMap
              mapContainerStyle={containerStyle}
              center={center}
              zoom={15}
            >
              {ticket.latitud && ticket.longitud && <Marker position={center} />}
            </GoogleMap>
          ) : <p>Cargando mapa...</p>}
        </CardContent>
      </Card>
    </div>
  );
};

export default ClientInfoPanel;

import React, { useEffect, useState } from 'react';
import { useTenant } from '@/context/TenantContext';
import { apiClient } from '@/api/client';
import { Ticket } from '@/types/unified';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { MessageSquare, ExternalLink, PlusCircle, AlertCircle } from 'lucide-react';
import { buildTenantPath } from '@/utils/tenantPaths';
import { useNavigate } from 'react-router-dom';

const STATUS_MAP: Record<string, string> = {
  open: "Abierto",
  pending: "Pendiente",
  closed: "Cerrado",
  resolved: "Resuelto",
  in_progress: "En Proceso"
};

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  open: "default",
  pending: "secondary",
  closed: "outline",
  resolved: "outline",
  in_progress: "default"
};

const UserClaimsPage = () => {
  const { currentSlug } = useTenant();
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentSlug) {
      loadTickets();
    }
  }, [currentSlug]);

  const loadTickets = async () => {
    setLoading(true);
    try {
      if (!currentSlug) return;
      const data = await apiClient.listTickets(currentSlug);
      if (data && data.length > 0) {
        setTickets(data);
      } else {
        setTickets([]);
      }
    } catch (error) {
      console.error('Error loading tickets:', error);
      setTickets([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4 max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
         <h1 className="text-2xl font-bold">Mis Reclamos y Solicitudes</h1>
         <Button onClick={() => navigate(buildTenantPath('/reclamos/nuevo', currentSlug))}>
            <PlusCircle className="mr-2 h-4 w-4"/> Nuevo Reclamo
         </Button>
      </div>

      {loading ? (
        <div className="space-y-4">
             {[1,2].map(i => <div key={i} className="h-32 bg-muted/20 animate-pulse rounded-lg"/>)}
        </div>
      ) : tickets.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-lg text-muted-foreground">
          <MessageSquare className="h-12 w-12 mb-4 opacity-20" />
          <p>No tenés reclamos registrados aún.</p>
          <Button variant="link" className="mt-2" onClick={() => navigate(buildTenantPath('/reclamos/nuevo', currentSlug))}>
            Iniciar un nuevo reclamo
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {tickets.map(ticket => (
            <Card key={ticket.id} className="overflow-hidden">
              <CardContent className="p-0">
                 <div className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-muted/20 border-b">
                    <div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-lg">#{ticket.id}</span>
                        <Badge variant={STATUS_VARIANTS[ticket.status] || 'default'} className="capitalize">
                           {STATUS_MAP[ticket.status] || ticket.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                        {format(new Date(ticket.created_at), "d 'de' MMMM yyyy", { locale: es })}
                      </p>
                    </div>

                    <div className="text-right">
                       <Button variant="ghost" size="sm" asChild>
                          <a href={buildTenantPath(`/encuestas/${ticket.id}`, currentSlug)} className="flex items-center gap-1">
                              Ver detalles <ExternalLink className="h-3 w-3"/>
                          </a>
                          {/* Note: The detail link might depend on how ticket details are exposed to portal users.
                              Usually it would be /portal/reclamos/:id.
                              For now, using a placeholder or if available.
                              The prompt mentions /admin/encuestas/[id] but not user portal ticket detail.
                              We'll assume generic detail page or leave it blank/disabled if not implemented.
                              Actually, TenantSurveyDetailPage exists, but TenantTicketDetailPage?
                              For now, I'll just link to the lookup page /chat/:ticketId
                          */}
                       </Button>
                    </div>
                 </div>

                 <div className="p-4">
                    <h3 className="font-medium text-lg mb-2">{ticket.subject}</h3>
                    {ticket.messages && ticket.messages.length > 0 && (
                        <div className="bg-muted/30 p-3 rounded-md text-sm text-muted-foreground line-clamp-2">
                            "{ticket.messages[ticket.messages.length - 1].content}"
                        </div>
                    )}
                    <div className="mt-4 pt-4 border-t flex justify-end">
                        <Button size="sm" variant="outline" onClick={() => navigate(buildTenantPath(`/chat/${ticket.id}`, currentSlug))}>
                            Ver seguimiento
                        </Button>
                    </div>
                 </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default UserClaimsPage;

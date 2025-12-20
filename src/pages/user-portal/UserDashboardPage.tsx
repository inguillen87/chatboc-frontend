import React, { useEffect, useState } from 'react';
import { useTenant } from '@/context/TenantContext';
import { apiClient } from '@/api/client';
import { PortalContent } from '@/types/unified';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, ShoppingBag, Star, Calendar } from 'lucide-react';
import { Link } from 'react-router-dom';

const UserDashboardPage = () => {
  const { currentSlug, tenant } = useTenant();
  const [content, setContent] = useState<PortalContent | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentSlug) {
      loadContent();
    }
  }, [currentSlug]);

  const loadContent = async () => {
    setLoading(true);
    try {
      if (!currentSlug) return;
      const data = await apiClient.getPortalContent(currentSlug);
      setContent(data);
    } catch (error) {
      console.error('Error loading portal content:', error);
      // Fallback mock data
      setContent({
        news: [
            { id: 1, title: 'Bienvenido al Portal', summary: 'Gestioná tus interacciones desde aquí.' }
        ],
        events: [],
        notifications: [
            { id: 101, message: 'Tu pedido #1234 está en camino', read: false }
        ]
      });
    } finally {
      setLoading(false);
    }
  };

  const isPyme = tenant?.tipo !== 'municipio';

  if (loading) return <div className="p-8">Cargando...</div>;

  return (
    <div className="container mx-auto p-4 max-w-5xl space-y-6">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Hola, Bienvenido</h1>
          <p className="text-muted-foreground">
            {isPyme ? 'Tu panel de cliente' : 'Tu portal ciudadano'}
          </p>
        </div>
        <div className="flex gap-2">
           <Button asChild variant="outline">
             <Link to={`/${currentSlug}/${isPyme ? 'productos' : 'tramites'}`}>
               {isPyme ? 'Ver Catálogo' : 'Iniciar Trámite'}
             </Link>
           </Button>
        </div>
      </header>

      {/* Notifications Section */}
      {content?.notifications && content.notifications.length > 0 && (
        <Card className="border-l-4 border-l-primary">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Notificaciones Recientes</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {content.notifications.map((notif: any) => (
                <li key={notif.id} className="flex justify-between items-center p-2 bg-muted/20 rounded">
                  <span>{notif.message}</span>
                  {!notif.read && <Badge variant="secondary">Nuevo</Badge>}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

        {/* Main Action Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5" />
              <CardTitle>{isPyme ? 'Mis Pedidos' : 'Mis Reclamos'}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Revisá el estado de tus {isPyme ? 'compras' : 'solicitudes'} recientes.
            </p>
            <Button asChild className="w-full">
              <Link to={`/portal/${isPyme ? 'pedidos' : 'reclamos'}`}>Ver Historial</Link>
            </Button>
          </CardContent>
        </Card>

        {/* Loyalty / Benefits */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Star className="h-5 w-5 text-yellow-500" />
              <CardTitle>Beneficios</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-center py-2">
               <span className="text-4xl font-bold">120</span>
               <p className="text-sm text-muted-foreground">Puntos acumulados</p>
            </div>
            <Button asChild variant="outline" className="w-full mt-2">
              <Link to="/portal/beneficios">Canjear</Link>
            </Button>
          </CardContent>
        </Card>

        {/* News / Events */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              <CardTitle>Novedades</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
             {content?.news && content.news.length > 0 ? (
               <div className="space-y-3">
                 {content.news.slice(0, 2).map((item: any) => (
                   <div key={item.id}>
                     <h4 className="font-semibold text-sm">{item.title}</h4>
                     <p className="text-xs text-muted-foreground line-clamp-2">{item.summary}</p>
                   </div>
                 ))}
                 <Button asChild variant="link" className="px-0 h-auto">
                   <Link to="/portal/noticias">Ver todas</Link>
                 </Button>
               </div>
             ) : (
               <p className="text-sm text-muted-foreground">No hay novedades recientes.</p>
             )}
          </CardContent>
        </Card>

      </div>
    </div>
  );
};

export default UserDashboardPage;

import React from 'react';
import SummaryCard from '@/components/user-portal/dashboard/SummaryCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link, useNavigate } from 'react-router-dom';
import {
  ShoppingBag, PlusCircle, History, Newspaper, TicketPercent,
  MessageSquareQuote, ClipboardList, ImageOff
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUser } from '@/hooks/useUser';

// Datos de usuario real obtenidos del contexto

const recentActivities = [
  { id: 'R001', type: 'RECLAMO', description: 'Poste de luz caído en Av. San Martín y Belgrano', status: 'Recibido', statusType: 'info', date: '03/08/2024', link: '/portal/pedidos/R001' },
  { id: 'T015', type: 'TRÁMITE', description: 'Solicitud de exención impuesto automotor', status: 'En Revisión', statusType: 'warning', date: '02/08/2024', link: '/portal/pedidos/T015' },
  { id: 'P007', type: 'PEDIDO', description: 'Compra de entradas para evento municipal', status: 'Confirmado', statusType: 'success', date: '01/08/2024', link: '/portal/pedidos/P007' },
];

const featuredNews = [
  { id: 'N001', title: 'Nueva Campaña de Vacunación Antirrábica Gratuita', date: '05/08/2024', imageUrl: null, category: 'Salud Pública', link: '/portal/noticias/N001' },
  { id: 'E002', title: 'Festival de Jazz en la Plaza Central este Sábado', date: '10/08/2024', imageUrl: '/placeholders/event-jazz.png', category: 'Cultura', link: '/portal/noticias/E002' },
];

const activeBenefits = [
  { id: 'B001', title: '15% OFF en Tasa Municipal por Pago Anual', expiryDate: '31/08/2024', code: 'PAGOANUAL15', link: '/portal/beneficios/B001' },
];

const pendingSurveys = [
  { id: 'S001', title: 'Encuesta de Satisfacción sobre Servicios de Limpieza Urbana', link: '/portal/encuestas/S001' },
];

const UserDashboardPage = () => {
  const navigate = useNavigate();

  const getBadgeClasses = (statusType?: string): string => {
    switch (statusType?.toLowerCase()) {
      case 'success':
      case 'confirmado':
      case 'entregado':
      case 'resuelto':
        return 'bg-success text-success-foreground border-transparent hover:bg-success/80';
      case 'warning':
      case 'en revisión':
        return 'bg-warning text-warning-foreground border-transparent hover:bg-warning/80';
      case 'info':
      case 'recibido':
      case 'en proceso':
        return 'bg-primary text-primary-foreground border-transparent hover:bg-primary/80';
      case 'error':
      case 'rechazado':
        return 'bg-destructive text-destructive-foreground border-transparent hover:bg-destructive/80';
      default:
        return 'bg-secondary text-secondary-foreground border-transparent hover:bg-secondary/80';
    }
  };

  const { user } = useUser();

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      <div className="mb-2">
        <h1 className="text-2xl md:text-3xl font-bold text-dark">
          ¡Hola, {user?.name}!
        </h1>
        <p className="text-muted-foreground">
          Bienvenido/a a tu portal con {user?.nombre_empresa}.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
        <Button
          size="lg"
          className="w-full py-6 text-base shadow-md hover:shadow-lg font-medium"
          onClick={() => navigate('/portal/catalogo')}
        >
          <ShoppingBag className="mr-2 h-5 w-5" /> Ver Catálogo / Trámites
        </Button>
        <Button
          size="lg"
          variant="secondary"
          className="w-full py-6 text-base shadow-md hover:shadow-lg font-medium"
          onClick={() => alert('TODO: Navegar a Nuevo Pedido/Reclamo/Trámite')}
        >
          <PlusCircle className="mr-2 h-5 w-5" /> Nueva Gestión
        </Button>
      </div>

      <div className="grid gap-6 md:gap-8 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
        {recentActivities.length > 0 && (
          <SummaryCard
            title="Tus Gestiones Recientes"
            icon={<History className="h-6 w-6" />}
            ctaText="Ver todas mis gestiones"
            onCtaClick={() => navigate('/portal/pedidos')}
            className="lg:col-span-2 xl:col-span-2"
          >
            <ul className="space-y-0.5 -mx-2">
              {recentActivities.slice(0, 3).map(activity => (
                <li key={activity.id} className="px-2 py-2 hover:bg-muted/50 rounded-md transition-colors">
                  <Link to={activity.link} className="flex justify-between items-center w-full">
                    <div>
                      <p className="text-sm font-medium text-foreground truncate pr-2 leading-snug">{activity.description}</p>
                      <p className="text-xs text-muted-foreground">{activity.type} - {activity.date}</p>
                    </div>
                    <Badge className={cn("text-xs whitespace-nowrap ml-2", getBadgeClasses(activity.statusType))}>
                      {activity.status}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          </SummaryCard>
        )}

        {featuredNews.length > 0 && (
          <SummaryCard
            title="Novedades y Eventos"
            icon={<Newspaper className="h-6 w-6" />}
            ctaText="Ver todas las novedades"
            onCtaClick={() => navigate('/portal/noticias')}
            className="xl:col-span-1"
          >
            <ul className="space-y-3 -mx-2">
              {featuredNews.slice(0, 2).map(news => (
                <li key={news.id} className="px-2 py-2 hover:bg-muted/50 rounded-md transition-colors">
                  <Link to={news.link} className="group block">
                    {!news.imageUrl ? (
                      <div className="w-full h-24 bg-muted rounded-md mb-2 flex items-center justify-center group-hover:opacity-90 transition-opacity">
                        <ImageOff className="h-10 w-10 text-muted-foreground/70" />
                      </div>
                    ) : (
                      <img src={news.imageUrl} alt={news.title} className="w-full h-24 object-cover rounded-md mb-2 group-hover:opacity-90 transition-opacity"/>
                    )}
                    <h4 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors mb-0.5 leading-snug">{news.title}</h4>
                    <p className="text-xs text-muted-foreground">{news.date} - {news.category}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </SummaryCard>
        )}

        {activeBenefits.length > 0 && (
           <SummaryCard
            title="Beneficios para Ti"
            icon={<TicketPercent className="h-6 w-6" />}
            ctaText="Ver todos los beneficios"
            onCtaClick={() => navigate('/portal/beneficios')}
          >
            <ul className="space-y-3">
              {activeBenefits.slice(0,1).map(benefit =>(
                <li key={benefit.id} className="p-3 bg-primary/10 border border-primary/20 rounded-md hover:shadow-md transition-shadow">
                   <Link to={benefit.link} className="group block">
                    <h4 className="text-sm font-semibold text-primary group-hover:underline mb-0.5 leading-snug">{benefit.title}</h4>
                    <p className="text-xs text-muted-foreground">
                      {benefit.expiryDate && `Vence: ${benefit.expiryDate}. `}
                      {benefit.code && `Código: `}
                      {benefit.code && <span className="font-medium text-foreground">{benefit.code}</span>}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </SummaryCard>
        )}

        {pendingSurveys.length > 0 && (
          <SummaryCard
            title="Tu Opinión Nos Importa"
            icon={<MessageSquareQuote className="h-6 w-6" />}
          >
            <div className="flex flex-col items-center text-center">
              <p className="text-sm text-muted-foreground mb-4">
                {pendingSurveys.length === 1
                  ? `Tienes una encuesta pendiente: "${pendingSurveys[0].title}"`
                  : `Tienes ${pendingSurveys.length} encuestas pendientes.`
                }
              </p>
              <Button
                className="w-full sm:w-auto"
                onClick={() => navigate(pendingSurveys[0].link)}
              >
                <ClipboardList className="mr-2 h-4 w-4" /> Responder Ahora
              </Button>
            </div>
          </SummaryCard>
        )}
      </div>
    </div>
  );
};

export default UserDashboardPage;

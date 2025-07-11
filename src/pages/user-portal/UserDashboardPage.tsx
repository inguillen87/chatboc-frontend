import React from 'react';
// UserPortalLayout ya no se importa aquí si se usa como Layout Route en App.tsx
import SummaryCard from '@/components/user-portal/dashboard/SummaryCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link, useNavigate } from 'react-router-dom';
import {
  ShoppingBag, PlusCircle, History, Newspaper, TicketPercent, MessageSquareQuote, ClipboardList
} from 'lucide-react'; // Removidos CalendarDays, Gift, ArrowRight si no se usan directamente aquí

// --- Datos Dummy (Mover a un archivo separado o contexto/estado global más adelante) ---
const currentUser = {
  nombre: "Ana Vocos",
};

const currentOrganization = {
  nombre: "Municipio de Junín", // Este dato vendría del contexto del usuario logueado
};

const recentActivities = [
  { id: 'R001', type: 'RECLAMO', description: 'Poste de luz caído en Av. San Martín y Belgrano', status: 'Recibido', statusType: 'info', date: '03/08/2024', link: '/portal/pedidos/R001' },
  { id: 'T015', type: 'TRÁMITE', description: 'Solicitud de exención impuesto automotor', status: 'En Revisión', statusType: 'warning', date: '02/08/2024', link: '/portal/pedidos/T015' },
  { id: 'P007', type: 'PEDIDO', description: 'Compra de entradas para evento municipal', status: 'Confirmado', statusType: 'success', date: '01/08/2024', link: '/portal/pedidos/P007' },
];

const featuredNews = [
  { id: 'N001', title: 'Nueva Campaña de Vacunación Antirrábica Gratuita', date: '05/08/2024', imageUrl: '/placeholders/news-vaccination.png', category: 'Salud Pública', link: '/portal/noticias/N001' },
  { id: 'E002', title: 'Festival de Jazz en la Plaza Central este Sábado', date: '10/08/2024', imageUrl: '/placeholders/event-jazz.png', category: 'Cultura', link: '/portal/noticias/E002' }, // Asumiendo que noticias y eventos comparten una ruta o se diferencian por tipo
];

const activeBenefits = [
  { id: 'B001', title: '15% OFF en Tasa Municipal por Pago Anual', expiryDate: '31/08/2024', code: 'PAGOANUAL15', link: '/portal/beneficios/B001' },
];

const pendingSurveys = [
  { id: 'S001', title: 'Encuesta de Satisfacción sobre Servicios de Limpieza Urbana', link: '/portal/encuestas/S001' },
];
// --- Fin Datos Dummy ---

type BadgeVariant = "default" | "secondary" | "destructive" | "outline" | "success" | "warning";


const UserDashboardPage = () => {
  const navigate = useNavigate();

  // Helper para mapear statusType a variantes de Badge
  // Asegúrate de que estas variantes ('success', 'warning', 'info') existan en tu componente Badge
  // o crea clases CSS personalizadas si es necesario.
  // Por ahora, usaré las que creamos ('success', 'warning') y otras estándar.
  const getBadgeVariant = (statusType?: string): BadgeVariant => {
    switch (statusType?.toLowerCase()) {
      case 'success':
      case 'confirmado':
      case 'entregado':
      case 'resuelto':
        return 'success';
      case 'warning':
      case 'en revisión':
        return 'warning';
      case 'info':
      case 'recibido':
      case 'en proceso':
        return 'default'; // 'default' es a menudo el color primario en shadcn badges
      case 'error':
      case 'rechazado':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      {/* Saludo y Nombre de Organización */}
      <div className="mb-2">
        <h1 className="text-2xl md:text-3xl font-bold text-dark">
          ¡Hola, {currentUser.nombre}!
        </h1>
        <p className="text-muted-foreground">
          Bienvenido/a a tu portal con {currentOrganization.nombre}.
        </p>
      </div>

      {/* Acciones Rápidas Principales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
        <Button
          size="lg"
          className="w-full py-6 text-base shadow-md hover:shadow-lg font-medium" // Añadido font-medium
          onClick={() => navigate('/portal/catalogo')}
        >
          <ShoppingBag className="mr-2 h-5 w-5" /> Ver Catálogo / Trámites
        </Button>
        <Button
          size="lg"
          variant="secondary"
          className="w-full py-6 text-base shadow-md hover:shadow-lg font-medium" // Añadido font-medium
          onClick={() => alert('TODO: Navegar a Nuevo Pedido/Reclamo/Trámite')}
        >
          <PlusCircle className="mr-2 h-5 w-5" /> Nueva Gestión
        </Button>
      </div>

      {/* Rejilla de Tarjetas de Resumen */}
      <div className="grid gap-6 md:gap-8 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
        {/* Tarjeta: Últimos Pedidos/Reclamos */}
        {recentActivities.length > 0 && (
          <SummaryCard
            title="Tus Gestiones Recientes"
            icon={<History className="h-6 w-6" />} // Icono un poco más grande
            ctaText="Ver todas mis gestiones"
            onCtaClick={() => navigate('/portal/pedidos')}
            className="lg:col-span-2 xl:col-span-2" // Ocupa 2 columnas en lg y xl
          >
            <ul className="space-y-3 -mx-2"> {/* Margen negativo para compensar padding de items */}
              {recentActivities.slice(0, 3).map(activity => (
                <li key={activity.id} className="border-b border-border last:border-b-0 px-2 py-2.5 hover:bg-muted/50 rounded-md transition-colors">
                  <Link to={activity.link} className="flex justify-between items-center w-full">
                    <div>
                      <p className="text-sm font-medium text-foreground truncate pr-2">{activity.description}</p>
                      <p className="text-xs text-muted-foreground">{activity.type} - {activity.date}</p>
                    </div>
                    <Badge variant={getBadgeVariant(activity.status)} className="text-xs whitespace-nowrap ml-2">
                      {activity.status}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          </SummaryCard>
        )}

        {/* Tarjeta: Noticias y Eventos */}
        {featuredNews.length > 0 && (
          <SummaryCard
            title="Novedades y Eventos"
            icon={<Newspaper className="h-6 w-6" />}
            ctaText="Ver todas las novedades"
            onCtaClick={() => navigate('/portal/noticias')}
            className="xl:col-span-1" // Asegurar que ocupe 1 columna en xl si la anterior ocupa 2
          >
            <ul className="space-y-3 -mx-2">
              {featuredNews.slice(0, 2).map(news => (
                <li key={news.id} className="border-b border-border last:border-b-0 px-2 py-2.5 hover:bg-muted/50 rounded-md transition-colors">
                  <Link to={news.link} className="group block">
                    {/* Placeholder para imagen si se decide incluir */}
                    {/* <img src={news.imageUrl || '/placeholders/news-placeholder.png'} alt={news.title} className="w-full h-24 object-cover rounded-md mb-2 group-hover:opacity-90 transition-opacity"/> */}
                    <h4 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors mb-0.5">{news.title}</h4>
                    <p className="text-xs text-muted-foreground">{news.date} - {news.category}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </SummaryCard>
        )}

        {/* Tarjeta: Beneficios Destacados */}
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
                    <h4 className="text-sm font-semibold text-primary group-hover:underline mb-0.5">{benefit.title}</h4>
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

        {/* Tarjeta: Encuestas Pendientes */}
        {pendingSurveys.length > 0 && (
          <SummaryCard
            title="Tu Opinión Nos Importa"
            icon={<MessageSquareQuote className="h-6 w-6" />}
          >
            <div className="flex flex-col items-center text-center">
              <p className="text-sm text-muted-foreground mb-4"> {/* Aumentado margen inferior */}
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

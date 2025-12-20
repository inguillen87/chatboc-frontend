import React from 'react';
import { MessageSquareText, Users, ShoppingBag, Gift, BarChart2, Map } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

const solutionFeatures = [
  {
    icon: <MessageSquareText className="h-10 w-10 text-primary" />,
    title: "Agentes IA Inteligentes",
    description: "No son chatbots estáticos. Son Agentes que entienden el contexto, responden naturalmente y guían al usuario sin necesidad de flujos rígidos."
  },
  {
    icon: <ShoppingBag className="h-10 w-10 text-primary" />,
    title: "Marketplace Automático",
    description: "Sube tu catálogo y listo. La plataforma genera tu tienda online automáticamente, permitiendo a comercios vender y a vecinos comprar en minutos."
  },
  {
    icon: <Gift className="h-10 w-10 text-primary" />,
    title: "Participación y Recompensas",
    description: "Fomenta la participación ciudadana. Los usuarios suman puntos por votar o interactuar, que luego pueden canjear por vouchers o beneficios."
  },
  {
    icon: <Map className="h-10 w-10 text-primary" />,
    title: "Mapas de Calor y Territorio",
    description: "Visualiza la actividad en tiempo real. Detecta zonas de mayor demanda, reclamos o ventas con mapas de calor interactivos y precisos."
  },
  {
    icon: <BarChart2 className="h-10 w-10 text-primary" />,
    title: "Analíticas y Dashboards",
    description: "Todo lo que necesitas ver en un solo lugar. Métricas claras de satisfacción, tiempos de respuesta y engagement para Gobiernos y Pymes."
  },
  {
    icon: <Users className="h-10 w-10 text-primary" />,
    title: "CRM y Gestión Integral",
    description: "Centraliza cada interacción. Gestiona perfiles de vecinos o clientes, historial de consultas y segmentación avanzada sin esfuerzo."
  }
];

const SolutionSection = () => {
  const navigate = useNavigate();

  return (
    <section id="solucion" className="py-16 md:py-24 bg-background text-foreground">
      <div className="container px-4 mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-12 md:mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-foreground">
            Potencia real, sin complicaciones
          </h2>
          <p className="text-lg text-muted-foreground">
            Una suite completa que combina Inteligencia Artificial, comercio local y participación ciudadana. Todo integrado, todo funcionando desde el primer día.
          </p>
        </div>

        <div className="grid gap-6 md:gap-8 md:grid-cols-2 lg:grid-cols-3">
          {solutionFeatures.map((feature, index) => (
            <div
              key={index}
              className="bg-card text-card-foreground p-6 md:p-8 rounded-lg border border-border shadow-lg hover:shadow-xl transition-shadow duration-300 flex flex-col items-center text-center"
            >
              <div className="mb-5 flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 text-primary">
                {feature.icon}
              </div>
              <h3 className="text-xl font-semibold mb-3 text-foreground">{feature.title}</h3>
              <p className="text-muted-foreground text-sm">{feature.description}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center mt-12 md:mt-16">
          <Button
            size="lg"
            className="shadow-lg hover:shadow-xl transition-shadow"
            onClick={() => navigate('/register')}
          >
            <Users className="mr-2 h-5 w-5" /> Empezar Ahora
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="shadow-lg hover:shadow-xl transition-shadow"
            onClick={() => navigate('/demo')}
          >
            <MessageSquareText className="mr-2 h-5 w-5" /> Probar Agente IA
          </Button>
        </div>
      </div>
    </section>
  );
};

export default SolutionSection;

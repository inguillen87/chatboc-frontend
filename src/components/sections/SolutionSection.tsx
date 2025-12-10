import React from 'react';
import { MessageSquareText, Users, ShoppingBag, Vote, BarChart2, Map } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

const solutionFeatures = [
  {
    icon: <Vote className="h-10 w-10 text-primary" />,
    title: "Participación Ciudadana en Tiempo Real",
    description: "Realiza encuestas y votaciones en vivo (estilo YouTube). Involucra a la comunidad en decisiones clave con transparencia y rapidez."
  },
  {
    icon: <ShoppingBag className="h-10 w-10 text-primary" />,
    title: "Marketplace para Municipios y Comercios",
    description: "Crea tu propio mercado digital. Permite que comercios locales ofrezcan productos y servicios, fomentando la economía local desde una plataforma unificada."
  },
  {
    icon: <Map className="h-10 w-10 text-primary" />,
    title: "Mapas de Calor y Geolocalización",
    description: "Visualiza dónde están los problemas y las oportunidades. Detecta zonas de alta demanda o incidencia con mapas de calor interactivos."
  },
  {
    icon: <BarChart2 className="h-10 w-10 text-primary" />,
    title: "Analíticas Inteligentes y Métricas",
    description: "Toma decisiones basadas en datos. Paneles de control avanzados que te muestran tendencias, satisfacción y comportamiento de usuarios al instante."
  },
  {
    icon: <MessageSquareText className="h-10 w-10 text-primary" />,
    title: "Chatbots IA y Atención 24/7",
    description: "Automatiza la atención al vecino y al cliente. Asistentes virtuales que entienden lenguaje natural y resuelven consultas en cualquier momento."
  },
  {
    icon: <Users className="h-10 w-10 text-primary" />,
    title: "CRM y Gestión de Relaciones",
    description: "Centraliza la información de tus ciudadanos o clientes. Segmenta, comunica y construye relaciones duraderas con una visión 360°."
  }
];

const SolutionSection = () => {
  const navigate = useNavigate();

  return (
    <section id="solucion" className="py-16 md:py-24 bg-background text-foreground">
      <div className="container px-4 mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-12 md:mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-dark">
            Todo lo que necesitas para conectar y crecer
          </h2>
          <p className="text-lg text-muted-foreground">
            Desde la participación ciudadana hasta el impulso del comercio local. Una suite completa de herramientas digitales para la era moderna.
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
              <h3 className="text-xl font-semibold mb-3 text-dark">{feature.title}</h3>
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
            <Vote className="mr-2 h-5 w-5" /> Probar Votación en Vivo
          </Button>
        </div>
      </div>
    </section>
  );
};

export default SolutionSection;

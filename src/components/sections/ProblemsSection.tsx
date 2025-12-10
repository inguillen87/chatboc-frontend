import React from 'react';
import { Ghost, Store, SearchX, LineChart, Megaphone, Activity } from 'lucide-react';

const problemsData = [
  {
    icon: <Ghost className="h-8 w-8 text-primary" />,
    title: "Comunidad Desconectada",
    description: "Los ciudadanos sienten que no son escuchados. La falta de canales directos de participación genera apatía y desconfianza en la gestión.",
    comment: "Con nuestras herramientas de Votación en Vivo, la participación es visible, inmediata y transparente."
  },
  {
    icon: <Store className="h-8 w-8 text-primary" />,
    title: "Economía Local Invisible",
    description: "Los pequeños comercios luchan por tener presencia digital. Sin un marketplace unificado, el consumo se fuga a grandes plataformas externas.",
    comment: "Crea un Mercado Digital local donde cada comercio tenga su espacio y venda a sus vecinos fácilmente."
  },
  {
    icon: <SearchX className="h-8 w-8 text-primary" />,
    title: "Gestión a Ciegas",
    description: "Tomar decisiones sin datos es arriesgado. Sin métricas claras ni mapas de calor, es difícil saber dónde invertir recursos o esfuerzos.",
    comment: "Nuestros Mapas de Calor y Analíticas te muestran exactamente qué pasa y dónde, en tiempo real."
  },
  {
    icon: <Megaphone className="h-8 w-8 text-primary" />,
    title: "Comunicación Unidireccional",
    description: "Los canales tradicionales solo emiten información. No hay diálogo real ni escucha activa de las necesidades del ciudadano o cliente.",
    comment: "Chatbots IA y Encuestas transforman el monólogo en un diálogo constructivo y constante."
  },
  {
    icon: <LineChart className="h-8 w-8 text-primary" />,
    title: "Oportunidades Perdidas",
    description: "Sin herramientas de seguimiento (CRM), las solicitudes se pierden y las oportunidades de venta o mejora de servicio se desvanecen.",
    comment: "Centraliza cada interacción. Seguimiento automático para que ningún vecino o cliente quede sin respuesta."
  },
  {
    icon: <Activity className="h-8 w-8 text-primary" />,
    title: "Lentitud en la Respuesta",
    description: "Los procesos burocráticos o manuales son lentos. La gente espera inmediatez digital que las herramientas antiguas no pueden dar.",
    comment: "Automatización e IA para respuestas instantáneas. Eficiencia que se siente."
  }
];

const ProblemsSection = () => {
  return (
    <section id="problemas" className="py-16 md:py-24 bg-light text-foreground">
      <div className="container px-4 mx-auto">
        <div className="text-center mb-12 md:mb-16 max-w-3xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-dark">
            Desafíos Reales, Soluciones Modernas
          </h2>
          <p className="text-lg text-muted-foreground">
            La brecha entre las instituciones/comercios y las personas nunca ha sido tan evidente. Es hora de cerrar esa brecha con tecnología que acerca.
          </p>
        </div>

        <div className="grid gap-6 md:gap-8 md:grid-cols-2 lg:grid-cols-3">
          {problemsData.map((problem, index) => (
            <div
              key={index}
              className="bg-card text-card-foreground p-6 rounded-lg border border-border shadow-lg hover:shadow-xl transition-shadow duration-300 flex flex-col"
            >
              <div className="flex-shrink-0 mb-5 flex items-center justify-center w-12 h-12 rounded-full bg-primary/10">
                {problem.icon}
              </div>
              <h3 className="text-xl font-semibold mb-3 text-dark">{problem.title}</h3>
              <p className="text-muted-foreground mb-4 flex-grow">{problem.description}</p>
              <p className="text-sm text-primary font-medium border-t border-border pt-3 mt-auto">
                {problem.comment}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ProblemsSection;

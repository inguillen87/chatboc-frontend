import React from 'react';
import { Ghost, Store, SearchX, LineChart, MessageSquareX, Sliders } from 'lucide-react';

const problemsData = [
  {
    icon: <Ghost className="h-8 w-8 text-primary" />,
    title: "Comunidad Desconectada",
    description: "Los ciudadanos sienten que no son escuchados. La falta de canales directos y modernos genera apatía y desconfianza.",
    comment: "Con nuestra plataforma, la participación es real, transparente y premiada con puntos."
  },
  {
    icon: <Sliders className="h-8 w-8 text-primary" />,
    title: "Configuraciones Técnicas Complejas",
    description: "Otras herramientas (como ManyChat) te obligan a diseñar flujos complicados y perder horas configurando menús.",
    comment: "Nosotros te damos la solución llave en mano. Sube tus datos y la IA hace el resto."
  },
  {
    icon: <Store className="h-8 w-8 text-primary" />,
    title: "Economía Local Invisible",
    description: "Los pequeños comercios no tienen herramientas digitales propias y pierden ventas frente a grandes plataformas.",
    comment: "Generamos Marketplaces locales automáticamente para que cada comercio tenga su tienda en minutos."
  },
  {
    icon: <SearchX className="h-8 w-8 text-primary" />,
    title: "Gestión a Ciegas",
    description: "Sin datos claros, mapas de calor o métricas de satisfacción, es imposible tomar decisiones acertadas.",
    comment: "Nuestros Dashboards con Mapas de Calor te muestran la realidad de tu gestión al instante."
  },
  {
    icon: <MessageSquareX className="h-8 w-8 text-primary" />,
    title: "Chatbots 'Tontos' y Rígidos",
    description: "Los bots tradicionales solo siguen guiones y frustran al usuario cuando se salen del libreto.",
    comment: "Nuestros Agentes IA entienden el lenguaje natural y resuelven problemas reales sin scripts."
  },
  {
    icon: <LineChart className="h-8 w-8 text-primary" />,
    title: "Oportunidades Perdidas",
    description: "Sin un CRM integrado, las solicitudes y los clientes potenciales se pierden en el olvido.",
    comment: "Centraliza y gestiona cada interacción para que ningún vecino o cliente quede sin respuesta."
  }
];

const ProblemsSection = () => {
  return (
    <section id="problemas" className="py-16 md:py-24 bg-muted text-foreground">
      <div className="container px-4 mx-auto">
        <div className="text-center mb-12 md:mb-16 max-w-3xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-foreground">
            Desafíos Reales, Solución Integral
          </h2>
          <p className="text-lg text-muted-foreground">
            Entendemos los problemas de gobiernos y pymes en LATAM. Por eso creamos una plataforma que resuelve, no que complica.
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
              <h3 className="text-xl font-semibold mb-3 text-foreground">{problem.title}</h3>
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

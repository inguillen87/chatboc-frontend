import React from 'react';
// Actualizar iconos según los nuevos problemas
import { Clock, Repeat, FileSearch, Brain, BarChartBig, UserSearch } from 'lucide-react'; // Cambiado UserCog a UserSearch

// Lista de problemas actualizada y reenfocada
const problemsData = [
  {
    icon: <Clock className="h-8 w-8 text-primary" />, // Usar color primario de la paleta
    title: "Respuestas Lentas, Usuarios Frustrados",
    description: "Ciudadanos y clientes esperan ayuda al instante. Las demoras o la falta de atención 24/7 generan insatisfacción y pérdida de confianza.",
    comment: "Chatboc IA ofrece atención inmediata 24/7, resolviendo dudas y guiando a los usuarios, incluso fuera de horario."
  },
  {
    icon: <Repeat className="h-8 w-8 text-primary" />,
    title: "Equipos Saturados por Consultas Repetitivas",
    description: "Tu personal invierte horas respondiendo las mismas preguntas, desviando tiempo valioso de tareas estratégicas o casos complejos.",
    comment: "Automatiza hasta el 80% de las consultas frecuentes. Libera a tu equipo para que se enfoque en lo que realmente importa."
  },
  {
    icon: <FileSearch className="h-8 w-8 text-primary" />,
    title: "Información Dispersa, Procesos Complicados",
    description: "Para los usuarios, encontrar datos o entender trámites puede ser un laberinto. Para ti, un desafío de comunicación constante.",
    comment: "Centraliza el conocimiento. Sube tus documentos y normativas; nuestro IA guiará a los usuarios con lenguaje natural."
  },
  {
    icon: <Brain className="h-8 w-8 text-primary" />,
    title: "Falta de Personalización Real a Escala",
    description: "Brindar una experiencia verdaderamente adaptada a cada ciudadano o cliente es un reto logístico con alto volumen de interacciones.",
    comment: "La IA de Chatboc entiende el contexto y el historial, permitiendo interacciones personalizadas que mejoran la satisfacción."
  },
  {
    icon: <UserSearch className="h-8 w-8 text-primary" />, // Cambiado aquí
    title: "Dificultad para Conocer y Segmentar Usuarios",
    description: "Entender las necesidades específicas de diferentes grupos de ciudadanos o clientes es clave para ofrecer un servicio proactivo y relevante.",
    comment: "Nuestro CRM te permite registrar y segmentar perfiles detallados, facilitando campañas y comunicaciones dirigidas."
  },
  {
    icon: <BarChartBig className="h-8 w-8 text-primary" />,
    title: "Gestión Ineficiente, Oportunidades Perdidas",
    description: "La dificultad para rastrear solicitudes, medir la satisfacción o identificar cuellos de botella impide optimizar los servicios y la atención.",
    comment: "El CRM y los paneles analíticos te dan una visión 360° del rendimiento para una mejora continua de la experiencia."
  }
];

const ProblemsSection = () => {
  return (
    <section id="problemas" className="py-16 md:py-24 bg-light text-foreground"> {/* Usar bg-light para alternar secciones */}
      <div className="container px-4 mx-auto">
        <div className="text-center mb-12 md:mb-16 max-w-3xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-dark"> {/* Usar text-dark para contraste en bg-light */}
            ¿Tu Organización Enfrenta Estos Desafíos?
          </h2>
          <p className="text-lg text-muted-foreground">
            Tanto ciudadanos como clientes esperan hoy una comunicación ágil y soluciones efectivas. Chatboc potencia a municipios y empresas para ofrecer experiencias de usuario excepcionales, de forma eficiente y personalizada.
          </p>
        </div>

        <div className="grid gap-6 md:gap-8 md:grid-cols-2 lg:grid-cols-3">
          {problemsData.map((problem, index) => (
            <div
              key={index}
              className="bg-card text-card-foreground p-6 rounded-lg border border-border shadow-lg hover:shadow-xl transition-shadow duration-300 flex flex-col" // Usar rounded-lg, shadow-lg, flex-col
            >
              <div className="flex-shrink-0 mb-5 flex items-center justify-center w-12 h-12 rounded-full bg-primary/10"> {/* Icono con fondo primario suave */}
                {problem.icon}
              </div>
              <h3 className="text-xl font-semibold mb-3 text-dark">{problem.title}</h3>
              <p className="text-muted-foreground mb-4 flex-grow">{problem.description}</p> {/* flex-grow para alinear comentarios */}
              <p className="text-sm text-primary font-medium">{problem.comment}</p> {/* Comentario con color primario */}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ProblemsSection;

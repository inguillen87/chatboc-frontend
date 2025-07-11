import React from "react";
import { Button } from "@/components/ui/button";
// Iconos actualizados para los nuevos pasos
import { Target, UploadCloud, BotMessageSquare, BarChart3, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

const newSteps = [
  {
    number: "1",
    icon: <Target className="h-7 w-7 text-primary" />, // Iconos más grandes y con color primario
    title: "Descubrimiento y Configuración Inicial",
    description: "Definimos juntos tus objetivos, ya sea mejorar la atención ciudadana, optimizar el soporte a clientes o agilizar la gestión. Configuramos la plataforma base según tus prioridades."
  },
  {
    number: "2",
    icon: <UploadCloud className="h-7 w-7 text-primary" />,
    title: "Alimenta la Inteligencia de tu Plataforma",
    description: "Sube fácilmente documentos clave: normativas, catálogos de servicios/productos, FAQs. Nuestra IA los procesa para crear una base de conocimiento robusta y precisa."
  },
  {
    number: "3",
    icon: <BotMessageSquare className="h-7 w-7 text-primary" />,
    title: "Personaliza y Activa tu Asistente IA",
    description: "Ajusta la personalidad de tu Chatbot, define flujos de conversación e intégralo en tus canales (web, WhatsApp). Observa cómo interactúa y resuelve consultas en tiempo real."
  },
  {
    number: "4",
    icon: <BarChart3 className="h-7 w-7 text-primary" />,
    title: "Mide, Aprende y Evoluciona Continuamente",
    description: "Utiliza nuestros paneles analíticos para entender el rendimiento, identificar áreas de mejora y optimizar respuestas y procesos. Tu plataforma IA se vuelve más inteligente con cada interacción."
  }
];

const HowItWorksSection = () => {
  const navigate = useNavigate();

  return (
    <section id="como-funciona" className="py-16 md:py-24 bg-light text-foreground"> {/* Alternar fondo si la anterior fue bg-background */}
      <div className="container px-4 mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-12 md:mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-dark">
            Implementación Sencilla, Impacto Inmediato
          </h2>
          <p className="text-lg text-muted-foreground">
            Nuestra plataforma está diseñada para una adopción rápida y resultados visibles, transformando la atención ciudadana y la experiencia de tus clientes.
          </p>
        </div>

        <div className="max-w-3xl mx-auto"> {/* Reducir max-w para una apariencia más compacta de los pasos */}
          {newSteps.map((step, index) => (
            <div key={index} className="flex items-start mb-10 last:mb-0">
              <div className="flex flex-col items-center mr-6">
                <div
                  className="flex-shrink-0 w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center text-2xl font-bold shadow-md mb-2"
                >
                  {/* Usar el icono directamente en lugar del número si se prefiere, o mantener el número */}
                  {step.number}
                  {/* Opcional: {step.icon} si el número no es prioritario */}
                </div>
                {index < newSteps.length - 1 && (
                  <div className="w-px h-16 bg-border" /> // Línea conectora más sutil
                )}
              </div>
              <div className="bg-card text-card-foreground p-6 rounded-lg border border-border shadow-lg flex-grow hover:shadow-xl transition-shadow duration-300">
                {/* Opcional: Mostrar icono también aquí si se quita del círculo */}
                {/* <div className="mb-3">{step.icon}</div> */}
                <h3 className="text-xl font-semibold mb-2 text-dark">{step.title}</h3>
                <p className="text-muted-foreground">{step.description}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center mt-12 md:mt-16">
          <Button
            size="lg"
            className="shadow-lg hover:shadow-xl transition-shadow"
            onClick={() => navigate('/demo')} // Dirigir a la demo o página de contacto/soluciones
          >
            Solicita una Demostración <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </div>
    </section>
  );
};

export default HowItWorksSection;

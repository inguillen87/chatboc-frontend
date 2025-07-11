import React from 'react';
// Iconos actualizados para representar mejor las características de la solución
import { MessageSquareText, Users, FileText, LayoutDashboard, Zap, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

const solutionFeatures = [
  {
    icon: <MessageSquareText className="h-10 w-10 text-primary" />,
    title: "Asistentes Virtuales IA Multicanal",
    description: "Implementa Chatbots inteligentes en tu web, WhatsApp y más. Ofrecen respuestas instantáneas 24/7, guiando a ciudadanos y clientes de forma eficaz."
  },
  {
    icon: <Users className="h-10 w-10 text-primary" />,
    title: "CRM con Visión 360° de Usuarios",
    description: "Centraliza historiales, preferencias y casos de empresas, municipios y sus contactos. Permite una atención personalizada y proactiva."
  },
  {
    icon: <FileText className="h-10 w-10 text-primary" />,
    title: "Base de Conocimiento Inteligente",
    description: "Sube catálogos, normativas o FAQs. Nuestra IA los procesa para que el Chatbot y tu equipo siempre brinden información precisa y actualizada."
  },
  {
    icon: <LayoutDashboard className="h-10 w-10 text-primary" />,
    title: "Paneles Analíticos para Optimizar",
    description: "Mide interacciones, satisfacción y temas frecuentes. Obtén insights para mejorar continuamente la eficiencia y experiencia de tus usuarios."
  },
  {
    icon: <Zap className="h-10 w-10 text-primary" />,
    title: "Automatización de Tareas y Procesos",
    description: "Desde la toma de solicitudes hasta el seguimiento de casos. Libera a tu equipo para interacciones de mayor valor y agiliza los servicios."
  },
  {
    icon: <CheckCircle className="h-10 w-10 text-primary" />, // Icono de beneficio general
    title: "Experiencia de Usuario Superior",
    description: "Ofrece a ciudadanos y clientes una comunicación fluida, respuestas relevantes y acceso fácil a la información, elevando su satisfacción."
  }
];

const SolutionSection = () => {
  const navigate = useNavigate();

  return (
    <section id="solucion" className="py-16 md:py-24 bg-background text-foreground"> {/* Mantener bg-background si la anterior fue bg-light */}
      <div className="container px-4 mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-12 md:mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-dark">
            La Solución Integral para Conectar y Servir Mejor
          </h2>
          <p className="text-lg text-muted-foreground">
            Nuestra plataforma une un CRM inteligente con la potencia de Chatbots IA para transformar cómo municipios y empresas interactúan con sus comunidades, gestionan información y optimizan servicios.
          </p>
        </div>

        <div className="grid gap-6 md:gap-8 md:grid-cols-2 lg:grid-cols-3">
          {solutionFeatures.map((feature, index) => (
            <div
              key={index}
              className="bg-card text-card-foreground p-6 md:p-8 rounded-lg border border-border shadow-lg hover:shadow-xl transition-shadow duration-300 flex flex-col items-center text-center" // Centrar contenido
            >
              <div className="mb-5 flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 text-primary"> {/* Icono más grande y centrado */}
                {feature.icon}
              </div>
              <h3 className="text-xl font-semibold mb-3 text-dark">{feature.title}</h3>
              <p className="text-muted-foreground text-sm">{feature.description}</p> {/* Texto de descripción más pequeño */}
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center mt-12 md:mt-16">
          <Button
            size="lg"
            className="shadow-lg hover:shadow-xl transition-shadow" // Aplicar shadow aquí también
            onClick={() => navigate('/register')} // O /features, /solutions
          >
            <Zap className="mr-2 h-5 w-5" /> Explora la Plataforma
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="shadow-lg hover:shadow-xl transition-shadow"
            onClick={() => navigate('/demo')}
          >
            <MessageSquareText className="mr-2 h-5 w-5" /> Ver Demo en Vivo
          </Button>
        </div>
      </div>
    </section>
  );
};

export default SolutionSection;

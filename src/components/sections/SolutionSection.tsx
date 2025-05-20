import React from 'react';
import { Bot, Brain, LayoutDashboard, Clock, Coins, Heart } from 'lucide-react';

const SolutionSection = () => {
  const benefits = [
    {
      icon: <Bot className="h-10 w-10 text-blue-500" />,
      title: "Personalización Profunda desde el Inicio",
      description: "Chatboc ya viene listo con más de 50 preguntas y respuestas reales por rubro. Elegís tu sector y empezás a responder como un experto, sin configurar nada."
    },
    {
      icon: <Brain className="h-10 w-10 text-blue-500" />,
      title: "Inteligencia Artificial que Aprende y se Adapta",
      description: "Gracias a nuestro avanzado NLP y embeddings, Chatboc no solo sigue guiones; comprende la intención, el contexto y se vuelve más inteligente con cada conversación."
    },
    {
      icon: <LayoutDashboard className="h-10 w-10 text-blue-500" />,
      title: "Panel Simple. Control Total.",
      description: "Gestioná tu chatbot como un experto desde un panel claro, sin depender de soporte técnico ni configuraciones complejas."
    },
    {
      icon: <Clock className="h-10 w-10 text-blue-500" />,
      title: "Atención Ininterrumpida 24/7",
      description: "Tu negocio sigue generando oportunidades y resolviendo dudas incluso fuera de horario. Chatboc es tu empleado estrella que nunca descansa."
    },
    {
      icon: <Coins className="h-10 w-10 text-blue-500" />,
      title: "Optimización de Recursos y Costos",
      description: "Reducí el tiempo dedicado a tareas repetitivas y bajá los costos de atención tradicional, reinvirtiendo en lo que más importa."
    },
    {
      icon: <Heart className="h-10 w-10 text-blue-500" />,
      title: "Experiencia de Cliente Superior",
      description: "Conectá mejor con tus clientes con respuestas inmediatas, humanas y precisas que construyen confianza desde el primer mensaje."

    }
  ];

  return (
    <section id="solution" className="section-padding bg-background text-foreground">
      <div className="container px-4 mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Chatboc: La Inteligencia Conversacional Diseñada para <span className="gradient-text">Entender y Potenciar</span> Tu Negocio
          </h2>
          <p className="text-lg text-muted-foreground">
            Imaginá un asistente virtual que no solo responde preguntas, sino que entiende las particularidades de tu pyme, aprende de cada interacción y trabaja incansablemente para mejorar la satisfacción de tus clientes y optimizar tus procesos. Eso es Chatboc.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {benefits.map((benefit, index) => (
            <div
              key={index}
              className="bg-card text-card-foreground p-8 rounded-xl border border-border shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="mb-5">{benefit.icon}</div>
              <h3 className="text-xl font-semibold mb-3">{benefit.title}</h3>
              <p className="text-muted-foreground">{benefit.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default SolutionSection;

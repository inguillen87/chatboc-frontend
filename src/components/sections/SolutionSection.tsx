
import React from 'react';
import { Bot, Brain, LayoutDashboard, Clock, Coins, Heart } from 'lucide-react';

const SolutionSection = () => {
  const benefits = [
    {
      icon: <Bot className="h-10 w-10 text-blue-500" />,
      title: "Personalización Profunda desde el Inicio",
      description: "Comenzamos configurando juntos 10 preguntas y respuestas cruciales para tu negocio. Así, desde el día uno, Chatboc habla el idioma de tus clientes y conoce tus productos/servicios."
    },
    {
      icon: <Brain className="h-10 w-10 text-blue-500" />,
      title: "Inteligencia Artificial que Aprende y se Adapta",
      description: "Gracias a nuestro avanzado NLP y embeddings de Python, Chatboc no solo sigue guiones; comprende la intención, el contexto y se vuelve más inteligente con cada conversación."
    },
    {
      icon: <LayoutDashboard className="h-10 w-10 text-blue-500" />,
      title: "Panel de Administración Sencillo e Intuitivo",
      description: "Controla todo desde un panel fácil de usar, pensado para dueños de pymes, no para expertos en tecnología. Revisa conversaciones y ajusta respuestas sin complicaciones."
    },
    {
      icon: <Clock className="h-10 w-10 text-blue-500" />,
      title: "Atención Ininterrumpida 24/7",
      description: "Tu negocio sigue generando oportunidades y resolviendo dudas incluso fuera de tu horario laboral. Chatboc es tu empleado estrella que nunca descansa."
    },
    {
      icon: <Coins className="h-10 w-10 text-blue-500" />,
      title: "Optimización de Recursos y Costos",
      description: "Reduce drásticamente el tiempo dedicado a tareas repetitivas y disminuye los costos asociados a la atención al cliente tradicional, permitiéndote reinvertir en áreas estratégicas."
    },
    {
      icon: <Heart className="h-10 w-10 text-blue-500" />,
      title: "Experiencia de Cliente Superior",
      description: "Ofrece respuestas inmediatas, precisas y coherentes que encantan a tus clientes, aumentan su lealtad y mejoran la reputación de tu marca."
    }
  ];

  return (
    <section id="solution" className="section-padding bg-gray-50">
      <div className="container px-4 mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Chatboc: La Inteligencia Conversacional Diseñada para <span className="gradient-text">Entender y Potenciar</span> Tu Negocio
          </h2>
          <p className="text-lg text-gray-600">
            Imagina un asistente virtual que no solo responde preguntas, sino que entiende las particularidades de tu pyme, aprende de cada interacción y trabaja incansablemente para mejorar la satisfacción de tus clientes y optimizar tus procesos. Eso es Chatboc.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {benefits.map((benefit, index) => (
            <div 
              key={index} 
              className="bg-white p-8 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="mb-5">{benefit.icon}</div>
              <h3 className="text-xl font-semibold mb-3">{benefit.title}</h3>
              <p className="text-gray-600">{benefit.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default SolutionSection;

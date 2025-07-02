import React from 'react';
import { Bot, Brain, LayoutDashboard, Clock, Coins, Heart, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

const benefits = [
  {
    icon: <FileText className="h-10 w-10 text-blue-600" />,
    title: "Catálogo Digital Directo de tu PDF o Excel",
    description: "Olvidate de cargar productos a mano: subís tu catálogo y Chatboc responde usando tus datos reales, siempre actualizados."
  },
  {
    icon: <Brain className="h-10 w-10 text-blue-600" />,
    title: "Inteligencia Artificial de Verdad",
    description: "No son botones, es IA. Chatboc entiende, busca y sugiere usando procesamiento de lenguaje natural y búsquedas vectoriales."
  },
  {
    icon: <LayoutDashboard className="h-10 w-10 text-blue-600" />,
    title: "Panel de Control Fácil y Completo",
    description: "Gestioná preguntas, respuestas, métricas y catálogos sin depender de soporte. Todo claro y en un solo lugar."
  },
  {
    icon: <Clock className="h-10 w-10 text-blue-600" />,
    title: "Atendé 24/7, Incluso en Feriados",
    description: "No perdés más oportunidades: el bot responde en segundos a cualquier hora, todos los días."
  },
  {
    icon: <Coins className="h-10 w-10 text-blue-600" />,
    title: "Ahorro Real de Tiempo y Plata",
    description: "Reducí tareas repetitivas y bajá el costo de atención sin sacrificar calidad ni personalización."
  },
  {
    icon: <Heart className="h-10 w-10 text-blue-600" />,
    title: "Mejor Experiencia para tus Clientes",
    description: "Tus clientes reciben respuestas útiles y claras, como si chatearan con un experto de tu propio equipo."
  }
];

const SolutionSection = () => {
  const navigate = useNavigate();

  return (
    <section id="solution" className="section-padding bg-background text-foreground">
      <div className="container px-4 mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Chatboc: La IA Conversacional que Hace el Trabajo Difícil por Vos
          </h2>
          <p className="text-lg text-muted-foreground">
            Sumá tecnología real a tu pyme: subís tu catálogo, automatizás respuestas y medís resultados en serio. Chatboc no improvisa, trabaja con tus datos, aprende y mejora solo.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {benefits.map((benefit, index) => (
            <div
              key={index}
              className="bg-card text-card-foreground p-8 rounded-xl border border-border shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="mb-5 flex justify-center">{benefit.icon}</div>
              <h3 className="text-xl font-semibold mb-3">{benefit.title}</h3>
              <p className="text-muted-foreground">{benefit.description}</p>
            </div>
          ))}
        </div>

        {/* Botones de acción */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center mt-16">
          <Button
            size="lg"
            className="px-8 py-4 text-base font-semibold"
            onClick={() => navigate('/register')}
          >
            Probar Chatboc ahora
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="px-8 py-4 text-base font-semibold"
            onClick={() => navigate('/demo')}
          >
            Ver demo en vivo
          </Button>
        </div>
      </div>
    </section>
  );
};

export default SolutionSection;

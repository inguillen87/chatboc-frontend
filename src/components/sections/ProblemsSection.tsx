import React from 'react';
import { Clock, User, Users, Calendar, Bot } from 'lucide-react';

const ProblemsSection = () => {
  const problems = [
    {
      icon: <Clock className="h-6 w-6 text-red-500" />,
      title: "Clientes Impacientes",
      description: "Perdés oportunidades porque los clientes quieren respuestas instantáneas y no siempre estás disponible."
    },
    {
      icon: <Users className="h-6 w-6 text-orange-500" />,
      title: "Consultas Repetitivas",
      description: "Invertís horas respondiendo las mismas preguntas una y otra vez, tiempo que podrías dedicar a hacer crecer tu negocio."
    },
    {
      icon: <User className="h-6 w-6 text-yellow-500" />,
      title: "Atención Despersonalizada",
      description: "Cuesta ofrecer una atención adaptada a cada cliente con los recursos limitados de una pyme."
    },
    {
      icon: <Calendar className="h-6 w-6 text-green-500" />,
      title: "Oportunidades Perdidas Fuera de Horario",
      description: "Las consultas que llegan por la noche o los fines de semana se enfrían o se van a la competencia."
    },
    {
      icon: <Bot className="h-6 w-6 text-blue-500" />,
      title: "Chatbots Genéricos que Frustran",
      description: "Probaste otros bots, pero no entienden tu rubro ni las necesidades reales de tus clientes."
    }
  ];

  return (
    <section id="problemas" className="section-padding bg-background text-foreground">
      <div className="container px-4 mx-auto">
        <div className="text-center mb-12 max-w-3xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">¿Tu Pyme Enfrenta Estos Desafíos Diarios?</h2>
          <p className="text-lg text-muted-foreground">
            La mayoría de las pequeñas y medianas empresas se enfrentan a estos problemas que afectan directamente su crecimiento y rentabilidad.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {problems.map((problem, index) => (
            <div
              key={index}
              className="bg-card text-card-foreground p-6 rounded-xl border border-border shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="p-3 rounded-full bg-muted inline-flex mb-4">
                {problem.icon}
              </div>
              <h3 className="text-xl font-semibold mb-2">{problem.title}</h3>
              <p className="text-muted-foreground">{problem.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ProblemsSection;

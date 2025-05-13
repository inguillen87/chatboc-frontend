
import React from 'react';
import { Clock, User, Users, Calendar, Bot } from 'lucide-react';

const ProblemsSection = () => {
  const problems = [
    {
      icon: <Clock className="h-6 w-6 text-red-500" />,
      title: "Clientes Impacientes",
      description: "Pierdes oportunidades porque los clientes quieren respuestas instantáneas y no siempre estás disponible."
    },
    {
      icon: <Users className="h-6 w-6 text-orange-500" />,
      title: "Consultas Repetitivas",
      description: "Inviertes horas respondiendo las mismas preguntas una y otra vez, tiempo que podrías dedicar a hacer crecer tu negocio."
    },
    {
      icon: <User className="h-6 w-6 text-yellow-500" />,
      title: "Atención Despersonalizada",
      description: "Te cuesta ofrecer una atención verdaderamente adaptada a cada cliente con los recursos limitados de una pyme."
    },
    {
      icon: <Calendar className="h-6 w-6 text-green-500" />,
      title: "Oportunidades Perdidas Fuera de Horario",
      description: "Las consultas que llegan por la noche o los fines de semana se enfrían o se van a la competencia."
    },
    {
      icon: <Bot className="h-6 w-6 text-blue-500" />,
      title: "Chatbots Genéricos que Frustran",
      description: "Has probado otros chatbots, pero no entienden la jerga de tu sector ni las necesidades específicas de tus clientes."
    }
  ];

  return (
    <section id="problems" className="section-padding bg-white">
      <div className="container px-4 mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">¿Tu Pyme Enfrenta Estos Desafíos Diarios?</h2>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto">
            La mayoría de las pequeñas y medianas empresas se enfrentan a estos problemas que afectan directamente su crecimiento y rentabilidad.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {problems.map((problem, index) => (
            <div 
              key={index} 
              className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="p-3 rounded-full bg-gray-50 inline-flex mb-4">
                {problem.icon}
              </div>
              <h3 className="text-xl font-semibold mb-2">{problem.title}</h3>
              <p className="text-gray-600">{problem.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ProblemsSection;

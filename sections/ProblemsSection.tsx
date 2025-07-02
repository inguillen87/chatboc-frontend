import React from 'react';
import { Clock, User, Users, Calendar, Bot, FileText, Zap, Database } from 'lucide-react';

const problems = [
  {
    icon: <Clock className="h-6 w-6 text-red-500" />,
    title: "Clientes Impacientes",
    description: "Perdés ventas porque los clientes exigen respuestas inmediatas y no siempre podés atenderlos en el momento.",
    comment: "Chatboc responde al instante, 24/7, sin depender de humanos ni horarios."
  },
  {
    icon: <Users className="h-6 w-6 text-orange-500" />,
    title: "Consultas Repetitivas que te Roban Tiempo",
    description: "Pasás horas respondiendo lo mismo todos los días: precios, stock, horarios, formas de pago…",
    comment: "Con nuestro sistema, cada respuesta se automatiza y se personaliza según tu catálogo actualizado."
  },
  {
    icon: <FileText className="h-6 w-6 text-blue-700" />,
    title: "Catálogos y Listados Difíciles de Usar",
    description: "Tus productos y servicios cambian todo el tiempo, y mantener la información actualizada para tus clientes es un dolor de cabeza.",
    comment: "Ahora sólo subís tu PDF o Excel, y Chatboc responde usando la info real de tu negocio."
  },
  {
    icon: <Database className="h-6 w-6 text-fuchsia-600" />,
    title: "Bots que No Entienden tu Rubro",
    description: "Probaste otros bots, pero no reconocen términos de tu industria ni pueden buscar productos o condiciones especiales.",
    comment: "La IA de Chatboc usa Qdrant y procesamiento semántico: entiende consultas complejas y específicas de tu sector."
  },
  {
    icon: <Calendar className="h-6 w-6 text-green-500" />,
    title: "Oportunidades Perdidas Fuera de Horario",
    description: "Las consultas fuera de horario o durante el finde terminan en la competencia porque no podés responderlas rápido.",
    comment: "Chatboc atiende en tu web, WhatsApp o donde quieras, todos los días y a toda hora."
  },
  {
    icon: <Zap className="h-6 w-6 text-yellow-400" />,
    title: "Falta de Automatización Real",
    description: "Muchos sistemas prometen automatizar, pero siguen dependiendo de respuestas básicas o supervisión constante.",
    comment: "Con Chatboc, la automatización es total: cotiza, responde, deriva y aprende solo."
  }
];

const ProblemsSection = () => {
  return (
    <section id="problemas" className="section-padding bg-background text-foreground">
      <div className="container px-4 mx-auto">
        <div className="text-center mb-12 max-w-3xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            ¿Tu Pyme Sufre Estos Problemas? 
          </h2>
          <p className="text-lg text-muted-foreground">
            Las pymes de hoy pierden ventas y reputación por no poder responder con agilidad y profesionalismo. <b>Con Chatboc podés automatizar, personalizar y escalar tu atención al cliente usando la misma tecnología que las grandes empresas globales.</b>
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {problems.map((problem, index) => (
            <div
              key={index}
              className="bg-card text-card-foreground p-6 rounded-xl border border-border shadow-sm hover:shadow-lg transition-shadow relative"
            >
              <div className="p-3 rounded-full bg-muted flex items-center justify-center mb-4">
                {problem.icon}
              </div>
              <h3 className="text-xl font-semibold mb-2">{problem.title}</h3>
              <p className="text-muted-foreground mb-3">{problem.description}</p>
              <p className="text-xs text-blue-700 italic">{problem.comment}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ProblemsSection;

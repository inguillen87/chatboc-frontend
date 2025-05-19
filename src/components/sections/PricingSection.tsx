import React from 'react';
import { CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

const plans = [
  {
    name: 'Prueba Gratuita',
    price: 'GRATIS',
    duration: '/ 15 días',
    description: 'Probá Chatboc sin compromisos ni tarjeta de crédito.',
    features: [
      'Hasta 10 preguntas por día',
      'Configuración inicial guiada',
      'Hasta 10 preguntas y respuestas personalizadas',
      'Funcionalidad básica de IA',
      'Integración Web (Widget)',
      'Soporte básico'
    ],
    button: 'Comenzar GRATIS',
    action: '/register',
    highlight: false,
  },
  {
    name: 'Chatboc Pro',
    price: '$20',
    duration: '/ mes',
    description: 'Solución completa para automatizar tu atención al cliente.',
    features: [
      'Todo lo del plan gratuito, ¡y más!',
      'Hasta 50 preguntas y respuestas personalizadas',
      'Panel de administración con estadísticas',
      'Entrenamiento IA especializado en tu rubro',
      'Aprendizaje continuo y respuestas más inteligentes',
      'Integración Web y soporte prioritario',
      'Actualizaciones constantes'
    ],
    button: 'Elegir Plan Pro',
    action: '/register',
    highlight: true,
  },
  {
    name: 'Chatboc WhatsApp',
    price: '$30',
    duration: '/ mes',
    description: 'Todo el poder de Chatboc, conectado directamente con WhatsApp Business.',
    features: [
      'Todo lo del plan Pro',
      'Integración real con WhatsApp Business',
      'Configuración personalizada con soporte técnico',
      'Atención por WhatsApp 24/7',
      'Entrenamiento IA mejorado para conversaciones fluidas en mobile',
      'Ideal para empresas que reciben muchas consultas por WhatsApp'
    ],
    button: 'Solicitar Integración',
    action: 'https://wa.me/5492613168608?text=Hola! Quiero activar el plan WhatsApp de Chatboc.',
    highlight: false,
    external: true,
  },
];

const PricingSection = () => {
  const navigate = useNavigate();

  return (
    <section id="precios" className="bg-white py-16">
      <div className="container px-4 mx-auto text-center">
        <h2 className="text-3xl md:text-4xl font-bold mb-6">Planes para cada etapa de tu Pyme</h2>
        <p className="text-gray-600 mb-12 max-w-2xl mx-auto">
          Desde pruebas simples hasta automatización total, elegí el plan que se adapte a tus objetivos.
        </p>
        <div className="grid md:grid-cols-3 gap-8">
          {plans.map((plan, idx) => (
            <div
              key={idx}
              className={`p-6 rounded-xl border ${
                plan.highlight ? 'border-blue-500 shadow-lg' : 'border-gray-200'
              } transition`}
            >
              <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
              <p className="text-3xl font-semibold text-blue-600">{plan.price}</p>
              <p className="text-sm text-gray-500 mb-4">{plan.duration}</p>
              <p className="text-gray-700 mb-6">{plan.description}</p>
              <ul className="text-left space-y-2 mb-6">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-2 text-gray-600 text-sm">
                    <CheckCircle className="w-4 h-4 text-green-500 mt-1" />
                    {feature}
                  </li>
                ))}
              </ul>
              {plan.external ? (
                <a
                  href={plan.action}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block w-full text-center bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition"
                >
                  {plan.button}
                </a>
              ) : (
                <Button
                  onClick={() => navigate(plan.action)}
                  className="w-full"
                >
                  {plan.button}
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PricingSection;

import React from 'react';
import { CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

const plans = [
  {
    title: 'Prueba Gratuita',
    price: 'GRATIS',
    duration: '/ 15 días',
    description: 'Probá Chatboc sin compromisos ni tarjeta de crédito.',
    features: [
      'Hasta 10 preguntas por día',
      '15 días de uso ilimitado',
      'Configuración inicial guiada',
      'Hasta 10 preguntas/respuestas personalizadas',
      'Integración Web (Widget)',
      'IA básica + FAQ con NLP',
      'Soporte básico por email'
    ],
    cta: 'Comenzar GRATIS',
    buttonStyle: 'secondary',
    href: '/register',
  },
  {
    title: 'Chatboc Pro',
    price: '$30',
    duration: '/ mes',
    description: 'Automatización avanzada y panel completo.',
    features: [
      'Hasta 50 preguntas/respuestas personalizadas',
      'Entrenamiento NLP por rubro',
      'Panel con estadísticas y mejoras continuas',
      'Aprendizaje IA y FAQ avanzado',
      'Integración Web completa',
      'Soporte prioritario',
      'Actualizaciones constantes'
    ],
    cta: 'Elegir Plan Pro',
    buttonStyle: 'default',
    href: '/register',
  },
  {
    title: 'Chatboc Full + WhatsApp',
    price: '$80',
    duration: '/ mes',
    description: 'Incluye todo lo anterior + integración técnica con WhatsApp Business.',
    features: [
      'Todo lo del plan Pro',
      'Integración real con WhatsApp Business',
      'Implementación técnica completa (API, línea y pruebas)',
      'IA entrenada por sector',
      'Carga ampliada de preguntas y flujos',
      'Atención preferencial'
    ],
    cta: 'Solicitar Full Plan',
    buttonStyle: 'outline',
    href: 'https://wa.me/5492613168608?text=Quiero%20el%20Plan%20Full%20con%20WhatsApp%20Business',
  }
];

const PricingSection = () => {
  return (
    <section id="precios" className="section-padding bg-white dark:bg-gray-950">
      <div className="container px-4 mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Planes Pensados para Tu Negocio
          </h2>
          <p className="text-gray-600 dark:text-gray-300 text-lg">
            Empezá gratis, escalá según tu crecimiento.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-3">
          {plans.map((plan, index) => (
            <div
              key={index}
              className="border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm hover:shadow-md transition bg-white dark:bg-gray-900"
            >
              <h3 className="text-xl font-semibold mb-1">{plan.title}</h3>
              <p className="text-gray-500 dark:text-gray-400 mb-4 text-sm">{plan.description}</p>
              <div className="text-3xl font-bold mb-2">{plan.price}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-4">{plan.duration}</div>

              <ul className="mb-6 space-y-2 text-sm text-gray-700 dark:text-gray-300">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-blue-600 mt-1" />
                    {feature}
                  </li>
                ))}
              </ul>

              <a href={plan.href} target={plan.href.startsWith('http') ? '_blank' : '_self'}>
                <Button variant={plan.buttonStyle} className="w-full">
                  {plan.cta}
                </Button>
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PricingSection;

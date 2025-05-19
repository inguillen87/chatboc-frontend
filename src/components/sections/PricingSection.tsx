import React from 'react';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

const pricingPlans = [
  {
    name: 'Prueba Gratuita',
    price: 'GRATIS',
    duration: '/ 15 días',
    description: 'Ideal para conocer cómo Chatboc puede ayudar a tu negocio sin compromisos.',
    features: [
      'Hasta 50 consultas por día',
      'Configuración inicial paso a paso',
      'Funcionalidad básica de inteligencia artificial',
      'Integración web con widget flotante',
      'Soporte básico por email',
      'Sin tarjeta de crédito ni datos de facturación',
    ],
    cta: 'Probar sin compromiso',
    highlight: false
  },
  {
    name: 'Chatboc Pro',
    price: '$30',
    duration: '/ mes',
    description: 'Pensado para negocios que quieren automatizar su atención y escalar con IA.',
    features: [
      'Hasta 50 preguntas y respuestas personalizadas',
      'Entrenamiento especializado para tu rubro',
      'Panel de control con métricas y estadísticas',
      'IA con aprendizaje continuo y mejoras automáticas',
      'Integración Web + futura expansión a Telegram y otros canales',
      'Soporte técnico prioritario y acceso anticipado a nuevas funciones',
    ],
    cta: 'Quiero Automatizar mi Negocio',
    highlight: true
  },
  {
    name: 'Chatboc Full + WhatsApp',
    price: '$80',
    duration: '/ mes',
    description: 'Ideal para empresas que ya usan WhatsApp y buscan un canal automatizado de alto impacto.',
    features: [
      'Implementación profesional en WhatsApp Business API',
      'Conexión a tu línea y cuenta con asistencia completa',
      'Entrenamiento con base de datos extendida y respuestas más profundas',
      'Soporte técnico dedicado y personalizado',
    ],
    cta: 'Hablar con un asesor',
    highlight: false
  }
];

const PricingSection = () => {
  return (
    <section id="pricing" className="py-20 bg-background text-foreground">
      <div className="container px-4 mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <h2 className="text-3xl md:text-4xl font-bold mb-2">Planes y Precios</h2>
          <p className="text-muted-foreground">
            Elegí el plan que mejor se adapte a tu negocio. Todos comienzan con una prueba gratuita.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {pricingPlans.map((plan, index) => (
            <div
              key={index}
              className={`relative bg-card text-card-foreground rounded-xl border border-border p-6 shadow-sm hover:shadow-md transition-all ${plan.highlight ? 'ring-2 ring-blue-500 scale-[1.02] z-10' : ''}`}
            >
              {plan.highlight && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white text-xs px-3 py-1 rounded-full shadow">
                  Más Popular
                </div>
              )}
              <h3 className="text-lg font-semibold mb-1">{plan.name}</h3>
              <p className="text-xl font-bold text-white mb-0">{plan.price} <span className="text-sm font-normal text-muted-foreground">{plan.duration}</span></p>
              <p className="text-sm text-muted-foreground italic mt-1 mb-4">{plan.description}</p>
              <p className="text-sm font-semibold mb-2 text-white">Incluye:</p>
              <ul className="text-sm space-y-2 mb-6">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-start">
                    <Check className="h-4 w-4 text-blue-500 mt-1 mr-2" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <Button className="w-full">{plan.cta}</Button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PricingSection;

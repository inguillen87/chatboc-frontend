import React from 'react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Check } from 'lucide-react';

const plans = [
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
      'Sin Integraciones externas',
      'Sin automatizaciones',

      'Sin tarjeta de crédito ni datos de facturación'
    ],
    cta: 'Comenzar GRATIS',
    ctaLink: '/register',
    highlight: false
  },
  {
    name: 'Chatboc Pro',
    price: '$30',
    duration: '/ mes',
    description: 'Ideal para pymes que buscan escalar su atención al cliente con tecnología simple y efectiva.',
    features: [
      'Hasta 200 preguntas y respuestas personalizadas por mes',
      'Entrenamiento optimizado para el rubro de tu empresa',
      'Panel de control con métricas e historial de uso',
      'Asistente inteligente con aprendizaje y mejoras continuas',
      'Alertas automáticas por palabra clave (ej: reclamo, urgencia, compra)',
      'Registro automático de conversaciones (planilla o sistema)',
      'Soporte técnico prioritario y acceso anticipado a nuevas funcionalidades'
    ],
    cta: 'Elegir Plan Pro',
    ctaLink: '/register',
    highlight: true

  },
  {
    name: 'Chatboc Full',
    price: '$80',
    duration: '/ mes',
    description: 'Ideal para empresas que ya usan WhatsApp y buscan un canal automatizado de alto impacto.',
      features: [
      'Consultas ilimitadas',
      'Automatización completa de respuestas, seguimientos y derivaciones',
      'Envío automático de catálogos, promociones o formularios por email',
      'Integración con herramientas externas (CRM, planillas, formularios, etc.)',
      'Acceso a panel administrativo completo con historial y métricas',
      'Dashboard mensual con indicadores de rendimiento del chatbot',
      'Soporte para empresas con múltiples unidades de negocio o servicios diferenciados',
      'Soporte técnico dedicado y configuración avanzada incluida'
    ],

    cta: 'Solicitar Activación WhatsApp',
    ctaLink: 'https://wa.me/5492613168608?text=Hola! Estoy probando Chatboc y quiero implementarlo en mi empresa.',
    highlight: false
  }
];

const PricingSection = () => {
  const navigate = useNavigate();

  return (
    <section id="pricing" className="py-20 bg-background text-foreground">
      <div className="container px-4 mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Planes y Precios</h2>
          <p className="text-muted-foreground">Elegí el plan que mejor se adapte a tu negocio. Todos comienzan con una prueba gratuita.</p>
        </div>

        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan, index) => (
            <div
              key={index}
              className={`p-6 rounded-xl border border-border shadow-md bg-card text-card-foreground relative transition-transform duration-300 hover:shadow-xl hover:scale-105 animate-fade-in ${plan.highlight ? 'ring-2 ring-blue-500' : ''}`}
            >
              {plan.highlight && (
                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-blue-600 text-white text-xs px-3 py-1 rounded-full">
                  Más Popular
                </div>
              )}

              <h3 className="text-xl font-bold mb-1">{plan.name}</h3>
              <p className="text-lg text-white font-semibold mb-1">{plan.price} <span className="text-sm font-normal text-muted-foreground">{plan.duration}</span></p>
              <p className="text-sm italic text-muted-foreground mb-4">{plan.description}</p>

              <p className="text-sm font-semibold mb-2 text-foreground">Incluye:</p>
              <ul className="space-y-2 text-sm text-muted-foreground mb-6">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-blue-500 mt-1" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                size="lg"
                className={`w-full font-semibold ${plan.name.includes('WhatsApp') ? 'bg-green-600 hover:bg-green-700 text-white' : ''}`}
                onClick={() => {
                  if (plan.ctaLink.startsWith('http')) {
                    window.open(plan.ctaLink, '_blank');
                  } else {
                    navigate(plan.ctaLink);
                  }
                }}
              >
                {plan.cta}
              </Button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PricingSection;

import React from 'react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Check, Sparkles } from 'lucide-react';

const plans = [
  {
    name: 'Prueba Gratuita',
    price: 'GRATIS',
    duration: '/ 15 días',
    description: 'Probá nuestra tecnología de IA con subida de catálogos, consultas inteligentes y atención automatizada. Ideal para ver el potencial real de Chatboc.',
    features: [
      'Hasta 50 consultas',
      'Carga de catálogo en PDF o Excel',
      'Procesamiento automático con Google Document AI',
      'Búsqueda inteligente con algoritmos de vectores (Qdrant)',
      'Configuración inicial guiada',
      'Widget web flotante',
      'Sin integraciones externas',
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
    description: 'Automatización profesional para pymes. Incluye procesamiento avanzado de catálogos, respuestas personalizadas y tecnología de IA de última generación.',
    features: [
      'Hasta 200 preguntas y respuestas personalizadas por mes',
      'Entrenamiento optimizado para el rubro de tu empresa',
      'Carga Controlada de catálogos en PDF/Excel',
      'Búsqueda y respuestas en tiempo real usando Qdrant',
      'Panel de métricas, historial de consultas y mejoras continuas',
      'Asistente IA con aprendizaje sobre tus productos',
      'Alertas inteligentes por palabra clave',
      'Registro automático de conversaciones',
      'Soporte prioritario y acceso a nuevas funciones'
    ],
    cta: 'Elegir Plan Pro',
    ctaLink: '/register',
    highlight: true
  },
  {
    name: 'Chatboc Full',
    price: '$80',
    duration: '/ mes',
    description: 'Todo el poder de nuestra IA: atención ilimitada, integración WhatsApp, automatizaciones y paneles avanzados. Desarrollado con tecnología mundial de vanguardia.',
    features: [
      'Consultas ilimitadas y multicanal',
      'Automatización completa: respuestas, seguimientos y derivaciones',
      'Envío de catálogos, promociones y formularios personalizados',
      'CRM y paneles visuales exclusivos en la nube',
      'Acceso total a panel administrativo, prospectos y filtros avanzados',
      'Dashboard mensual con indicadores clave',
      'Tecnología de vectores y procesamiento de lenguaje natural a nivel global',
      'Soporte para empresas con múltiples unidades, rubros o sucursales',
      'Soporte técnico premium y configuración avanzada incluida'
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
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="flex justify-center mb-4">
            <Sparkles className="h-8 w-8 text-blue-500" />
          </div>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Planes y Precios</h2>
          <p className="text-lg text-muted-foreground">
            Somos la primera plataforma en la región que integra procesamiento de catálogos en PDF y Excel usando <b>Google Document AI</b> y <b>Qdrant</b> (búsqueda por vectores), la misma tecnología que utilizan empresas líderes a nivel mundial.  
            <br /><br />
            Chatboc no es un bot tradicional: nuestros algoritmos de inteligencia artificial convierten tu catálogo en respuestas automáticas, cotizaciones instantáneas y asistencia personalizada para cada cliente.<br />
            Elegí tu plan y llevá la atención de tu empresa a otro nivel.
          </p>
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
              <p className="text-lg font-semibold mb-1">{plan.price} <span className="text-sm font-normal text-muted-foreground">{plan.duration}</span></p>
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

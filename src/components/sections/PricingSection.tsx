import React from 'react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
// Actualizar iconos según los nuevos planes y enfoque
import { Check, Sparkles, Building, Users } from 'lucide-react';

// Definición de planes adaptada a tres propuestas clave
const pricingOptions = [
  {
    name: 'Plan Gratis Esencial',
    headline: 'Actívalo sin costo junto a un especialista',
    description:
      'Descubre Chatboc sin riesgos. Ideal para validar la atención con IA y mostrar resultados rápidos desde el día uno.',
    features: [
      'Chatbot IA listo para usar con configuración guiada',
      'Hasta 100 conversaciones mensuales para tus primeros casos',
      'Carga de 3 documentos de referencia (PDF, Word o Excel)',
      'Widget web personalizable y base de respuestas inteligente',
      'Panel de seguimiento básico con métricas esenciales',
    ],
    cta: 'Agendar activación gratuita',
    ctaLink:
      'https://wa.me/5492613168608?text=Hola!%20Quiero%20activar%20el%20Plan%20Gratis%20Esencial%20de%20Chatboc%20junto%20a%20un%20especialista',
    highlight: false,
    icon: <Sparkles className="h-10 w-10 text-primary" />,
  },
  {
    name: 'Plan Full PyME',
    headline: 'Creamos contigo una experiencia omnicanal de alto impacto',
    description:
      'Potencia ventas y soporte con automatizaciones profundas, integraciones y reportes diseñados para equipos en crecimiento.',
    features: [
      'Todo lo del Plan Gratis y acompañamiento estratégico continuo',
      'Interacciones mensuales ampliadas para captar y fidelizar leads',
      'Integración con CRM y herramientas comerciales clave',
      'Campañas automatizadas y respuestas multicanal (web, WhatsApp, email)',
      'Analíticas avanzadas, embudos personalizados y soporte prioritario',
    ],
    cta: 'Hablar con un asesor PyME',
    ctaLink:
      'https://wa.me/5492613168608?text=Hola!%20Quiero%20una%20demostraci%C3%B3n%20del%20Plan%20Full%20PyME%20de%20Chatboc',
    highlight: true,
    icon: <Users className="h-10 w-10 text-primary" />,
  },
  {
    name: 'Plan Gubernamental',
    headline: 'Diseñamos soluciones a medida para gobiernos e instituciones',
    description:
      'Escala la atención ciudadana con procesos seguros, interoperables y acompañamiento experto de principio a fin.',
    features: [
      'Consultoría especializada y desarrollo de flujos personalizados',
      'Integración con sistemas legados, ERP, GovTech y BI',
      'Gestión de altos volúmenes con cumplimiento y trazabilidad total',
      'Equipo dedicado para capacitación, soporte y mejora continua',
      'Acuerdos de servicio (SLA) y gobernanza de datos de nivel institucional',
    ],
    cta: 'Coordinar reunión institucional',
    ctaLink:
      'https://wa.me/5492613168608?text=Hola!%20Necesito%20una%20propuesta%20para%20el%20Plan%20Gubernamental%20de%20Chatboc',
    highlight: false,
    icon: <Building className="h-10 w-10 text-primary" />,
  },
];

const PricingSection = () => {
  const navigate = useNavigate();

  return (
    <section id="precios" className="py-16 md:py-24 bg-muted text-foreground"> {/* Alternar fondo */}
      <div className="container px-4 mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-12 md:mb-16">
          <div className="inline-block p-3 mb-4 bg-primary/10 rounded-lg">
            <Sparkles className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Planes Flexibles para Impulsar tu Comunicación
          </h2>
          <p className="text-lg text-muted-foreground">
            Ofrecemos soluciones para cada necesidad: desde startups y empresas en crecimiento hasta municipios y grandes corporaciones. Descubre el poder de la IA y un CRM inteligente adaptado a ti.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-1 lg:grid-cols-3 items-stretch"> {/* items-stretch para igualar alturas si son diferentes */}
          {pricingOptions.map((option, index) => (
            <div
              key={index}
              className={`relative p-6 md:p-8 rounded-lg border ${option.highlight ? 'border-primary ring-2 ring-primary' : 'border-border'} shadow-lg bg-card text-card-foreground flex flex-col transition-transform duration-300 hover:shadow-xl hover:scale-[1.03]`}
            >
              {option.highlight && (
                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full shadow-md">
                  Recomendado
                </div>
              )}

              {option.icon && <div className="flex justify-center mb-5">{option.icon}</div>}

              <h3 className="text-2xl font-bold mb-3 text-center">{option.name}</h3>

              <div className="text-center mb-4">
                <span className="text-lg font-semibold text-primary">{option.headline}</span>
              </div>

              <p className="text-sm text-muted-foreground mb-6 text-center flex-grow">{option.description}</p>

              {option.features && (
                <>
                  <p className="text-sm font-semibold mb-3">
                    Lo que incluye:
                  </p>
                  <ul className="space-y-2.5 text-sm text-muted-foreground mb-8 flex-grow">
                    {option.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-2.5">
                        <Check className="h-5 w-5 text-success flex-shrink-0 mt-0.5" /> {/* Icono de check verde */}
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              <Button
                size="lg"
                variant={option.highlight ? 'default' : 'outline'}
                className="w-full font-semibold mt-auto"
                onClick={() => {
                  if (option.ctaLink.startsWith('http')) {
                    window.open(option.ctaLink, '_blank');
                  } else {
                    navigate(option.ctaLink);
                  }
                }}
              >
                {option.cta}
              </Button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PricingSection;

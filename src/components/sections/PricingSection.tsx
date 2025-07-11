import React from 'react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
// Actualizar iconos según los nuevos planes y enfoque
import { Check, Sparkles, Building, Users, MessageSquarePlus, BarChartHorizontalBig } from 'lucide-react';

// Definición de planes adaptada
const pricingOptions = [
  {
    type: 'plan', // Para diferenciar de la tarjeta de contacto
    name: 'Inicia con IA',
    price: 'GRATIS',
    duration: 'por 14 días',
    description: 'Experimenta el poder de nuestra IA. Ideal para individuos o equipos pequeños que quieren empezar a automatizar.',
    features: [
      'Chatbot IA básico',
      'Carga de hasta 2 documentos (PDF/Excel)',
      'Hasta 100 interacciones/mes',
      'Configuración inicial simple',
      'Widget web personalizable',
    ],
    cta: 'Comienza Gratis',
    ctaLink: '/register',
    highlight: false,
  },
  {
    type: 'plan',
    name: 'Profesional Conectado',
    price: '$XX', // Aquí iría el precio real o "Desde $XX"
    duration: '/mes',
    description: 'Solución completa con Chatbot IA y CRM para optimizar la comunicación y gestión de usuarios.',
    features: [
      'Todo en Inicia con IA, y además:',
      'Chatbot IA Avanzado (más personalización)',
      'CRM integrado para gestión de perfiles',
      'Carga de hasta 10 documentos',
      'Hasta 1000 interacciones/mes',
      'Paneles analíticos básicos',
      'Integraciones esenciales (ej. email)',
      'Soporte estándar',
    ],
    cta: 'Elige Profesional',
    ctaLink: '/register?plan=profesional', // Ejemplo de link con plan
    highlight: true,
  },
  {
    type: 'contact', // Tarjeta especial
    icon: <Building className="h-10 w-10 text-primary mb-4" />,
    name: 'Soluciones para Gobiernos y Grandes Empresas',
    description: 'Ofrecemos planes y desarrollos a medida para municipios, entidades públicas y corporaciones con necesidades complejas: implantación asistida, integraciones avanzadas, SLAs, IA especializada y soporte premium.',
    features: [ // Características destacadas para este segmento
        'Consultoría y desarrollo personalizado',
        'Volumen de interacciones y datos escalable',
        'Integración con sistemas existentes (ERP, GovTech)',
        'Seguridad y cumplimiento normativo avanzado',
        'Capacitación y soporte dedicado',
    ],
    cta: 'Contactar para Solución a Medida',
    ctaLink: '/contacto', // O un mailto: o link a agendar reunión
    highlight: false, // Podría tener un estilo visual diferente
  }
];

const PricingSection = () => {
  const navigate = useNavigate();

  return (
    <section id="precios" className="py-16 md:py-24 bg-light text-foreground"> {/* Alternar fondo */}
      <div className="container px-4 mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-12 md:mb-16">
          <div className="inline-block p-3 mb-4 bg-primary/10 rounded-lg">
            <Sparkles className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-dark">
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
              className={`p-6 md:p-8 rounded-lg border ${option.highlight ? 'border-primary ring-2 ring-primary' : 'border-border'} shadow-lg bg-card text-card-foreground flex flex-col transition-transform duration-300 hover:shadow-xl hover:scale-[1.03]`}
            >
              {option.highlight && (
                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full shadow-md">
                  Más Popular
                </div>
              )}

              {option.type === 'contact' && option.icon && <div className="flex justify-center mb-4">{option.icon}</div>}

              <h3 className="text-2xl font-bold mb-3 text-dark text-center">{option.name}</h3>

              {option.type === 'plan' && (
                <div className="text-center mb-4">
                  <span className="text-4xl font-extrabold text-primary">{option.price}</span>
                  {option.duration && <span className="text-sm font-medium text-muted-foreground ml-1">{option.duration}</span>}
                </div>
              )}

              <p className="text-sm text-muted-foreground mb-6 text-center flex-grow">{option.description}</p>

              {option.features && (
                <>
                  <p className="text-sm font-semibold mb-3 text-dark">
                    {option.type === 'plan' ? 'Incluye:' : 'Beneficios Destacados:'}
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
                variant={option.highlight ? 'default' : (option.type === 'contact' ? 'default' : 'outline')} // 'default' para la tarjeta de contacto también
                className="w-full font-semibold mt-auto" // mt-auto para empujar al final
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

import React from 'react';
import { CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

const PricingSection = () => {
  const navigate = useNavigate();

  const plans = [
    {
      name: 'Prueba Gratuita',
      price: 'GRATIS',
      duration: '/ 15 días',
      features: [
        'Hasta 10 Preguntas por día',
        'Configuración inicial guiada',
        'Funcionalidad básica de IA',
        'Integración Web (Widget)',
        'Soporte básico',
        'Sin tarjeta de crédito',
      ],
      cta: 'Comenzar GRATIS',
    },
    {
      name: 'Chatboc Pro',
      price: '$30',
      duration: '/ mes',
      features: [
        'Todo lo del plan de prueba',
        'Hasta 50 Preguntas y Respuestas personalizadas',
        'Entrenamiento específico por rubro',
        'Panel con estadísticas y métricas',
        'Aprendizaje IA continuo',
        'Integración Web y futura expansión a Telegram y otros canales',
        'Soporte prioritario y mejoras constantes',
      ],
      cta: 'Elegir Plan Pro',
    },
    {
      name: 'Chatboc Full + WhatsApp',
      price: '$80',
      duration: '/ mes',
      features: [
        'Incluye todo lo del plan PRO',
        'Implementación personalizada vía WhatsApp Business API',
        'Configuración completa por nuestro equipo',
        'Integración con línea y cuenta del cliente',
        'Entrenamiento con base de datos extendida',
        'Soporte técnico dedicado',
      ],
      cta: 'Solicitar Activación WhatsApp',
    },
  ];

  return (
    <section id="precios" className="section-padding bg-background text-foreground">
      <div className="container px-4 mx-auto">
        <div className="text-center mb-12 max-w-3xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Planes de Chatboc</h2>
          <p className="text-lg text-muted-foreground">
            Elegí el plan que mejor se adapte a tu negocio. Probalo gratis o activá una versión profesional con más funcionalidades.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan, index) => (
            <div
              key={index}
              className="bg-card text-card-foreground p-6 rounded-xl border border-border shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
            >
              <div>
                <h3 className="text-xl font-semibold mb-1">{plan.name}</h3>
                <p className="text-3xl font-bold mb-2">{plan.price} <span className="text-sm font-normal">{plan.duration}</span></p>

                <ul className="space-y-2 mb-6 text-sm text-muted-foreground">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-blue-600 mt-1" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-auto">
                <Button
                  className="w-full"
                  onClick={() => navigate('/register')}
                >
                  {plan.cta}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PricingSection;

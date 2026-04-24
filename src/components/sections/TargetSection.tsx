import React from 'react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
// Nuevos iconos representativos
import { Landmark, Briefcase, CheckCircle, ArrowRight, Calendar } from 'lucide-react';

const TargetSection = () => {
  const navigate = useNavigate();

  const municipalBenefits = [
    "Atención ciudadana eficiente 24/7.",
    "Agilización de trámites y consultas frecuentes.",
    "Acceso simplificado a información pública.",
    "Optimización en la gestión de servicios y reclamos.",
    "Fomento de la participación ciudadana.",
  ];

  const businessBenefits = [
    "Servicio al cliente y soporte técnico optimizados.",
    "Automatización de ventas y captura inteligente de leads.",
    "Comunicación personalizada a gran escala.",
    "Mejora tangible de la eficiencia operativa.",
    "Construcción de relaciones duraderas y leales con clientes.",
  ];

  const handleConsultingClick = () => {
    // Redirect to external booking link
    window.open("https://calendly.com/chatboc", "_blank");
  };

  return (
    <section id="publico-objetivo" className="py-16 md:py-24 bg-background text-foreground"> {/* Fondo alterno si es necesario */}
      <div className="container px-4 mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-12 md:mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-foreground">
            Una Solución Versátil para Cada Organización
          </h2>
          <p className="text-lg text-muted-foreground">
            Nuestra plataforma IA se adapta para optimizar la interacción y gestión tanto en el sector público como en el privado, mejorando la experiencia de cada ciudadano y cliente.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 lg:gap-12 items-start">
          {/* Bloque para Municipios y Gobiernos */}
          <div className="bg-card text-card-foreground p-6 md:p-8 rounded-lg border border-border shadow-xl hover:shadow-2xl transition-all duration-300 flex flex-col">
            <div className="flex items-center mb-6">
              <div className="p-3 rounded-full bg-primary/10 text-primary mr-4">
                <Landmark className="h-8 w-8" />
              </div>
              <h3 className="text-2xl font-semibold text-foreground">Gobiernos Cercanos, Ciudadanos Satisfechos</h3>
            </div>
            <p className="text-muted-foreground mb-6 flex-grow">
              Transformamos la manera en que las entidades públicas interactúan con la comunidad, ofreciendo servicios más accesibles, eficientes y transparentes.
            </p>
            <ul className="space-y-3 text-muted-foreground mb-8">
              {municipalBenefits.map((benefit, index) => (
                <li key={index} className="flex items-start gap-2.5">
                  <CheckCircle className="h-5 w-5 text-success flex-shrink-0 mt-0.5" />
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>
            <Button
              variant="outline"
              className="mt-auto w-full sm:w-auto" // mt-auto para alinear botones si las listas son de diferente largo
              onClick={() => navigate('/soluciones/gobierno')} // Enlace a una página específica si existe
            >
              Soluciones para Sector Público <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>

          {/* Bloque para Empresas */}
          <div className="bg-card text-card-foreground p-6 md:p-8 rounded-lg border border-border shadow-xl hover:shadow-2xl transition-all duration-300 flex flex-col">
            <div className="flex items-center mb-6">
              <div className="p-3 rounded-full bg-primary/10 text-primary mr-4">
                <Briefcase className="h-8 w-8" />
              </div>
              <h3 className="text-2xl font-semibold text-foreground">Empresas Conectadas, Clientes Leales</h3>
            </div>
            <p className="text-muted-foreground mb-6 flex-grow">
              Potenciamos a empresas de todos los tamaños para que brinden experiencias excepcionales, automaticen procesos y construyan relaciones sólidas con sus clientes.
            </p>
            <ul className="space-y-3 text-muted-foreground mb-8">
              {businessBenefits.map((benefit, index) => (
                <li key={index} className="flex items-start gap-2.5">
                  <CheckCircle className="h-5 w-5 text-success flex-shrink-0 mt-0.5" />
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>
            <Button
              variant="outline"
              className="mt-auto w-full sm:w-auto"
              onClick={() => navigate('/soluciones/empresas')} // Enlace a una página específica si existe
            >
              Soluciones para Empresas <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="text-center mt-12 md:mt-16">
          <Button
            size="lg"
            className="shadow-lg hover:shadow-xl transition-shadow"
            onClick={handleConsultingClick}
          >
            <Calendar className="mr-2 h-4 w-4" /> Agenda una Consultoría Personalizada
          </Button>
        </div>
      </div>
    </section>
  );
};

export default TargetSection;

import React from "react";
import { Button } from '@/components/ui/button'; // Usar el componente Button
import { Link } from 'react-router-dom'; // Para la navegación
import { ShoppingCart, Users, ArrowRight } from 'lucide-react'; // Iconos representativos

const futureSolutions = [
  {
    id: "chatpos",
    icon: <ShoppingCart className="h-12 w-12 text-primary" />, // Usar color primario o un color temático
    title: "ChatPOS: Punto de Interacción y Gestión Ágil",
    description: "Una solución moderna para puntos de atención, facturación y gestión de servicios/productos, adaptable tanto para comercios como para centros de atención municipal.",
    imageSrc: "/images/chatpos.png", // Mantener si es adecuada
    imageAlt: "Mockup de ChatPOS",
    demoLink: "/chatpos", // Enlace a la página específica de ChatPOS
    buttonText: "Conocer ChatPOS",
    themeColor: "green" // Para un acento de color si se desea
  },
  {
    id: "chatcrm",
    icon: <Users className="h-12 w-12 text-primary" />,
    title: "ChatCRM: Fortalece Relaciones con tus Usuarios",
    description: "Gestiona de forma integral los perfiles de ciudadanos y clientes, automatiza comunicaciones y campañas, y mide la satisfacción para una fidelización efectiva.",
    imageSrc: "/images/chatcrm.png",
    imageAlt: "Mockup de ChatCRM",
    demoLink: "/chatcrm",
    buttonText: "Explorar ChatCRM",
    themeColor: "purple" // Ejemplo de color temático
  }
];

const ComingSoonSection = () => {
  // Definir colores temáticos basados en el themeColor (ejemplo)
  // Esto podría hacerse más elegante con variantes de CVA o props en Button
  const getThemeClasses = (theme: string) => {
    if (theme === "green") {
      return {
        title: "text-green-600 dark:text-green-400",
        button: "bg-green-600 hover:bg-green-700 text-white"
      };
    }
    if (theme === "purple") {
      return {
        title: "text-purple-600 dark:text-purple-400",
        button: "bg-purple-600 hover:bg-purple-700 text-white"
      };
    }
    return { // Default
      title: "text-primary",
      button: "bg-primary hover:bg-primary/90 text-primary-foreground"
    };
  };


  return (
    <section id="proximamente" className="py-16 md:py-24 bg-muted text-foreground"> {/* Fondo alterno */}
      <div className="container px-4 mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-12 md:mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-foreground">
            Descubre Nuestras Soluciones Avanzadas
          </h2>
          <p className="text-lg text-muted-foreground">
            Explora herramientas diseñadas para potenciar la gestión, ventas y la interacción con usuarios en empresas y municipios.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-10">
          {futureSolutions.map((solution) => {
            const themeClasses = getThemeClasses(solution.themeColor);
            return (
              <div
                key={solution.id}
                className="bg-card text-card-foreground rounded-lg border border-border shadow-xl hover:shadow-2xl transition-all duration-300 flex flex-col items-center p-6 md:p-8"
              >
                <div className="p-3 rounded-full bg-primary/10 mb-5">
                  {solution.icon}
                </div>
                <h3 className={`text-2xl font-semibold mb-3 ${themeClasses.title}`}> {/* Aplicar color temático al título */}
                  {solution.title}
                </h3>
                <p className="text-muted-foreground text-center mb-6 flex-grow">
                  {solution.description}
                </p>
                {solution.imageSrc && (
                  <img
                    src={solution.imageSrc}
                    alt={solution.imageAlt}
                    className="my-4 rounded-lg w-full max-w-sm h-auto shadow-md" // Ajustar tamaño y sombra
                  />
                )}
                <Button asChild size="lg" className={`mt-auto w-full sm:w-auto font-semibold ${themeClasses.button}`}>
                  <Link to={solution.demoLink}>
                    {solution.buttonText} <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default ComingSoonSection;

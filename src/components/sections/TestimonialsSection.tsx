import React from 'react';
import { Star } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

// Datos de testimonios adaptados con ejemplos más realistas
const testimonialsData = [
  {
    quote: "Con Chatboc, los vecinos de Junín reciben respuestas inmediatas y todo el seguimiento de sus consultas y reclamos queda digitalizado. El tiempo de resolución mejoró notablemente y nuestro equipo puede enfocarse en casos más complejos.",
    organizationName: "Municipio de Junín, Mendoza", // Nombre principal a mostrar
    authorName: "Equipo de Modernización", // Quién lo dice
    // authorTitle: "Municipio de Junín, Mendoza", // Opcional si organizationName ya es suficiente
    logoSrc: "/logos/municipio-junin-placeholder.png", // Placeholder para el logo real
    avatarFallback: "MJ", // Iniciales de Municipio de Junín
    stars: 5
  },
  {
    quote: "La integración del CRM con WhatsApp nos permitió gestionar mejor a nuestros clientes y automatizar respuestas sin perder la cercanía humana. ¡Un antes y un después para nuestra bodega!",
    organizationName: "Cuatro Fincas Winery",
    authorName: "Gerencia de Marketing y Ventas",
    // authorTitle: "Cuatro Fincas Winery",
    logoSrc: "/logos/cuatro-fincas-placeholder.png", // Placeholder
    avatarFallback: "CF",
    stars: 5
  },
  {
    quote: "Chatboc nos permitió atender los reclamos de los vecinos un 70% más rápido y digitalizar todo el seguimiento desde WhatsApp. La capacitación y el soporte fueron excelentes.",
    organizationName: "Municipio de Concordia, Entre Ríos",
    authorName: "Departamento de Atención al Ciudadano",
    // authorTitle: "Municipio de Concordia, Entre Ríos",
    logoSrc: "/logos/municipio-concordia-placeholder.png", // Placeholder
    avatarFallback: "MC",
    stars: 4
  },
  {
    quote: "Con el chatbot de Chatboc, pudimos responder automáticamente dudas frecuentes sobre nuestros servicios y liberar al personal para tareas de mayor valor estratégico. La implementación fue sorprendentemente sencilla.",
    organizationName: "La Bodega del Este", // Ejemplo de otra empresa
    authorName: "Atención al Cliente",
    // authorTitle: "La Bodega del Este",
    logoSrc: "/logos/bodega-este-placeholder.png", // Placeholder
    avatarFallback: "BE",
    stars: 5
  }
];

const TestimonialsSection = () => {
  return (
    <section id="testimonios" className="py-16 md:py-24 bg-muted text-foreground">
      <div className="container px-4 mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-12 md:mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-foreground">
            Organizaciones que Ya Transforman su Comunicación
          </h2>
          <p className="text-lg text-muted-foreground">
            Descubre cómo municipios y empresas están mejorando la interacción con sus usuarios y optimizando su gestión gracias a nuestra solución integral.
          </p>
        </div>

        <div className="grid gap-6 md:gap-8 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2"> {/* Ajustado a 2 columnas para más espacio por testimonio */}
          {testimonialsData.map((testimonial, index) => (
            <div
              key={index}
              className="bg-card text-card-foreground p-6 md:p-8 rounded-lg border border-border shadow-xl hover:shadow-2xl transition-all duration-300 flex flex-col"
            >
              <div className="flex mb-4 text-yellow-400">
                {Array(testimonial.stars).fill(0).map((_, i) => (
                  <Star key={i} className="h-5 w-5 fill-current" />
                ))}
                {Array(5 - testimonial.stars).fill(0).map((_, i) => (
                  <Star key={`empty-${i}`} className="h-5 w-5 text-muted-foreground/50" />
                ))}
              </div>
              <p className="text-muted-foreground text-base md:text-lg italic mb-6 flex-grow">"{testimonial.quote}"</p> {/* Ligeramente más grande la cita */}
              <div className="flex items-center pt-4 border-t border-border">
                <Avatar className="h-12 w-12 md:h-14 md:w-14 mr-4">
                  <AvatarImage src={testimonial.logoSrc} alt={testimonial.organizationName} />
                  <AvatarFallback className="bg-primary/10 text-primary text-lg md:text-xl">
                    {testimonial.avatarFallback}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h4 className="font-semibold text-base md:text-lg text-foreground">{testimonial.organizationName}</h4>
                  <p className="text-sm text-muted-foreground">— {testimonial.authorName}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;

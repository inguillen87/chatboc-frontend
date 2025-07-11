import React from 'react';
import { Star, Landmark, Building } from 'lucide-react'; // Añadir iconos para tipo de organización
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"; // Usar el componente Avatar de shadcn/ui

// Datos de testimonios adaptados
const testimonialsData = [
  {
    quote: "Desde que implementamos la plataforma, la gestión de consultas ciudadanas es mucho más ágil. Los vecinos obtienen respuestas al instante y nuestro equipo puede enfocarse en casos complejos.",
    name: "Ana Pérez",
    role: "Directora de Modernización", // Rol en lugar de 'company'
    organization: "Municipio de Ciudad Futura",
    avatarIcon: <Landmark className="h-6 w-6" />, // Icono para tipo de organización
    avatarFallback: "MF",
    stars: 5
  },
  {
    quote: "El CRM integrado y el chatbot IA nos han permitido personalizar la atención a nuestros clientes a un nivel que antes era imposible. Las ventas y la satisfacción han aumentado notablemente.",
    name: "Juan García",
    role: "Gerente Comercial",
    organization: "Soluciones Integrales S.A.",
    avatarIcon: <Building className="h-6 w-6" />,
    avatarFallback: "SI",
    stars: 5
  },
  {
    quote: "La capacidad de subir nuestra base de conocimientos y que el IA la utilice para responder con precisión ha sido un cambio de juego. Redujimos el tiempo de capacitación y mejoramos la consistencia.",
    name: "Laura Méndez",
    role: "Jefa de Operaciones",
    organization: "EducaTech Global",
    avatarIcon: <Building className="h-6 w-6" />, // Podría ser otro icono si es una ONG o similar
    avatarFallback: "EG",
    stars: 4 // Variar estrellas para realismo
  }
];

const TestimonialsSection = () => {
  return (
    <section id="testimonios" className="py-16 md:py-24 bg-light text-foreground"> {/* Fondo alterno */}
      <div className="container px-4 mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-12 md:mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-dark">
            Organizaciones que Ya Transforman su Comunicación
          </h2>
          <p className="text-lg text-muted-foreground">
            Descubre cómo municipios, empresas y diversas entidades están mejorando la interacción con sus usuarios y optimizando su gestión gracias a nuestra solución integral.
          </p>
        </div>

        <div className="grid gap-6 md:gap-8 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {testimonialsData.map((testimonial, index) => (
            <div
              key={index}
              className="bg-card text-card-foreground p-6 rounded-lg border border-border shadow-xl hover:shadow-2xl transition-all duration-300 flex flex-col" // Estilo de tarjeta mejorado
            >
              <div className="flex mb-4 text-yellow-400">
                {Array(testimonial.stars).fill(0).map((_, i) => (
                  <Star key={i} className="h-5 w-5 fill-current" /> // fill-current para heredar color
                ))}
                {Array(5 - testimonial.stars).fill(0).map((_, i) => ( // Estrellas vacías
                  <Star key={`empty-${i}`} className="h-5 w-5 text-muted-foreground/50" />
                ))}
              </div>
              <p className="text-muted-foreground mb-6 italic flex-grow">"{testimonial.quote}"</p>
              <div className="flex items-center pt-4 border-t border-border"> {/* Separador */}
                <Avatar className="h-12 w-12 mr-4">
                  {/* <AvatarImage src={testimonial.avatar} alt={testimonial.name} /> Avatar real si se tiene */}
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {testimonial.avatarIcon || testimonial.avatarFallback}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h4 className="font-semibold text-base text-dark">{testimonial.name}</h4>
                  <p className="text-sm text-muted-foreground">{testimonial.role}, {testimonial.organization}</p>
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

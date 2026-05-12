import React from "react";
import { Quote, Star } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const testimonialsData = [
  {
    quote:
      "Pasamos de responder mensajes sueltos a tener historial, tickets y prioridades claras. El equipo opera con mucha más confianza.",
    organizationName: "Equipo de atención ciudadana",
    authorName: "Operación pública",
    avatarFallback: "OP",
    stars: 5,
  },
  {
    quote:
      "El chat dejó de ser solo soporte: ahora captura intención comercial, deriva a venta y conserva el contexto de cada cliente.",
    organizationName: "Equipo comercial",
    authorName: "Empresa regional",
    avatarFallback: "ER",
    stars: 5,
  },
  {
    quote:
      "La mayor diferencia fue poder ver datos frescos y acciones recomendadas. El panel ya no es decorativo: sirve para decidir.",
    organizationName: "Equipo de gestión",
    authorName: "Organización multiárea",
    avatarFallback: "GM",
    stars: 5,
  },
  {
    quote:
      "Pudimos sumar nuevos recorridos sin volver a empezar: el equipo entiende qué hacer y el usuario avanza más rápido.",
    organizationName: "Equipo de implementación",
    authorName: "Operación SaaS",
    avatarFallback: "OS",
    stars: 5,
  },
];

const TestimonialsSection = () => {
  return (
    <section id="testimonios" className="bg-background py-16 text-foreground md:py-24">
      <div className="container mx-auto px-4">
        <div className="mx-auto mb-12 max-w-3xl text-center md:mb-16">
          <div className="chatboc-section-kicker mb-4">Señales de valor</div>
          <h2 className="chatboc-section-heading">La experiencia se nota en la operación diaria</h2>
          <p className="chatboc-section-copy mt-4">
            Más que una capa visual, Chatboc busca que cada conversación deje datos, contexto y una acción posible para el equipo.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {testimonialsData.map((testimonial) => (
            <article key={testimonial.organizationName} className="chatboc-landing-panel chatboc-hover-lift flex flex-col p-5 md:p-6">
              <div className="mb-5 flex items-center justify-between gap-4">
                <Quote className="h-6 w-6 text-primary" />
                <div className="flex text-amber-400">
                  {Array.from({ length: testimonial.stars }).map((_, index) => (
                    <Star key={index} className="h-4 w-4 fill-current" />
                  ))}
                </div>
              </div>
              <p className="flex-1 text-base leading-7 text-muted-foreground">"{testimonial.quote}"</p>
              <div className="mt-6 flex items-center border-t border-border/70 pt-4">
                <Avatar className="mr-4 h-11 w-11">
                  <AvatarFallback className="bg-primary/10 text-primary">{testimonial.avatarFallback}</AvatarFallback>
                </Avatar>
                <div>
                  <h4 className="font-semibold text-foreground">{testimonial.organizationName}</h4>
                  <p className="text-sm text-muted-foreground">{testimonial.authorName}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;

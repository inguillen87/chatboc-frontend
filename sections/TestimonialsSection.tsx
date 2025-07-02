import React from 'react';
import { Star } from 'lucide-react';

const TestimonialsSection = () => {
  const testimonials = [
    {
      quote: "Desde que implementamos Chatboc, nuestro tiempo de respuesta mejoró un 90% y las consultas repetitivas disminuyeron drásticamente. ¡Ahora podemos enfocarnos en hacer crecer el negocio!",
      name: "María González",
      company: "Fashionista Store",
      avatar: "https://randomuser.me/api/portraits/women/68.jpg",
      stars: 5
    },
    {
      quote: "La personalización inicial fue clave. Chatboc realmente entiende nuestro nicho y nuestros clientes lo notan. ¡Lo recomiendo!",
      name: "Carlos Rodríguez",
      company: "Tech Solutions",
      avatar: "https://randomuser.me/api/portraits/men/45.jpg",
      stars: 5
    },
    {
      quote: "El soporte al implementar Chatboc fue excelente. En solo días, el chatbot ya estaba respondiendo las dudas más comunes y capturando datos de potenciales clientes.",
      name: "Ana Martínez",
      company: "Asesoría Legal",
      avatar: "https://randomuser.me/api/portraits/women/32.jpg",
      stars: 5
    }
  ];

  return (
    <section className="py-14 md:py-20 bg-blue-50 dark:bg-background">
      <div className="container px-4 mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-12 md:mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-3">
            Pymes como la Tuya ya Confían en Chatboc
          </h2>
          <p className="text-lg text-muted-foreground">
            Descubrí cómo Chatboc transforma la atención al cliente en negocios reales.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {testimonials.map((t, index) => (
            <div
              key={index}
              className="bg-card text-card-foreground p-6 rounded-xl border border-border shadow-sm hover:shadow-md transition"
            >
              <div className="flex mb-3 text-yellow-400">
                {Array(t.stars).fill(0).map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-yellow-400" />
                ))}
              </div>
              <p className="text-sm italic text-muted-foreground mb-5">"{t.quote}"</p>
              <div className="flex items-center">
                <img
                  src={t.avatar}
                  alt={t.name}
                  className="w-10 h-10 rounded-full mr-3 object-cover"
                />
                <div>
                  <h4 className="font-medium text-sm">{t.name}</h4>
                  <p className="text-xs text-muted-foreground">{t.company}</p>
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


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
    <section className="section-padding bg-blue-50">
      <div className="container px-4 mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Pymes como la Tuya ya Confían en Chatboc
          </h2>
          <p className="text-lg text-gray-600">
            Descubre cómo Chatboc está transformando la comunicación y atención al cliente en diversos negocios.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {testimonials.map((testimonial, index) => (
            <div 
              key={index} 
              className="bg-white p-8 rounded-xl shadow-sm border border-gray-100"
            >
              <div className="flex mb-4">
                {Array(testimonial.stars).fill(0).map((_, i) => (
                  <Star key={i} className="h-5 w-5 fill-current text-yellow-400" />
                ))}
              </div>
              <p className="text-gray-700 italic mb-6">"{testimonial.quote}"</p>
              <div className="flex items-center">
                <img 
                  src={testimonial.avatar} 
                  alt={testimonial.name} 
                  className="w-12 h-12 rounded-full mr-4 object-cover"
                />
                <div>
                  <h4 className="font-medium">{testimonial.name}</h4>
                  <p className="text-sm text-gray-500">{testimonial.company}</p>
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


import React from 'react';
import { ShoppingCart, Briefcase, Utensils, Home, GraduationCap } from 'lucide-react';

const TargetSection = () => {
  const targets = [
    {
      icon: <ShoppingCart className="h-8 w-8 text-blue-500" />,
      title: "Tiendas Online (E-commerce)",
      description: "Responde dudas sobre productos, envíos, tallas, y guía en el proceso de compra 24/7."
    },
    {
      icon: <Briefcase className="h-8 w-8 text-blue-500" />,
      title: "Proveedores de Servicios Profesionales",
      description: "Filtra consultas iniciales, agenda citas, y responde preguntas frecuentes sobre tus servicios."
    },
    {
      icon: <Utensils className="h-8 w-8 text-blue-500" />,
      title: "Negocios Locales",
      description: "Gestiona reservas, informa horarios, detalla servicios y promociones."
    },
    {
      icon: <Home className="h-8 w-8 text-blue-500" />,
      title: "Sector Inmobiliario",
      description: "Capta interesados, ofrece detalles de propiedades, y agenda visitas."
    },
    {
      icon: <GraduationCap className="h-8 w-8 text-blue-500" />,
      title: "Instituciones Educativas Pequeñas",
      description: "Informa sobre cursos, procesos de inscripción, y resuelve dudas de alumnos y aspirantes."
    }
  ];

  return (
    <section className="section-padding bg-white">
      <div className="container px-4 mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Chatboc es Ideal para Pymes que Buscan Crecer y Optimizar su Comunicación
          </h2>
          <p className="text-lg text-gray-600">
            Diseñado específicamente para adaptarse a las necesidades de diversos tipos de negocios.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {targets.map((target, index) => (
            <div 
              key={index} 
              className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="mb-4">
                {target.icon}
              </div>
              <h3 className="text-xl font-semibold mb-2">{target.title}</h3>
              <p className="text-gray-600">{target.description}</p>
            </div>
          ))}
          
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-xl border border-blue-200 shadow-sm hover:shadow-md transition-shadow">
            <h3 className="text-xl font-semibold mb-2">¡Y Muchas Más!</h3>
            <p className="text-gray-700">
              Cualquier pyme que reciba consultas constantes y quiera ofrecer una atención al cliente excepcional sin aumentar sus costos operativos.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default TargetSection;

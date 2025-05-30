import React from 'react';
import {
  ShoppingCart,
  Briefcase,
  Utensils,
  Home,
  GraduationCap,
  Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

const targets = [
  {
    icon: <ShoppingCart className="h-8 w-8 text-blue-600" />,
    title: "E-commerce y Tiendas Online",
    description: "Responde consultas sobre productos, stock, envíos y ayuda al usuario a comprar en cualquier momento."
  },
  {
    icon: <Briefcase className="h-8 w-8 text-blue-600" />,
    title: "Servicios Profesionales",
    description: "Filtra consultas, agenda turnos y responde dudas habituales de forma automática."
  },
  {
    icon: <Utensils className="h-8 w-8 text-blue-600" />,
    title: "Negocios Locales y Gastronómicos",
    description: "Gestiona reservas, informa horarios y promociones, y facilita la atención incluso en horarios pico."
  },
  {
    icon: <Home className="h-8 w-8 text-blue-600" />,
    title: "Inmobiliarias y Alquileres",
    description: "Capta interesados, detalla propiedades, responde requisitos y agenda visitas sin esperas."
  },
  {
    icon: <GraduationCap className="h-8 w-8 text-blue-600" />,
    title: "Instituciones Educativas",
    description: "Informa sobre cursos, fechas de inscripción y atiende consultas de estudiantes o padres."
  }
];

const TargetSection = () => {
  const navigate = useNavigate();

  return (
    <section id="target" className="section-padding bg-background text-foreground">
      <div className="container px-4 mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Chatboc Se Adapta a Cualquier Negocio que Quiere Vender y Atender Mejor
          </h2>
          <p className="text-lg text-muted-foreground">
            ¿Recibís muchas consultas y perdés ventas o tiempo respondiendo? Chatboc automatiza tu atención y la lleva a nivel profesional, sin importar tu rubro.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {targets.map((target, index) => (
            <div
              key={index}
              className="bg-card text-card-foreground p-6 rounded-xl border border-border shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="mb-4">{target.icon}</div>
              <h3 className="text-xl font-semibold mb-2">{target.title}</h3>
              <p className="text-muted-foreground">{target.description}</p>
            </div>
          ))}

          <div className="flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/10 dark:to-blue-800/10 p-6 rounded-xl border border-blue-200 dark:border-blue-400/30 shadow-sm hover:shadow-md transition-shadow">
            <Sparkles className="h-8 w-8 text-blue-500 mb-2" />
            <h3 className="text-xl font-semibold mb-2">¿No ves tu rubro?</h3>
            <p className="text-muted-foreground mb-2 text-center">
              Chatboc funciona para cualquier pyme que quiera profesionalizar su atención, captar más clientes y vender 24/7.
            </p>
            <Button
              size="sm"
              variant="outline"
              className="mt-2"
              onClick={() => navigate('/demo')}
            >
              Probar con mi caso
            </Button>
          </div>
        </div>

        {/* Botones CTA */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center mt-14">
          <Button
            size="lg"
            className="px-8 py-4 text-base font-semibold"
            onClick={() => navigate('/register')}
          >
            Quiero probar Chatboc
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="px-8 py-4 text-base font-semibold"
            onClick={() => navigate('/demo')}
          >
            Ver demo para mi rubro
          </Button>
        </div>
      </div>
    </section>
  );
};

export default TargetSection;

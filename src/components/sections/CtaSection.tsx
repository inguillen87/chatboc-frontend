import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const CtaSection = () => {
  const navigate = useNavigate();

  return (
    <section className="py-14 md:py-20 bg-gradient-to-br from-blue-600 to-blue-800 text-white">
      <div className="container px-4 mx-auto">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4">
            ¿Listo para que Chatboc trabaje para tu Pyme?
          </h2>
          <p className="text-base sm:text-lg opacity-90 mb-6">
            Empezá hoy tu prueba gratuita de 15 días y descubrí cómo Chatboc transforma tu atención al cliente.
          </p>
          <Button
            size="lg"
            variant="secondary"
            className="text-blue-800 bg-white hover:bg-white/90 font-medium transition"
            onClick={() => navigate('/register')}
          >
            Sí, ¡Quiero Mi Prueba Gratuita! <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
          <div className="mt-4">
            <button
              onClick={() => navigate('/login')}
              className="text-sm underline underline-offset-4 hover:text-white/80 transition-colors"
            >
              ¿Ya tenés cuenta? Iniciar sesión
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CtaSection;

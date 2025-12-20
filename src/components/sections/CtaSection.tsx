import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowRight, MessageSquareHeart, UserPlus, Bot } from 'lucide-react'; // Cambiado UserCheck a UserPlus
import { useNavigate } from 'react-router-dom';

const CtaSection = () => {
  const navigate = useNavigate();

  return (
    <section className="py-16 md:py-24 bg-background text-foreground transition-colors"> {/* Fondo según alternancia */}
      <div className="container px-4 mx-auto">
        <div className="text-center max-w-2xl md:max-w-3xl mx-auto">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6 text-foreground">
            ¿Listo para Transformar la Interacción con tus Usuarios?
          </h2>
          <p className="text-lg md:text-xl text-muted-foreground mb-8 md:mb-10">
            Descubre cómo nuestra plataforma IA puede potenciar a tu organización. Explora una demostración interactiva, contáctanos para una asesoría personalizada o crea una cuenta para comenzar.
          </p>

          <div className="flex flex-col sm:flex-row justify-center items-center gap-4 md:gap-5 flex-wrap">
            <Button
              size="lg"
              className="font-semibold shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 w-full sm:w-auto"
              onClick={() => navigate('/demo')}
            >
              <Bot className="mr-2 h-5 w-5" /> Ver Demo Interactiva
            </Button>

            <Button
              size="lg"
              variant="outline"
              className="font-semibold shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 w-full sm:w-auto"
              onClick={() => navigate('/contacto')}
            >
              <MessageSquareHeart className="mr-2 h-5 w-5" /> Hablar con un Asesor
            </Button>

            <Button
              size="lg"
              variant="secondary"
              className="font-semibold shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 w-full sm:w-auto"
              onClick={() => navigate('/register')}
            >
              <UserPlus className="mr-2 h-5 w-5" /> Crear Cuenta {/* CORREGIDO UserCheck a UserPlus */}
            </Button>
          </div>

          <div className="mt-8">
            <button
              onClick={() => navigate('/login')}
              className="text-sm text-muted-foreground hover:text-primary underline underline-offset-4 transition-colors"
            >
              ¿Ya tienes una cuenta? Iniciar sesión
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CtaSection;

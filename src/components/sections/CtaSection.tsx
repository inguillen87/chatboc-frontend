import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowRight, MessageCircle } from 'lucide-react';
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
            Empezá hoy mismo. Podés probarlo sin registrarte, crear tu cuenta o escribirnos por WhatsApp.
          </p>

          <div className="flex flex-col sm:flex-row justify-center items-center gap-4 flex-wrap">
            <Button
              size="lg"
              variant="secondary"
              className="text-blue-800 bg-white hover:bg-white/90 font-medium transition"
              onClick={() => navigate('/demo')}
            >
              Probar sin registrarme <ArrowRight className="ml-2 h-5 w-5" />
            </Button>

            <Button
              size="lg"
              className="bg-white text-blue-800 hover:bg-white/90 font-medium transition"
              onClick={() => navigate('/register')}
            >
              Crear cuenta gratis <ArrowRight className="ml-2 h-5 w-5" />
            </Button>

            <Button
              size="lg"
              variant="outline"
              className="border-white text-white hover:bg-white/10 transition"
              onClick={() =>
                window.open(
                  'https://wa.me/5492613168608?text=Hola! Estoy probando Chatboc y quiero implementarlo en mi empresa.',
                  '_blank'
                )
              }
            >
              Hablar por WhatsApp <MessageCircle className="ml-2 h-5 w-5" />
            </Button>
          </div>

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

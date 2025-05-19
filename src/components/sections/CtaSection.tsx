import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowRight, MessageCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const CtaSection = () => {
  const navigate = useNavigate();

  return (
    <section className="py-14 md:py-20 bg-background text-foreground transition-colors animate-fade-in">
      <div className="container px-4 mx-auto">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            ¿Listo para que Chatboc trabaje para tu Pyme?
          </h2>
          <p className="text-lg text-muted-foreground mb-6">
            Empezá hoy mismo. Podés probarlo sin registrarte, crear tu cuenta o escribirnos por WhatsApp.
          </p>

          <div className="flex flex-col sm:flex-row justify-center items-center gap-4 flex-wrap">
            {/* CTA Principal */}
            <Button
              size="lg"
              className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold shadow-sm transition-transform duration-300 hover:scale-105"
              onClick={() => navigate('/register')}
            >
              Crear cuenta gratis <ArrowRight className="ml-2 h-5 w-5" />
            </Button>

            {/* CTA Alternativa */}
            <Button
              size="lg"
              variant="outline"
              className="border-border text-foreground hover:bg-muted/50 font-semibold transition-transform duration-300 hover:scale-105"
              onClick={() => navigate('/demo')}
            >
              Probar sin registrarme <ArrowRight className="ml-2 h-5 w-5" />
            </Button>

            {/* WhatsApp */}
            <Button
              size="lg"
              className="bg-green-600 hover:bg-green-700 text-white font-semibold shadow-sm transition-transform duration-300 hover:scale-105"
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

          <div className="mt-6">
            <button
              onClick={() => navigate('/login')}
              className="text-sm underline underline-offset-4 hover:text-muted-foreground transition-colors"
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

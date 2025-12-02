import React from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, Users, Zap } from "lucide-react"; // MessageSquareText no se usa aquí
import ChatbocLogoAnimated from "../chat/ChatbocLogoAnimated";
import { useNavigate } from "react-router-dom";

const HeroSection = () => {
  const navigate = useNavigate();

  return (
    <section className="py-20 md:py-28 bg-background text-foreground transition-colors">
      <div className="container px-4 mx-auto">
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
          {/* Texto principal */}
          <div className="w-full lg:w-1/2 lg:pr-10 text-center lg:text-left">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-6 leading-tight">
              {/* Aplicando el efecto degradado a "Conectamos" */}
              <span
                className="bg-gradient-to-r from-primary via-blue-500 to-cyan-500 text-transparent bg-clip-text"
              >
                Conectamos
              </span> Gobiernos y Empresas con sus Comunidades
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground mb-8">
              Transforma la interacción con ciudadanos y clientes mediante nuestra plataforma IA con CRM inteligente y Chatbots que realmente entienden y resuelven.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 mb-6">
              <Button
                size="lg"
                className="w-full sm:w-auto shadow-lg hover:shadow-xl transition-shadow"
                onClick={() => navigate("/demo")}
              >
                <Zap className="mr-2 h-5 w-5" /> Probar Demo Interactiva
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="w-full sm:w-auto shadow-lg hover:shadow-xl transition-shadow"
                onClick={() => navigate("/register")}
              >
                <Users className="mr-2 h-5 w-5" /> Conocer Soluciones
              </Button>
            </div>

            <p className="text-sm text-muted-foreground text-center lg:text-left">
              Impulsa la eficiencia y la satisfacción. Simple de empezar, poderoso para crecer.
            </p>
          </div>

          {/* Visual: Simulación de chat ... (el resto del código de la simulación de chat se mantiene igual) ... */}
          <div className="w-full lg:w-1/2 relative mt-8 lg:mt-0">
            <div className="bg-card text-card-foreground rounded-xl shadow-xl p-5 border border-border max-w-full sm:max-w-md mx-auto animate-float">
              <div className="flex items-center border-b border-border pb-3 mb-4">
                <div className="mr-3">
                  <ChatbocLogoAnimated size={36} />
                </div>
                <div>
                  <h3 className="font-semibold text-base text-foreground">Asistente Inteligente</h3>
                  <p className="text-xs text-muted-foreground">Potenciado por Chatboc IA</p>
                </div>
                <div className="ml-auto">
                  <span className="inline-flex items-center px-2.5 py-1 bg-success/10 text-success text-xs font-medium rounded-full">
                    <span className="w-2 h-2 bg-success rounded-full mr-1.5" />
                    Online
                  </span>
                </div>
              </div>

              <div className="space-y-3.5 text-sm max-h-[300px] overflow-y-auto pr-2">
                <div className="flex">
                  <div className="bg-primary/10 text-primary-dark p-3 rounded-lg rounded-bl-none max-w-[85%]">
                    <p className="font-medium text-primary">Vecino:</p>
                    Hola, necesito información sobre cómo renovar mi licencia de conducir.
                  </div>
                </div>
                <div className="flex justify-end">
                  <div className="bg-muted text-foreground p-3 rounded-lg rounded-br-none max-w-[85%]">
                    <p className="font-medium text-foreground">Asistente IA:</p>
                    ¡Hola! Para renovar tu licencia necesitas: DNI vigente, licencia anterior, y no tener multas pendientes. El trámite se inicia online aquí: [enlace]. ¿Te puedo ayudar con algo más?
                  </div>
                </div>
                <div className="flex">
                  <div className="bg-primary/10 text-primary-dark p-3 rounded-lg rounded-bl-none max-w-[85%]">
                    <p className="font-medium text-primary">Vecino:</p>
                    ¿Dónde puedo verificar si tengo multas?
                  </div>
                </div>
                <div className="flex justify-end">
                  <div className="bg-muted text-foreground p-3 rounded-lg rounded-br-none max-w-[85%]">
                    <p className="font-medium text-foreground">Asistente IA:</p>
                    Puedes consultar tus multas pendientes en el portal de infracciones de la ciudad: [enlace]. ¿Alguna otra consulta?
                  </div>
                </div>
              </div>

              <div className="mt-4 flex">
                <input
                  type="text"
                  placeholder="Escribe tu consulta aquí..."
                  className="flex-1 border border-input bg-background text-foreground rounded-l-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <Button variant="default" size="icon" className="rounded-l-none">
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </div>
            </div>
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-primary/5 rounded-full blur-3xl -z-10" />
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;

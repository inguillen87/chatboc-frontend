import React from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, Users, Zap } from "lucide-react";
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
              <span
                className="bg-gradient-to-r from-primary via-blue-500 to-cyan-500 text-transparent bg-clip-text"
              >
                Conectamos
              </span> Gobiernos y Empresas con sus Comunidades
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground mb-8">
              Creamos <strong>Agentes IA</strong> que entienden y resuelven, no simples chatbots.
              <br className="hidden md:block" />
              Una plataforma <strong>SaaS "llave en mano"</strong>: sube tu catálogo o normativa y obtén tu Marketplace o Portal de Servicios listo para usar. Sin configuraciones técnicas complejas.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 mb-6">
              <Button
                size="lg"
                className="w-full sm:w-auto shadow-lg hover:shadow-xl transition-shadow"
                onClick={() => navigate("/demo")}
              >
                <Zap className="mr-2 h-5 w-5" /> Ver Demo en Vivo
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="w-full sm:w-auto shadow-lg hover:shadow-xl transition-shadow"
                onClick={() => navigate("/register")}
              >
                <Users className="mr-2 h-5 w-5" /> Crear Cuenta Gratis
              </Button>
            </div>

            <p className="text-sm text-muted-foreground text-center lg:text-left">
              Incluye Mapas de Calor, Puntos de Recompensa y Analíticas avanzadas.
            </p>
          </div>

          {/* Visual: Simulación de chat */}
          <div className="w-full lg:w-1/2 relative mt-8 lg:mt-0">
            <div className="bg-card text-card-foreground rounded-xl shadow-xl p-5 border border-border max-w-full sm:max-w-md mx-auto animate-float">
              <div className="flex items-center border-b border-border pb-3 mb-4">
                <div className="mr-3">
                  <ChatbocLogoAnimated size={36} />
                </div>
                <div>
                  <h3 className="font-semibold text-base text-foreground">Agente IA Inteligente</h3>
                  <p className="text-xs text-muted-foreground">Potenciado por Chatboc IA</p>
                </div>
                <div className="ml-auto">
                  <span className="inline-flex items-center px-2.5 py-1 bg-success/10 text-success text-xs font-medium rounded-full">
                    <span className="w-2 h-2 bg-success rounded-full mr-1.5" />
                    En línea
                  </span>
                </div>
              </div>

              <div className="space-y-3.5 text-sm max-h-[300px] overflow-y-auto pr-2">
                <div className="flex">
                  <div className="bg-primary/10 text-primary-dark p-3 rounded-lg rounded-bl-none max-w-[85%]">
                    <p className="font-medium text-primary">Vecino:</p>
                    Hola, ¿cómo puedo participar en la votación del presupuesto participativo?
                  </div>
                </div>
                <div className="flex justify-end">
                  <div className="bg-muted text-foreground p-3 rounded-lg rounded-br-none max-w-[85%]">
                    <p className="font-medium text-foreground">Agente IA:</p>
                    ¡Hola! 👋 Es muy fácil. La votación está abierta y puedes elegir los proyectos para tu barrio.
                    <br/><br/>
                    Ingresa a la <strong>Planilla de Votación</strong> aquí para ver las opciones y registrar tu voto de forma segura:
                    <br/>
                    <span className="text-primary underline cursor-pointer">🔗 Acceder al Formulario de Votación</span>
                  </div>
                </div>
                <div className="flex">
                  <div className="bg-primary/10 text-primary-dark p-3 rounded-lg rounded-bl-none max-w-[85%]">
                    <p className="font-medium text-primary">Vecino:</p>
                    Genial, ¿y sumo puntos por participar?
                  </div>
                </div>
                <div className="flex justify-end">
                  <div className="bg-muted text-foreground p-3 rounded-lg rounded-br-none max-w-[85%]">
                    <p className="font-medium text-foreground">Agente IA:</p>
                    ¡Exacto! 🎁 Al completar la votación sumarás <strong>50 Puntos Ciudadanos</strong> que podrás canjear por beneficios en comercios locales adheridos.
                  </div>
                </div>
              </div>

              <div className="mt-4 flex">
                <input
                  type="text"
                  placeholder="Escribe tu consulta..."
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

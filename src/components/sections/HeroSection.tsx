import React from "react";
import { Button } from "@/components/ui/button"; // Asegurarse que se usa el botón de shadcn/ui
import { ArrowRight, MessageSquareText, Users, Zap } from "lucide-react"; // Iconos actualizados
import ChatbocLogoAnimated from "../chat/ChatbocLogoAnimated"; // Mantener si es relevante
import { useNavigate } from "react-router-dom";

const HeroSection = () => {
  const navigate = useNavigate();

  return (
    <section className="py-20 md:py-28 bg-background text-foreground transition-colors"> {/* Ajuste de padding */}
      <div className="container px-4 mx-auto">
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16"> {/* Aumentar gap */}
          {/* Texto principal */}
          <div className="w-full lg:w-1/2 lg:pr-10 text-center lg:text-left">
            {/* Nuevo Titular y Subtítulo */}
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-6 leading-tight">
              <span className="text-primary">Conectamos</span> Gobiernos y Empresas con sus Comunidades {/* Usar text-primary para el acento */}
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground mb-8"> {/* Aumentar tamaño y margen */}
              Transforma la interacción con ciudadanos y clientes mediante nuestra plataforma IA con CRM inteligente y Chatbots que realmente entienden y resuelven.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 mb-6"> {/* Aumentar gap */}
              <Button // Usar el componente Button de shadcn/ui
                size="lg"
                className="w-full sm:w-auto shadow-lg hover:shadow-xl transition-shadow" // Añadir sombra y transición
                onClick={() => navigate("/demo")} // Mantener /demo si es la demo interactiva del chat
              >
                <Zap className="mr-2 h-5 w-5" /> Probar Demo Interactiva
              </Button>
              <Button
                variant="outline" // Mantener outline, se verá con el nuevo --radius y colores
                size="lg"
                className="w-full sm:w-auto shadow-lg hover:shadow-xl transition-shadow"
                onClick={() => navigate("/register")} // O cambiar a "/contact-sales" o "/solutions"
              >
                <Users className="mr-2 h-5 w-5" /> Conocer Soluciones
              </Button>
            </div>

            <p className="text-sm text-muted-foreground text-center lg:text-left"> {/* Ajustar alineación en mobile */}
              Impulsa la eficiencia y la satisfacción. Simple de empezar, poderoso para crecer.
            </p>
          </div>

          {/* Visual: Animación/Demo del Producto (mantener la simulación de chat por ahora, pero idealmente sería una animación más pulida) */}
          <div className="w-full lg:w-1/2 relative mt-8 lg:mt-0">
            {/* Se mantiene la simulación de chat existente, pero se podrían refinar los estilos de las burbujas y el contenedor */}
            <div className="bg-card text-card-foreground rounded-xl shadow-xl p-5 border border-border max-w-full sm:max-w-md mx-auto animate-float"> {/* rounded-xl usa var(--radius) */}
              <div className="flex items-center border-b border-border pb-3 mb-4">
                <div className="mr-3">
                  <ChatbocLogoAnimated size={36} /> {/* Ajustar props si es necesario */}
                </div>
                <div>
                  <h3 className="font-semibold text-base text-foreground">Asistente Inteligente</h3> {/* Texto más genérico */}
                  <p className="text-xs text-muted-foreground">Potenciado por Chatboc IA</p>
                </div>
                <div className="ml-auto">
                  <span className="inline-flex items-center px-2.5 py-1 bg-success/10 text-success text-xs font-medium rounded-full"> {/* Usar color success y foreground */}
                    <span className="w-2 h-2 bg-success rounded-full mr-1.5" />
                    Online
                  </span>
                </div>
              </div>

              {/* Ejemplo de interacción de chat - Adaptar a un caso de uso municipal o de atención al cliente más general */}
              <div className="space-y-3.5 text-sm max-h-[300px] overflow-y-auto pr-2"> {/* Limitar altura y scrollbar */}
                <div className="flex">
                  <div className="bg-primary/10 text-primary-foreground p-3 rounded-lg rounded-bl-none max-w-[85%]">
                    <p className="font-medium text-primary">Vecino:</p> {/* Identificar el rol */}
                    Hola, necesito información sobre cómo renovar mi licencia de conducir.
                  </div>
                </div>
                <div className="flex justify-end">
                  <div className="bg-muted text-muted-foreground p-3 rounded-lg rounded-br-none max-w-[85%]">
                    <p className="font-medium text-foreground">Asistente IA:</p>
                    ¡Hola! Para renovar tu licencia necesitas: DNI vigente, licencia anterior, y no tener multas pendientes. El trámite se inicia online aquí: [enlace]. ¿Te puedo ayudar con algo más?
                  </div>
                </div>
                <div className="flex">
                  <div className="bg-primary/10 text-primary-foreground p-3 rounded-lg rounded-bl-none max-w-[85%]">
                    <p className="font-medium text-primary">Vecino:</p>
                    ¿Dónde puedo verificar si tengo multas?
                  </div>
                </div>
                <div className="flex justify-end">
                  <div className="bg-muted text-muted-foreground p-3 rounded-lg rounded-br-none max-w-[85%]">
                    <p className="font-medium text-foreground">Asistente IA:</p>
                    Puedes consultar tus multas pendientes en el portal de infracciones de la ciudad: [enlace]. ¿Alguna otra consulta?
                  </div>
                </div>
              </div>

              <div className="mt-4 flex">
                <input
                  type="text"
                  placeholder="Escribe tu consulta aquí..."
                  className="flex-1 border border-input bg-background text-foreground rounded-l-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" /* Usar variables de shadcn */
                />
                <Button variant="default" size="icon" className="rounded-l-none"> {/* Botón de shadcn */}
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </div>
            </div>
            {/* Efectos decorativos (se pueden mantener o simplificar) */}
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-primary/5 rounded-full blur-3xl -z-10" />
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;

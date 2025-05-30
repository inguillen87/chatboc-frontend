import React from "react";
import { Button } from "@/components/ui/button";
import { MessageSquare, Sparkles, UserPlus, LogIn } from "lucide-react";
import { useRouter } from "next/router";

const HeroSection = () => {
  const router = useRouter();

  return (
    <section className="pt-20 pb-12 md:pt-32 md:pb-24 overflow-hidden bg-background text-foreground transition-colors">
      <div className="container px-4 mx-auto">
        <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-12">
          {/* Texto principal */}
          <div className="w-full lg:w-1/2 lg:pr-12 text-center lg:text-left">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 leading-tight">
              <span className="gradient-text">Chatboc:</span> Primer Bot IA para PYMEs con Catálogo Inteligente
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground mb-6">
              Subí tu catálogo en PDF o Excel y empezá a vender por chat en minutos. Atención 24/7, ventas automáticas y respuestas instantáneas con la mejor tecnología IA.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 mb-3">
              <Button
                size="lg"
                className="w-full sm:w-auto"
                onClick={() => router.push("/demo")}
              >
                <MessageSquare className="mr-2 h-5 w-5" /> Probar Demo
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="w-full sm:w-auto"
                onClick={() => router.push("/register")}
              >
                <UserPlus className="mr-2 h-5 w-5" /> Registrarse
              </Button>
              <Button
                variant="ghost"
                size="lg"
                className="w-full sm:w-auto"
                onClick={() => router.push("/login")}
              >
                <LogIn className="mr-2 h-5 w-5" /> Iniciar Sesión
              </Button>
            </div>

            <p className="text-xs text-muted-foreground text-center sm:text-left">
              Sin tarjeta de crédito. Configuración inicial guiada.
            </p>
          </div>

          {/* Chat simulado */}
          <div className="w-full lg:w-1/2 relative">
            <div className="bg-card text-card-foreground rounded-2xl shadow-xl p-5 border border-border max-w-full sm:max-w-md mx-auto animate-float">
              <div className="flex items-center border-b border-border pb-3 mb-3">
                <div className="mr-3">
                  <img
                    src="/chatboc_widget_64x64.png"
                    alt="Chatboc"
                    className="w-8 h-8 rounded"
                    style={{ padding: "2px" }}
                  />
                </div>
                <div>
                  <h3 className="font-medium text-sm">Chatboc</h3>
                  <p className="text-xs text-muted-foreground">Asistente IA personalizado</p>
                </div>
                <div className="ml-auto">
                  <span className="inline-flex items-center px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded-full">
                    <span className="w-2 h-2 bg-green-500 rounded-full mr-1" />
                    Online
                  </span>
                </div>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex items-start">
                  <div className="bg-blue-100 dark:bg-blue-900/30 rounded-lg p-3 max-w-[85%]">
                    Hola, ¿en qué puedo ayudarte hoy?
                  </div>
                </div>
                <div className="flex justify-end">
                  <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-3 max-w-[85%]">
                    ¿Puedo ver la lista de productos?
                  </div>
                </div>
                <div className="flex items-start">
                  <div className="bg-blue-100 dark:bg-blue-900/30 rounded-lg p-3 max-w-[85%]">
                    Claro. Te muestro el catálogo actualizado de este mes.<br />
                    <span className="text-xs text-muted-foreground">[Catálogo PDF adjunto]</span>
                  </div>
                </div>
                <div className="flex justify-end">
                  <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-3 max-w-[85%]">
                    ¿Tenés promos de Malbec?
                  </div>
                </div>
                <div className="flex items-start">
                  <div className="bg-blue-100 dark:bg-blue-900/30 rounded-lg p-3 max-w-[85%]">
                    Sí, 2x1 en cajas de 6. ¿Querés que te reserve una?
                  </div>
                </div>
              </div>

              <div className="mt-4 flex">
                <input
                  type="text"
                  placeholder="Consultá por productos, precios o stock…"
                  className="flex-1 border border-border rounded-l-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-background text-foreground"
                />
                <button className="bg-blue-600 text-white rounded-r-lg px-4 py-2">
                  <Sparkles className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Efectos decorativos */}
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-blue-500/10 dark:bg-blue-300/10 rounded-full blur-3xl -z-10" />
            <div className="absolute top-1/4 right-1/4 w-40 h-40 bg-cyan-500/10 dark:bg-cyan-300/10 rounded-full blur-3xl -z-10" />
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;

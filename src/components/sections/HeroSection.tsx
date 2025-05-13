
import React from 'react';
import { Button } from '@/components/ui/button';
import { MessageSquare, Sparkles, ArrowRight } from 'lucide-react';

const HeroSection = () => {
  return (
    <section className="pt-28 pb-20 md:pt-36 md:pb-28 overflow-hidden bg-gradient-to-b from-white to-blue-50">
      <div className="container px-4 mx-auto">
        <div className="flex flex-col lg:flex-row items-center">
          {/* Left column - Text content */}
          <div className="w-full lg:w-1/2 lg:pr-12 mb-12 lg:mb-0">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
              <span className="gradient-text">Chatboc:</span> Tu Experto Virtual que Entiende y Atiende a Tus Clientes, 24/7
            </h1>
            <p className="text-lg md:text-xl text-gray-600 mb-8">
              Deja de perder ventas y tiempo. Con Chatboc, ofreces respuestas inmediatas y personalizadas que fidelizan a tus clientes y capturan nuevas oportunidades, incluso mientras duermes.
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <Button size="lg" className="w-full sm:w-auto">
                Iniciar Mi Prueba Gratuita <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <p className="text-xs text-gray-500 mt-2 sm:mt-0">
                Sin tarjeta de crédito requerida. Configuración inicial guiada.
              </p>
            </div>
          </div>

          {/* Right column - Image/illustration */}
          <div className="w-full lg:w-1/2 relative">
            <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100 max-w-md mx-auto relative z-10 animate-float">
              <div className="flex items-center border-b border-gray-100 pb-4 mb-4">
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center mr-3">
                  <MessageSquare className="h-4 w-4 text-white" />
                </div>
                <div>
                  <h3 className="font-medium">Chatboc</h3>
                  <p className="text-xs text-gray-500">Asistente IA personalizado</p>
                </div>
                <div className="ml-auto">
                  <span className="inline-flex items-center px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                    <span className="w-2 h-2 bg-green-500 rounded-full mr-1"></span>
                    Online
                  </span>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-start">
                  <div className="bg-blue-100 rounded-lg p-3 max-w-[80%]">
                    <p className="text-sm">Hola, ¿en qué puedo ayudarte hoy?</p>
                  </div>
                </div>
                
                <div className="flex items-start justify-end">
                  <div className="bg-gray-100 rounded-lg p-3 max-w-[80%]">
                    <p className="text-sm">¿Cuál es el horario de atención?</p>
                  </div>
                </div>

                <div className="flex items-start">
                  <div className="bg-blue-100 rounded-lg p-3 max-w-[80%]">
                    <p className="text-sm">Nuestro horario de atención es de lunes a viernes de 9:00 a 18:00, pero yo puedo ayudarte 24/7 con consultas, reservas y más información.</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex">
                <input 
                  type="text" 
                  placeholder="Escribe tu mensaje..." 
                  className="flex-1 border border-gray-300 rounded-l-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button className="bg-blue-600 text-white rounded-r-lg px-4 py-2">
                  <Sparkles className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Decorative elements */}
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl -z-10"></div>
            <div className="absolute top-1/4 right-1/4 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl -z-10"></div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;

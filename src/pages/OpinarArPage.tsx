import React from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

const OpinarArPage: React.FC = () => {
  return (
    <div className="bg-background text-foreground min-h-screen">
      <main className="max-w-4xl mx-auto px-4 py-16 sm:py-24">
        <div className="text-center">
          <img
            src="/images/opinar-icon.svg"
            alt="Opinar.ar Logo"
            className="w-24 h-24 mx-auto mb-6"
          />
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight bg-gradient-to-r from-sky-500 to-blue-600 text-transparent bg-clip-text">
            opinar.ar
          </h1>
          <p className="mt-4 max-w-2xl mx-auto text-lg sm:text-xl text-muted-foreground">
            Una consultora inteligente basada en encuestas digitales.
          </p>
        </div>

        <div className="mt-16 space-y-12">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Resultados en Tiempo Real, Decisiones al Instante
            </h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-3xl mx-auto">
              Olvídese de esperar semanas por informes obsoletos. Vea cada respuesta en su dashboard al segundo de ser enviada, desde cualquier dispositivo. Filtre, analice y actúe sobre la opinión pública en vivo. Esto es agilidad.
            </p>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center" aria-hidden="true">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-background px-3 text-lg font-medium text-muted-foreground">
                Características Principales
              </span>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-8 text-left">
            <div className="bg-card p-6 rounded-lg shadow-md">
              <h3 className="text-xl font-semibold text-primary mb-2">Dashboard Interactivo</h3>
              <p className="text-muted-foreground">
                Visualice datos con gráficos dinámicos y filtros personalizables para un análisis profundo.
              </p>
            </div>
            <div className="bg-card p-6 rounded-lg shadow-md">
              <h3 className="text-xl font-semibold text-primary mb-2">Segmentación Avanzada</h3>
              <p className="text-muted-foreground">
                Cruce variables demográficas y geográficas para entender a cada sector de su comunidad.
              </p>
            </div>
            <div className="bg-card p-6 rounded-lg shadow-md">
              <h3 className="text-xl font-semibold text-primary mb-2">Alertas en Tiempo Real</h3>
              <p className="text-muted-foreground">
                Configure notificaciones para temas críticos y responda a las necesidades ciudadanas al instante.
              </p>
            </div>
            <div className="bg-card p-6 rounded-lg shadow-md">
              <h3 className="text-xl font-semibold text-primary mb-2">Informes Automatizados</h3>
              <p className="text-muted-foreground">
                Genere y comparta reportes profesionales con un solo clic, listos para su presentación.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-20 text-center">
          <h2 className="text-2xl font-bold tracking-tight">
            Transforme la opinión en acción
          </h2>
          <p className="mt-3 text-lg text-muted-foreground">
            Descubra el poder de los datos en tiempo real y tome decisiones más inteligentes para su municipio o empresa.
          </p>
          <div className="mt-8">
            <Button asChild size="lg" className="bg-sky-600 hover:bg-sky-700">
              <a href="https://opinar.ar" target="_blank" rel="noopener noreferrer">
                Visitar Opinar.ar
                <ArrowRight className="ml-2 h-5 w-5" />
              </a>
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default OpinarArPage;

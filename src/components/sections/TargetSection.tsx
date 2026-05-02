import React from "react";
import { ArrowRight, Briefcase, Calendar, CheckCircle2, GraduationCap, Landmark } from "lucide-react";
import { Button } from "@/components/ui/button";

const targetGroups = [
  {
    icon: Landmark,
    title: "Gobierno y territorio",
    description:
      "Atención ciudadana, trámites, reclamos, encuestas, mapas y participación con trazabilidad para equipos públicos.",
    points: ["Portal de servicios", "Tickets y SLA", "Mapas y votaciones"],
  },
  {
    icon: Briefcase,
    title: "Empresas y comercios",
    description:
      "Ventas asistidas, soporte, catálogo, leads, checkout, recompensas y seguimiento sin romper la conversación.",
    points: ["Widget y WhatsApp", "Marketplace y pagos", "CRM operativo"],
  },
  {
    icon: GraduationCap,
    title: "Educación",
    description:
      "Experiencia escolar para familias, secretaría y operadores: asistencia, comunicados, documentación y casos sensibles.",
    points: ["Menú escolar", "Casos por canal", "WhatsApp educativo"],
  },
];

const TargetSection = () => {
  const handleConsultingClick = () => {
    window.open("https://calendly.com/chatboc", "_blank");
  };

  const scrollToDemos = () => {
    const el = document.getElementById("demos");
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section id="publico-objetivo" className="bg-background py-16 text-foreground md:py-24">
      <div className="container mx-auto px-4">
        <div className="mx-auto mb-12 max-w-3xl text-center md:mb-16">
          <div className="chatboc-section-kicker mb-4">Sectores</div>
          <h2 className="chatboc-section-heading">Una base común para verticales distintas</h2>
          <p className="chatboc-section-copy mt-4">
            La plataforma conserva el mismo núcleo operativo y deja que el backend adapte la experiencia por tenant,
            vertical, permisos y capacidades disponibles.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {targetGroups.map((group) => {
            const Icon = group.icon;
            return (
              <article key={group.title} className="chatboc-landing-panel chatboc-hover-lift flex h-full flex-col p-5 md:p-6">
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-[8px] bg-primary/10 text-primary">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-semibold text-foreground">{group.title}</h3>
                <p className="mt-3 flex-1 text-sm leading-6 text-muted-foreground">{group.description}</p>
                <ul className="mt-5 space-y-2 border-t border-border/70 pt-4 text-sm text-muted-foreground">
                  {group.points.map((point) => (
                    <li key={point} className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-success" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  variant="outline"
                  className="mt-6 rounded-[8px] border-border/80 font-semibold hover:border-primary/40 hover:bg-primary/5"
                  onClick={scrollToDemos}
                >
                  Ver demos
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </article>
            );
          })}
        </div>

        <div className="mt-10 flex justify-center">
          <Button
            size="lg"
            variant="secondary"
            className="rounded-[8px] border border-border/70 bg-card px-6 font-semibold shadow-sm hover:bg-accent"
            onClick={handleConsultingClick}
          >
            <Calendar className="mr-2 h-4 w-4" />
            Agendar consultoría
          </Button>
        </div>
      </div>
    </section>
  );
};

export default TargetSection;

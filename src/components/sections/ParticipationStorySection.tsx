import React, { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";

import { PARTICIPATION_STEPS } from "./participationStorySteps";

// The animated story (GSAP + ScrollTrigger) downloads only when the visitor
// gets near it, so the first load of the landing does not grow.
const ParticipationStory = React.lazy(() => import("./ParticipationStory"));

const StaticSteps = () => (
  <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
    {PARTICIPATION_STEPS.map((step) => (
      <li key={step.id} className="rounded-[12px] border border-border bg-card p-5">
        <p className="text-sm font-semibold text-primary">{step.label}</p>
        <p className="mt-2 text-lg font-semibold leading-snug text-foreground">{step.title}</p>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
      </li>
    ))}
  </ol>
);

type StoryBoundaryProps = { children: React.ReactNode };

// Same class-component pattern as the other landing boundaries in this repo.
class StoryBoundaryImpl extends (React.Component as any)<StoryBoundaryProps, { failed: boolean }> {
  constructor(props: StoryBoundaryProps) {
    super(props);
    this.state = { failed: false };
  }
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? <StaticSteps /> : this.props.children;
  }
}
const StoryBoundary = StoryBoundaryImpl as unknown as React.ComponentType<StoryBoundaryProps>;

export default function ParticipationStorySection() {
  const reduceMotion = useReducedMotion();
  const anchor = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    if (reduceMotion || near) return;
    const node = anchor.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setNear(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setNear(true);
          observer.disconnect();
        }
      },
      { rootMargin: "600px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [reduceMotion, near]);

  return (
    <section id="participacion-y-beneficios" aria-labelledby="participacion-titulo" className="py-20 sm:py-28">
      <div ref={anchor} className="container mx-auto max-w-6xl px-4">
        <div className="max-w-2xl">
          <h2 id="participacion-titulo" className="text-3xl font-semibold leading-tight tracking-tight text-foreground sm:text-4xl">
            Participar suma. Y se canjea desde el chat.
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
            Cada voto, encuesta o aporte al barrio da puntos. La gente los cambia por becas, útiles, descuentos en
            remedios o entradas, sin salir de WhatsApp.
          </p>
        </div>
        {reduceMotion || !near ? (
          <StaticSteps />
        ) : (
          <StoryBoundary>
            <React.Suspense fallback={<StaticSteps />}>
              <ParticipationStory />
            </React.Suspense>
          </StoryBoundary>
        )}
      </div>
    </section>
  );
}

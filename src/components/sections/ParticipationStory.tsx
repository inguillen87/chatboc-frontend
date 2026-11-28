import React, { useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

import { PARTICIPATION_STEPS } from "./participationStorySteps";

gsap.registerPlugin(ScrollTrigger);

// Balance shown in the phone at each step: vote (+150), browse, redeem the kit.
const BALANCE_BY_STEP = [1350, 1500, 1500, 0] as const;

const BENEFITS = [
  { name: "Kit escolar completo", cost: "1.500 pts" },
  { name: "Descuento en medicamentos", cost: "800 pts" },
  { name: "Entrada a recital", cost: "600 pts" },
] as const;

/**
 * Scrollytelling: the text steps scroll by while the phone stays in view and
 * changes scene. Each step that reaches the middle of the screen drives one
 * GSAP transition; the points counter tweens between balances.
 */
export default function ParticipationStory() {
  const root = useRef<HTMLDivElement>(null);
  const points = useRef<HTMLSpanElement>(null);
  const [active, setActive] = useState(0);

  useLayoutEffect(() => {
    const node = root.current;
    if (!node) return;
    const context = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>("[data-story-step]").forEach((step, index) => {
        ScrollTrigger.create({
          trigger: step,
          start: "top 60%",
          end: "bottom 40%",
          onToggle: (self) => {
            if (self.isActive) setActive(index);
          },
        });
      });
    }, node);
    return () => context.revert();
  }, []);

  const balance = useRef({ value: 1350 });

  useLayoutEffect(() => {
    const node = root.current;
    if (!node) return;
    // Scenes are driven tween by tween (no context revert between steps, which
    // would snap every scene back to its initial state and flash).
    const q = gsap.utils.selector(node);
    gsap.to(q("[data-scene]"), { autoAlpha: 0, y: 16, duration: 0.25, ease: "power2.out", overwrite: true });
    gsap.to(q(`[data-scene="${active}"]`), {
      autoAlpha: 1, y: 0, duration: 0.45, delay: 0.1, ease: "power3.out", overwrite: true,
    });
    gsap.fromTo(
      q(`[data-scene="${active}"] [data-pop]`),
      { autoAlpha: 0, y: 10, scale: 0.98 },
      { autoAlpha: 1, y: 0, scale: 1, duration: 0.4, stagger: 0.12, delay: 0.2, ease: "power3.out", overwrite: true },
    );
    gsap.to(balance.current, {
      value: BALANCE_BY_STEP[active] ?? 1350,
      duration: 0.9,
      ease: "power2.out",
      overwrite: true,
      onUpdate: () => {
        if (points.current) points.current.textContent = Math.round(balance.current.value).toLocaleString("es-AR");
      },
    });
  }, [active]);

  useLayoutEffect(() => () => {
    const node = root.current;
    if (node) gsap.killTweensOf(gsap.utils.selector(node)("[data-scene], [data-pop]"));
    gsap.killTweensOf(balance.current);
  }, []);

  return (
    <div ref={root} className="mt-12 grid gap-10 lg:grid-cols-[1fr_minmax(0,22rem)] lg:gap-16">
      <ol className="order-2 lg:order-1">
        {PARTICIPATION_STEPS.map((step, index) => (
          <li
            key={step.id}
            data-story-step
            className="flex min-h-[52vh] flex-col justify-center border-l-2 py-10 pl-6 transition-colors duration-300 lg:min-h-[68vh]"
            style={{ borderColor: index === active ? "hsl(var(--primary))" : "hsl(var(--border))" }}
            aria-current={index === active ? "step" : undefined}
          >
            <p className={`text-sm font-semibold ${index === active ? "text-primary" : "text-muted-foreground"}`}>
              {step.label}
            </p>
            <p className={`mt-2 text-2xl font-semibold leading-snug sm:text-3xl ${index === active ? "text-foreground" : "text-muted-foreground/70"}`}>
              {step.title}
            </p>
            <p className="mt-3 max-w-md text-base leading-relaxed text-muted-foreground">{step.body}</p>
          </li>
        ))}
      </ol>

      <div className="order-1 lg:order-2">
        <div className="sticky top-20 z-10 mx-auto w-full max-w-[19rem] lg:top-28">
          <div
            className="relative aspect-[9/17] overflow-hidden rounded-[2.2rem] border border-border bg-background shadow-[0_30px_80px_-40px_hsl(var(--primary)/0.55)]"
            aria-hidden="true"
          >
            <div className="flex items-center gap-2 border-b border-border bg-card px-4 py-3">
              <span className="h-7 w-7 rounded-full bg-primary/15" />
              <div>
                <p className="text-xs font-semibold text-foreground">Tu municipio</p>
                <p className="text-[10px] text-muted-foreground">en línea</p>
              </div>
              <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                <span ref={points}>1.350</span> pts
              </span>
            </div>

            <div className="relative h-full p-3 text-[12px] leading-snug">
              <div data-scene="0" className="absolute inset-3 space-y-2">
                <p data-pop className="max-w-[85%] rounded-2xl rounded-tl-sm bg-card px-3 py-2 text-foreground">
                  ¿Qué te gustaría para la plaza nueva?
                </p>
                <div data-pop className="space-y-1">
                  {["Juegos para chicos", "Más árboles", "Una cancha"].map((option, index) => (
                    <p
                      key={option}
                      className={`rounded-xl border px-3 py-1.5 ${index === 0 ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
                    >
                      {option}
                    </p>
                  ))}
                </div>
                <p data-pop className="ml-auto max-w-[70%] rounded-2xl rounded-tr-sm bg-primary px-3 py-2 text-primary-foreground">
                  Juegos para chicos
                </p>
              </div>

              <div data-scene="1" className="invisible absolute inset-3 space-y-2 opacity-0">
                <p data-pop className="max-w-[85%] rounded-2xl rounded-tl-sm bg-card px-3 py-2 text-foreground">
                  ¡Gracias por votar! 🙌
                </p>
                <div data-pop className="rounded-2xl border border-primary/40 bg-primary/10 px-3 py-4 text-center">
                  <p className="text-[11px] text-muted-foreground">Sumaste</p>
                  <p className="text-3xl font-bold text-primary">+150</p>
                  <p className="text-[11px] text-muted-foreground">puntos de participación</p>
                </div>
                <p data-pop className="max-w-[85%] rounded-2xl rounded-tl-sm bg-card px-3 py-2 text-foreground">
                  Escribí TIENDA para canjearlos.
                </p>
              </div>

              <div data-scene="2" className="invisible absolute inset-3 opacity-0">
                <div data-pop className="rounded-2xl border border-border bg-card p-3">
                  <p className="text-sm font-semibold text-foreground">Beneficios</p>
                  <p className="text-[11px] text-muted-foreground">Elegí qué querés canjear.</p>
                  <div className="mt-2 space-y-1.5">
                    {BENEFITS.map((benefit, index) => (
                      <div
                        key={benefit.name}
                        data-pop
                        className={`flex items-center justify-between rounded-xl border px-2.5 py-2 ${index === 0 ? "border-primary bg-primary/10" : "border-border"}`}
                      >
                        <span className="text-foreground">{benefit.name}</span>
                        <span className="text-[10px] text-muted-foreground">{benefit.cost}</span>
                      </div>
                    ))}
                  </div>
                  <p data-pop className="mt-3 rounded-full bg-primary py-1.5 text-center font-semibold text-primary-foreground">
                    Agregar al pedido
                  </p>
                </div>
              </div>

              <div data-scene="3" className="invisible absolute inset-3 space-y-2 opacity-0">
                <p data-pop className="ml-auto max-w-[50%] rounded-2xl rounded-tr-sm bg-primary px-3 py-2 text-primary-foreground">
                  LISTO
                </p>
                <div data-pop className="rounded-2xl rounded-tl-sm bg-card px-3 py-2 text-foreground">
                  <p className="font-semibold">📦 Pedido enviado</p>
                  <p className="mt-1 text-muted-foreground">1 x Kit escolar completo · 1.500 puntos</p>
                </div>
                <p data-pop className="max-w-[85%] rounded-2xl rounded-tl-sm bg-card px-3 py-2 text-foreground">
                  Retiralo el jueves en el centro vecinal. Te avisamos por acá.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

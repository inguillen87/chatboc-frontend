import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, Pause, Play } from "lucide-react";

// One case followed from the first message to the closing survey. A diagram of
// boxes and arrows says "everything is connected"; watching a street light
// complaint become a number, an assignment and a result shows it.

type JourneyMode = "gobierno" | "empresa";

type Scene = {
  person?: string;
  attachments?: string[];
  fields?: Array<[string, string]>;
  bot?: string;
  record?: { title: string; meta: string; status: number; note?: string };
  bars?: Array<[string, number]>;
  survey?: { question: string; options: string[]; chosen: number };
};

type Step = { title: string; summary: string; scene: Scene };

type Journey = { resolves: string; statuses: [string, string, string]; steps: Step[] };

const journeys: Record<JourneyMode, Journey> = {
  gobierno: {
    resolves: "Reclamos, trámites y participación",
    statuses: ["Ingresado", "En curso", "Resuelto"],
    steps: [
      {
        title: "Llega la consulta",
        summary: "Por WhatsApp, la web o un audio.",
        scene: {
          person: "Hay una luminaria apagada en San Martín al 400.",
          attachments: ["Foto", "Ubicación"],
        },
      },
      {
        title: "Chatboc la entiende",
        summary: "Ordena el pedido y pregunta lo que falta.",
        scene: {
          fields: [
            ["Tipo", "Reclamo"],
            ["Categoría", "Alumbrado público"],
            ["Dónde", "San Martín 400, Centro"],
            ["Evidencia", "1 foto y ubicación"],
          ],
          bot: "¿Es una sola luminaria o toda la cuadra?",
        },
      },
      {
        title: "Queda registrado",
        summary: "Con número, área responsable y estado.",
        scene: {
          record: { title: "Reclamo de alumbrado", meta: "Zona Centro, prioridad media", status: 0 },
          bot: "Listo. Quedó registrado y te aviso cuando haya novedades.",
        },
      },
      {
        title: "Tu equipo lo resuelve",
        summary: "Con la foto, el lugar y la conversación a la vista.",
        scene: {
          record: {
            title: "Reclamo de alumbrado",
            meta: "Zona Centro, prioridad media",
            status: 2,
            note: "Alumbrado: luminaria reemplazada.",
          },
          bot: "Tu reclamo fue resuelto. Gracias por avisar.",
        },
      },
      {
        title: "Se mide y se pregunta",
        summary: "Tablero por categoría y zona, y una encuesta al cierre.",
        scene: {
          bars: [
            ["Alumbrado", 0.82],
            ["Residuos", 0.58],
            ["Arbolado", 0.36],
            ["Tránsito", 0.24],
          ],
          survey: { question: "¿Cómo fue la atención?", options: ["Buena", "Regular", "Mala"], chosen: 0 },
        },
      },
    ],
  },
  empresa: {
    resolves: "Consultas, catálogo y pedidos",
    statuses: ["Pedido", "Confirmado", "Entregado"],
    steps: [
      {
        title: "Llega la consulta",
        summary: "Por WhatsApp, la web o un audio.",
        scene: {
          person: "¿Tienen el taladro percutor de 13 mm? ¿A cuánto está?",
          attachments: ["Audio"],
        },
      },
      {
        title: "Chatboc la entiende",
        summary: "Busca en tu catálogo y pregunta lo que falta.",
        scene: {
          fields: [
            ["Tipo", "Consulta de producto"],
            ["Producto", "Taladro percutor 13 mm"],
            ["Stock", "Disponible"],
            ["Falta", "Forma de entrega"],
          ],
          bot: "Sí, hay stock. ¿Lo retirás o te lo enviamos?",
        },
      },
      {
        title: "Queda registrado",
        summary: "El pedido se arma con lo que la persona eligió.",
        scene: {
          record: { title: "Pedido armado", meta: "1 producto, envío a domicilio", status: 0 },
          bot: "Te paso el resumen para que lo confirmes.",
        },
      },
      {
        title: "Tu equipo lo resuelve",
        summary: "Ventas confirma y sigue la entrega.",
        scene: {
          record: {
            title: "Pedido armado",
            meta: "1 producto, envío a domicilio",
            status: 2,
            note: "Ventas: entregado en el domicilio.",
          },
          bot: "Tu pedido fue entregado. Gracias por tu compra.",
        },
      },
      {
        title: "Se mide y se pregunta",
        summary: "Qué se consulta, qué se vende y cómo fue la compra.",
        scene: {
          bars: [
            ["Consultas", 0.9],
            ["Pedidos", 0.52],
            ["Entregados", 0.44],
          ],
          survey: { question: "¿Cómo fue la compra?", options: ["Buena", "Regular", "Mala"], chosen: 0 },
        },
      },
    ],
  },
};

const STEP_MS = 3400;

const SceneView = ({ scene, statuses, animate }: { scene: Scene; statuses: Journey["statuses"]; animate: boolean }) => {
  // Each piece of the scene arrives in reading order, a beat apart.
  let order = 0;
  const appear = () => {
    const delay = animate ? 0.12 + order * 0.22 : 0;
    order += 1;
    return {
      initial: animate ? { opacity: 0, y: 8 } : false,
      animate: { opacity: 1, y: 0 },
      transition: { duration: animate ? 0.32 : 0, delay, ease: [0.22, 0.61, 0.36, 1] as const },
    };
  };

  return (
    <div className="flex h-full flex-col justify-center gap-3">
      {scene.person ? (
        <motion.div {...appear()} className="ml-auto max-w-[85%]">
          <p className="rounded-[14px] rounded-br-[4px] bg-primary px-4 py-2.5 text-sm leading-6 text-primary-foreground">
            {scene.person}
          </p>
        </motion.div>
      ) : null}

      {scene.attachments?.length ? (
        <motion.ul {...appear()} className="ml-auto flex flex-wrap justify-end gap-1.5">
          {scene.attachments.map((item) => (
            <li
              key={item}
              className="rounded-[8px] border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground"
            >
              {item}
            </li>
          ))}
        </motion.ul>
      ) : null}

      {scene.fields?.length ? (
        <dl className="overflow-hidden rounded-[12px] border border-border bg-background">
          {scene.fields.map(([label, value]) => (
            <motion.div
              key={label}
              {...appear()}
              className="grid grid-cols-[6.5rem_1fr] gap-3 border-b border-border px-4 py-2.5 text-sm last:border-b-0"
            >
              <dt className="text-slate-600 dark:text-muted-foreground">{label}</dt>
              <dd className="font-medium text-foreground">{value}</dd>
            </motion.div>
          ))}
        </dl>
      ) : null}

      {scene.record ? (
        <motion.div {...appear()} className="rounded-[12px] border border-border bg-background p-4">
          <p className="text-sm font-semibold text-foreground">{scene.record.title}</p>
          <p className="mt-0.5 text-sm text-slate-600 dark:text-muted-foreground">{scene.record.meta}</p>
          <ol className="mt-3 grid grid-cols-3 gap-1.5" aria-label="Estado">
            {statuses.map((status, index) => {
              const reached = index <= scene.record!.status;
              const resolved = index === 2 && scene.record!.status === 2;
              return (
                <li key={status} aria-current={index === scene.record!.status ? "step" : undefined}>
                  <span
                    className={`block h-1 rounded-full ${
                      resolved ? "bg-emerald-500" : reached ? "bg-primary" : "bg-border"
                    }`}
                  />
                  <span
                    className={`mt-1.5 flex items-center gap-1 text-xs ${
                      reached ? "font-semibold text-foreground" : "text-slate-600 dark:text-muted-foreground"
                    }`}
                  >
                    {resolved ? <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" /> : null}
                    {status}
                  </span>
                </li>
              );
            })}
          </ol>
          {scene.record.note ? (
            <p className="mt-3 border-t border-border pt-3 text-sm text-foreground">{scene.record.note}</p>
          ) : null}
        </motion.div>
      ) : null}

      {scene.bars?.length ? (
        <motion.div {...appear()} className="rounded-[12px] border border-border bg-background p-4">
          <ul className="space-y-2.5">
            {scene.bars.map(([label, value], index) => (
              <li key={label} className="grid grid-cols-[5.5rem_1fr] items-center gap-3 text-sm">
                <span className="text-slate-600 dark:text-muted-foreground">{label}</span>
                <span className="h-2 overflow-hidden rounded-full bg-border">
                  <motion.span
                    className="block h-full origin-left rounded-full bg-primary"
                    initial={animate ? { scaleX: 0 } : false}
                    animate={{ scaleX: value }}
                    transition={{ duration: animate ? 0.6 : 0, delay: animate ? 0.35 + index * 0.1 : 0, ease: "easeOut" }}
                  />
                </span>
              </li>
            ))}
          </ul>
        </motion.div>
      ) : null}

      {scene.survey ? (
        <motion.div {...appear()} className="rounded-[12px] border border-border bg-background p-4">
          <p className="text-sm font-semibold text-foreground">{scene.survey.question}</p>
          <ul className="mt-2.5 flex flex-wrap gap-1.5">
            {scene.survey.options.map((option, index) => (
              <li
                key={option}
                className={`rounded-[8px] border px-3 py-1 text-sm ${
                  index === scene.survey!.chosen
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-slate-600 dark:text-muted-foreground"
                }`}
              >
                {option}
              </li>
            ))}
          </ul>
        </motion.div>
      ) : null}

      {scene.bot ? (
        <motion.div {...appear()} className="mr-auto max-w-[85%]">
          <p className="rounded-[14px] rounded-bl-[4px] border border-border bg-background px-4 py-2.5 text-sm leading-6 text-foreground">
            {scene.bot}
          </p>
        </motion.div>
      ) : null}
    </div>
  );
};

const ServiceJourneyFlow = () => {
  const reduceMotion = useReducedMotion();
  const [mode, setMode] = useState<JourneyMode>("gobierno");
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [inView, setInView] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const journey = journeys[mode];
  const step = journey.steps[active];
  const animate = !reduceMotion;

  // The story starts when the section is on screen, and never for someone who
  // asked for less motion: they read it at their own pace with the steps.
  useEffect(() => {
    const node = rootRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => setInView(Boolean(entry?.isIntersecting)),
      { threshold: 0.35 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const startedRef = useRef(false);
  useEffect(() => {
    if (inView && !startedRef.current && !reduceMotion) {
      startedRef.current = true;
      setPlaying(true);
    }
  }, [inView, reduceMotion]);

  useEffect(() => {
    if (!playing || !inView) return undefined;
    const timer = window.setTimeout(() => {
      setActive((current) => (current + 1) % journey.steps.length);
    }, STEP_MS);
    return () => window.clearTimeout(timer);
  }, [playing, inView, active, journey.steps.length]);

  const chooseStep = (index: number) => {
    setPlaying(false);
    setActive(index);
  };

  const chooseMode = (next: JourneyMode) => {
    setMode(next);
    setActive(0);
  };

  const progress = active / (journey.steps.length - 1);

  return (
    <div
      ref={rootRef}
      className="mt-10 overflow-hidden rounded-[12px] border border-border bg-card"
      role="region"
      aria-label="Recorrido conectado"
    >
      <div className="flex flex-col gap-4 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <p className="text-sm font-semibold text-foreground">Un caso, de punta a punta</p>
          <p className="mt-0.5 text-sm text-slate-600 dark:text-muted-foreground">{journey.resolves}</p>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="grid grid-cols-2 rounded-[8px] border border-border bg-muted/35 p-1"
            role="group"
            aria-label="Contexto del recorrido"
          >
            {(["gobierno", "empresa"] as const).map((item) => (
              <button
                key={item}
                type="button"
                aria-pressed={mode === item}
                onClick={() => chooseMode(item)}
                className={`min-h-10 rounded-[8px] px-4 text-sm font-semibold transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                  mode === item
                    ? "bg-primary text-primary-foreground"
                    : "text-slate-600 hover:text-foreground dark:text-muted-foreground"
                }`}
              >
                {item === "gobierno" ? "Gobierno" : "Empresa"}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setPlaying((current) => !current)}
            aria-label={playing ? "Pausar el recorrido" : "Reproducir el recorrido"}
            className="inline-flex h-12 w-12 items-center justify-center rounded-[8px] border border-border text-foreground transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {playing ? <Pause className="h-4 w-4" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}
          </button>
        </div>
      </div>

      <div className="grid md:grid-cols-[minmax(0,19rem)_minmax(0,1fr)]">
        <div className="relative">
          {/* The rail fills as the case advances. */}
          <span aria-hidden="true" className="absolute bottom-9 left-[1.9rem] top-9 w-px bg-border sm:left-[2.15rem]" />
          <motion.span
            aria-hidden="true"
            className="absolute bottom-9 left-[1.9rem] top-9 w-px origin-top bg-primary sm:left-[2.15rem]"
            initial={false}
            animate={{ scaleY: progress }}
            transition={{ duration: animate ? 0.5 : 0, ease: "easeInOut" }}
          />
          <ol aria-label={`Recorrido operativo para ${mode}`}>
            {journey.steps.map((item, index) => {
              const isActive = index === active;
              const isDone = index < active;
              return (
                <li key={item.title} className="relative">
                  <button
                    type="button"
                    onClick={() => chooseStep(index)}
                    aria-current={isActive ? "step" : undefined}
                    className={`grid w-full grid-cols-[1.5rem_1fr] items-start gap-3 px-5 py-4 text-left transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary sm:px-6 ${
                      isActive ? "bg-primary/[0.07]" : "hover:bg-muted/40"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`relative z-[1] mt-1 h-3 w-3 justify-self-center rounded-full border-2 transition-colors motion-reduce:transition-none ${
                        isActive || isDone ? "border-primary bg-primary" : "border-border bg-card"
                      }`}
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-foreground">{item.title}</span>
                      <span className="mt-0.5 block text-sm leading-5 text-slate-600 dark:text-muted-foreground">
                        {item.summary}
                      </span>
                    </span>
                  </button>
                  {isActive ? (
                    <div className="border-y border-border bg-muted/20 px-5 py-5 md:hidden">
                      <SceneView scene={item.scene} statuses={journey.statuses} animate={false} />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </div>

        <div
          className="hidden min-h-[25rem] border-l border-border bg-muted/20 p-6 md:block lg:p-8"
          aria-live="off"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={`${mode}-${active}`}
              className="mx-auto h-full max-w-md"
              initial={animate ? { opacity: 0 } : false}
              animate={{ opacity: 1 }}
              exit={animate ? { opacity: 0 } : undefined}
              transition={{ duration: animate ? 0.18 : 0 }}
            >
              <SceneView scene={step.scene} statuses={journey.statuses} animate={animate} />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <div className="border-t border-border px-5 py-3 text-xs leading-5 text-slate-600 dark:text-muted-foreground sm:px-6">
        Ejemplo ilustrativo. Los canales, integraciones y automatizaciones se habilitan según la configuración
        contratada.
      </div>
    </div>
  );
};

export default ServiceJourneyFlow;

import React, { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

// The four kinds of survey the editor offers, each shown as a question the
// visitor can actually answer. Saying "encuestas" explains little; answering
// one in two seconds explains the rest.

type KindId = "opinion" | "votacion" | "sondeo" | "planificacion";

type Kind = {
  id: KindId;
  name: string;
  use: string;
  question: string;
  options: string[];
  multiple?: boolean;
  // Illustrative shares, shown only after the visitor answers.
  sample: number[];
  after: string;
};

const KINDS: Kind[] = [
  {
    id: "votacion",
    name: "Votación en vivo",
    use: "Una pregunta, una opción por persona y el resultado en pantalla mientras votan. Para un presupuesto participativo, una asamblea o un evento.",
    question: "¿Qué obra va primero en el presupuesto participativo?",
    options: ["Renovar la plaza", "Luminarias nuevas", "Bicisenda"],
    sample: [38, 41, 21],
    after: "Tu voto quedó registrado.",
  },
  {
    id: "opinion",
    name: "Consulta sobre una propuesta",
    use: "Varias preguntas para saber qué piensa la gente de un proyecto de gobierno, un servicio o un producto antes de lanzarlo.",
    question: "¿Estás de acuerdo con hacer peatonal el centro los fines de semana?",
    options: ["De acuerdo", "En desacuerdo", "Necesito más información"],
    sample: [52, 27, 21],
    after: "Gracias. Tu respuesta quedó registrada.",
  },
  {
    id: "sondeo",
    name: "Sondeo rápido",
    use: "Una sola pregunta para tomar el pulso de un tema en el día: una medida, un precio, un lanzamiento.",
    question: "Si este producto saliera hoy, ¿lo comprarías?",
    options: ["Sí", "No", "Depende del precio"],
    sample: [44, 18, 38],
    after: "Listo, gracias.",
  },
  {
    id: "planificacion",
    name: "Planificación",
    use: "Para decidir con la gente fechas, lugares o prioridades, con más de una respuesta.",
    question: "¿Qué días te quedan mejor para la audiencia pública?",
    options: ["Martes", "Jueves", "Sábado"],
    multiple: true,
    sample: [47, 29, 58],
    after: "Anotado. Te avisamos cuando esté la fecha.",
  },
];

// What the organization reads afterwards. Every line names a view that exists
// in the survey workspace.
const READINGS: Array<[string, string]> = [
  ["Resultados en vivo", "Cada voto mueve el resultado en el momento, listo para proyectar en una sala o un acto."],
  ["Mapa de calor", "Dónde se participa más y dónde falta llegar, por zona."],
  ["Quién responde", "Cortes por edad, género y territorio declarado."],
  ["Por dónde llegan", "Cuántas respuestas trae cada canal y cada campaña."],
  ["Evolución diaria", "Cómo crece la participación día por día."],
  ["Quién puede participar", "Abierta a todos o limitada a un grupo, con consentimiento informado."],
];

const BASE_VOTES = 1284;

const SurveyKindsSection = () => {
  const reduceMotion = useReducedMotion();
  const [kindId, setKindId] = useState<KindId>("votacion");
  const [picked, setPicked] = useState<number[]>([]);
  const [sent, setSent] = useState(false);
  const [votes, setVotes] = useState(BASE_VOTES);
  const kind = KINDS.find((item) => item.id === kindId) ?? KINDS[0];

  // After the visitor answers, a few more answers "arrive" so the count moves
  // the way it does on a real screen. It stops by itself and never runs for
  // someone who asked for less motion.
  useEffect(() => {
    if (!sent || reduceMotion) return undefined;
    let ticks = 0;
    const timer = window.setInterval(() => {
      ticks += 1;
      setVotes((current) => current + 1 + (ticks % 3));
      if (ticks >= 9) window.clearInterval(timer);
    }, 700);
    return () => window.clearInterval(timer);
  }, [sent, reduceMotion, kindId]);

  const chooseKind = (id: KindId) => {
    setKindId(id);
    setPicked([]);
    setSent(false);
    setVotes(BASE_VOTES);
  };

  const pick = (index: number) => {
    if (sent) return;
    if (kind.multiple) {
      setPicked((current) => (current.includes(index) ? current.filter((item) => item !== index) : [...current, index]));
      return;
    }
    setPicked([index]);
    setSent(true);
  };

  return (
    <section aria-labelledby="survey-kinds-title" className="bg-background py-20 text-foreground md:py-28">
      <div className="container mx-auto px-4">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1fr_1fr] lg:gap-16">
          <div>
            <div className="chatboc-section-kicker mb-4">Encuestas, sondeos y votaciones</div>
            <h2 id="survey-kinds-title" className="chatboc-section-heading text-balance">
              Consultá a miles de personas y mirá el resultado mientras llega
            </h2>
            <p className="chatboc-section-copy mt-5 max-w-md">
              Para un gobierno que quiere medir una propuesta, una empresa que lanza un producto o un colegio que
              consulta a las familias. Se responde desde WhatsApp, el chat, un enlace o un código QR. Elegí una y
              votá.
            </p>

            <div className="mt-8 border-t border-border" role="tablist" aria-label="Tipos de encuesta">
              {KINDS.map((item) => {
                const selected = item.id === kindId;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    id={`survey-kind-tab-${item.id}`}
                    aria-selected={selected}
                    aria-controls="survey-kind-panel"
                    onClick={() => chooseKind(item.id)}
                    className={`relative block w-full border-b border-border py-4 pl-4 pr-2 text-left transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary ${
                      selected ? "bg-primary/[0.06]" : "hover:bg-muted/40"
                    }`}
                  >
                    {selected ? <span aria-hidden="true" className="absolute inset-y-0 left-0 w-0.5 bg-primary" /> : null}
                    <span className="chatboc-display block text-lg font-semibold text-foreground">{item.name}</span>
                    <span className="mt-0.5 block text-sm leading-6 text-slate-600 dark:text-muted-foreground">
                      {item.use}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="mt-5 max-w-md text-sm leading-6 text-slate-600 dark:text-muted-foreground">
              Cada encuesta puede combinar opción única, opción múltiple, puntuación y respuesta abierta, y mostrar
              una pregunta solo según lo que se respondió antes.
            </p>
          </div>

          <div
            id="survey-kind-panel"
            role="tabpanel"
            aria-labelledby={`survey-kind-tab-${kind.id}`}
            className="self-start rounded-[12px] border border-border bg-card p-6 lg:sticky lg:top-28 lg:p-8"
          >
            <p className="text-sm text-slate-600 dark:text-muted-foreground">{kind.name}</p>
            <p className="chatboc-display mt-2 text-xl font-semibold leading-snug text-foreground md:text-2xl">
              {kind.question}
            </p>

            <ul className="mt-6 space-y-2">
              {kind.options.map((option, index) => {
                const isPicked = picked.includes(index);
                const share = kind.sample[index];
                return (
                  <li key={option}>
                    <button
                      type="button"
                      onClick={() => pick(index)}
                      aria-pressed={isPicked}
                      disabled={sent}
                      className={`relative min-h-12 w-full overflow-hidden rounded-[8px] border px-4 py-3 text-left text-sm font-medium transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-default ${
                        isPicked ? "border-primary text-foreground" : "border-border text-foreground hover:border-primary/60"
                      }`}
                    >
                      {sent ? (
                        <motion.span
                          aria-hidden="true"
                          className="absolute inset-y-0 left-0 w-full origin-left bg-primary/15"
                          initial={reduceMotion ? false : { scaleX: 0 }}
                          animate={{ scaleX: share / 100 }}
                          transition={{ duration: reduceMotion ? 0 : 0.7, delay: reduceMotion ? 0 : index * 0.08, ease: "easeOut" }}
                        />
                      ) : null}
                      <span className="relative flex items-center justify-between gap-3">
                        <span>{option}</span>
                        {sent ? (
                          <span className="tabular-nums text-slate-600 dark:text-muted-foreground">{share} %</span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>

            {kind.multiple && !sent ? (
              <button
                type="button"
                onClick={() => setSent(true)}
                disabled={picked.length === 0}
                className="mt-4 inline-flex min-h-11 items-center rounded-[8px] bg-primary px-5 text-sm font-semibold text-primary-foreground transition-opacity disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Enviar respuesta
              </button>
            ) : null}

            <div className="mt-5 min-h-[3.25rem] border-t border-border pt-4 text-sm" aria-live="polite">
              {sent ? (
                <>
                  <p className="font-semibold text-foreground">{kind.after}</p>
                  <p className="mt-0.5 text-slate-600 dark:text-muted-foreground">
                    <span className="tabular-nums font-semibold text-foreground">
                      {votes.toLocaleString("es-AR")}
                    </span>{" "}
                    respuestas. Simulación con datos de ejemplo.{" "}
                    <button
                      type="button"
                      onClick={() => chooseKind(kind.id)}
                      className="font-semibold text-primary underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      Responder de nuevo
                    </button>
                  </p>
                </>
              ) : (
                <p className="text-slate-600 dark:text-muted-foreground">
                  {kind.multiple ? "Podés marcar más de una." : "Tocá una opción para responder."}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="mx-auto mt-16 max-w-6xl">
          <h3 className="chatboc-display text-xl font-semibold text-foreground md:text-2xl">
            Lo que tu equipo lee después
          </h3>
          <dl className="mt-6 grid gap-x-10 border-t border-border sm:grid-cols-2 lg:grid-cols-3">
            {READINGS.map(([title, detail]) => (
              <div key={title} className="border-b border-border py-5">
                <dt className="text-base font-semibold text-foreground">{title}</dt>
                <dd className="mt-1 text-sm leading-6 text-slate-600 dark:text-muted-foreground">{detail}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
};

export default SurveyKindsSection;

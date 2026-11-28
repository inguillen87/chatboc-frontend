import React, { useEffect, useRef, useState } from "react";
import { Star } from "lucide-react";
import { sendClaimSatisfaction } from "@/api/trackingExperience";

export interface ClaimSatisfactionState {
  available: boolean;
  submitted: boolean;
  rating: number | null;
  endpoint: string;
}

const LABELS = ["Muy mal", "Mal", "Regular", "Bien", "Muy bien"];

/** Read the backend contract strictly; anything unexpected hides the control. */
export function parseClaimSatisfaction(value: unknown): ClaimSatisfactionState | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const rating = record.rating;
  if (typeof record.available !== "boolean" || typeof record.submitted !== "boolean" || record.scale !== 5
    || !(rating === null || (Number.isInteger(rating) && (rating as number) >= 1 && (rating as number) <= 5))
    || typeof record.endpoint !== "string" || !/^\/api\/public\/tracking\/claims\/\d{1,10}\/satisfaction$/.test(record.endpoint)) return null;
  return { available: record.available, submitted: record.submitted, rating: rating as number | null, endpoint: record.endpoint };
}

/** «¿Cómo resolvieron tu reclamo?»: five large buttons, one answer, then thanks. */
export function ClaimSatisfaction({ state, pin }: { state: ClaimSatisfactionState; pin: string }) {
  const [rating, setRating] = useState<number | null>(state.rating);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { setRating(state.rating); }, [state.rating, state.endpoint]);

  if (!state.available && rating === null) return null;
  const rate = async (value: number) => {
    if (sending || rating !== null || !pin) return;
    setSending(true); setError("");
    try {
      const response = await sendClaimSatisfaction({ endpoint: state.endpoint, pin, rating: value });
      const saved = parseClaimSatisfaction(response?.satisfaction);
      if (mounted.current) setRating(saved?.rating ?? value);
    } catch {
      if (mounted.current) setError("No pudimos guardar tu calificación. Probá de nuevo en unos minutos.");
    } finally {
      if (mounted.current) setSending(false);
    }
  };

  return (
    <section data-testid="claim-satisfaction" aria-labelledby="claim-satisfaction-title"
      className="mt-4 rounded-xl border border-border bg-background/60 p-4">
      <h3 id="claim-satisfaction-title" className="text-base font-semibold">
        {rating === null ? "¿Cómo resolvieron tu reclamo?" : "Gracias por calificar tu reclamo"}
      </h3>
      {rating === null ? <>
        <p className="mt-1 text-sm text-muted-foreground">Elegí una opción. Ayuda a mejorar la atención.</p>
        <div role="group" aria-labelledby="claim-satisfaction-title" className="mt-3 flex flex-wrap gap-2">
          {LABELS.map((label, index) => (
            <button key={label} type="button" disabled={sending} onClick={() => void rate(index + 1)}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border px-3 py-2 text-sm font-semibold hover:border-primary hover:bg-primary/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60">
              <span aria-hidden="true" className="flex">
                {Array.from({ length: index + 1 }, (_, star) => <Star key={star} size={14} className="fill-current text-primary" />)}
              </span>
              {label}
            </button>
          ))}
        </div>
      </> : <p className="mt-1 text-sm text-muted-foreground">Tu respuesta: {LABELS[rating - 1]}.</p>}
      <p role="status" className="mt-2 text-sm text-destructive empty:hidden">{error}</p>
    </section>
  );
}

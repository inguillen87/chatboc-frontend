import { useEffect, useId, useRef, useState } from "react";
import { Loader2, Play, RotateCcw } from "lucide-react";
import {
  parseWhatsappWorkflowDraftJson,
  type WhatsappWorkflowStudioDurableContract,
} from "@/api/v2/whatsappWorkflowStudio";
import {
  simulateWhatsappWorkflow,
  type WhatsappWorkflowSimulation,
  type WhatsappWorkflowProposedEffect,
} from "@/api/v2/whatsappWorkflowSimulation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getErrorMessage } from "@/utils/api";

interface Props {
  contract: WhatsappWorkflowStudioDurableContract;
  expectedTenantSlug: string;
  draftJson: string;
  disabled?: boolean;
}

const statusLabels = {
  completed: "Prueba completada",
  not_triggered: "El mensaje no activó el flujo",
  blocked: "Prueba bloqueada",
};

const effectDescription = (effect: WhatsappWorkflowProposedEffect) => {
  if (effect.type === "reply_template") return `Respuesta con la plantilla: ${effect.template_key}`;
  if (effect.type === "create_ticket") return `Creación de caso en la categoría: ${effect.category}`;
  return `Derivación a la cola: ${effect.queue}`;
};

export default function WorkflowStudioSimulator({ contract, expectedTenantSlug, draftJson, disabled = false }: Props) {
  const id = useId();
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("text");
  const [language, setLanguage] = useState("");
  const [broadcastId, setBroadcastId] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<WhatsappWorkflowSimulation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);
  const requestSequence = useRef(0);
  const inputKey = JSON.stringify([contract.tenant.id, expectedTenantSlug, draftJson, message, messageType, language, broadcastId, disabled]);
  const latestInput = useRef(inputKey);
  if (latestInput.current !== inputKey) {
    latestInput.current = inputKey;
    requestSequence.current += 1;
  }
  const resultInput = useRef<string | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      requestSequence.current += 1;
    };
  }, []);

  useEffect(() => {
    setPending(false);
    setResult(null);
    setError(null);
  }, [inputKey]);

  const invalidate = () => {
    requestSequence.current += 1;
    resultInput.current = null;
    setPending(false);
    setResult(null);
    setError(null);
  };

  const reset = () => {
    invalidate();
    setMessage("");
    setMessageType("text");
    setLanguage("");
    setBroadcastId("");
  };

  const run = async () => {
    if (disabled || pending || (messageType === "text" && !message.trim())) return;
    const sequence = ++requestSequence.current;
    const requestInput = inputKey;
    const isCurrent = () => mounted.current && requestSequence.current === sequence && latestInput.current === requestInput;
    setPending(true);
    setResult(null);
    setError(null);
    resultInput.current = requestInput;
    try {
      const draft = parseWhatsappWorkflowDraftJson(draftJson, contract);
      const response = await simulateWhatsappWorkflow({
        contract,
        expectedTenantSlug,
        draft,
        event: {
          message: { type: messageType, text: message },
          ...(language.trim() ? { contact: { language: language.trim() } } : {}),
          ...(broadcastId.trim() ? { broadcast_id: broadcastId.trim() } : {}),
        },
        isCurrent,
      });
      if (isCurrent()) setResult(response);
    } catch (cause) {
      if (isCurrent()) setError(getErrorMessage(cause, "No se pudo completar la prueba."));
    } finally {
      if (isCurrent()) setPending(false);
    }
  };

  const draftContract = contract.draft_contract as Record<string, unknown>;
  const messageTypes = Array.isArray(draftContract.message_types)
    ? draftContract.message_types.filter((value): value is string => typeof value === "string" && Boolean(value.trim()))
    : ["text"];
  const currentResult = resultInput.current === inputKey ? result : null;
  const currentError = resultInput.current === inputKey ? error : null;

  return (
    <section className="space-y-4 rounded-2xl border border-border/60 p-4" aria-labelledby={`${id}-title`} data-testid="workflow-simulator">
      <div>
        <h4 id={`${id}-title`} className="text-sm font-bold text-foreground">{contract.capabilities.simulate.label}</h4>
        <p className="mt-1 text-sm text-muted-foreground">
          Probá el borrador actual con datos sintéticos. No envía mensajes ni crea casos reales.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
        <label className="space-y-1 text-sm font-medium" htmlFor={`${id}-message`}>
          Mensaje de prueba
          <Textarea id={`${id}-message`} value={message} maxLength={2000} disabled={disabled}
            onChange={(event) => { invalidate(); setMessage(event.target.value); }} />
        </label>
        <label className="space-y-1 text-sm font-medium" htmlFor={`${id}-type`}>
          Tipo de mensaje
          <select id={`${id}-type`} value={messageType} disabled={disabled}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            onChange={(event) => { invalidate(); setMessageType(event.target.value); }}>
            {messageTypes.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
        </label>
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer font-medium">Datos de prueba opcionales</summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="space-y-1" htmlFor={`${id}-language`}>
            Idioma del contacto
            <Input id={`${id}-language`} value={language} maxLength={16} disabled={disabled}
              onChange={(event) => { invalidate(); setLanguage(event.target.value); }} />
          </label>
          <label className="space-y-1" htmlFor={`${id}-broadcast`}>
            Identificador del broadcast
            <Input id={`${id}-broadcast`} value={broadcastId} maxLength={120} disabled={disabled}
              onChange={(event) => { invalidate(); setBroadcastId(event.target.value); }} />
          </label>
        </div>
      </details>
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => void run()} disabled={disabled || pending || (messageType === "text" && !message.trim())}>
          {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <Play className="mr-2 h-4 w-4" aria-hidden="true" />}
          {pending ? "Probando…" : "Probar mensaje"}
        </Button>
        <Button type="button" variant="outline" onClick={reset}>
          <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />Reiniciar prueba
        </Button>
      </div>
      {currentError ? <p role="alert" className="text-sm text-destructive">{currentError}</p> : null}
      {currentResult ? (
        <div className="space-y-4 border-t border-border/60 pt-4">
          <p role="status" className="text-sm font-semibold">{statusLabels[currentResult.status]}</p>
          {currentResult.blockers.length ? (
            <ul className="space-y-2 text-sm text-destructive" aria-label="Bloqueos de la prueba">
              {currentResult.blockers.map((blocker, index) => (
                <li key={`${blocker.code}-${index}`}>
                  {blocker.message} <span className="font-mono text-xs">({blocker.path})</span>
                </li>
              ))}
            </ul>
          ) : null}
          {currentResult.validation.warnings.length ? (
            <ul className="space-y-1 text-sm text-muted-foreground" aria-label="Observaciones de la prueba">
              {currentResult.validation.warnings.map((warning, index) => <li key={`${warning.code}-${index}`}>{warning.message}</li>)}
            </ul>
          ) : null}
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <h5 className="text-sm font-semibold">Recorrido previsto</h5>
              {currentResult.trace.length ? (
                <ol className="mt-2 space-y-2" aria-label="Traza de la prueba">
                  {currentResult.trace.map((step, index) => (
                    <li key={`${step.step_id}-${index}`} className="rounded-lg border border-border/60 p-3 text-sm">
                      <p className="break-words font-medium">{index + 1}. {step.step_id} · {step.type}</p>
                      {step.type === "branch" ? <p className="text-muted-foreground">{step.matched ? "Condición cumplida" : "Condición no cumplida"}</p> : null}
                      {step.type === "stop" ? <p className="text-muted-foreground">Resultado: {step.outcome}</p> :
                        step.next_step_id ? <p className="break-words text-muted-foreground">Siguiente: {step.next_step_id}</p> : null}
                    </li>
                  ))}
                </ol>
              ) : <p className="mt-2 text-sm text-muted-foreground">Sin pasos recorridos.</p>}
            </div>
            <div>
              <h5 className="text-sm font-semibold">Efectos previstos</h5>
              {currentResult.proposed_effects.length ? (
                <ul className="mt-2 space-y-2" aria-label="Efectos previstos">
                  {currentResult.proposed_effects.map((effect, index) => (
                    <li key={index} className="break-words rounded-lg border border-border/60 p-3 text-sm">{effectDescription(effect)}</li>
                  ))}
                </ul>
              ) : <p className="mt-2 text-sm text-muted-foreground">Sin efectos previstos.</p>}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

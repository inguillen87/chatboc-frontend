import React from 'react';
import type { HandoffLabels, HandoffState } from './chatTypes';

export default function HandoffBanner({
  state,
  labels,
  onCreateTicket,
  onOpenWhatsApp,
  onWaitOperator,
}: {
  state: HandoffState;
  labels?: HandoffLabels;
  onCreateTicket?: () => void;
  onOpenWhatsApp?: () => void;
  onWaitOperator?: () => void;
}) {
  if (state === 'none') return null;
  const message = labels?.message;
  const actions = [
    onCreateTicket && labels?.createTicket
      ? { label: labels.createTicket, onClick: onCreateTicket }
      : null,
    onOpenWhatsApp && labels?.openWhatsApp
      ? { label: labels.openWhatsApp, onClick: onOpenWhatsApp }
      : null,
    onWaitOperator && labels?.waitOperator
      ? { label: labels.waitOperator, onClick: onWaitOperator }
      : null,
  ].filter((action): action is { label: string; onClick: () => void } => Boolean(action));

  if (!message && actions.length === 0) return null;

  return (
    <div className="rounded-lg border border-amber-300/50 bg-amber-50/70 p-3 text-sm" role="status" aria-live="polite">
      {message ? <p className="mb-2 text-amber-900">{message}</p> : null}
      {actions.length ? (
        <div className="flex flex-wrap gap-2">
          {actions.map((action) => (
            <button key={action.label} type="button" className="rounded border px-2 py-1" onClick={action.onClick}>
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

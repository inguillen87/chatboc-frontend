import { useLayoutEffect, useRef, useState } from 'react';

type Action = 'close' | 'delete';
type Handler = () => Promise<void> | void;
export interface SurveyCardActionOptions {
  blocked: boolean;
  close?: Handler;
  delete?: Handler;
}

/** Local single-flight protection, not authorization or server idempotency.
 * Mount this hook inside the survey snapshot boundary. A pending request is never
 * described as cancelled merely because its view unmounted.
 */
export function useSurveyCardActions(options: SurveyCardActionOptions) {
  const active = useRef(false);
  const epoch = useRef(0);
  const latest = useRef(options);
  const running = useRef<{ action: Action; promise: Promise<void> } | null>(null);
  const [pending, setPending] = useState<Action | null>(null);
  useLayoutEffect(() => { latest.current = options; });
  useLayoutEffect(() => {
    active.current = true;
    ++epoch.current;
    return () => { active.current = false; ++epoch.current; };
  }, []);

  const run = (action: Action): Promise<void> => {
    if (!active.current) return Promise.reject(new Error('survey_card_scope_expired'));
    if (running.current) {
      return running.current.action === action
        ? running.current.promise
        : Promise.reject(new Error('survey_card_action_pending'));
    }
    if (latest.current.blocked || !latest.current[action]) {
      return Promise.reject(new Error('survey_card_action_unavailable'));
    }
    const started = epoch.current;
    setPending(action);
    // The lock is installed before user code runs, including reentrant handlers.
    const promise = Promise.resolve().then(() => {
      if (!active.current || epoch.current !== started || latest.current.blocked || !latest.current[action]) {
        throw new Error('survey_card_scope_expired');
      }
      return latest.current[action]!();
    }).finally(() => {
      if (running.current?.promise === promise) running.current = null;
      if (active.current && epoch.current === started) setPending(null);
    });
    running.current = { action, promise };
    return promise;
  };
  return {
    pending,
    close: () => run('close'),
    delete: () => run('delete'),
    isPending: () => running.current !== null,
  };
}

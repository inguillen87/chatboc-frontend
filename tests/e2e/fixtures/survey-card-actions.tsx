import React, { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { SurveyCard } from '@/components/surveys/SurveyCard';
import { surveyCardFixture } from '../../fixtures/survey-card-actions';
import '@/index.css';

type State = { mode: 'live' | 'draft'; tenant: string; revision: number; allowed: boolean };
type Harness = { configure: (value: Partial<State>) => void; complete: () => void;
  counts: () => { close: number; delete: number } };
declare global { interface Window { surveyCardAcceptance: Harness } }
function Fixture() {
  const [state, setState] = useState<State>({ mode: 'live', tenant: 'tenant-a', revision: 0, allowed: true });
  const counts = useRef({ close: 0, delete: 0 });
  const complete = useRef<(() => void) | null>(null);
  const survey = surveyCardFixture(state.mode);
  survey.titulo += ` · revisión ${state.revision}`;
  survey.admin_lifecycle!.capabilities.can_close = state.mode === 'live' && state.allowed;
  survey.admin_lifecycle!.actions.close.enabled = state.mode === 'live' && state.allowed;
  survey.admin_lifecycle!.capabilities.can_delete = state.mode === 'draft' && state.allowed;
  const invoke = (kind: 'close' | 'delete') => {
    ++counts.current[kind];
    return new Promise<void>(resolve => { complete.current = resolve; });
  };
  window.surveyCardAcceptance = {
    configure: value => setState(old => ({ ...old, ...value })),
    complete: () => { complete.current?.(); complete.current = null; },
    counts: () => ({ ...counts.current }),
  };
  return <main className="mx-auto max-w-4xl space-y-5 p-4 text-foreground">
    <p className="text-xs text-muted-foreground">Entorno de prueba · datos y acciones sintéticos</p>
    <SurveyCard tenantSlug={state.tenant} survey={survey} onEdit={() => {}} onAnalytics={() => {}}
      onClose={() => invoke('close')} onDelete={() => invoke('delete')}/>
  </main>;
}
createRoot(document.getElementById('root')!).render(<Fixture/>);

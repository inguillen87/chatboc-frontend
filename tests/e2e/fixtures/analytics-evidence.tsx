import { createRoot } from 'react-dom/client';
import fixtures from '../../fixtures/analytics-evidence.json';
import { SurveyAnalyticsEvidence } from '@/components/surveys/SurveyAnalyticsEvidence';
import { readAnalyticsEvidence } from '@/utils/surveyAnalyticsEvidence';
import '@/index.css';

const query = new URLSearchParams(location.search);
const key = (query.get('case') || 'low') as keyof typeof fixtures;
const source = fixtures[key] || fixtures.low;
const value = readAnalyticsEvidence(source.analytics_evidence, 301, 7, source);
if (!value) throw new Error('Invalid backend fixture');
if (query.get('dark') === '1') document.documentElement.classList.add('dark');
document.body.style.overflow = 'auto';
createRoot(document.getElementById('root')!).render(<main className="min-h-screen bg-background p-4 sm:p-8 text-foreground">
  <div className="mx-auto max-w-5xl space-y-5">
    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{'Chatboc \u00b7 Entorno de pruebas \u00b7 Datos sint\u00e9ticos'}</p>
    <SurveyAnalyticsEvidence evidence={value} />
  </div>
</main>);

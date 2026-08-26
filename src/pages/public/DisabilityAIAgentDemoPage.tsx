import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import {
  Accessibility,
  ArrowRight,
  BarChart3,
  BellRing,
  BookOpen,
  Briefcase,
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  FileText,
  GraduationCap,
  Headphones,
  HeartPulse,
  Image as ImageIcon,
  Layers3,
  Link2,
  MapPin,
  MessageCircle,
  Mic,
  Phone,
  Route,
  ShieldCheck,
  UserRound,
  Users,
  WalletCards,
} from 'lucide-react';

import { usePageMetadata } from '@/hooks/usePageMetadata';
import {
  disabilityAIAgentDemoContent as content,
  type DemoIconKey,
  type DemoScenario,
} from './disabilityAIAgentDemo.content';

const LazyMapLibreMap = React.lazy(() => import('@/components/MapLibreMap'));

const iconByKey: Record<DemoIconKey, LucideIcon> = {
  accessibility: Accessibility,
  bell: BellRing,
  briefcase: Briefcase,
  calendar: Calendar,
  callback: Phone,
  catalog: BookOpen,
  clipboard: ClipboardCheck,
  contact: UserRound,
  document: FileText,
  education: GraduationCap,
  form: Link2,
  health: HeartPulse,
  human: Headphones,
  image: ImageIcon,
  layers: Layers3,
  location: MapPin,
  message: MessageCircle,
  microphone: Mic,
  pdf: FileText,
  route: Route,
  users: Users,
  wallet: WalletCards,
};

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#087f73] focus-visible:ring-offset-2 focus-visible:ring-offset-[#f4f7f5]';

type RevealProps = {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  reduceMotion: boolean;
};

const Reveal = ({ children, className, delay = 0, reduceMotion }: RevealProps) => (
  <motion.div
    className={className}
    initial={reduceMotion ? false : { opacity: 0, y: 16 }}
    animate={reduceMotion ? { opacity: 1, y: 0 } : undefined}
    whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
    viewport={{ once: true, amount: 0.18 }}
    transition={reduceMotion ? { duration: 0 } : { duration: 0.48, delay, ease: [0.22, 1, 0.36, 1] }}
  >
    {children}
  </motion.div>
);

const SectionHeading = ({
  eyebrow,
  title,
  description,
  id,
}: {
  eyebrow: string;
  title: string;
  description: string;
  id: string;
}) => (
  <div className="max-w-3xl">
    <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#066b63]">{eyebrow}</p>
    <h2 id={id} className="mt-3 text-balance text-3xl font-semibold tracking-[-0.035em] text-[#102f2e] sm:text-4xl">
      {title}
    </h2>
    <p className="mt-4 max-w-2xl text-pretty text-base leading-7 text-[#536765]">{description}</p>
  </div>
);

const InstitutionalAccessibilityControls = ({
  reducedMotion,
  onReducedMotionChange,
}: {
  reducedMotion: boolean;
  onReducedMotionChange: (value: boolean) => void;
}) => {
  const [open, setOpen] = React.useState(false);
  const [largeText, setLargeText] = React.useState(false);
  const [highContrast, setHighContrast] = React.useState(false);

  React.useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('tdf-demo-large-text', largeText);
    root.classList.toggle('tdf-demo-high-contrast', highContrast);
    root.classList.toggle('tdf-demo-reduced-motion', reducedMotion);

    return () => {
      root.classList.remove('tdf-demo-large-text', 'tdf-demo-high-contrast', 'tdf-demo-reduced-motion');
    };
  }, [largeText, highContrast, reducedMotion]);

  const preferences = [
    { label: 'Texto grande', pressed: largeText, toggle: () => setLargeText((value) => !value) },
    { label: 'Alto contraste', pressed: highContrast, toggle: () => setHighContrast((value) => !value) },
    { label: 'Reducir movimiento', pressed: reducedMotion, toggle: () => onReducedMotionChange(!reducedMotion) },
  ];

  return (
    <div className="relative z-50 flex flex-col items-end gap-2">
      {open ? (
        <div
          id="institutional-accessibility-panel"
          className="absolute right-0 top-14 w-[min(19rem,calc(100vw-1.5rem))] rounded-2xl border border-[#b8cbc5] bg-white p-3 shadow-[0_22px_60px_rgba(16,47,46,0.24)]"
          role="region"
          aria-label="Preferencias de accesibilidad"
        >
          <p className="px-1 text-sm font-bold text-[#173a38]">Accesibilidad</p>
          <p className="mt-1 px-1 text-xs leading-5 text-[#4d625d]">Ajustes locales para esta demostración.</p>
          <div className="mt-3 grid gap-2">
            {preferences.map(({ label, pressed, toggle }) => (
              <button
                key={label}
                type="button"
                aria-pressed={pressed}
                className={`${focusRing} flex min-h-11 items-center justify-between rounded-xl border border-[#c9d8d4] px-3 text-left text-sm font-bold text-[#274b47] hover:bg-[#edf5f2]`}
                onClick={toggle}
              >
                <span>{label}</span>
                <span className={`grid h-6 w-6 place-items-center rounded-full ${pressed ? 'bg-[#0b5f58] text-white' : 'bg-[#edf2f0] text-[#667874]'}`} aria-hidden="true">
                  {pressed ? <Check className="h-4 w-4" /> : null}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <button
        type="button"
        className={`${focusRing} grid h-12 w-12 place-items-center rounded-full border border-white/25 bg-[#0b4b47] text-white shadow-[0_14px_34px_rgba(16,47,46,0.34)]`}
        aria-label={open ? 'Cerrar preferencias de accesibilidad' : 'Abrir preferencias de accesibilidad'}
        aria-expanded={open}
        aria-controls="institutional-accessibility-panel"
        onClick={() => setOpen((value) => !value)}
      >
        <Accessibility className="h-5 w-5" aria-hidden="true" />
      </button>
    </div>
  );
};

const ScenarioWorkspace = ({
  scenario,
  activeScenario,
  onScenarioChange,
}: {
  scenario: DemoScenario;
  activeScenario: string;
  onScenarioChange: (scenarioId: string) => void;
}) => {
  const tabRefs = React.useRef<Array<HTMLButtonElement | null>>([]);
  const [operatorNotice, setOperatorNotice] = React.useState('');
  const [chatNotice, setChatNotice] = React.useState('');
  const [inspectorView, setInspectorView] = React.useState('Resumen');
  const [selectedRole, setSelectedRole] = React.useState<'Para mí' | 'Familia / red'>(scenario.roleChoice);
  const [csatOpen, setCsatOpen] = React.useState(false);
  const [csatRating, setCsatRating] = React.useState<number | null>(null);

  React.useEffect(() => {
    setOperatorNotice('');
    setChatNotice('');
    setInspectorView('Resumen');
    setSelectedRole(scenario.roleChoice);
    setCsatOpen(false);
    setCsatRating(null);
  }, [scenario.id, scenario.roleChoice]);

  const focusScenario = React.useCallback(
    (index: number) => {
      const target = content.scenarios[index];
      if (!target) return;
      onScenarioChange(target.id);
      tabRefs.current[index]?.focus();
    },
    [onScenarioChange],
  );

  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'Home') return focusScenario(0);
    if (event.key === 'End') return focusScenario(content.scenarios.length - 1);
    const direction = event.key === 'ArrowRight' ? 1 : -1;
    focusScenario((index + direction + content.scenarios.length) % content.scenarios.length);
  };

  const inspectorContent: Record<string, { title: string; detail: string }> = {
    Resumen: {
      title: 'Resumen operativo',
      detail: `${scenario.status} · ${scenario.operational.priority} · ${scenario.operational.queue}.`,
    },
    Persona: {
      title: 'Persona y red de apoyo',
      detail: `Persona DEMO · ${selectedRole} · contacto protegido · ${scenario.operational.locality}.`,
    },
    Trámite: {
      title: 'Trámite y próximo paso',
      detail: `${scenario.category}. ${scenario.nextStep}`,
    },
    Adjuntos: {
      title: 'Adjuntos y entregables',
      detail: `${scenario.operational.attachments}. ${scenario.deliverables.map((item) => item.label).join(' · ')}.`,
    },
    Historial: {
      title: 'Historial del caso',
      detail: scenario.history.join(' · '),
    },
  };
  const activeInspectorContent = inspectorContent[inspectorView] ?? inspectorContent.Resumen;

  return (
    <div className="overflow-hidden rounded-[1.75rem] border border-[#b7cac5] bg-white shadow-[0_28px_80px_-48px_rgba(18,60,57,0.48)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#dbe5e1] bg-[#f8faf9] px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#0b4b47] text-white" aria-hidden="true">
            <Accessibility className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-[#173a38]">{content.hero.visualLabel}</p>
            <p className="text-xs text-[#647775]">Canal ciudadano y operación en un mismo caso</p>
          </div>
        </div>
        <span className="inline-flex min-h-8 items-center gap-2 rounded-full border border-[#9fc6bd] bg-[#eaf6f2] px-3 text-xs font-bold text-[#086c62]">
          <span className="h-2 w-2 rounded-full bg-[#12a594]" aria-hidden="true" />
          Sincronización simulada
        </span>
      </div>

      <div
        className="flex gap-1 overflow-x-auto border-b border-[#dbe5e1] bg-white p-2 [scrollbar-width:thin]"
        role="tablist"
        aria-label="Escenarios de atención accesible"
      >
        {content.scenarios.map((item, index) => (
          <button
            key={item.id}
            ref={(element) => {
              tabRefs.current[index] = element;
            }}
            id={`scenario-tab-${item.id}`}
            type="button"
            role="tab"
            aria-selected={activeScenario === item.id}
            aria-controls="scenario-panel"
            tabIndex={activeScenario === item.id ? 0 : -1}
            className={`${focusRing} min-h-11 shrink-0 rounded-xl px-3.5 text-left text-sm font-semibold transition-colors ${
              activeScenario === item.id
                ? 'bg-[#dff2ed] text-[#075f57]'
                : 'text-[#5d6f6d] hover:bg-[#f1f5f3] hover:text-[#173a38]'
            }`}
            onClick={() => onScenarioChange(item.id)}
            onKeyDown={(event) => handleTabKeyDown(event, index)}
          >
            {item.tabLabel}
          </button>
        ))}
      </div>

      <div
        id="scenario-panel"
        role="tabpanel"
        aria-labelledby={`scenario-tab-${scenario.id}`}
        className="grid min-h-[31rem] xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]"
      >
        <section className="flex min-w-0 flex-col bg-[#edf4f1]" aria-label="Conversación de WhatsApp representativa">
          <header className="flex items-center justify-between gap-3 border-b border-[#c8d8d3] bg-[#0b4b47] px-4 py-3 text-white sm:px-5">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/14" aria-hidden="true">
                <MessageCircle className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">Agente de IA de Discapacidad</p>
                <p className="text-xs text-white/75">WhatsApp · escenario conceptual</p>
              </div>
            </div>
            <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold">Muestra</span>
          </header>

          <div className="flex flex-1 flex-col gap-3 p-4 sm:p-5" aria-live="polite">
            <p className="mx-auto rounded-full bg-white/80 px-3 py-1 text-[11px] font-semibold text-[#637471] shadow-sm">
              Caso de muestra · sin datos personales
            </p>
            <div className="max-w-[92%] rounded-2xl rounded-bl-md bg-white px-3.5 py-3 text-sm text-[#274541] shadow-sm">
              <p className="font-semibold">¿Para quién es la consulta?</p>
              <div className="mt-2 flex flex-wrap gap-2" aria-label="Rol de la persona en la consulta">
                {(['Para mí', 'Familia / red'] as const).map((role) => (
                  <button
                    key={role}
                    type="button"
                    aria-pressed={selectedRole === role}
                    className={`${focusRing} min-h-11 rounded-full border px-3 text-xs font-bold ${selectedRole === role ? 'border-[#0b665e] bg-[#dff2ed] text-[#075f57]' : 'border-[#c7d5d1] bg-[#f7faf8] text-[#506560]'}`}
                    onClick={() => {
                      setSelectedRole(role);
                      setChatNotice(`Rol de muestra seleccionado: ${role}.`);
                    }}
                  >
                    {role}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[11px] leading-4 text-[#526863]">La orientación general continúa sin pedir DNI.</p>
            </div>
            <div className="ml-auto max-w-[88%] rounded-2xl rounded-br-md bg-[#d8f5dc] px-3.5 py-3 text-sm leading-6 text-[#183833] shadow-sm">
              {scenario.citizenMessage}
            </div>
            <div
              className="ml-auto w-[88%] max-w-sm overflow-hidden rounded-2xl rounded-br-md border border-[#b9d2ca] bg-[#d8f5dc] shadow-sm"
              aria-label={`${scenario.citizenAsset.label}. ${scenario.citizenAsset.detail}`}
            >
              {scenario.citizenAsset.kind === 'audio' ? (
                <div className="flex items-center gap-3 px-3.5 py-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#0b5f58] text-white" aria-hidden="true">
                    <Mic className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex h-5 items-center gap-1" aria-hidden="true">
                      {[8, 14, 10, 18, 12, 16, 9, 15, 7, 12, 6, 10].map((height, index) => (
                        <span key={`${height}-${index}`} className="w-1 rounded-full bg-[#3d8179]" style={{ height }} />
                      ))}
                    </div>
                    <p className="mt-1 text-xs font-bold text-[#214b46]">{scenario.citizenAsset.label}</p>
                    <p className="text-[11px] leading-4 text-[#4b625d]">{scenario.citizenAsset.detail}</p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-[4.5rem_minmax(0,1fr)]">
                  <span className="grid min-h-20 place-items-center bg-[linear-gradient(145deg,#b8d8cf,#7fb6aa)] text-[#0b4b47]" aria-hidden="true">
                    {scenario.citizenAsset.kind === 'image' ? <ImageIcon className="h-6 w-6" /> : <MapPin className="h-6 w-6" />}
                  </span>
                  <span className="min-w-0 px-3 py-3">
                    <span className="block text-xs font-bold text-[#214b46]">{scenario.citizenAsset.label}</span>
                    <span className="mt-1 block text-[11px] leading-4 text-[#4b625d]">{scenario.citizenAsset.detail}</span>
                  </span>
                </div>
              )}
            </div>
            {scenario.agentMessages.map((message) => (
              <div key={message} className="max-w-[92%] rounded-2xl rounded-bl-md bg-white px-3.5 py-3 text-sm leading-6 text-[#274541] shadow-sm">
                {message}
              </div>
            ))}
            <div className="grid max-w-[94%] gap-2 sm:grid-cols-2" aria-label="Entregables de muestra en la conversación">
              {scenario.deliverables.map((deliverable) => {
                const DeliverableIcon = iconByKey[deliverable.icon];
                return (
                  <div key={deliverable.label} className="flex min-w-0 items-center gap-2.5 rounded-xl border border-[#cad9d4] bg-white p-3 shadow-sm">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#e6f2ee] text-[#087a70]" aria-hidden="true">
                      <DeliverableIcon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-xs font-bold text-[#214b46]">{deliverable.label}</span>
                      <span className="mt-0.5 block text-[11px] leading-4 text-[#526863]">{deliverable.detail}</span>
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-1.5" aria-label="Controles accesibles de la conversación">
              {[
                ['Hablar con una persona', 'Solicitud de atención humana registrada en la demostración.'],
                ['Repetir', 'La última respuesta se repetiría en el formato accesible elegido.'],
                ['Corregir', 'Podés corregir el dato anterior sin reiniciar el caso.'],
                ['Volver', 'Volvemos al paso anterior y conservamos el contexto.'],
              ].map(([label, notice]) => (
                <button
                  key={label}
                  type="button"
                  className={`${focusRing} min-h-11 rounded-full border border-[#b8cec8] bg-white px-3 text-[11px] font-bold text-[#315550] hover:bg-[#edf5f2]`}
                  onClick={() => setChatNotice(notice)}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="min-h-4 text-[11px] leading-4 text-[#4b625d]" aria-live="polite">
              {chatNotice}
            </p>
            {csatOpen ? (
              <div className="max-w-[94%] rounded-2xl rounded-bl-md border border-[#b8cec8] bg-white p-3.5 shadow-sm" data-testid="csat-close-step">
                <p className="text-sm font-bold text-[#214b46]">¿Cómo fue la atención?</p>
                <p className="mt-1 text-xs leading-5 text-[#526863]">Cierre accesible de muestra. Elegí una valoración del 1 al 5.</p>
                <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Valoración de satisfacción de 1 a 5">
                  {[1, 2, 3, 4, 5].map((rating) => (
                    <button
                      key={rating}
                      type="button"
                      aria-label={`${rating} de 5`}
                      aria-pressed={csatRating === rating}
                      className={`${focusRing} grid h-11 w-11 place-items-center rounded-full border text-sm font-bold ${csatRating === rating ? 'border-[#0b665e] bg-[#0b5f58] text-white' : 'border-[#b8cec8] bg-[#f7faf8] text-[#315550]'}`}
                      onClick={() => {
                        setCsatRating(rating);
                        setChatNotice(`Gracias. Valoración de muestra registrada: ${rating} de 5.`);
                        setOperatorNotice(`Cierre simulado auditado · CSAT ${rating}/5 · sin datos personales.`);
                      }}
                    >
                      {rating}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="mt-auto grid grid-cols-5 gap-1.5" aria-label="Formatos de entrada disponibles">
              {content.experience.inputs.map((input) => {
                const Icon = iconByKey[input.icon];
                return (
                  <div
                    key={input.label}
                    className="flex min-h-12 flex-col items-center justify-center rounded-xl border border-[#bfd1cb] bg-white px-1 text-[#315550]"
                    title={input.label}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    <span className="mt-1 text-[11px] font-semibold">{input.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="min-w-0 bg-[#102d2c] p-4 text-white sm:p-5" aria-label="Caso CRM sincronizado representativo">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/12 pb-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#7dd6c9]">CRM de discapacidad</p>
              <h2 className="mt-1 text-lg font-semibold">{scenario.title}</h2>
            </div>
            <span className="rounded-full border border-white/15 bg-white/[0.07] px-3 py-1 text-xs font-semibold text-white/85">
              {scenario.caseCode}
            </span>
          </div>

          <div className="mt-3 rounded-xl border border-white/10 bg-black/10 p-3" aria-label="Resumen de la bandeja CRM de muestra">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-bold text-white/90">Bandeja Mesa Única</p>
              <span className="rounded-full border border-white/10 px-2 py-1 text-[11px] font-semibold text-white/70">12 casos de muestra</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-semibold text-white/75">
              <span className="rounded-full bg-white/[0.08] px-2.5 py-1.5">Pendientes 5</span>
              <span className="rounded-full bg-[#f0c96f]/15 px-2.5 py-1.5 text-[#f5d994]">SLA en riesgo 3</span>
              <span className="rounded-full bg-[#7dd6c9]/12 px-2.5 py-1.5 text-[#9ce4d9]">Derivación 4</span>
            </div>
          </div>

          <div className="mt-3 flex gap-1 overflow-x-auto rounded-xl border border-white/10 bg-black/10 p-1" role="group" aria-label="Vistas del inspector del caso CRM">
            {['Resumen', 'Persona', 'Trámite', 'Adjuntos', 'Historial'].map((view) => (
              <button
                key={view}
                type="button"
                aria-pressed={inspectorView === view}
                className={`${focusRing} min-h-11 shrink-0 rounded-lg px-2.5 text-[11px] font-bold ${inspectorView === view ? 'bg-[#7dd6c9] text-[#073c38]' : 'text-white/70 hover:bg-white/[0.08] hover:text-white'}`}
                onClick={() => {
                  setInspectorView(view);
                  setOperatorNotice(`Inspector de muestra: ${view}.`);
                }}
              >
                {view}
              </button>
            ))}
          </div>

          <div className="mt-2 rounded-xl border border-[#7dd6c9]/20 bg-[#123e3a] p-3" data-testid="crm-inspector-panel" aria-live="polite">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#8be0d3]">{activeInspectorContent.title}</p>
            <p className="mt-1.5 text-xs leading-5 text-white/78">{activeInspectorContent.detail}</p>
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-2 xl:grid-cols-4" aria-label="Control operativo del caso">
            {[
              ['Cola', scenario.operational.queue],
              ['Prioridad', scenario.operational.priority],
              ['SLA', scenario.operational.sla],
              ['Localidad', scenario.operational.locality],
            ].map(([label, value]) => (
              <div key={label} className="min-w-0 rounded-xl border border-white/10 bg-black/10 p-2.5">
                <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/55">{label}</dt>
                <dd className="mt-1 break-words text-xs font-semibold leading-4 text-white/90">{value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.045] p-3" aria-label="Historial y transferencia del caso">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/55">Historial trazable</p>
              <span className="rounded-full border border-white/10 px-2 py-1 text-[11px] font-semibold text-white/70">{scenario.operational.attachments}</span>
            </div>
            <ol className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
              {scenario.history.map((event) => (
                <li key={event} className="flex items-center gap-1.5 text-[11px] leading-4 text-white/72">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#72d2c3]" aria-hidden="true" />
                  {event}
                </li>
              ))}
            </ol>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={`${focusRing} min-h-11 rounded-xl bg-[#7dd6c9] px-3 text-xs font-bold text-[#073c38] focus-visible:ring-[#a9eee4] focus-visible:ring-offset-[#102d2c]`}
              onClick={() => setOperatorNotice('Simulación: caso tomado por el operador de Mesa Única.')}
            >
              Tomar caso
            </button>
            <button
              type="button"
              className={`${focusRing} min-h-11 rounded-xl border border-white/18 bg-white/[0.07] px-3 text-xs font-bold text-white focus-visible:ring-[#a9eee4] focus-visible:ring-offset-[#102d2c]`}
              onClick={() => setOperatorNotice(`Transferencia preparada: Persona DEMO · ${scenario.operational.locality} · contacto protegido · ${scenario.category}.`)}
            >
              Preparar transferencia
            </button>
            <button
              type="button"
              className={`${focusRing} min-h-11 rounded-xl border border-[#f1c96b]/35 bg-[#f1c96b]/10 px-3 text-xs font-bold text-[#f7dda0] focus-visible:ring-[#f7dda0] focus-visible:ring-offset-[#102d2c]`}
              onClick={() => {
                setCsatOpen(true);
                setOperatorNotice('Cierre de muestra preparado y encuesta CSAT enviada al canal ciudadano.');
                setChatNotice('Encuesta de cierre recibida en el mismo hilo.');
              }}
            >
              Cerrar + CSAT
            </button>
            <p
              className="w-full basis-full text-xs leading-5 text-[#a8c9c3] sm:min-w-[12rem] sm:flex-1 sm:basis-auto"
              aria-live="polite"
            >
              {operatorNotice || `Transferencia: ${scenario.operational.transfer}.`}
            </p>
          </div>

          <dl className="mt-4 grid gap-2 sm:grid-cols-2">
            {[
              ['Estado', scenario.status],
              ['Responsable', scenario.owner],
              ['Categoría', scenario.category],
              ['Audiencia', scenario.audience],
            ].map(([label, value]) => (
              <div key={label} className="min-w-0 rounded-xl border border-white/10 bg-white/[0.055] p-3">
                <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/55">{label}</dt>
                <dd className="mt-1 break-words text-sm font-semibold text-white/95">{value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-3 rounded-xl border border-[#3db5a5]/35 bg-[#123e3a] p-3.5">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.13em] text-[#8be0d3]">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Próximo paso
            </div>
            <p className="mt-2 text-sm leading-6 text-white/90">{scenario.nextStep}</p>
          </div>

          <div className="mt-3 rounded-xl border border-white/10 bg-black/10 p-3.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-white/70">
              <ClipboardCheck className="h-4 w-4 text-[#8be0d3]" aria-hidden="true" />
              Lista de cotejo orientativa
            </div>
            <ul className="mt-3 grid gap-2 sm:grid-cols-3">
              {scenario.checklist.map((item) => (
                <li key={item} className="flex gap-2 text-xs leading-5 text-white/70">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#8be0d3]" aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <dl className="mt-3 grid gap-2 sm:grid-cols-2">
            <div className="min-w-0 rounded-xl border border-white/10 bg-white/[0.055] p-3">
              <dt className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/55">Registro conceptual</dt>
              <dd className="mt-1 break-words text-xs font-semibold text-white/90">{scenario.registration}</dd>
            </div>
            <div className="min-w-0 rounded-xl border border-white/10 bg-white/[0.055] p-3">
              <dt className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/55">CSAT al cierre</dt>
              <dd className="mt-1 break-words text-xs font-semibold text-white/90">{scenario.csat}</dd>
            </div>
          </dl>

          <div className="mt-3 flex items-start gap-2 rounded-xl border border-[#f1c96b]/25 bg-[#f1c96b]/10 p-3 text-xs leading-5 text-[#f7dda0]">
            <BellRing className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{scenario.alert}</span>
          </div>
        </section>
      </div>
    </div>
  );
};

const ConceptualTerritoryMap = ({ mapView }: { mapView: 'thematic' | 'geographic' }) => {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [shouldLoad, setShouldLoad] = React.useState(false);

  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    if (typeof IntersectionObserver === 'undefined') {
      setShouldLoad(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setShouldLoad(true);
        observer.disconnect();
      },
      { rootMargin: '320px 0px' },
    );
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="min-h-[25rem] sm:min-h-[30rem]" data-testid="tdf-map-viewport">
      {shouldLoad ? (
        <React.Suspense
          fallback={<div className="grid h-[25rem] place-items-center bg-[#e9f0ed] text-sm font-semibold text-[#50635f] sm:h-[30rem]" role="status">Preparando mapa conceptual…</div>}
        >
          <LazyMapLibreMap
            className="h-[25rem] rounded-none border-0 sm:h-[30rem]"
            center={content.territory.center}
            initialZoom={7}
            fitToBounds={content.territory.fitToBounds}
            boundsPadding={52}
            heatmapData={[...content.territory.points]}
            showHeatmap={mapView === 'thematic'}
            showPoints
            disableClientClustering
            ariaLabel="Mapa MapLibre de demanda conceptual y simulada en Tierra del Fuego"
            ariaDescribedBy="territory-map-description"
            evidence={{
              label: 'Ubicaciones simuladas',
              source: 'conceptual_demo',
              provider: 'MapLibre',
              synthetic: true,
              usingSyntheticPoints: true,
              pointCount: content.territory.points.length,
              syntheticDisclaimer: 'No representa datos provinciales ni casos reales.',
            }}
          />
        </React.Suspense>
      ) : (
        <div className="grid h-[25rem] place-items-center bg-[#e9f0ed] px-6 text-center text-sm font-semibold text-[#50635f] sm:h-[30rem]" role="status">
          El mapa conceptual se prepara al acercarte a esta sección.
        </div>
      )}
    </div>
  );
};

const DisabilityAIAgentDemoPage = () => {
  const operatingSystemReducedMotion = useReducedMotion() ?? false;
  const [userReducedMotion, setUserReducedMotion] = React.useState(false);
  const shouldReduceMotion = operatingSystemReducedMotion || userReducedMotion;
  const [activeScenarioId, setActiveScenarioId] = React.useState(content.scenarios[0].id);
  const [mapView, setMapView] = React.useState<'thematic' | 'geographic'>('thematic');
  const activeScenario =
    content.scenarios.find((scenario) => scenario.id === activeScenarioId) ?? content.scenarios[0];

  usePageMetadata(content.metadata);

  return (
    <>
      <a className="tdf-demo-skip-link" href="#main-content">Saltar al contenido principal</a>
      <div
      className="min-h-screen overflow-x-clip bg-[#f4f7f5] font-sans text-[#173a38] selection:bg-[#bfe7de] selection:text-[#103c38]"
      data-testid="tdf-disability-demo"
      data-reduced-motion={shouldReduceMotion ? 'true' : 'false'}
    >
      <aside aria-label="Estado de la demostración" className="bg-[#0b3f3c] px-4 py-2 text-center text-xs font-semibold tracking-wide text-white">
        <span className="inline-flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-[#8be0d3]" aria-hidden="true" />
          {content.truthNotice.title}
          <span className="hidden font-normal text-white/70 md:inline">· {content.truthNotice.detail}</span>
        </span>
      </aside>

      <header className="sticky top-0 z-40 border-b border-[#d8e3df] bg-[#f8faf9]">
        <div className="mx-auto flex min-h-16 w-full max-w-[90rem] items-center justify-between gap-4 px-4 sm:px-6 lg:px-10">
          <a href="#inicio" className={`${focusRing} flex min-h-11 min-w-0 items-center gap-3 rounded-xl`}>
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#0b4b47] text-white" aria-hidden="true">
              <Accessibility className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold text-[#123b38]">{content.brand.program}</span>
              <span className="block truncate text-[11px] font-medium text-[#526662]">{content.brand.entity} · propuesta conceptual</span>
            </span>
          </a>

          <nav className="hidden items-center gap-1 xl:flex" aria-label="Secciones de la demostración">
            {content.navigation.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className={`${focusRing} flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold text-[#536865] transition-colors hover:bg-white hover:text-[#0b5f58]`}
              >
                {item.label}
              </a>
            ))}
          </nav>

          <span className="hidden min-h-9 items-center rounded-full border border-[#bfd3cd] bg-white px-3 text-xs font-semibold text-[#46615e] sm:inline-flex">
            {content.brand.whiteLabel}
          </span>
          <InstitutionalAccessibilityControls
            reducedMotion={userReducedMotion}
            onReducedMotionChange={setUserReducedMotion}
          />
        </div>
        <nav className="mx-auto flex w-full max-w-[90rem] gap-1 overflow-x-auto border-t border-[#d8e3df] px-3 py-1.5 [scrollbar-width:thin] xl:hidden" aria-label="Secciones de la demostración en móvil">
          {content.navigation.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={`${focusRing} flex min-h-11 shrink-0 items-center rounded-xl px-3 text-xs font-bold text-[#315550] hover:bg-white`}
            >
              {item.label}
            </a>
          ))}
          <span className="sticky right-0 grid min-h-11 w-9 shrink-0 place-items-center bg-gradient-to-l from-[#f8faf9] via-[#f8faf9] to-transparent pl-2 text-lg font-bold text-[#52706a]" aria-hidden="true">→</span>
        </nav>
      </header>

      <main id="main-content" tabIndex={-1}>
        <section
          id="inicio"
          className="relative scroll-mt-24 border-b border-[#d9e4e0] bg-[radial-gradient(circle_at_88%_8%,rgba(216,238,232,0.8),transparent_34%),radial-gradient(circle_at_8%_94%,rgba(233,223,196,0.52),transparent_30%)]"
          aria-labelledby="hero-title"
        >
          <div className="relative mx-auto grid w-full max-w-[90rem] gap-10 px-4 py-10 sm:px-6 sm:py-14 lg:px-10 xl:grid-cols-[minmax(0,0.78fr)_minmax(34rem,1.22fr)] xl:items-center xl:py-20">
            <Reveal reduceMotion={shouldReduceMotion}>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#066b63]">{content.hero.eyebrow}</p>
              <h1 id="hero-title" className="mt-4 max-w-3xl text-balance text-4xl font-semibold leading-[1.03] tracking-[-0.05em] text-[#102f2e] sm:text-5xl xl:text-[3.65rem]">
                {content.hero.title}
              </h1>
              <p className="mt-6 max-w-2xl text-pretty text-base leading-7 text-[#536765] sm:text-lg sm:leading-8">
                {content.hero.description}
              </p>

              <div className="mt-7 flex flex-wrap gap-3">
                <a
                  href={content.hero.primaryAction.href}
                  className={`${focusRing} inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#0b5f58] px-5 text-sm font-bold text-white shadow-[0_12px_28px_-14px_rgba(11,95,88,0.85)] transition-colors hover:bg-[#094d48]`}
                >
                  {content.hero.primaryAction.label}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </a>
                <a
                  href={content.hero.secondaryAction.href}
                  className={`${focusRing} inline-flex min-h-12 items-center justify-center rounded-xl border border-[#b7cbc5] bg-white px-5 text-sm font-bold text-[#174a45] transition-colors hover:bg-[#edf5f2]`}
                >
                  {content.hero.secondaryAction.label}
                </a>
              </div>

              <ul className="mt-8 grid gap-2 text-sm text-[#405e59] sm:grid-cols-2" aria-label="Alcance de la propuesta">
                {content.hero.highlights.map((highlight) => (
                  <li key={highlight} className="flex min-h-10 items-center gap-2 rounded-xl border border-[#d6e3df] bg-white/70 px-3">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-[#168c7e]" aria-hidden="true" />
                    <span className="font-medium">{highlight}</span>
                  </li>
                ))}
              </ul>
            </Reveal>

            <Reveal reduceMotion={shouldReduceMotion} delay={0.08} className="min-w-0" >
              <ScenarioWorkspace
                scenario={activeScenario}
                activeScenario={activeScenarioId}
                onScenarioChange={setActiveScenarioId}
              />
            </Reveal>
          </div>
        </section>

        <section id="atencion" className="scroll-mt-24 bg-white py-16 sm:py-20" aria-labelledby="service-model-title">
          <div className="mx-auto w-full max-w-[90rem] px-4 sm:px-6 lg:px-10">
            <Reveal reduceMotion={shouldReduceMotion}>
              <SectionHeading
                id="service-model-title"
                eyebrow={content.serviceModel.eyebrow}
                title={content.serviceModel.title}
                description={content.serviceModel.description}
              />
            </Reveal>

            <div className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(20rem,0.75fr)]">
              <Reveal reduceMotion={shouldReduceMotion} className="rounded-[1.6rem] border border-[#d6e2de] bg-[#f7faf8] p-5 sm:p-6">
                <h3 className="text-base font-semibold text-[#173c39]">{content.serviceModel.audiencesTitle}</h3>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {content.serviceModel.audiences.map((audience) => {
                    const Icon = iconByKey[audience.icon];
                    return (
                      <div key={audience.title} className="flex items-start gap-3 rounded-xl border border-[#dce6e2] bg-white p-4">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#dff2ed] text-[#087a70]" aria-hidden="true">
                          <Icon className="h-5 w-5" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-[#183d39]">{audience.title}</p>
                          <p className="mt-1 text-xs leading-5 text-[#4d625d]">{audience.detail}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Reveal>

              <Reveal reduceMotion={shouldReduceMotion} delay={0.05} className="rounded-[1.6rem] border border-[#d6d9cf] bg-[#f8f5ec] p-5 sm:p-6">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-[#775b21]" aria-hidden="true">
                    <ShieldCheck className="h-5 w-5" />
                  </span>
                  <h3 className="text-base font-semibold text-[#3f392a]">{content.serviceModel.identityPolicy.title}</h3>
                </div>
                <p className="mt-4 text-sm leading-6 text-[#696252]">{content.serviceModel.identityPolicy.detail}</p>
              </Reveal>
            </div>

            <div className="mt-5 space-y-2 md:hidden" aria-label="Cinco ejes de atención">
              {content.serviceModel.axes.map((axis, index) => {
                const Icon = iconByKey[axis.icon];
                return (
                  <details key={axis.title} className="group rounded-2xl border border-[#d5e1dd] bg-[#f8faf9]" open={index === 0}>
                    <summary className={`${focusRing} flex min-h-14 cursor-pointer list-none items-center gap-3 rounded-2xl px-4 py-3 [&::-webkit-details-marker]:hidden`}>
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#e2f2ed] text-[#087a70]" aria-hidden="true">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-bold text-[#183d39]">{axis.title}</span>
                        <span className="block text-xs leading-5 text-[#4d625d]">{axis.topics}</span>
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-[#66807b] transition-transform group-open:rotate-90" aria-hidden="true" />
                    </summary>
                    <div className="border-t border-[#dce6e2] px-4 py-3 text-xs leading-5 text-[#526864]">
                      <p><span className="font-bold text-[#31534e]">Organismo:</span> {axis.responsible}</p>
                      <p className="mt-2"><span className="font-bold text-[#31534e]">Agente de IA:</span> {axis.agentRole}</p>
                    </div>
                  </details>
                );
              })}
            </div>

            <div className="mt-5 hidden gap-3 md:grid md:grid-cols-2 xl:grid-cols-5" aria-label="Cinco ejes de atención">
              {content.serviceModel.axes.map((axis, index) => {
                const Icon = iconByKey[axis.icon];
                return (
                  <Reveal key={axis.title} reduceMotion={shouldReduceMotion} delay={index * 0.035} className="min-w-0 rounded-2xl border border-[#d5e1dd] bg-[#f8faf9] p-4">
                    <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#e2f2ed] text-[#087a70]" aria-hidden="true">
                      <Icon className="h-4 w-4" />
                    </span>
                    <h3 className="mt-4 text-sm font-bold text-[#183d39]">{axis.title}</h3>
                    <p className="mt-1 text-xs font-semibold leading-5 text-[#087066]">{axis.topics}</p>
                    <p className="mt-3 text-xs leading-5 text-[#4d625d]"><span className="font-bold text-[#31534e]">Organismo:</span> {axis.responsible}</p>
                    <p className="mt-2 text-xs leading-5 text-[#4d625d]"><span className="font-bold text-[#31534e]">Agente de IA:</span> {axis.agentRole}</p>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>

        <section id="experiencia" className="scroll-mt-24 py-16 sm:py-20" aria-labelledby="experience-title">
          <div className="mx-auto w-full max-w-[90rem] px-4 sm:px-6 lg:px-10">
            <Reveal reduceMotion={shouldReduceMotion}>
              <SectionHeading
                id="experience-title"
                eyebrow={content.experience.eyebrow}
                title={content.experience.title}
                description={content.experience.description}
              />
            </Reveal>

            <div className="mt-9 grid gap-5 xl:grid-cols-[minmax(0,1fr)_16rem_minmax(0,1.2fr)] xl:items-stretch">
              <Reveal reduceMotion={shouldReduceMotion} className="rounded-[1.6rem] border border-[#d6e2de] bg-white p-5 sm:p-6">
                <h3 className="text-lg font-semibold text-[#153b38]">{content.experience.inputsTitle}</h3>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {content.experience.inputs.map((item) => {
                    const Icon = iconByKey[item.icon];
                    return (
                      <div key={item.label} className="flex min-h-[5.5rem] items-start gap-3 rounded-xl border border-[#e0e8e5] bg-[#f8faf9] p-3.5">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#e2f2ed] text-[#087a70]" aria-hidden="true">
                          <Icon className="h-4 w-4" />
                        </span>
                        <div>
                          <p className="text-sm font-bold text-[#183d39]">{item.label}</p>
                          <p className="mt-1 text-xs leading-5 text-[#536964]">{item.detail}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Reveal>

              <Reveal reduceMotion={shouldReduceMotion} delay={0.05} className="flex min-h-44 flex-col items-center justify-center rounded-[1.6rem] border border-[#8fbab1] bg-[#0c4b47] p-6 text-center text-white">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/10" aria-hidden="true">
                  <Accessibility className="h-6 w-6" />
                </span>
                <p className="mt-4 text-xs font-bold uppercase tracking-[0.16em] text-[#91dfd2]">{content.experience.bridge.label}</p>
                <h3 className="mt-2 text-xl font-semibold">{content.experience.bridge.title}</h3>
                <p className="mt-2 text-sm text-white/70">{content.experience.bridge.detail}</p>
              </Reveal>

              <Reveal reduceMotion={shouldReduceMotion} delay={0.1} className="rounded-[1.6rem] border border-[#d6e2de] bg-white p-5 sm:p-6">
                <h3 className="text-lg font-semibold text-[#153b38]">{content.experience.outputsTitle}</h3>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {content.experience.outputs.map((item) => {
                    const Icon = iconByKey[item.icon];
                    return (
                      <div key={item.label} className="flex min-h-[5.5rem] items-start gap-3 rounded-xl border border-[#e0e8e5] bg-[#f8faf9] p-3.5">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#efe8d8] text-[#775b21]" aria-hidden="true">
                          <Icon className="h-4 w-4" />
                        </span>
                        <div>
                          <p className="text-sm font-bold text-[#183d39]">{item.label}</p>
                          <p className="mt-1 text-xs leading-5 text-[#536964]">{item.detail}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        <section id="operacion" className="scroll-mt-24 border-y border-[#d9e3df] bg-white py-16 sm:py-20" aria-labelledby="operations-title">
          <div className="mx-auto w-full max-w-[90rem] px-4 sm:px-6 lg:px-10">
            <Reveal reduceMotion={shouldReduceMotion}>
              <SectionHeading
                id="operations-title"
                eyebrow={content.operations.eyebrow}
                title={content.operations.title}
                description={content.operations.description}
              />
            </Reveal>

            <div className="mt-9 grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(19rem,0.65fr)]">
              <Reveal reduceMotion={shouldReduceMotion} className="overflow-hidden rounded-[1.6rem] border border-[#cadbd6] bg-[#102f2e] text-white">
                <div className="grid gap-px bg-white/10 sm:grid-cols-3">
                  {[
                    [content.operations.channelLabel, content.operations.channelValue],
                    [content.operations.syncLabel, 'Muestra navegable'],
                    [content.operations.crmLabel, content.operations.crmValue],
                  ].map(([label, value]) => (
                    <div key={label} className="bg-[#102f2e] p-4 sm:p-5">
                      <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/55">{label}</p>
                      <p className="mt-2 text-base font-semibold">{value}</p>
                    </div>
                  ))}
                </div>
                <ol className="grid gap-0 p-5 sm:grid-cols-4 sm:p-6" aria-label="Etapas operativas del caso">
                  {content.operations.stages.map((stage, index) => (
                    <li key={stage.label} className="relative flex gap-3 pb-5 last:pb-0 sm:block sm:pb-0 sm:pr-5">
                      <div className="relative flex shrink-0 sm:mb-3 sm:items-center">
                        <span className={`z-10 grid h-9 w-9 place-items-center rounded-full text-xs font-bold ${stage.status === 'completo' ? 'bg-[#88ded1] text-[#0c3e3a]' : stage.status === 'activo' ? 'bg-[#f0c96f] text-[#493913]' : 'border border-white/25 bg-[#173b39] text-white/65'}`}>
                          {stage.status === 'completo' ? <Check className="h-4 w-4" aria-hidden="true" /> : index + 1}
                        </span>
                        {index < content.operations.stages.length - 1 ? <span className="absolute left-4 top-8 h-[calc(100%+0.5rem)] w-px bg-white/15 sm:left-9 sm:top-4 sm:h-px sm:w-[calc(100%-1.25rem)]" aria-hidden="true" /> : null}
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{stage.label}</p>
                        <p className="mt-1 text-xs leading-5 text-white/55">{stage.detail}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </Reveal>

              <div className="grid gap-5">
                <Reveal reduceMotion={shouldReduceMotion} delay={0.05} className="rounded-[1.6rem] border border-[#d2dfdb] bg-[#f7faf8] p-5 sm:p-6">
                  <div className="flex items-center justify-between gap-4">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#dff2ed] text-[#087a70]" aria-hidden="true"><Clock3 className="h-5 w-5" /></span>
                    <span className="rounded-full border border-[#a9cbc3] bg-white px-3 py-1 text-sm font-bold text-[#0b665e]">{content.operations.humanWindow.schedule}</span>
                  </div>
                  <h3 className="mt-5 text-lg font-semibold text-[#173c39]">{content.operations.humanWindow.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#5d716d]">{content.operations.humanWindow.detail}</p>
                </Reveal>
                <Reveal reduceMotion={shouldReduceMotion} delay={0.1} className="rounded-[1.6rem] border border-[#d6d9cf] bg-[#f8f5ec] p-5 sm:p-6">
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-white text-[#775b21]" aria-hidden="true"><ShieldCheck className="h-5 w-5" /></span>
                    <h3 className="text-lg font-semibold text-[#3f392a]">{content.operations.whiteLabel.title}</h3>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-[#696252]">{content.operations.whiteLabel.detail}</p>
                </Reveal>
              </div>
            </div>

            <Reveal reduceMotion={shouldReduceMotion} delay={0.12} className="mt-5 rounded-[1.6rem] border border-[#d2dfdb] bg-[#f7faf8] p-5 sm:p-6">
              <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
                <div>
                  <h3 className="flex items-center gap-2 text-lg font-semibold text-[#173c39]">
                    <BellRing className="h-5 w-5 text-[#087a70]" aria-hidden="true" />
                    {content.operations.alertsTitle}
                  </h3>
                  <p className="mt-2 max-w-3xl text-xs leading-5 text-[#5d716d]">{content.operations.alertsDescription}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full border border-[#9fc7bd] bg-[#e8f5f1] px-3 py-1 text-[11px] font-bold text-[#14685f]">
                    {content.operations.alertsMetric}
                  </span>
                  <span className="rounded-full border border-[#b9d0c9] bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#47635e]">
                    Configuración previa obligatoria
                  </span>
                </div>
              </div>
              <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {content.operations.alerts.map((alert) => {
                  const Icon = iconByKey[alert.icon];
                  return (
                    <li key={alert.label} className="flex min-h-[5rem] items-start gap-3 rounded-xl border border-[#dce6e2] bg-white p-3.5">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#e2f2ed] text-[#087a70]" aria-hidden="true">
                        <Icon className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="text-sm font-bold text-[#183d39]">{alert.label}</p>
                        <p className="mt-1 text-xs leading-5 text-[#4d625d]">{alert.detail}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Reveal>
          </div>
        </section>

        <section id="indicadores" className="scroll-mt-24 py-16 sm:py-20" aria-labelledby="territory-title">
          <div className="mx-auto w-full max-w-[90rem] px-4 sm:px-6 lg:px-10">
            <Reveal reduceMotion={shouldReduceMotion}>
              <SectionHeading
                id="territory-title"
                eyebrow={content.territory.eyebrow}
                title={content.territory.title}
                description={content.territory.description}
              />
            </Reveal>

            <div className="mt-9 grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(22rem,0.65fr)]">
              <Reveal reduceMotion={shouldReduceMotion} className="overflow-hidden rounded-[1.6rem] border border-[#cbdcd7] bg-white">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#dce6e2] p-4 sm:p-5">
                  <div className="max-w-xl">
                    <h3 className="text-lg font-semibold text-[#173c39]">{content.territory.mapTitle}</h3>
                    <p id="territory-map-description" className="mt-1 text-xs leading-5 text-[#687a77]">{content.territory.mapDescription}</p>
                  </div>
                  <div className="inline-flex rounded-xl border border-[#c9d8d4] bg-[#f2f6f4] p-1" role="group" aria-label={content.territory.viewLabel}>
                    {(['thematic', 'geographic'] as const).map((view) => (
                      <button
                        key={view}
                        type="button"
                        className={`${focusRing} min-h-11 rounded-lg px-3 text-xs font-bold transition-colors ${mapView === view ? 'bg-white text-[#0b665e] shadow-sm' : 'text-[#506560] hover:text-[#173c39]'}`}
                        aria-pressed={mapView === view}
                        onClick={() => setMapView(view)}
                      >
                        {content.territory.views[view]}
                      </button>
                    ))}
                  </div>
                </div>
                <ConceptualTerritoryMap mapView={mapView} />
                <p className="border-t border-[#dce6e2] bg-[#f8faf9] px-4 py-3 text-xs leading-5 text-[#5d706d] sm:px-5">
                  {content.territory.note}
                </p>
              </Reveal>

              <div className="grid gap-5">
                <Reveal reduceMotion={shouldReduceMotion} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-2">
                  {content.territory.metrics.map((metric) => (
                    <div key={metric.label} className="rounded-2xl border border-[#d4e0dc] bg-white p-4">
                      <p className="text-3xl font-semibold tracking-[-0.04em] text-[#123c39]">{metric.value}</p>
                      <p className="mt-1 text-sm font-semibold text-[#31524e]">{metric.label}</p>
                      <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[#536864]">{metric.detail}</p>
                    </div>
                  ))}
                </Reveal>

                <Reveal reduceMotion={shouldReduceMotion} delay={0.06} className="rounded-[1.6rem] border border-[#d4e0dc] bg-white p-5">
                  <div className="flex items-center gap-3">
                    <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#e2f2ed] text-[#087a70]" aria-hidden="true"><BarChart3 className="h-4 w-4" /></span>
                    <h3 className="text-base font-semibold text-[#173c39]">{content.territory.breakdownTitle}</h3>
                  </div>
                  <ul className="mt-5 space-y-4">
                    {content.territory.breakdown.map((item) => (
                      <li key={item.label}>
                        <div className="flex items-end justify-between gap-3 text-xs">
                          <span className="font-semibold text-[#405e59]">{item.label}</span>
                          <span className="font-bold text-[#173c39]">{item.value}%</span>
                        </div>
                        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-[#e5ece9]" role="img" aria-label={`${item.label}: ${item.value} por ciento en la muestra conceptual`}>
                          <motion.div
                            className="h-full rounded-full bg-[#168c7e]"
                            style={shouldReduceMotion ? { width: `${item.value}%` } : undefined}
                            initial={shouldReduceMotion ? false : { width: 0 }}
                            whileInView={shouldReduceMotion ? undefined : { width: `${item.value}%` }}
                            viewport={shouldReduceMotion ? undefined : { once: true, amount: 0.7 }}
                            transition={{ duration: shouldReduceMotion ? 0 : 0.7, ease: 'easeOut' }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                </Reveal>
              </div>
            </div>
          </div>
        </section>

        <section id="gobernanza" className="scroll-mt-24 border-y border-[#d9e3df] bg-[#102f2e] py-16 text-white sm:py-20" aria-labelledby="governance-title">
          <div className="mx-auto w-full max-w-[90rem] px-4 sm:px-6 lg:px-10">
            <Reveal reduceMotion={shouldReduceMotion}>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#88ded1]">{content.governance.eyebrow}</p>
              <h2 id="governance-title" className="mt-3 max-w-3xl text-balance text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">{content.governance.title}</h2>
              <p className="mt-4 max-w-2xl text-base leading-7 text-white/65">{content.governance.description}</p>
            </Reveal>

            <div className="mt-9 grid gap-5 lg:grid-cols-2">
              {[
                [content.governance.accessibilityTitle, content.governance.accessibilityItems, Accessibility],
                [content.governance.controlsTitle, content.governance.controlsItems, ShieldCheck],
              ].map(([title, items, Icon], blockIndex) => {
                const GovernanceIcon = Icon as LucideIcon;
                return (
                  <Reveal key={String(title)} reduceMotion={shouldReduceMotion} delay={blockIndex * 0.06} className="rounded-[1.6rem] border border-white/12 bg-white/[0.055] p-5 sm:p-6">
                    <div className="flex items-center gap-3">
                      <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#8be0d3] text-[#0b3f3b]" aria-hidden="true"><GovernanceIcon className="h-5 w-5" /></span>
                      <h3 className="text-lg font-semibold">{String(title)}</h3>
                    </div>
                    <ul className="mt-5 space-y-3">
                      {(items as readonly string[]).map((item) => (
                        <li key={item} className="flex gap-3 text-sm leading-6 text-white/75">
                          <Check className="mt-1 h-4 w-4 shrink-0 text-[#88ded1]" aria-hidden="true" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </Reveal>
                );
              })}
            </div>

            <Reveal reduceMotion={shouldReduceMotion} delay={0.1} className="mt-5 rounded-2xl border border-[#e7c771]/35 bg-[#e7c771]/10 p-5">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#f3d98e]" aria-hidden="true" />
                <div>
                  <h3 className="font-semibold text-[#f5e1a8]">{content.governance.cautionTitle}</h3>
                  <p className="mt-2 max-w-5xl text-sm leading-6 text-white/70">{content.governance.caution}</p>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        <section id="implementacion" className="scroll-mt-24 bg-white py-16 sm:py-20" aria-labelledby="implementation-title">
          <div className="mx-auto w-full max-w-[90rem] px-4 sm:px-6 lg:px-10">
            <Reveal reduceMotion={shouldReduceMotion}>
              <SectionHeading
                id="implementation-title"
                eyebrow={content.implementation.eyebrow}
                title={content.implementation.title}
                description={content.implementation.description}
              />
            </Reveal>

            <ol className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Hoja de ruta en cuatro fases">
              {content.implementation.phases.map((phase, index) => (
                <li key={phase.number} className="h-full">
                  <Reveal reduceMotion={shouldReduceMotion} delay={index * 0.04} className="h-full rounded-2xl border border-[#d5e1dd] bg-[#f8faf9] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#087f73]">Fase {phase.number}</span>
                      <Route className="h-4 w-4 text-[#7b918c]" aria-hidden="true" />
                    </div>
                    <h3 className="mt-3 text-base font-semibold text-[#173c39]">{phase.title}</h3>
                    <p className="mt-2 text-xs leading-5 text-[#4d625d]">{phase.detail}</p>
                  </Reveal>
                </li>
              ))}
            </ol>

            <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)]">
              <Reveal reduceMotion={shouldReduceMotion} className="rounded-[1.6rem] border border-[#d6e2de] bg-[#f7faf8] p-5 sm:p-6">
                <h3 className="text-lg font-semibold text-[#173c39]">{content.implementation.responsibilitiesTitle}</h3>
                <div className="mt-4 space-y-2 md:hidden">
                  {content.implementation.responsibilities.map((responsibility) => (
                    <details key={responsibility.party} className="group rounded-xl border border-[#dce6e2] bg-white">
                      <summary className={`${focusRing} flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm font-bold text-[#183d39] [&::-webkit-details-marker]:hidden`}>
                        {responsibility.party}
                        <ChevronRight className="h-4 w-4 text-[#66807b] transition-transform group-open:rotate-90" aria-hidden="true" />
                      </summary>
                      <ul className="space-y-2 border-t border-[#dce6e2] px-4 py-3">
                        {responsibility.items.map((item) => (
                          <li key={item} className="flex gap-2 text-xs leading-5 text-[#4d625d]">
                            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#168c7e]" aria-hidden="true" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  ))}
                </div>
                <div className="mt-4 hidden gap-3 md:grid md:grid-cols-2">
                  {content.implementation.responsibilities.map((responsibility, index) => (
                    <div
                      key={responsibility.party}
                      className={`rounded-xl border border-[#dce6e2] bg-white p-4 ${index === content.implementation.responsibilities.length - 1 && content.implementation.responsibilities.length % 2 === 1 ? 'md:col-span-2' : ''}`}
                    >
                      <h4 className="text-sm font-bold text-[#183d39]">{responsibility.party}</h4>
                      <ul className="mt-3 space-y-2">
                        {responsibility.items.map((item) => (
                          <li key={item} className="flex gap-2 text-xs leading-5 text-[#4d625d]">
                            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#168c7e]" aria-hidden="true" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </Reveal>

              <Reveal reduceMotion={shouldReduceMotion} delay={0.05} className="overflow-hidden rounded-[1.6rem] border border-[#7ba49b] bg-[#102f2e] text-white">
                <div className="border-b border-white/12 p-5 sm:p-6">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#88ded1]">Propuesta económica orientativa</p>
                  <h3 className="mt-2 text-2xl font-semibold">{content.implementation.budget.title}</h3>
                  <p className="mt-4 text-2xl font-semibold tracking-[-0.03em] text-[#f3d98e] sm:text-3xl">{content.implementation.budget.price}</p>
                  <p className="mt-2 max-w-3xl text-xs leading-5 text-white/65">{content.implementation.budget.priceDetail}</p>
                </div>

                <div className="grid gap-px bg-white/10 md:grid-cols-2">
                  {[
                    [content.implementation.budget.initialTitle, content.implementation.budget.initialItems],
                    [content.implementation.budget.operationTitle, content.implementation.budget.operationItems],
                  ].map(([title, items]) => (
                    <div key={String(title)} className="bg-[#102f2e] p-5 sm:p-6">
                      <h4 className="text-sm font-semibold text-white">{String(title)}</h4>
                      <ul className="mt-3 space-y-2">
                        {(items as readonly string[]).map((item) => (
                          <li key={item} className="flex gap-2 text-xs leading-5 text-white/65">
                            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#88ded1]" aria-hidden="true" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>

                <div className="grid gap-3 border-t border-white/12 p-5 sm:p-6 md:grid-cols-2">
                  {[
                    [content.implementation.budget.dependenciesTitle, content.implementation.budget.dependencies],
                    [content.implementation.budget.exclusionsTitle, content.implementation.budget.exclusions],
                  ].map(([title, items]) => (
                    <details key={String(title)} className="group rounded-xl border border-white/12 bg-white/[0.055]">
                      <summary className={`${focusRing} flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 py-3 text-xs font-bold uppercase tracking-[0.1em] text-white/85 focus-visible:ring-[#88ded1] focus-visible:ring-offset-[#102f2e] [&::-webkit-details-marker]:hidden`}>
                        {String(title)}
                        <ChevronRight className="h-4 w-4 text-[#88ded1] transition-transform group-open:rotate-90" aria-hidden="true" />
                      </summary>
                      <ul className="space-y-2 border-t border-white/10 px-4 py-3">
                        {(items as readonly string[]).map((item) => (
                          <li key={item} className="flex gap-2 text-xs leading-5 text-white/65">
                            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#88ded1]" aria-hidden="true" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  ))}
                </div>

                <div className="flex flex-col gap-3 border-t border-white/12 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                  <p className="max-w-xl text-xs leading-5 text-white/60">Documento ejecutivo conceptual; la contratación requiere validar alcance, fuentes, riesgos y condiciones.</p>
                  <a
                    href="/propuestas/propuesta-ejecutiva-agente-ia-discapacidad-tdf.pdf"
                    download
                    className={`${focusRing} inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#f3d98e] px-4 text-sm font-bold text-[#3e3218] hover:bg-[#ffe7a9] focus-visible:ring-[#f3d98e] focus-visible:ring-offset-[#102f2e]`}
                  >
                    <FileText className="h-4 w-4" aria-hidden="true" />
                    Descargar propuesta PDF
                  </a>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        <section className="border-t border-[#d9e3df] py-16 sm:py-20" aria-labelledby="closing-title">
          <Reveal reduceMotion={shouldReduceMotion} className="mx-auto w-[calc(100%-2rem)] max-w-[82rem] rounded-[2rem] border border-[#b9d1ca] bg-white px-5 py-10 text-center shadow-[0_30px_90px_-60px_rgba(13,76,70,0.55)] sm:px-10 sm:py-14">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#066b63]">{content.closing.eyebrow}</p>
            <h2 id="closing-title" className="mx-auto mt-3 max-w-3xl text-balance text-3xl font-semibold tracking-[-0.035em] text-[#102f2e] sm:text-4xl">{content.closing.title}</h2>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-[#4d625d]">{content.closing.description}</p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <a href={content.closing.primaryAction.href} className={`${focusRing} inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#0b5f58] px-5 text-sm font-bold text-white hover:bg-[#094d48]`}>
                {content.closing.primaryAction.label}<ChevronRight className="h-4 w-4" aria-hidden="true" />
              </a>
              <a href={content.closing.secondaryAction.href} className={`${focusRing} inline-flex min-h-12 items-center rounded-xl border border-[#b7cbc5] px-5 text-sm font-bold text-[#174a45] hover:bg-[#edf5f2]`}>
                {content.closing.secondaryAction.label}
              </a>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="border-t border-[#d4e0dc] bg-[#eaf0ed]">
        <div className="mx-auto flex w-full max-w-[90rem] flex-col gap-3 px-4 py-7 text-xs text-[#536763] sm:px-6 md:flex-row md:items-end md:justify-between lg:px-10">
          <div>
            <p className="font-bold text-[#244b46]">{content.footer.label}</p>
            <p className="mt-1">{content.footer.detail}</p>
            <p className="mt-2 max-w-2xl font-semibold text-[#315550]">{content.footer.creator}</p>
          </div>
          <p className="font-semibold">{content.footer.disclaimer}</p>
        </div>
      </footer>
      </div>
    </>
  );
};

export default DisabilityAIAgentDemoPage;

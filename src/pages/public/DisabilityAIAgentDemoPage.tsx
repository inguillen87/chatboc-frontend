import React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import {
  Accessibility,
  Activity,
  AlignLeft,
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
  Pause,
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  Play,
  RotateCcw,
  Route,
  Send,
  ShieldCheck,
  SkipForward,
  Sparkles,
  UserRound,
  Users,
  Volume2,
  VolumeX,
  WalletCards,
  X,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

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
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#28c8e8] focus-visible:ring-offset-2 focus-visible:ring-offset-[#f4f7f5]';
const faroBlueFocusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#28c8e8] focus-visible:ring-offset-2 focus-visible:ring-offset-white';

const DEMO_FINAL_STEP = 9;
const DEMO_STEP_MS = 1450;
const FARO_ASSET = '/branding/faro-agent-accessible-v1.webp';
const FARO_ICON_ASSET = '/branding/faro-agent-icon-v1.webp';

const TERRITORY_CATEGORY_META = [
  { label: 'CUD / CMO', short: 'C', color: '#087c81', textColor: '#ffffff' },
  { label: 'Salud y prestaciones', short: 'S', color: '#d55d39', textColor: '#071f38' },
  { label: 'Educación y apoyos', short: 'E', color: '#2563eb', textColor: '#ffffff' },
  { label: 'RUPE y licencias', short: 'R', color: '#b7791f', textColor: '#071f38' },
  { label: 'Inclusión laboral', short: 'I', color: '#7c3aed', textColor: '#ffffff' },
] as const;

const territoryPointKey = (point: (typeof content.territory.points)[number]) =>
  `${point.ciudad}-${point.barrio}-${point.categoria}-${point.tipo_ticket}`;

const demoStepLabels = [
  'Canal listo',
  'Consulta recibida',
  'Adjunto accesible',
  'Procesamiento simulado',
  'Categoría y prioridad',
  'Respuesta en preparación',
  'Orientación enviada',
  'Entregables enviados',
  'Seguimiento y derivación',
  'CSAT disponible',
] as const;

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
    <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#075f91]">{eyebrow}</p>
    <h2 id={id} className="mt-3 text-balance text-3xl font-semibold tracking-[-0.035em] text-[#071f38] sm:text-4xl">
      {title}
    </h2>
    <p className="mt-4 max-w-2xl text-pretty text-base leading-7 text-[#526b7d]">{description}</p>
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
  const [readingFriendly, setReadingFriendly] = React.useState(false);
  const [wideSpacing, setWideSpacing] = React.useState(false);
  const [readingFocus, setReadingFocus] = React.useState(false);
  const [speaking, setSpeaking] = React.useState(false);
  const speechSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  React.useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('tdf-demo-large-text', largeText);
    root.classList.toggle('tdf-demo-high-contrast', highContrast);
    root.classList.toggle('tdf-demo-reading-friendly', readingFriendly);
    root.classList.toggle('tdf-demo-wide-spacing', wideSpacing);
    root.classList.toggle('tdf-demo-reading-focus', readingFocus);
    root.classList.toggle('tdf-demo-reduced-motion', reducedMotion);

    return () => {
      root.classList.remove(
        'tdf-demo-large-text',
        'tdf-demo-high-contrast',
        'tdf-demo-reading-friendly',
        'tdf-demo-wide-spacing',
        'tdf-demo-reading-focus',
        'tdf-demo-reduced-motion',
      );
    };
  }, [largeText, highContrast, readingFriendly, wideSpacing, readingFocus, reducedMotion]);

  React.useEffect(() => () => {
    if (speechSupported) window.speechSynthesis.cancel();
  }, [speechSupported]);

  const toggleReadAloud = () => {
    if (!speechSupported) return;
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const readableText = document.querySelector('main')?.textContent?.replace(/\s+/g, ' ').trim();
    if (!readableText) return;
    const utterance = new SpeechSynthesisUtterance(readableText.slice(0, 8500));
    utterance.lang = 'es-AR';
    utterance.rate = 0.9;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    setSpeaking(true);
  };

  const preferences = [
    { label: 'Texto grande', pressed: largeText, toggle: () => setLargeText((value) => !value) },
    { label: 'Alto contraste', pressed: highContrast, toggle: () => setHighContrast((value) => !value) },
    { label: 'Lectura clara / dislexia', pressed: readingFriendly, toggle: () => setReadingFriendly((value) => !value) },
    { label: 'Espaciado amplio', pressed: wideSpacing, toggle: () => setWideSpacing((value) => !value) },
    { label: 'Foco de lectura', pressed: readingFocus, toggle: () => setReadingFocus((value) => !value) },
    { label: 'Reducir movimiento', pressed: reducedMotion, toggle: () => onReducedMotionChange(!reducedMotion) },
  ];

  return (
    <div className="relative z-50 flex flex-col items-end gap-2">
      {open ? (
        <div
          id="institutional-accessibility-panel"
          className="absolute right-0 top-14 w-[min(19rem,calc(100vw-1.5rem))] rounded-2xl border border-[#b8d0df] bg-white p-3 shadow-[0_22px_60px_rgba(7,31,56,0.24)]"
          role="region"
          aria-label="Preferencias de accesibilidad"
        >
          <p className="px-1 text-sm font-bold text-[#071f38]">Accesibilidad</p>
          <p className="mt-1 px-1 text-xs leading-5 text-[#4a6275]">Preferencias locales. No se guardan ni se envían.</p>
          <div className="mt-3 grid gap-2">
            {preferences.map(({ label, pressed, toggle }) => (
              <button
                key={label}
                type="button"
                aria-pressed={pressed}
                className={`${faroBlueFocusRing} flex min-h-11 items-center justify-between rounded-xl border border-[#c7d9e5] px-3 text-left text-sm font-bold text-[#173c57] hover:bg-[#edf6fb]`}
                onClick={toggle}
              >
                <span>{label}</span>
                <span className={`grid h-6 w-6 place-items-center rounded-full ${pressed ? 'bg-[#075f91] text-white' : 'bg-[#e9f1f6] text-[#5b7182]'}`} aria-hidden="true">
                  {pressed ? <Check className="h-4 w-4" /> : null}
                </span>
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={!speechSupported}
            aria-pressed={speaking}
            className={`${faroBlueFocusRing} mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#075f91] px-3 text-sm font-bold text-white shadow-[0_10px_24px_rgba(7,95,145,0.2)] hover:bg-[#064d78] disabled:cursor-not-allowed disabled:opacity-50`}
            onClick={toggleReadAloud}
          >
            {speaking ? <VolumeX className="h-4 w-4" aria-hidden="true" /> : <Volume2 className="h-4 w-4" aria-hidden="true" />}
            {speaking ? 'Detener lectura' : 'Escuchar contenido'}
          </button>
          <p className="mt-2 px-1 text-[11px] leading-4 text-[#526b7d]">
            El modo de lectura cambia tipografía, espaciado y ancho de línea; no presupone una única necesidad visual.
          </p>
        </div>
      ) : null}
      <button
        type="button"
        className={`${faroBlueFocusRing} grid h-12 w-12 place-items-center rounded-full border border-[#55cae3]/45 bg-[#071f38] text-[#7de7f3] shadow-[0_14px_34px_rgba(7,31,56,0.34)]`}
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

const InteractiveScenarioWorkspace = ({
  scenario,
  activeScenario,
  onScenarioChange,
  reduceMotion,
}: {
  scenario: DemoScenario;
  activeScenario: string;
  onScenarioChange: (scenarioId: string) => void;
  reduceMotion: boolean;
}) => {
  const tabRefs = React.useRef<Array<HTMLButtonElement | null>>([]);
  const workspaceRef = React.useRef<HTMLDivElement | null>(null);
  const [hasEnteredViewport, setHasEnteredViewport] = React.useState(false);
  const [step, setStep] = React.useState(0);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [mobilePane, setMobilePane] = React.useState<'chat' | 'crm'>('chat');
  const [selectedRole, setSelectedRole] = React.useState<'Para mí' | 'Familia / red'>(scenario.roleChoice);
  const [notice, setNotice] = React.useState('');
  const [inspectorView, setInspectorView] = React.useState('Resumen');
  const [audioPlaying, setAudioPlaying] = React.useState(false);
  const [csatOpen, setCsatOpen] = React.useState(false);
  const [csatRating, setCsatRating] = React.useState<number | null>(null);

  React.useEffect(() => {
    setStep(0);
    setIsPlaying(hasEnteredViewport && !reduceMotion);
    setMobilePane('chat');
    setSelectedRole(scenario.roleChoice);
    setNotice('');
    setInspectorView('Resumen');
    setAudioPlaying(false);
    setCsatOpen(false);
    setCsatRating(null);
  }, [scenario.id, scenario.roleChoice]);

  React.useEffect(() => {
    const element = workspaceRef.current;
    if (!element) return undefined;
    if (typeof IntersectionObserver === 'undefined') {
      setHasEnteredViewport(true);
      return undefined;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setHasEnteredViewport(true);
          observer.disconnect();
        }
      },
      { threshold: 0.22, rootMargin: '0px 0px -8% 0px' },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    if (hasEnteredViewport && !reduceMotion && step === 0) setIsPlaying(true);
  }, [hasEnteredViewport, reduceMotion, step]);

  React.useEffect(() => {
    if (reduceMotion) setIsPlaying(false);
  }, [reduceMotion]);

  React.useEffect(() => {
    const pauseWhenHidden = () => {
      if (document.hidden) setIsPlaying(false);
    };
    document.addEventListener('visibilitychange', pauseWhenHidden);
    return () => document.removeEventListener('visibilitychange', pauseWhenHidden);
  }, []);

  React.useEffect(() => {
    if (!hasEnteredViewport || !isPlaying || step >= DEMO_FINAL_STEP) return undefined;
    const timer = window.setTimeout(() => {
      setStep((current) => Math.min(DEMO_FINAL_STEP, current + 1));
    }, DEMO_STEP_MS);
    return () => window.clearTimeout(timer);
  }, [hasEnteredViewport, isPlaying, step]);

  React.useEffect(() => {
    if (step >= DEMO_FINAL_STEP) setIsPlaying(false);
  }, [step]);

  const progress = Math.round((step / DEMO_FINAL_STEP) * 100);
  const currentLabel = demoStepLabels[step] ?? demoStepLabels[0];
  const visibleHistory = scenario.history.slice(0, Math.max(0, Math.min(scenario.history.length, step - 3)));
  const crmStatus = step < 1
    ? 'Esperando evento'
    : step < 3
      ? 'Ingreso registrado'
      : step < 4
        ? 'Procesamiento simulado'
        : step < 6
          ? 'Clasificado'
          : scenario.status;

  const eventRows = [
    { at: 1, label: 'Mensaje recibido', detail: 'Caso creado desde WhatsApp', icon: MessageCircle },
    { at: 2, label: 'Adjunto accesible', detail: scenario.citizenAsset.label, icon: scenario.citizenAsset.kind === 'audio' ? Mic : scenario.citizenAsset.kind === 'location' ? MapPin : scenario.citizenAsset.kind === 'image' ? ImageIcon : FileText },
    { at: 4, label: 'Clasificación asistida', detail: `${scenario.category} · ${scenario.operational.priority}`, icon: Sparkles },
    { at: 6, label: 'Respuesta enviada', detail: 'Orientación entregada en el mismo hilo', icon: Send },
    { at: 7, label: 'Entregables', detail: scenario.deliverables.map((item) => item.label).join(' · '), icon: FileText },
    { at: 8, label: 'Continuidad humana', detail: 'Llamada o transferencia disponible', icon: PhoneOutgoing },
  ];

  const inspectorContent: Record<string, { title: string; detail: string }> = {
    Resumen: { title: 'Resumen operativo', detail: step >= 4 ? `${crmStatus} · ${scenario.operational.priority} · ${scenario.operational.queue}.` : 'El resumen se completa a medida que avanza la secuencia.' },
    Persona: { title: 'Persona y red de apoyo', detail: step >= 2 ? `Persona DEMO · ${selectedRole} · identidad protegida · ${scenario.operational.locality}.` : 'Sin identidad ni datos personales en esta muestra.' },
    Trámite: { title: 'Trámite y próximo paso', detail: step >= 6 ? `${scenario.category}. ${scenario.nextStep}` : 'Motivo todavía en clasificación conceptual.' },
    Adjuntos: { title: 'Adjuntos y entregables', detail: step >= 7 ? `${scenario.operational.attachments}. ${scenario.deliverables.map((item) => item.label).join(' · ')}.` : step >= 2 ? scenario.citizenAsset.label : 'Todavía no hay adjuntos.' },
    Historial: { title: 'Historial del caso', detail: visibleHistory.length ? visibleHistory.join(' · ') : 'El historial aparecerá evento por evento.' },
  };

  const focusScenario = React.useCallback((index: number) => {
    const target = content.scenarios[index];
    if (!target) return;
    onScenarioChange(target.id);
    tabRefs.current[index]?.focus();
  }, [onScenarioChange]);

  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'Home') return focusScenario(0);
    if (event.key === 'End') return focusScenario(content.scenarios.length - 1);
    const direction = event.key === 'ArrowRight' ? 1 : -1;
    focusScenario((index + direction + content.scenarios.length) % content.scenarios.length);
  };

  const restart = () => {
    setStep(0);
    setIsPlaying(!reduceMotion);
    setNotice('Secuencia reiniciada.');
    setAudioPlaying(false);
    setCsatOpen(false);
    setCsatRating(null);
  };

  const revealAll = () => {
    setStep(DEMO_FINAL_STEP);
    setIsPlaying(false);
    setNotice('Secuencia completa visible.');
  };

  const motionProps = reduceMotion
    ? { initial: false as const, animate: { opacity: 1 }, exit: { opacity: 1 }, transition: { duration: 0 } }
    : { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0 }, transition: { duration: 0.28 } };

  return (
    <div ref={workspaceRef} className="overflow-hidden rounded-[1.75rem] border border-[#b8d0df] bg-white shadow-[0_28px_80px_-48px_rgba(7,95,145,0.42)]" data-testid="interactive-scenario-workspace">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#d6e4ed] bg-[#f8fbfd] px-4 py-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <motion.img
            src={FARO_ICON_ASSET}
            alt=""
            className="h-12 w-12 shrink-0 object-contain"
            width="48"
            height="48"
            initial={reduceMotion ? false : { opacity: 0.72, scale: 0.94, rotate: -3 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.48, ease: 'easeOut' }}
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-[#071f38]">{content.brand.product}</p>
            <p className="truncate text-xs text-[#526b7d]">{content.brand.agentMeaning}</p>
          </div>
        </div>
        <span className="inline-flex min-h-8 items-center gap-2 rounded-full border border-[#b8d0df] bg-[#edf6fb] px-3 text-xs font-bold text-[#075f91]">
          <span className={`h-2 w-2 rounded-full ${isPlaying ? 'bg-[#28c8e8]' : 'bg-[#d2a23c]'}`} aria-hidden="true" />
          Secuencia local · sin conexión a CRM
        </span>
      </div>

      <div className="border-b border-[#d6e4ed] bg-white px-3 py-3 sm:px-5">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" data-testid="tdf-sequence-toggle" className={`${focusRing} inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#075f91] px-3 text-xs font-bold text-white shadow-[0_8px_20px_rgba(7,95,145,0.18)] transition-colors hover:bg-[#064d78] disabled:opacity-45`} onClick={() => setIsPlaying((value) => !value)} disabled={step >= DEMO_FINAL_STEP} aria-label={isPlaying ? 'Pausar demostración' : 'Reanudar demostración'}>
            {isPlaying ? <Pause className="h-4 w-4" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}
            {isPlaying ? 'Pausar' : step >= DEMO_FINAL_STEP ? 'Finalizada' : 'Reanudar'}
          </button>
          <button type="button" className={`${focusRing} inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#b8d0df] bg-white px-3 text-xs font-bold text-[#173c57] transition-colors hover:border-[#70b8d9] hover:bg-[#edf6fb] disabled:opacity-45`} onClick={() => { setIsPlaying(false); setStep((current) => Math.min(DEMO_FINAL_STEP, current + 1)); }} disabled={step >= DEMO_FINAL_STEP} aria-label="Siguiente paso">
            <SkipForward className="h-4 w-4" aria-hidden="true" />Siguiente
          </button>
          <button type="button" className={`${focusRing} inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#b8d0df] bg-white px-3 text-xs font-bold text-[#173c57] transition-colors hover:border-[#70b8d9] hover:bg-[#edf6fb]`} onClick={restart} aria-label="Reproducir nuevamente">
            <RotateCcw className="h-4 w-4" aria-hidden="true" />Reiniciar
          </button>
          <button type="button" className={`${focusRing} min-h-11 rounded-xl border border-[#b8d0df] bg-[#f4f8fb] px-3 text-xs font-bold text-[#173c57] transition-colors hover:border-[#70b8d9] hover:bg-[#e7f3f9]`} onClick={revealAll}>Ver secuencia completa</button>
          <span className="ml-auto text-xs font-bold text-[#173c57]">Paso {step} de {DEMO_FINAL_STEP} · {currentLabel}</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#dfeaf1]" role="progressbar" aria-label="Progreso de sincronización WhatsApp a CRM" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-valuetext={`Paso ${step} de ${DEMO_FINAL_STEP}: ${currentLabel}`}>
          <motion.div data-testid="tdf-sync-progress-fill" className="h-full rounded-full bg-[linear-gradient(90deg,#075f91,#28c8e8)] shadow-[0_0_16px_rgba(40,200,232,0.42)]" animate={{ width: `${progress}%` }} transition={{ duration: reduceMotion ? 0 : 0.3 }} />
        </div>
        <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">{`Paso ${step}: ${currentLabel}`}</p>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-[#d6e4ed] bg-white p-2 [scrollbar-width:thin]" role="tablist" aria-label="Cinco ejes de atención accesible">
        {content.scenarios.map((item, index) => (
          <button key={item.id} ref={(element) => { tabRefs.current[index] = element; }} id={`interactive-scenario-tab-${item.id}`} type="button" role="tab" aria-selected={activeScenario === item.id} aria-controls="interactive-scenario-panel" tabIndex={activeScenario === item.id ? 0 : -1} className={`${focusRing} min-h-11 shrink-0 rounded-xl px-3.5 text-left text-xs font-bold transition-colors ${activeScenario === item.id ? 'bg-[#dff3f9] text-[#07527f]' : 'text-[#4a6275] hover:bg-[#edf6fb]'}`} onClick={() => onScenarioChange(item.id)} onKeyDown={(event) => handleTabKeyDown(event, index)}>
            {item.tabLabel}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-1 border-b border-[#d6e4ed] bg-[#eef5f9] p-2 xl:hidden" role="group" aria-label="Vista móvil sincronizada">
        {([['chat', 'Conversación'], ['crm', `CRM · ${progress}%`]] as const).map(([pane, label]) => (
          <button key={pane} type="button" aria-pressed={mobilePane === pane} className={`${focusRing} min-h-11 rounded-xl text-xs font-bold ${mobilePane === pane ? 'bg-[#075f91] text-white' : 'bg-white text-[#173c57]'}`} onClick={() => setMobilePane(pane)}>{label}</button>
        ))}
      </div>

      <div id="interactive-scenario-panel" role="tabpanel" aria-labelledby={`interactive-scenario-tab-${scenario.id}`} className="grid min-h-[34rem] xl:grid-cols-[minmax(0,0.94fr)_minmax(0,1.06fr)]">
        <section className={`${mobilePane === 'chat' ? 'flex' : 'hidden'} min-w-0 flex-col bg-[#eef5f9] xl:flex`} aria-label="Conversación de WhatsApp representativa">
          <header className="flex items-center justify-between gap-3 border-b border-[#c8d8d3] bg-[#0b4b47] px-4 py-3 text-white sm:px-5">
            <div className="flex min-w-0 items-center gap-3">
              <motion.img
                src={FARO_ICON_ASSET}
                alt=""
                className="h-10 w-10 shrink-0 object-contain"
                width="40"
                height="40"
                animate={reduceMotion ? undefined : isPlaying ? { scale: [1, 1.05, 1], y: [0, -2, 0] } : { scale: 1, y: 0 }}
                transition={reduceMotion ? undefined : { duration: 2.2, repeat: isPlaying ? Infinity : 0, ease: 'easeInOut' }}
              />
              <div className="min-w-0"><p className="truncate text-sm font-semibold">Faro TDF</p><p className="text-xs text-white/75">Agente de IA · WhatsApp conceptual</p></div>
            </div>
            <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold">Muestra</span>
          </header>

          <div className="flex flex-1 flex-col gap-3 p-4 sm:p-5" role="log" aria-label="Mensajes de la secuencia simulada">
            <p className="mx-auto rounded-full bg-white/80 px-3 py-1 text-[11px] font-semibold text-[#637471] shadow-sm">Caso de muestra · sin datos personales</p>
            <div className="max-w-[92%] rounded-2xl rounded-bl-md bg-white px-3.5 py-3 text-sm text-[#274541] shadow-sm">
              <p className="font-semibold">¿Para quién es la consulta?</p>
              <div className="mt-2 flex flex-wrap gap-2" aria-label="Rol de la persona en la consulta">
                {(['Para mí', 'Familia / red'] as const).map((role) => <button key={role} type="button" aria-pressed={selectedRole === role} className={`${focusRing} min-h-11 rounded-full border px-3 text-xs font-bold ${selectedRole === role ? 'border-[#7fb9db] bg-[#e6f3fa] text-[#075f91]' : 'border-[#c7d9e5] bg-[#f8fbfd] text-[#526b7d]'}`} onClick={() => { setSelectedRole(role); setNotice(`Rol de muestra seleccionado: ${role}.`); }}>{role}</button>)}
              </div>
              <p className="mt-2 text-[11px] leading-4 text-[#526863]">La orientación general continúa sin pedir DNI.</p>
            </div>

            <AnimatePresence initial={false}>
              {step >= 1 ? <motion.div key="citizen-message" {...motionProps} className="ml-auto max-w-[88%] rounded-2xl rounded-br-md bg-[#d8f5dc] px-3.5 py-3 text-sm leading-6 text-[#183833] shadow-sm">{scenario.citizenMessage}</motion.div> : null}
              {step >= 2 ? (
                <motion.div key="citizen-asset" {...motionProps} className="ml-auto w-[88%] max-w-sm overflow-hidden rounded-2xl rounded-br-md border border-[#b9d2ca] bg-[#d8f5dc] shadow-sm">
                  {scenario.citizenAsset.kind === 'audio' ? (
                    <div>
                      <button type="button" className={`${focusRing} flex min-h-14 w-full items-center gap-3 px-3.5 py-3 text-left`} aria-label={audioPlaying ? 'Pausar audio simulado' : 'Reproducir audio simulado'} onClick={() => { setAudioPlaying((value) => !value); setIsPlaying(false); setNotice('Audio simulado: reproducción local, sin sonido real ni datos personales.'); }}>
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#075f91] text-white">{audioPlaying ? <Pause className="h-4 w-4" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}</span>
                        <span className="min-w-0 flex-1"><span className="flex h-5 items-center gap-1" aria-hidden="true">{[8,14,10,18,12,16,9,15,7,12,6,10].map((height,index) => <span key={`${height}-${index}`} className={`w-1 rounded-full bg-[#3d8179] ${audioPlaying && !reduceMotion ? 'animate-pulse' : ''}`} style={{ height }} />)}</span><span className="mt-1 block text-xs font-bold text-[#214b46]">{scenario.citizenAsset.label}</span><span className="block text-[11px] text-[#4b625d]">{scenario.citizenAsset.detail}</span></span>
                      </button>
                      <details className="border-t border-[#b9d2ca] bg-white/70 px-3.5 py-2"><summary className={`${focusRing} min-h-11 cursor-pointer py-2 text-xs font-bold text-[#214b46]`}>Ver transcripción accesible</summary><p className="pb-2 text-xs leading-5 text-[#4b625d]">{scenario.citizenAsset.transcript ?? scenario.citizenAsset.detail}</p></details>
                    </div>
                  ) : (
                    <div className="grid grid-cols-[4.5rem_minmax(0,1fr)]">
                      <span className="grid min-h-20 place-items-center bg-[linear-gradient(145deg,#b8d8cf,#7fb6aa)] text-[#0b4b47]" aria-hidden="true">{scenario.citizenAsset.kind === 'image' ? <ImageIcon className="h-6 w-6" /> : scenario.citizenAsset.kind === 'location' ? <MapPin className="h-6 w-6" /> : <FileText className="h-6 w-6" />}</span>
                      <span className="min-w-0 px-3 py-3"><span className="block text-xs font-bold text-[#214b46]">{scenario.citizenAsset.label}</span><span className="mt-1 block text-[11px] leading-4 text-[#4b625d]">{scenario.citizenAsset.detail}</span></span>
                    </div>
                  )}
                </motion.div>
              ) : null}
              {step >= 3 && step < 6 ? <motion.div key="typing" {...motionProps} className="flex w-fit items-center gap-2 rounded-2xl rounded-bl-md bg-white px-3.5 py-3 text-xs font-semibold text-[#526863] shadow-sm"><span className="flex gap-1" aria-hidden="true"><span className="h-1.5 w-1.5 rounded-full bg-[#0b766d]" /><span className="h-1.5 w-1.5 rounded-full bg-[#0b766d]" /><span className="h-1.5 w-1.5 rounded-full bg-[#0b766d]" /></span>Faro está {step < 4 ? 'procesando el formato' : 'preparando una respuesta'}…</motion.div> : null}
              {step >= 6 ? <motion.div key="agent-one" {...motionProps} className="max-w-[92%] rounded-2xl rounded-bl-md bg-white px-3.5 py-3 text-sm leading-6 text-[#274541] shadow-sm">{scenario.agentMessages[0]}</motion.div> : null}
              {step >= 7 ? <motion.div key="agent-two" {...motionProps} className="max-w-[92%] rounded-2xl rounded-bl-md bg-white px-3.5 py-3 text-sm leading-6 text-[#274541] shadow-sm">{scenario.agentMessages[1]}</motion.div> : null}
            </AnimatePresence>

            {step >= 7 ? <div className="grid max-w-[94%] gap-2 sm:grid-cols-2" aria-label="Entregables simulados">{scenario.deliverables.map((deliverable) => { const DeliverableIcon = iconByKey[deliverable.icon]; return <button key={deliverable.label} type="button" className={`${focusRing} flex min-h-14 min-w-0 items-center gap-2.5 rounded-xl border border-[#cad9d4] bg-white p-3 text-left shadow-sm`} onClick={() => setNotice(`${deliverable.label}: vista conceptual preparada.`)}><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#e6f2ee] text-[#087a70]" aria-hidden="true"><DeliverableIcon className="h-4 w-4" /></span><span className="min-w-0"><span className="block text-xs font-bold text-[#214b46]">{deliverable.label}</span><span className="mt-0.5 block text-[11px] leading-4 text-[#526863]">{deliverable.detail}</span></span></button>; })}</div> : null}

            {step >= 8 ? <div className="grid gap-2 sm:grid-cols-2" aria-label="Telefonía y atención humana simuladas"><button type="button" className={`${focusRing} flex min-h-14 items-center gap-3 rounded-xl border border-[#b8cec8] bg-white p-3 text-left`} onClick={() => setNotice('Llamada entrante simulada registrada en el historial del CRM.')}><PhoneIncoming className="h-5 w-5 text-[#087a70]" aria-hidden="true" /><span><span className="block text-xs font-bold">Llamada entrante</span><span className="text-[11px] text-[#526863]">Registrar contacto en el caso</span></span></button><button type="button" className={`${focusRing} flex min-h-14 items-center gap-3 rounded-xl border border-[#b8cec8] bg-white p-3 text-left`} onClick={() => setNotice('Devolución de llamada simulada preparada para el equipo humano.')}><PhoneOutgoing className="h-5 w-5 text-[#087a70]" aria-hidden="true" /><span><span className="block text-xs font-bold">Llamada saliente</span><span className="text-[11px] text-[#526863]">Preparar callback humano</span></span></button></div> : null}

            {step >= 6 ? <div className="flex flex-wrap gap-1.5" aria-label="Controles accesibles de la conversación">{[['Hablar con una persona','Solicitud de atención humana registrada en la demostración.'],['Repetir','La última respuesta se repetiría en el formato accesible elegido.'],['Corregir','Podés corregir el dato anterior sin reiniciar el caso.'],['Volver','Volvemos al paso anterior y conservamos el contexto.']].map(([label,message]) => <button key={label} type="button" className={`${focusRing} min-h-11 rounded-full border border-[#b8cec8] bg-white px-3 text-[11px] font-bold text-[#315550]`} onClick={() => { if (label === 'Hablar con una persona') setStep((current) => Math.max(current, 8)); setNotice(message); }}>{label}</button>)}</div> : null}

            {csatOpen ? <div className="max-w-[94%] rounded-2xl rounded-bl-md border border-[#b8d0df] bg-white p-3.5 shadow-sm" data-testid="csat-close-step"><p className="text-sm font-bold text-[#173c57]">¿Cómo fue la atención?</p><p className="mt-1 text-xs leading-5 text-[#526b7d]">Cierre accesible de muestra. Elegí una valoración del 1 al 5.</p><div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Valoración de satisfacción de 1 a 5">{[1,2,3,4,5].map((rating) => <button key={rating} type="button" aria-label={`${rating} de 5`} aria-pressed={csatRating === rating} className={`${focusRing} grid h-11 w-11 place-items-center rounded-full border text-sm font-bold ${csatRating === rating ? 'border-[#075f91] bg-[#075f91] text-white' : 'border-[#c7d9e5] bg-[#f8fbfd] text-[#173c57]'}`} onClick={() => { setCsatRating(rating); setNotice(`Valoración de muestra registrada: ${rating} de 5. Cierre simulado auditado · CSAT ${rating}/5.`); }}>{rating}</button>)}</div></div> : null}

            <p className="min-h-4 text-[11px] leading-4 text-[#4b625d]">{notice}</p>
            <button type="button" className={`${focusRing} mt-auto min-h-11 rounded-xl border border-[#9fc6bd] bg-white px-3 text-xs font-bold text-[#075f57] xl:hidden`} onClick={() => setMobilePane('crm')}>Ver CRM actualizado · {progress}%</button>
          </div>
        </section>

        <section className={`${mobilePane === 'crm' ? 'block' : 'hidden'} min-w-0 bg-[#102d2c] p-4 text-white sm:p-5 xl:block`} aria-label="Caso CRM sincronizado representativo">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/12 pb-4"><div className="flex min-w-0 items-center gap-3"><img src={FARO_ICON_ASSET} alt="" className="h-11 w-11 shrink-0 object-contain" width="44" height="44" /><div className="min-w-0"><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#7dd6c9]">Faro TDF · CRM Mesa Única</p><h2 className="mt-1 truncate text-lg font-semibold">{scenario.title}</h2><p className="mt-0.5 text-[11px] text-white/55">{content.brand.slogan}</p></div></div><span className="rounded-full border border-white/15 bg-white/[0.07] px-3 py-1 text-xs font-semibold text-white/85">{step >= 1 ? scenario.caseCode : 'CASO PENDIENTE'}</span></div>

          <div className="mt-3 rounded-xl border border-[#7dd6c9]/25 bg-[#123e3a] p-3"><div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.13em] text-[#8be0d3]">Actualización sincronizada</p><p className="mt-1 text-sm font-semibold">{currentLabel}</p></div><span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-bold">{progress}%</span></div><p className="mt-2 text-xs leading-5 text-white/65">Origen: Faro / WhatsApp · secuencia local demostrativa.</p></div>

          <dl className="mt-3 grid grid-cols-2 gap-2 xl:grid-cols-5" aria-label="Control operativo del caso">{[['Estado',crmStatus],['Cola',step >= 4 ? scenario.operational.queue : 'Por clasificar'],['Prioridad',step >= 4 ? scenario.operational.priority : 'Pendiente'],['SLA',step >= 4 ? scenario.operational.sla : 'Sin iniciar'],['Localidad',step >= 2 ? scenario.operational.locality : 'Pendiente']].map(([label,value]) => <div key={label} className="min-w-0 rounded-xl border border-white/10 bg-black/10 p-2.5"><dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/55">{label}</dt><dd className="mt-1 break-words text-xs font-semibold leading-4 text-white/90">{value}</dd></div>)}</dl>

          <div className="mt-3 flex gap-1 overflow-x-auto rounded-xl border border-white/10 bg-black/10 p-1" role="group" aria-label="Vistas del inspector del caso CRM">{['Resumen','Persona','Trámite','Adjuntos','Historial'].map((view) => <button key={view} type="button" aria-pressed={inspectorView === view} className={`${focusRing} min-h-11 shrink-0 rounded-lg px-2.5 text-[11px] font-bold ${inspectorView === view ? 'bg-[#7dd6c9] text-[#073c38]' : 'text-white/70 hover:bg-white/[0.08]'}`} onClick={() => setInspectorView(view)}>{view}</button>)}</div>
          <div className="mt-2 rounded-xl border border-[#7dd6c9]/20 bg-[#123e3a] p-3" data-testid="crm-inspector-panel"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#8be0d3]">{inspectorContent[inspectorView]?.title}</p><p className="mt-1.5 text-xs leading-5 text-white/78">{inspectorContent[inspectorView]?.detail}</p></div>

          <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.045] p-3" aria-label="Eventos sincronizados del caso"><div className="flex items-center justify-between gap-2"><p className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/55">Actividad multicanal</p><span className="text-[11px] font-semibold text-[#8be0d3]">{eventRows.filter((event) => step >= event.at).length}/{eventRows.length} eventos</span></div><ol className="mt-3 grid gap-2">{eventRows.map((event) => { const EventIcon = event.icon; const active = step >= event.at; return <li key={event.label} className={`flex items-start gap-3 rounded-lg border p-2.5 ${active ? 'border-[#64cbbb]/25 bg-[#64cbbb]/8' : 'border-white/8 bg-black/10 opacity-45'}`}><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${active ? 'bg-[#7dd6c9] text-[#073c38]' : 'bg-white/10 text-white/60'}`}><EventIcon className="h-4 w-4" aria-hidden="true" /></span><span><span className="block text-xs font-bold">{event.label}</span><span className="mt-0.5 block text-[11px] leading-4 text-white/60">{active ? event.detail : 'Pendiente en la secuencia'}</span></span></li>; })}</ol></div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2"><div className="rounded-xl border border-white/10 bg-black/10 p-3"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/55">Responsable</p><p className="mt-1 text-xs font-semibold">{step >= 8 ? scenario.owner : 'Sin asignar'}</p></div><div className="rounded-xl border border-white/10 bg-black/10 p-3"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/55">Próximo paso</p><p className="mt-1 text-xs leading-5 text-white/80">{step >= 6 ? scenario.nextStep : 'Se definirá con la orientación'}</p></div></div>

          {step >= 4 ? <div className="mt-3 rounded-xl border border-white/10 bg-black/10 p-3"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/55">Lista de cotejo orientativa</p><ul className="mt-2 grid gap-2 sm:grid-cols-3">{scenario.checklist.map((item) => <li key={item} className="flex items-start gap-2 text-[11px] leading-4 text-white/70"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#8be0d3]" aria-hidden="true" /><span>{item}</span></li>)}</ul></div> : null}

          {step >= DEMO_FINAL_STEP ? <dl className="mt-3 grid gap-2 sm:grid-cols-2"><div className="rounded-xl border border-white/10 bg-white/[0.055] p-3"><dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/55">Registro conceptual</dt><dd className="mt-1 text-xs font-semibold text-white/90">{scenario.registration}</dd></div><div className="rounded-xl border border-white/10 bg-white/[0.055] p-3"><dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/55">CSAT al cierre</dt><dd className="mt-1 text-xs font-semibold leading-5 text-white/90">{scenario.csat}</dd></div></dl> : null}

          <div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={step < 6} className={`${focusRing} min-h-11 rounded-xl bg-[#7dd6c9] px-3 text-xs font-bold text-[#073c38] disabled:cursor-not-allowed disabled:opacity-40`} onClick={() => setNotice('Simulación: caso tomado por el operador de Mesa Única.')}>Simular toma</button><button type="button" disabled={step < 8} className={`${focusRing} min-h-11 rounded-xl border border-white/18 bg-white/[0.07] px-3 text-xs font-bold text-white disabled:opacity-40`} onClick={() => setNotice(`Transferencia preparada: Persona DEMO · ${scenario.operational.locality} · contacto protegido.`)}>Simular transferencia</button><button type="button" disabled={step < DEMO_FINAL_STEP} className={`${focusRing} min-h-11 rounded-xl border border-[#f1c96b]/35 bg-[#f1c96b]/10 px-3 text-xs font-bold text-[#f7dda0] disabled:opacity-40`} onClick={() => { setCsatOpen(true); setMobilePane('chat'); setNotice('Encuesta CSAT simulada enviada al mismo hilo.'); }}>Cerrar + CSAT</button></div>
          <p className="mt-3 text-[11px] leading-5 text-white/55">Las acciones son demostrativas y no escriben en bases, telefonía ni servicios externos.</p>
        </section>
      </div>
    </div>
  );
};

const ExecutiveDashboard = ({
  reduceMotion,
  onOpenScenario,
}: {
  reduceMotion: boolean;
  onOpenScenario: (scenarioId: string) => void;
}) => {
  const demandTrend = [
    { day: 'Lun', whatsapp: 32, widget: 9, calls: 5 },
    { day: 'Mar', whatsapp: 41, widget: 11, calls: 7 },
    { day: 'Mié', whatsapp: 38, widget: 13, calls: 9 },
    { day: 'Jue', whatsapp: 52, widget: 15, calls: 8 },
    { day: 'Vie', whatsapp: 49, widget: 12, calls: 11 },
    { day: 'Sáb', whatsapp: 27, widget: 8, calls: 4 },
    { day: 'Dom', whatsapp: 21, widget: 6, calls: 3 },
  ];
  const resolutionMix = [
    { name: 'Orientación autónoma', value: 68, color: '#0b766d' },
    { name: 'Derivación humana', value: 18, color: '#d5a52f' },
    { name: 'Seguimiento', value: 14, color: '#6a7e79' },
  ];
  const capabilities = [
    { label: 'Texto', detail: 'Consulta en lenguaje cotidiano', icon: MessageCircle, status: 'Entrada' },
    { label: 'Nota de voz', detail: 'Audio con transcripción visible', icon: Mic, status: 'Entrada' },
    { label: 'Imagen', detail: 'Captura o foto contextual', icon: ImageIcon, status: 'Entrada' },
    { label: 'Ubicación', detail: 'Zona general con consentimiento', icon: MapPin, status: 'Entrada' },
    { label: 'PDF y formulario', detail: 'Entrega accesible en el mismo hilo', icon: FileText, status: 'Salida' },
    { label: 'Llamada entrante', detail: 'Registro y resumen en el caso', icon: PhoneIncoming, status: 'Telefonía' },
    { label: 'Llamada saliente', detail: 'Callback humano preparado', icon: PhoneOutgoing, status: 'Telefonía' },
    { label: 'Atención humana', detail: 'Transferencia con contexto completo', icon: Headphones, status: 'Equipo' },
  ];

  return (
    <section id="dashboard" className="scroll-mt-24 border-b border-[#d9e3df] bg-[#0d2928] py-16 text-white sm:py-20" aria-labelledby="dashboard-title">
      <div className="mx-auto w-full max-w-[90rem] px-4 sm:px-6 lg:px-10">
        <Reveal reduceMotion={reduceMotion}>
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
            <div className="max-w-3xl">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#88ded1]">Dashboard ejecutivo · muestra navegable</p>
              <h2 id="dashboard-title" className="mt-3 text-balance text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">Todo el circuito ciudadano, visible en un solo centro de control</h2>
              <p className="mt-4 max-w-2xl text-base leading-7 text-white/65">Cada texto, audio, imagen, ubicación, documento, llamada o derivación se convierte en un evento trazable. Los datos de esta sección son simulados y sirven para validar el MVP.</p>
            </div>
            <a href="#inicio" className={`${focusRing} inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#f3d98e] px-4 text-sm font-bold text-[#3e3218] focus-visible:ring-[#f3d98e] focus-visible:ring-offset-[#0d2928]`}>Ver conversación sincronizada <ArrowRight className="h-4 w-4" aria-hidden="true" /></a>
          </div>
        </Reveal>

        <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Indicadores ejecutivos simulados">
          {[['320','interacciones de muestra','WhatsApp, widget y llamadas'],['68%','resolución orientativa','Sin intervención humana'],['18%','derivación asistida','Casos complejos o solicitados'],['4,6 / 5','claridad percibida','CSAT conceptual al cierre']].map(([value,label,detail], index) => <Reveal key={label} reduceMotion={reduceMotion} delay={index * 0.035} className="rounded-2xl border border-white/12 bg-white/[0.055] p-4"><p className="text-3xl font-semibold tracking-[-0.04em] text-[#f5e1a8]">{value}</p><p className="mt-1 text-sm font-bold">{label}</p><p className="mt-2 text-xs text-white/55">{detail}</p></Reveal>)}
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.12fr)_minmax(0,0.88fr)]">
          <Reveal reduceMotion={reduceMotion} className="rounded-[1.6rem] border border-white/12 bg-white/[0.055] p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-lg font-semibold">Demanda multicanal · 7 días</h3><p className="mt-1 text-xs text-white/55">Volumen representativo por canal; no son registros provinciales.</p></div><span className="rounded-full border border-[#7dd6c9]/25 bg-[#7dd6c9]/10 px-3 py-1 text-[11px] font-bold text-[#9ce4d9]">Recharts · muestra local</span></div>
            <figure className="mt-5 h-72" aria-label="Gráfico de área de demanda simulada por WhatsApp, widget y llamadas durante siete días">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={demandTrend} accessibilityLayer margin={{ top: 8, right: 6, left: -22, bottom: 0 }}>
                  <defs><linearGradient id="whatsappArea" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#7dd6c9" stopOpacity={0.55} /><stop offset="95%" stopColor="#7dd6c9" stopOpacity={0.02} /></linearGradient></defs>
                  <CartesianGrid stroke="rgba(255,255,255,0.1)" vertical={false} />
                  <XAxis dataKey="day" tick={{ fill: 'rgba(255,255,255,.62)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'rgba(255,255,255,.5)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: '#102f2e', border: '1px solid rgba(255,255,255,.18)', borderRadius: 12, color: 'white' }} labelStyle={{ color: '#9ce4d9', fontWeight: 700 }} />
                  <Area type="monotone" dataKey="whatsapp" name="WhatsApp" stroke="#7dd6c9" fill="url(#whatsappArea)" strokeWidth={3} isAnimationActive={!reduceMotion} />
                  <Area type="monotone" dataKey="widget" name="Widget" stroke="#f3d98e" fill="transparent" strokeWidth={2} isAnimationActive={!reduceMotion} />
                  <Area type="monotone" dataKey="calls" name="Llamadas" stroke="#9fb5ff" fill="transparent" strokeWidth={2} isAnimationActive={!reduceMotion} />
                </AreaChart>
              </ResponsiveContainer>
            </figure>
            <table className="sr-only"><caption>Demanda simulada por día y canal</caption><thead><tr><th>Día</th><th>WhatsApp</th><th>Widget</th><th>Llamadas</th></tr></thead><tbody>{demandTrend.map((row) => <tr key={row.day}><th>{row.day}</th><td>{row.whatsapp}</td><td>{row.widget}</td><td>{row.calls}</td></tr>)}</tbody></table>
          </Reveal>

          <Reveal reduceMotion={reduceMotion} delay={0.05} className="rounded-[1.6rem] border border-white/12 bg-white/[0.055] p-4 sm:p-5">
            <h3 className="text-lg font-semibold">Resultado de atención</h3><p className="mt-1 text-xs text-white/55">Distribución conceptual sobre 100 interacciones.</p>
            <figure className="mt-5 h-72" aria-label="Gráfico de barras del resultado simulado de atención">
              <ResponsiveContainer width="100%" height="100%"><BarChart data={resolutionMix} layout="vertical" accessibilityLayer margin={{ top: 10, right: 22, left: 4, bottom: 0 }}><CartesianGrid stroke="rgba(255,255,255,0.1)" horizontal={false} /><XAxis type="number" domain={[0,100]} tick={{ fill: 'rgba(255,255,255,.52)', fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis type="category" dataKey="name" width={118} tick={{ fill: 'rgba(255,255,255,.72)', fontSize: 11 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={{ background: '#102f2e', border: '1px solid rgba(255,255,255,.18)', borderRadius: 12, color: 'white' }} formatter={(value) => [`${value}%`, 'Participación']} /><Bar dataKey="value" radius={[0,8,8,0]} isAnimationActive={!reduceMotion}>{resolutionMix.map((item) => <Cell key={item.name} fill={item.color} />)}</Bar></BarChart></ResponsiveContainer>
            </figure>
          </Reveal>
        </div>

        <Reveal reduceMotion={reduceMotion} delay={0.08} className="mt-5 rounded-[1.6rem] border border-white/12 bg-white/[0.055] p-4 sm:p-5">
          <div className="flex flex-wrap items-end justify-between gap-3"><div><h3 className="text-lg font-semibold">Matriz de canales y acciones</h3><p className="mt-1 text-xs text-white/55">Ejemplos funcionales del MVP; ninguna tarjeta ejecuta una integración externa.</p></div><span className="rounded-full bg-[#f3d98e]/12 px-3 py-1 text-[11px] font-bold text-[#f5e1a8]">8 capacidades demostrables</span></div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{capabilities.map((item, index) => { const CapabilityIcon = item.icon; return <motion.div key={item.label} className="group rounded-xl border border-white/10 bg-black/10 p-3.5" whileHover={reduceMotion ? undefined : { y: -3, borderColor: 'rgba(125,214,201,.45)' }} transition={{ duration: 0.2 }}><div className="flex items-start justify-between gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#7dd6c9]/12 text-[#9ce4d9]"><CapabilityIcon className="h-5 w-5" aria-hidden="true" /></span><span className="rounded-full border border-white/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-white/55">{item.status}</span></div><p className="mt-3 text-sm font-bold">{item.label}</p><p className="mt-1 text-xs leading-5 text-white/55">{item.detail}</p>{index < content.scenarios.length ? <button type="button" className={`${focusRing} mt-3 min-h-11 w-full rounded-lg border border-white/10 px-2 text-xs font-bold text-[#9ce4d9] hover:bg-white/[0.06] focus-visible:ring-[#88ded1] focus-visible:ring-offset-[#0d2928]`} onClick={() => onOpenScenario(content.scenarios[index].id)}>Ver caso de muestra</button> : null}</motion.div>; })}</div>
        </Reveal>
      </div>
    </section>
  );
};

const ConceptualTerritoryMap = ({
  mapView,
  points,
}: {
  mapView: 'thematic' | 'geographic';
  points: Array<(typeof content.territory.points)[number]>;
}) => {
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

  const fitToBounds = React.useMemo(() => {
    if (!points.length) return content.territory.fitToBounds;
    const longitudes = points.map((point) => point.lng);
    const latitudes = points.map((point) => point.lat);
    return [
      [Math.min(...longitudes), Math.min(...latitudes)],
      [Math.max(...longitudes), Math.max(...latitudes)],
    ] as [number, number][];
  }, [points]);

  return (
    <div
      ref={containerRef}
      className="min-h-[24rem] sm:min-h-[34rem]"
      data-testid="tdf-map-viewport"
      data-heatmap-visible={mapView === 'thematic' ? 'true' : 'false'}
      data-points-visible="true"
      data-point-count={points.length}
    >
      {shouldLoad ? (
        <React.Suspense
          fallback={<div className="grid h-[24rem] place-items-center bg-[#e9f0ed] text-sm font-semibold text-[#50635f] sm:h-[34rem]" role="status">Preparando mapa territorial…</div>}
        >
          <LazyMapLibreMap
            className="h-[24rem] rounded-none border-0 sm:h-[34rem]"
            center={content.territory.center}
            initialZoom={11.5}
            fitToBounds={fitToBounds}
            fitBoundsRequestKey={`${points.map((point) => `${point.ciudad}-${point.barrio}`).join('|')}-${mapView}`}
            boundsPadding={52}
            heatmapData={[...points]}
            showHeatmap={mapView === 'thematic'}
            showPoints
            showPointLabels
            pointMinZoom={4.5}
            pointLabelMinZoom={9}
            pointLabelMode="barrio"
            heatmapRadiusScale={2.8}
            heatmapPalette="faro"
            disableClientClustering
            popupContext="territory"
            ariaLabel="Mapa MapLibre de demanda conceptual y simulada en Tierra del Fuego"
            ariaDescribedBy="territory-map-description"
            evidence={{
              label: 'Ubicaciones simuladas',
              source: 'conceptual_demo',
              provider: 'MapLibre',
              synthetic: true,
              usingSyntheticPoints: true,
              pointCount: points.length,
              syntheticDisclaimer: 'No representa datos provinciales ni casos reales.',
            }}
          />
        </React.Suspense>
      ) : (
        <div className="grid h-[24rem] place-items-center bg-[#e9f0ed] px-6 text-center text-sm font-semibold text-[#50635f] sm:h-[34rem]" role="status">
          El mapa conceptual se prepara al acercarte a esta sección.
        </div>
      )}
    </div>
  );
};

const FaroChatWidget = ({
  reduceMotion,
  onOpenScenario,
}: {
  reduceMotion: boolean;
  onOpenScenario: (scenarioId: string) => void;
}) => {
  const [open, setOpen] = React.useState(false);
  const [typing, setTyping] = React.useState(false);
  const [selectedScenario, setSelectedScenario] = React.useState<string | null>(null);
  const [citizenMessage, setCitizenMessage] = React.useState('');
  const [agentMessage, setAgentMessage] = React.useState('');
  const timerRef = React.useRef<number | null>(null);
  const launcherRef = React.useRef<HTMLButtonElement | null>(null);
  const closeButtonRef = React.useRef<HTMLButtonElement | null>(null);

  const quickActions = [
    { label: 'CUD y CMO', scenario: 'cud', prompt: 'Quiero saber qué necesito para iniciar el CUD.', response: 'Puedo ayudarte con una lista de cotejo clara, una guía PDF y la opción de atención humana. Esta muestra no solicita DNI ni documentos reales.' },
    { label: 'RUPE y pensión', scenario: 'rupe', prompt: 'Necesito orientación sobre RUPE y fe de vida.', response: 'Voy a separar requisitos, fe de vida, licencias y próximos pasos. También puedo dejar preparada una devolución de llamada.' },
    { label: 'Salud y medicación', scenario: 'health', prompt: 'Tengo un problema con medicación y necesito ayuda.', response: 'Voy a ordenar la urgencia, cobertura y derivación. Si el caso lo requiere, queda listo para el equipo humano con el contexto preservado.' },
    { label: 'Trabajo y cursos', scenario: 'employment', prompt: 'Quiero buscar trabajo y preparar mi CV.', response: 'Puedo orientar sobre inclusión laboral, cursos y una plantilla de CV accesible, siempre sujeto a validación oficial.' },
  ];

  React.useEffect(() => () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
  }, []);

  React.useEffect(() => {
    if (!open) return undefined;
    const focusTimer = window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setOpen(false);
      window.requestAnimationFrame(() => launcherRef.current?.focus());
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      window.cancelAnimationFrame(focusTimer);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  const closeWidget = () => {
    setOpen(false);
    window.requestAnimationFrame(() => launcherRef.current?.focus());
  };

  const runQuickAction = (action: (typeof quickActions)[number]) => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    setSelectedScenario(action.scenario);
    setCitizenMessage(action.prompt);
    setAgentMessage('');
    setTyping(true);
    const complete = () => {
      setTyping(false);
      setAgentMessage(action.response);
      timerRef.current = null;
    };
    if (reduceMotion) complete();
    else timerRef.current = window.setTimeout(complete, 680);
  };

  const openInCrm = () => {
    if (!selectedScenario) return;
    setOpen(false);
    onOpenScenario(selectedScenario);
  };

  return (
    <div className="tdf-faro-widget fixed bottom-4 right-4 z-[60] flex flex-col items-end gap-3">
      <AnimatePresence>
        {open ? (
          <motion.aside
            key="faro-widget-panel"
            id="faro-widget-panel"
            role="dialog"
            aria-modal="false"
            aria-labelledby="faro-widget-title"
            className="max-h-[min(36rem,calc(100vh-7rem))] w-[min(24rem,calc(100vw-2rem))] overflow-y-auto rounded-[1.5rem] border border-[#a9c9dc] bg-white shadow-[0_26px_80px_rgba(7,31,56,0.3)]"
            initial={reduceMotion ? false : { opacity: 0, y: 14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: reduceMotion ? 0 : 0.24 }}
          >
            <header className="flex items-center gap-3 rounded-t-[1.45rem] bg-[#071f38] p-4 text-white">
              <motion.img src={FARO_ICON_ASSET} alt="" className="h-14 w-14 shrink-0 object-contain" width="56" height="56" initial={reduceMotion ? false : { opacity: 0.7, rotate: 4, scale: 0.94 }} animate={{ opacity: 1, rotate: 0, scale: 1 }} transition={{ duration: reduceMotion ? 0 : 0.4 }} />
              <div className="min-w-0 flex-1"><p id="faro-widget-title" className="text-base font-bold">Faro TDF</p><p className="text-xs leading-5 text-white/72">{content.brand.slogan}</p></div>
              <button ref={closeButtonRef} type="button" className={`${faroBlueFocusRing} grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/10 text-white focus-visible:ring-white focus-visible:ring-offset-[#071f38]`} aria-label="Cerrar chat de Faro" onClick={closeWidget}><X className="h-5 w-5" aria-hidden="true" /></button>
            </header>
            <div className="p-4">
              <span className="inline-flex rounded-full bg-[#e6f3fa] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#075f91]">Muestra conceptual · no envía datos</span>
              <div className="mt-3 rounded-2xl rounded-bl-md bg-[#eef5f9] p-3 text-sm leading-6 text-[#173c57]">Hola, soy Faro. Elegí un tema y te muestro cómo una consulta podría pasar del chat al CRM.</div>
              <div className="mt-3 grid grid-cols-2 gap-2" aria-label="Consultas rápidas de Faro">{quickActions.map((action) => <button key={action.label} type="button" className={`${faroBlueFocusRing} min-h-12 rounded-xl border border-[#c7d9e5] bg-white px-2.5 text-xs font-bold text-[#244c69] hover:bg-[#edf6fb]`} onClick={() => runQuickAction(action)}>{action.label}</button>)}</div>
              {citizenMessage ? <div className="mt-3 ml-auto max-w-[88%] rounded-2xl rounded-br-md bg-[#dceffa] p-3 text-sm leading-6 text-[#123a55]">{citizenMessage}</div> : null}
              <div role="status" aria-live="polite" aria-atomic="true">
                {typing ? <div className="mt-3 w-fit rounded-2xl rounded-bl-md bg-[#eef5f9] px-3 py-2 text-xs font-semibold text-[#526b7d]">Faro está preparando la orientación…</div> : null}
                {agentMessage ? <div className="mt-3 rounded-2xl rounded-bl-md bg-[#eef5f9] p-3 text-sm leading-6 text-[#173c57]">{agentMessage}</div> : null}
              </div>
              {agentMessage ? <button type="button" className={`${faroBlueFocusRing} mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#075f91] px-4 text-sm font-bold text-white hover:bg-[#064d78]`} onClick={openInCrm}><Activity className="h-4 w-4" aria-hidden="true" />Ver cómo llega al CRM</button> : null}
              <p className="mt-3 text-[11px] leading-4 text-[#526b7d]">No reemplaza información oficial ni atención profesional. La versión funcional requerirá fuentes, permisos y validaciones.</p>
            </div>
          </motion.aside>
        ) : null}
      </AnimatePresence>
      <button ref={launcherRef} type="button" className={`${faroBlueFocusRing} flex min-h-14 items-center gap-2 rounded-full border border-[#5bd7ec]/55 bg-[#075f91] p-1.5 text-sm font-bold text-white shadow-[0_18px_48px_rgba(7,79,128,0.34)] hover:bg-[#064d78] sm:pl-2 sm:pr-4`} aria-label={open ? 'Cerrar chat de Faro' : 'Abrir chat de Faro'} aria-controls="faro-widget-panel" aria-expanded={open} onClick={() => { if (open) closeWidget(); else setOpen(true); }}><motion.img src={FARO_ICON_ASSET} alt="" className="h-11 w-11 object-contain" width="44" height="44" animate={reduceMotion || open ? undefined : { y: [0,-2,0] }} transition={reduceMotion || open ? undefined : { duration: 2.1, repeat: Infinity, repeatDelay: 4.2, ease: 'easeInOut' }} /><span className="hidden sm:inline">{open ? 'Cerrar' : 'Hablar con Faro'}</span></button>
    </div>
  );
};

const DisabilityAIAgentDemoPage = () => {
  const operatingSystemReducedMotion = useReducedMotion() ?? false;
  const [userReducedMotion, setUserReducedMotion] = React.useState(false);
  const shouldReduceMotion = operatingSystemReducedMotion || userReducedMotion;
  const [activeScenarioId, setActiveScenarioId] = React.useState(content.scenarios[0].id);
  const [mapView, setMapView] = React.useState<'thematic' | 'geographic'>('thematic');
  const [cityFilter, setCityFilter] = React.useState('Todas');
  const [categoryFilter, setCategoryFilter] = React.useState('Todas');
  const [neighborhoodFilter, setNeighborhoodFilter] = React.useState('Todos');
  const [ticketTypeFilter, setTicketTypeFilter] = React.useState('Todos');
  const [selectedTerritoryPointKey, setSelectedTerritoryPointKey] = React.useState(
    territoryPointKey(content.territory.points[0]),
  );
  const activeScenario =
    content.scenarios.find((scenario) => scenario.id === activeScenarioId) ?? content.scenarios[0];
  const territoryPoints = React.useMemo(() => {
    const maxWeight = Math.max(...content.territory.points.map((point) => point.totalWeight ?? point.weight ?? 1));
    return content.territory.points.map((point) => ({
      ...point,
      intensity: Math.max(0.12, (point.totalWeight ?? point.weight ?? 1) / maxWeight),
      categoryColor: TERRITORY_CATEGORY_META.find((item) => item.label === point.categoria)?.color ?? '#087c81',
    }));
  }, []);
  const cityOptions = ['Todas', 'Ushuaia', 'Río Grande', 'Tolhuin'];
  const categoryOptions = ['Todas', ...TERRITORY_CATEGORY_META.map((item) => item.label)];
  const ticketTypeOptions = ['Todos', ...Array.from(new Set<string>(territoryPoints.map((point) => String(point.tipo_ticket))))];
  const neighborhoodOptions = ['Todos', ...Array.from(new Set<string>(
    territoryPoints
      .filter((point) => cityFilter === 'Todas' || point.ciudad === cityFilter)
      .filter((point) => categoryFilter === 'Todas' || point.categoria === categoryFilter)
      .map((point) => String(point.barrio)),
  )).sort((left, right) => left.localeCompare(right, 'es'))];
  const filteredTerritoryPoints = React.useMemo(
    () => territoryPoints.filter((point) =>
      (cityFilter === 'Todas' || point.ciudad === cityFilter) &&
      (categoryFilter === 'Todas' || point.categoria === categoryFilter) &&
      (neighborhoodFilter === 'Todos' || point.barrio === neighborhoodFilter) &&
      (ticketTypeFilter === 'Todos' || point.tipo_ticket === ticketTypeFilter)),
    [categoryFilter, cityFilter, neighborhoodFilter, territoryPoints, ticketTypeFilter],
  );
  const filteredTerritoryVolume = filteredTerritoryPoints.reduce((sum, point) => sum + (point.totalWeight ?? point.weight ?? 0), 0);
  const topNeighborhoods = [...filteredTerritoryPoints]
    .sort((left, right) => (right.totalWeight ?? right.weight ?? 0) - (left.totalWeight ?? left.weight ?? 0))
    .slice(0, 6);
  const territoryCategoryBreakdown = TERRITORY_CATEGORY_META.map((category) => {
    const points = filteredTerritoryPoints.filter((point) => point.categoria === category.label);
    const volume = points.reduce((sum, point) => sum + (point.totalWeight ?? point.weight ?? 0), 0);
    return {
      ...category,
      points: points.length,
      totalPoints: territoryPoints.filter((point) => point.categoria === category.label).length,
      volume,
      percentage: filteredTerritoryVolume > 0 ? Math.round((volume / filteredTerritoryVolume) * 100) : 0,
    };
  });
  const selectedTerritoryPoint = filteredTerritoryPoints.find(
    (point) => territoryPointKey(point) === selectedTerritoryPointKey,
  ) ?? filteredTerritoryPoints[0] ?? null;

  const resetTerritoryFilters = React.useCallback(() => {
    setCityFilter('Todas');
    setCategoryFilter('Todas');
    setNeighborhoodFilter('Todos');
    setTicketTypeFilter('Todos');
  }, []);

  const openScenario = React.useCallback((scenarioId: string) => {
    setActiveScenarioId(scenarioId);
    window.requestAnimationFrame(() => {
      document.getElementById('inicio')?.scrollIntoView({
        behavior: shouldReduceMotion ? 'auto' : 'smooth',
        block: 'start',
      });
    });
  }, [shouldReduceMotion]);

  usePageMetadata(content.metadata);

  return (
    <>
      <a className="tdf-demo-skip-link" href="#main-content">Saltar al contenido principal</a>
      <div
      className="min-h-screen overflow-x-clip bg-[#f4f8fb] font-sans text-[#173c57] selection:bg-[#dceffa] selection:text-[#071f38]"
      data-testid="tdf-disability-demo"
      data-reduced-motion={shouldReduceMotion ? 'true' : 'false'}
    >
      <aside aria-label="Estado de la demostración" className="bg-[#0b3f3c] px-4 py-2 text-center text-xs font-semibold tracking-wide text-white">
        <span className="inline-flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-[#7de7f3]" aria-hidden="true" />
          {content.truthNotice.title}
          <span className="hidden font-normal text-white/70 md:inline">· {content.truthNotice.detail}</span>
        </span>
      </aside>

      <header className="sticky top-0 z-40 border-b border-[#d6e4ed] bg-[#f8fbfd]">
        <div className="mx-auto flex min-h-16 w-full max-w-[90rem] items-center justify-between gap-4 px-4 sm:px-6 lg:px-10">
          <a href="#inicio" className={`${focusRing} flex min-h-11 min-w-0 items-center gap-3 rounded-xl`}>
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#0b4b47] shadow-[0_8px_20px_-12px_rgba(7,95,145,0.72)]" aria-hidden="true">
              <motion.img src={FARO_ICON_ASSET} alt="" className="h-10 w-10 object-contain" width="40" height="40" whileHover={shouldReduceMotion ? undefined : { rotate: -4, scale: 1.06 }} transition={{ duration: 0.2 }} />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold text-[#071f38]">{content.brand.product}</span>
              <span className="block truncate text-[11px] font-medium text-[#526b7d]">{content.brand.slogan}</span>
            </span>
          </a>

          <nav className="hidden items-center gap-1 xl:flex" aria-label="Secciones de la demostración">
            {content.navigation.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className={`${focusRing} flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold text-[#526b7d] transition-colors hover:bg-white hover:text-[#075f91]`}
              >
                {item.label}
              </a>
            ))}
          </nav>

          <span className="hidden min-h-9 items-center rounded-full border border-[#b8d0df] bg-white px-3 text-xs font-semibold text-[#173c57] sm:inline-flex">
            {content.brand.entity} · {content.brand.whiteLabel}
          </span>
          <InstitutionalAccessibilityControls
            reducedMotion={shouldReduceMotion}
            onReducedMotionChange={setUserReducedMotion}
          />
        </div>
        <nav className="mx-auto flex w-full max-w-[90rem] gap-1 overflow-x-auto border-t border-[#d6e4ed] px-3 py-1.5 [scrollbar-width:thin] xl:hidden" aria-label="Secciones de la demostración en móvil">
          {content.navigation.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={`${focusRing} flex min-h-11 shrink-0 items-center rounded-xl px-3 text-xs font-bold text-[#173c57] hover:bg-white`}
            >
              {item.label}
            </a>
          ))}
          <span className="sticky right-0 grid min-h-11 w-9 shrink-0 place-items-center bg-gradient-to-l from-[#f8fbfd] via-[#f8fbfd] to-transparent pl-2 text-lg font-bold text-[#526b7d]" aria-hidden="true">→</span>
        </nav>
      </header>

      <main id="main-content" tabIndex={-1}>
        <section
          id="inicio"
          className="relative scroll-mt-24 border-b border-[#d6e4ed] bg-[radial-gradient(circle_at_88%_8%,rgba(220,239,250,0.82),transparent_34%),radial-gradient(circle_at_8%_94%,rgba(233,223,196,0.45),transparent_30%)]"
          aria-labelledby="hero-title"
        >
          <div className="relative mx-auto grid w-full max-w-[90rem] gap-10 px-4 py-10 sm:px-6 sm:py-14 lg:px-10 xl:grid-cols-[minmax(0,0.78fr)_minmax(34rem,1.22fr)] xl:items-center xl:py-20">
            <Reveal reduceMotion={shouldReduceMotion}>
              <div className="mb-6 inline-flex items-center gap-3 rounded-2xl border border-[#b8d0df] bg-white/82 p-2.5 pr-4 shadow-[0_16px_44px_-32px_rgba(7,95,145,0.52)] backdrop-blur">
                <motion.img
                  src={FARO_ASSET}
                  alt="Faro, identidad visual del Agente de IA accesible"
                  className="h-14 w-14 shrink-0 object-contain"
                  width="56"
                  height="56"
                  animate={shouldReduceMotion ? undefined : { y: [0, -3, 0], rotate: [0, -1.5, 0] }}
                  transition={shouldReduceMotion ? undefined : { duration: 2.8, repeat: Infinity, repeatDelay: 1.5, ease: 'easeInOut' }}
                />
                <div>
                  <p className="text-sm font-extrabold text-[#071f38]">{content.brand.product}</p>
                  <p className="mt-0.5 text-xs font-semibold text-[#526b7d]">{content.brand.slogan}</p>
                </div>
              </div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#075f91]">{content.hero.eyebrow}</p>
              <h1 id="hero-title" className="mt-4 max-w-3xl text-balance text-4xl font-semibold leading-[1.03] tracking-[-0.05em] text-[#071f38] sm:text-5xl xl:text-[3.65rem]">
                {content.hero.title}
              </h1>
              <p className="mt-6 max-w-2xl text-pretty text-base leading-7 text-[#526b7d] sm:text-lg sm:leading-8">
                {content.hero.description}
              </p>

              <div className="mt-7 flex flex-wrap gap-3">
                <a
                  href={content.hero.primaryAction.href}
                  className={`${focusRing} inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#075f91] px-5 text-sm font-bold text-white shadow-[0_12px_28px_-14px_rgba(7,95,145,0.7)] transition-colors hover:bg-[#064d78]`}
                >
                  {content.hero.primaryAction.label}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </a>
                <a
                  href={content.hero.secondaryAction.href}
                  className={`${focusRing} inline-flex min-h-12 items-center justify-center rounded-xl border border-[#b8d0df] bg-white px-5 text-sm font-bold text-[#173c57] transition-colors hover:bg-[#edf6fb]`}
                >
                  {content.hero.secondaryAction.label}
                </a>
              </div>

              <ul className="mt-8 grid gap-2 text-sm text-[#244c69] sm:grid-cols-2" aria-label="Alcance de la propuesta">
                {content.hero.highlights.map((highlight) => (
                  <li key={highlight} className="flex min-h-10 items-center gap-2 rounded-xl border border-[#d6e4ed] bg-white/70 px-3">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-[#075f91]" aria-hidden="true" />
                    <span className="font-medium">{highlight}</span>
                  </li>
                ))}
              </ul>
            </Reveal>

            <Reveal reduceMotion={shouldReduceMotion} delay={0.08} className="min-w-0" >
              <InteractiveScenarioWorkspace
                scenario={activeScenario}
                activeScenario={activeScenarioId}
                onScenarioChange={setActiveScenarioId}
                reduceMotion={shouldReduceMotion}
              />
            </Reveal>
          </div>
        </section>

        <ExecutiveDashboard reduceMotion={shouldReduceMotion} onOpenScenario={openScenario} />

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
                <motion.img src={FARO_ASSET} alt="" className="h-20 w-20 object-contain" width="80" height="80" initial={shouldReduceMotion ? false : { opacity: 0.75, scale: 0.92, rotate: -3 }} whileInView={{ opacity: 1, scale: 1, rotate: 0 }} viewport={{ once: true, amount: 0.45 }} transition={{ duration: shouldReduceMotion ? 0 : 0.5, ease: 'easeOut' }} />
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

            <Reveal reduceMotion={shouldReduceMotion} className="mt-7 rounded-[1.35rem] border border-[#d4e0dc] bg-white p-4 sm:p-5">
              <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-sm font-bold text-[#173c39]">Explorar territorio simulado</p>
                    <p className="mt-1 text-xs leading-5 text-[#5d716d]">Filtrá la misma muestra por ciudad, barrio, rubro y tipo de gestión.</p>
                  </div>
                  <button type="button" className={`${focusRing} min-h-11 rounded-xl border border-[#bed1cc] bg-[#f7faf8] px-4 text-xs font-bold text-[#315550] hover:bg-[#edf5f2]`} onClick={resetTerritoryFilters}>
                    Limpiar filtros
                  </button>
                </div>

                <div className="grid gap-4 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
                  <div>
                    <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#61736f]">Ciudad</p>
                    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar mapa por ciudad">
                      {cityOptions.map((city) => (
                        <button
                          key={city}
                          type="button"
                          aria-pressed={cityFilter === city}
                          className={`${focusRing} min-h-11 rounded-xl border px-3 text-xs font-bold ${cityFilter === city ? 'border-[#075f91] bg-[#075f91] text-white' : 'border-[#c7d9e5] bg-[#f8fbfd] text-[#173c57]'}`}
                          onClick={() => {
                            setCityFilter(city);
                            setNeighborhoodFilter('Todos');
                          }}
                        >
                          {city}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#61736f]">Rubro / categoría</p>
                    <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:thin]" role="group" aria-label="Filtrar mapa por categoría o rubro">
                      {categoryOptions.map((category) => (
                        <button
                          key={category}
                          type="button"
                          aria-pressed={categoryFilter === category}
                          className={`${focusRing} min-h-11 shrink-0 rounded-xl border px-3 text-xs font-bold ${categoryFilter === category ? 'border-[#0b665e] bg-[#dff2ed] text-[#075f57]' : 'border-[#c9d8d4] bg-white text-[#315550]'}`}
                          onClick={() => {
                            setCategoryFilter(category);
                            setNeighborhoodFilter('Todos');
                          }}
                        >
                          {category}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <label className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#61736f]">
                    Barrio
                    <select aria-label="Filtrar mapa por barrio" value={neighborhoodFilter} onChange={(event) => setNeighborhoodFilter(event.target.value)} className={`${focusRing} mt-1.5 min-h-11 w-full rounded-xl border border-[#c9d8d4] bg-white px-3 text-xs font-bold normal-case tracking-normal text-[#315550]`}>
                      {neighborhoodOptions.map((neighborhood) => <option key={neighborhood} value={neighborhood}>{neighborhood}</option>)}
                    </select>
                  </label>
                  <label className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#61736f]">
                    Tipo de gestión
                    <select aria-label="Filtrar mapa por tipo" value={ticketTypeFilter} onChange={(event) => setTicketTypeFilter(event.target.value)} className={`${focusRing} mt-1.5 min-h-11 w-full rounded-xl border border-[#c9d8d4] bg-white px-3 text-xs font-bold normal-case tracking-normal text-[#315550]`}>
                      {ticketTypeOptions.map((type) => <option key={type} value={type}>{type}</option>)}
                    </select>
                  </label>
                  <div className="rounded-xl bg-[#e7f3ef] px-4 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#51706a]">Puntos visibles</p>
                    <p className="mt-1 text-xl font-semibold text-[#173c39]">{filteredTerritoryPoints.length} <span className="text-xs font-bold text-[#5d716d]">de {territoryPoints.length}</span></p>
                  </div>
                  <div className="rounded-xl bg-[#f3eddd] px-4 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#77632e]">Volumen ponderado</p>
                    <p className="mt-1 text-xl font-semibold text-[#4d401e]">{filteredTerritoryVolume}</p>
                  </div>
                </div>
              </div>
              <p className="mt-4 text-[11px] font-semibold text-[#526863]" aria-live="polite">
                Vista actual: {cityFilter} · {categoryFilter} · {neighborhoodFilter} · {ticketTypeFilter}
              </p>
            </Reveal>

            <div className="mt-7 grid items-start gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(22rem,0.65fr)]">
              <Reveal reduceMotion={shouldReduceMotion} className="self-start">
                <div id="territory-map-card" data-testid="tdf-map-card" className="overflow-hidden rounded-[1.6rem] border border-[#cbdcd7] bg-white">
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
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#dce6e2] bg-[#f8faf9] px-4 py-3 text-[11px] font-bold sm:px-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span data-testid="tdf-map-layer-heat" data-active={mapView === 'thematic' ? 'true' : 'false'} className={`rounded-full border px-2.5 py-1 ${mapView === 'thematic' ? 'border-[#80cfc3] bg-[#dff2ed] text-[#075f57]' : 'border-[#d6e0dd] bg-white text-[#75837f]'}`}>Calor {mapView === 'thematic' ? 'activo' : 'oculto'}</span>
                      <span data-testid="tdf-map-layer-points" data-active="true" className="rounded-full border border-[#a9cbc3] bg-white px-2.5 py-1 text-[#315550]">{filteredTerritoryPoints.length} puntos activos</span>
                    </div>
                    <div className="flex items-center gap-2 text-[#60736f]" aria-label="Escala de intensidad: baja, media y alta">
                      <span>Baja</span><span className="h-2 w-20 rounded-full bg-gradient-to-r from-[#69d5df] via-[#f2b84b] to-[#d55d39]" aria-hidden="true" /><span>Alta</span>
                    </div>
                  </div>
                  <ConceptualTerritoryMap mapView={mapView} points={filteredTerritoryPoints} />
                  <p data-testid="tdf-map-note" className="border-t border-[#dce6e2] bg-[#f8faf9] px-4 py-3 text-xs leading-5 text-[#5d706d] sm:px-5">
                    {content.territory.note}
                  </p>
                </div>
              </Reveal>

              <div className="grid content-start gap-5">
                <Reveal reduceMotion={shouldReduceMotion} className="rounded-[1.6rem] border border-[#d4e0dc] bg-white p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-[#173c39]">Categorías territoriales</h3>
                      <p className="mt-1 text-xs leading-5 text-[#5d716d]">Color, letra y cantidad visible en el mapa.</p>
                    </div>
                    <Layers3 className="h-5 w-5 text-[#087a70]" aria-hidden="true" />
                  </div>
                  <ul role="list" aria-label="Leyenda de categorías territoriales" className="mt-4 space-y-2.5">
                    {territoryCategoryBreakdown.map((category) => (
                      <li key={category.label} className="flex items-center justify-between gap-3 rounded-xl border border-[#e1e9e6] bg-[#f8faf9] px-3 py-2.5">
                        <span className="flex min-w-0 items-center gap-3">
                          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 border-white text-xs font-black shadow-sm" style={{ backgroundColor: category.color, color: category.textColor }} aria-hidden="true">{category.short}</span>
                          <span className="truncate text-xs font-bold text-[#31524e]">{category.label}</span>
                        </span>
                        <span className="shrink-0 text-[11px] font-bold text-[#647773]">{category.points}/{category.totalPoints}</span>
                      </li>
                    ))}
                  </ul>
                </Reveal>

                <Reveal reduceMotion={shouldReduceMotion} delay={0.03} className="grid gap-3 sm:grid-cols-2">
                  {content.territory.metrics.slice(0, 4).map((metric) => (
                    <div key={metric.label} className="rounded-2xl border border-[#d4e0dc] bg-white p-4">
                      <p className="text-2xl font-semibold tracking-[-0.04em] text-[#123c39]">{metric.value}</p>
                      <p className="mt-1 text-xs font-semibold text-[#31524e]">{metric.label}</p>
                      <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.1em] text-[#667773]">{metric.detail}</p>
                    </div>
                  ))}
                </Reveal>

                <Reveal reduceMotion={shouldReduceMotion} delay={0.05} className="rounded-[1.6rem] border border-[#d4e0dc] bg-white p-5">
                  <div className="flex items-start justify-between gap-3"><div><h3 className="text-base font-semibold text-[#173c39]">Zonas con mayor intensidad</h3><p className="mt-1 text-xs leading-5 text-[#5d716d]">Ranking de la muestra filtrada.</p></div><MapPin className="h-5 w-5 text-[#087a70]" aria-hidden="true" /></div>
                  {topNeighborhoods.length ? <ol className="mt-4 space-y-3">{topNeighborhoods.map((point, index) => { const value = point.totalWeight ?? point.weight ?? 0; const maxValue = topNeighborhoods[0]?.totalWeight ?? topNeighborhoods[0]?.weight ?? 1; return <li key={`${point.ciudad}-${point.barrio}`}><div className="flex items-end justify-between gap-3 text-xs"><span className="min-w-0"><span className="font-bold text-[#31524e]">{index + 1}. {point.barrio}</span><span className="ml-1 text-[#687a77]">· {point.ciudad}</span></span><span className="font-bold text-[#173c39]">{value}</span></div><div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#e5ece9]"><motion.div className="h-full rounded-full" style={{ backgroundColor: point.categoryColor }} initial={shouldReduceMotion ? false : { width: 0 }} whileInView={{ width: `${Math.max(8, Math.round((value / maxValue) * 100))}%` }} viewport={{ once: true }} transition={{ duration: shouldReduceMotion ? 0 : 0.55 }} /></div></li>; })}</ol> : <p className="mt-4 rounded-xl bg-[#f7faf8] p-4 text-sm text-[#5d716d]">No hay puntos para esta combinación de filtros.</p>}
                </Reveal>
              </div>
            </div>

            <Reveal reduceMotion={shouldReduceMotion} delay={0.06} className="mt-5 rounded-[1.6rem] border border-[#d4e0dc] bg-white p-5 sm:p-6">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h3 className="flex items-center gap-2 text-lg font-semibold text-[#173c39]"><BarChart3 className="h-5 w-5 text-[#087a70]" aria-hidden="true" />Distribución de la muestra filtrada</h3>
                  <p className="mt-1 text-xs leading-5 text-[#5d716d]">Participación ponderada por rubro sobre la selección actual.</p>
                </div>
                <span className="rounded-full bg-[#e7f3ef] px-3 py-1.5 text-[11px] font-bold text-[#315550]">{filteredTerritoryVolume} interacciones representativas</span>
              </div>
              <ul className="mt-5 grid gap-4 lg:grid-cols-5">
                {territoryCategoryBreakdown.map((category) => (
                  <li key={category.label} className="rounded-xl border border-[#e0e8e5] bg-[#f8faf9] p-4">
                    <div className="flex items-start justify-between gap-3 text-xs">
                      <span className="font-semibold leading-5 text-[#405e59]">{category.label}</span>
                      <span className="font-bold text-[#173c39]">{category.percentage}%</span>
                    </div>
                    <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-[#e5ece9]" role="img" aria-label={`${category.label}: ${category.percentage} por ciento de la muestra filtrada`}>
                      <motion.div className="h-full rounded-full" style={{ backgroundColor: category.color, ...(shouldReduceMotion ? { width: `${category.percentage}%` } : {}) }} initial={shouldReduceMotion ? false : { width: 0 }} whileInView={shouldReduceMotion ? undefined : { width: `${category.percentage}%` }} viewport={shouldReduceMotion ? undefined : { once: true, amount: 0.7 }} transition={{ duration: shouldReduceMotion ? 0 : 0.65, ease: 'easeOut' }} />
                    </div>
                    <p className="mt-2 text-[11px] font-semibold text-[#526863]">{category.points} puntos · volumen {category.volume}</p>
                  </li>
                ))}
              </ul>
            </Reveal>

            <Reveal reduceMotion={shouldReduceMotion} delay={0.08} className="mt-5">
              <div data-testid="tdf-map-point-directory" role="region" aria-labelledby="tdf-territory-directory-title" className="overflow-hidden rounded-[1.6rem] border border-[#d4e0dc] bg-white">
                <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#dce6e2] p-5 sm:p-6">
                <div>
                  <h3 id="tdf-territory-directory-title" className="text-lg font-semibold text-[#173c39]">Directorio territorial de muestra</h3>
                  <p className="mt-1 text-xs leading-5 text-[#5d716d]">Los mismos puntos del mapa, disponibles como lista accesible y verificable.</p>
                </div>
                <span className="rounded-full border border-[#c9d8d4] bg-[#f7faf8] px-3 py-1.5 text-[11px] font-bold text-[#315550]">{filteredTerritoryPoints.length} visibles · datos simulados</span>
              </div>
                <div className="grid items-start lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.6fr)]">
                <div className="max-h-[34rem] overflow-y-auto p-3 [scrollbar-width:thin] sm:p-4">
                  {filteredTerritoryPoints.length ? (
                    <ul aria-label="Ubicaciones representativas disponibles" className="grid gap-2 sm:grid-cols-2">
                      {filteredTerritoryPoints.map((point, index) => {
                        const category = TERRITORY_CATEGORY_META.find((item) => item.label === point.categoria) ?? TERRITORY_CATEGORY_META[0];
                        const isSelected = territoryPointKey(point) === territoryPointKey(selectedTerritoryPoint ?? point);
                        return (
                          <li key={territoryPointKey(point)}>
                            <button
                              type="button"
                              data-testid={`tdf-map-point-row-${index}`}
                              aria-label={`Ver detalle de ${point.barrio}, ${point.ciudad}`}
                              aria-pressed={isSelected}
                              className={`${focusRing} flex min-h-[7.4rem] w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors ${isSelected ? 'border-[#5cae9f] bg-[#edf8f5]' : 'border-[#e0e8e5] bg-[#f9fbfa] hover:border-[#a9cbc3] hover:bg-white'}`}
                              onClick={() => setSelectedTerritoryPointKey(territoryPointKey(point))}
                            >
                              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-black" style={{ backgroundColor: category.color, color: category.textColor }} aria-hidden="true">{category.short}</span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-bold text-[#173c39]">{point.barrio}</span>
                                <span className="mt-0.5 block text-xs text-[#60736f]">{point.ciudad} · {point.categoria}</span>
                                <span className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-bold text-[#526863]"><span className="rounded-full bg-white px-2 py-1">{point.tipo_ticket}</span><span className="rounded-full bg-white px-2 py-1">{point.canal}</span><span className="rounded-full bg-white px-2 py-1">Vol. {point.totalWeight ?? point.weight ?? 0}</span></span>
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <div className="grid min-h-48 place-items-center rounded-xl border border-dashed border-[#cbd8d4] bg-[#f8faf9] p-6 text-center">
                      <div><MapPin className="mx-auto h-6 w-6 text-[#7b918c]" aria-hidden="true" /><p className="mt-3 text-sm font-bold text-[#31524e]">No hay puntos para esta combinación</p><button type="button" className={`${focusRing} mt-3 min-h-11 rounded-xl border border-[#bed1cc] bg-white px-4 text-xs font-bold text-[#0b665e]`} onClick={resetTerritoryFilters}>Restablecer muestra</button></div>
                    </div>
                  )}
                </div>

                <aside role="region" aria-label="Detalle de ubicación representativa" className="border-t border-[#dce6e2] bg-[#102f2e] p-5 text-white lg:min-h-[34rem] lg:border-l lg:border-t-0 sm:p-6">
                  {selectedTerritoryPoint ? (
                    <div className="flex h-full flex-col">
                      <div className="flex items-start justify-between gap-3">
                        <span className="rounded-full bg-[#88ded1] px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#0b3f3b]">Dato simulado</span>
                        <span className="text-3xl font-semibold text-[#f0c96f]">{selectedTerritoryPoint.totalWeight ?? selectedTerritoryPoint.weight ?? 0}</span>
                      </div>
                      <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.16em] text-[#88ded1]">{selectedTerritoryPoint.ciudad}</p>
                      <h4 className="mt-1 text-2xl font-semibold">{selectedTerritoryPoint.barrio}</h4>
                      <p className="mt-2 text-sm leading-6 text-white/65">Punto representativo para demostrar segmentación territorial, priorización y trazabilidad operativa.</p>
                      <dl className="mt-6 grid gap-px overflow-hidden rounded-xl bg-white/10 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                        {[
                          ['Categoría', selectedTerritoryPoint.categoria],
                          ['Tipo', selectedTerritoryPoint.tipo_ticket],
                          ['Canal', selectedTerritoryPoint.canal],
                          ['Estado', selectedTerritoryPoint.estado],
                        ].map(([label, value]) => (
                          <div key={label} className="bg-[#153b39] p-3.5"><dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/65">{label}</dt><dd className="mt-1 text-xs font-semibold text-white/90">{value}</dd></div>
                        ))}
                      </dl>
                      <div className="mt-auto space-y-2 pt-6">
                        <button
                          type="button"
                          className={`${focusRing} min-h-11 w-full rounded-xl bg-[#88ded1] px-4 text-xs font-black text-[#0b3f3b] hover:bg-[#a2eadf]`}
                          onClick={() => {
                            setCityFilter(selectedTerritoryPoint.ciudad);
                            setCategoryFilter(selectedTerritoryPoint.categoria);
                            setNeighborhoodFilter(selectedTerritoryPoint.barrio);
                            setTicketTypeFilter(selectedTerritoryPoint.tipo_ticket);
                            window.requestAnimationFrame(() => document.getElementById('territory-map-card')?.scrollIntoView({ behavior: shouldReduceMotion ? 'auto' : 'smooth', block: 'center' }));
                          }}
                        >
                          Enfocar este barrio en el mapa
                        </button>
                        <button type="button" className={`${focusRing} min-h-11 w-full rounded-xl border border-white/20 px-4 text-xs font-bold text-white hover:bg-white/10`} onClick={() => { setCityFilter(selectedTerritoryPoint.ciudad); setCategoryFilter('Todas'); setNeighborhoodFilter('Todos'); setTicketTypeFilter('Todos'); }}>
                          Ver ciudad completa
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid h-full min-h-48 place-items-center text-center text-sm text-white/65">Ajustá los filtros para consultar un punto.</div>
                  )}
                </aside>
                </div>
              </div>
            </Reveal>
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
              <a href={content.closing.primaryAction.href} className={`${focusRing} inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#075f91] px-5 text-sm font-bold text-white hover:bg-[#064d78]`}>
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
      <FaroChatWidget reduceMotion={shouldReduceMotion} onOpenScenario={openScenario} />
      </div>
    </>
  );
};

export default DisabilityAIAgentDemoPage;

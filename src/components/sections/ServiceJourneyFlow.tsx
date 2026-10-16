import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import '@xyflow/react/dist/style.css';
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  type Edge,
  type Node,
} from '@xyflow/react';
import { BarChart3, Bot, Building2, Headphones, Landmark, MessagesSquare } from 'lucide-react';

type JourneyMode = 'gobierno' | 'empresa';

type JourneyNodeData = {
  eyebrow: string;
  label: string;
  detail: string;
  emphasis?: boolean;
};

const nodeBaseStyle: React.CSSProperties = {
  width: 188,
  border: '1px solid hsl(var(--border))',
  borderRadius: 12,
  background: 'hsl(var(--card))',
  color: 'hsl(var(--foreground))',
  boxShadow: '0 12px 32px rgba(15, 23, 42, 0.08)',
  padding: 0,
};

const platformNodeStyle: React.CSSProperties = {
  ...nodeBaseStyle,
  border: '1px solid hsl(var(--primary) / 0.55)',
  background: 'hsl(var(--primary))',
  color: 'hsl(var(--primary-foreground))',
  boxShadow: '0 18px 40px hsl(var(--primary) / 0.2)',
};

const journeys: Record<JourneyMode, { outcome: string; detail: string; insight: string }> = {
  gobierno: {
    outcome: 'Reclamos, trámites y participación',
    detail: 'Crea casos, recibe evidencia, deriva y registra respuestas de encuestas o votaciones.',
    insight: 'Estados, SLA, categorías y lectura territorial',
  },
  empresa: {
    outcome: 'Consultas, catálogo y pedidos',
    detail: 'Resuelve precios, arma carritos, confirma pedidos y conserva el seguimiento posventa.',
    insight: 'Conversión, demanda, operación y servicio',
  },
};

const JourneyNode = ({ data }: { data: JourneyNodeData }) => (
  <div className="relative p-4 text-left">
    <Handle type="target" position={Position.Left} className="!h-2.5 !w-2.5 !border-2 !border-background !bg-primary" />
    <div>
      <div className={`text-[10px] font-bold uppercase tracking-[0.13em] ${data.emphasis ? 'text-white/75' : 'text-primary'}`}>
        {data.eyebrow}
      </div>
      <div className="mt-1.5 text-[15px] font-semibold leading-5">{data.label}</div>
      <div className={`mt-2 text-[11px] leading-4 ${data.emphasis ? 'text-white/80' : 'text-muted-foreground'}`}>
        {data.detail}
      </div>
    </div>
    <Handle type="source" position={Position.Right} className="!h-2.5 !w-2.5 !border-2 !border-background !bg-primary" />
  </div>
);

const nodeTypes = { journey: JourneyNode };

const buildNodes = (mode: JourneyMode): Node<JourneyNodeData>[] => {
  const journey = journeys[mode];
  return [
    {
      id: 'channels',
      type: 'journey',
      position: { x: 0, y: 115 },
      data: {
        eyebrow: 'Entrada',
        label: 'WhatsApp, web y voz',
        detail: 'Texto, audio, imágenes, documentos y ubicación consentida.',
      },
      style: nodeBaseStyle,
    },
    {
      id: 'agent',
      type: 'journey',
      position: { x: 245, y: 115 },
      data: {
        eyebrow: 'Orquestación',
        label: 'Agente Chatboc',
        detail: 'Comprende el pedido, solicita lo necesario y ejecuta una acción validada.',
        emphasis: true,
      },
      style: platformNodeStyle,
    },
    {
      id: 'operation',
      type: 'journey',
      position: { x: 490, y: 32 },
      data: {
        eyebrow: mode === 'gobierno' ? 'Gestión pública' : 'Operación comercial',
        label: journey.outcome,
        detail: journey.detail,
      },
      style: nodeBaseStyle,
    },
    {
      id: 'team',
      type: 'journey',
      position: { x: 490, y: 198 },
      data: {
        eyebrow: 'Atención humana',
        label: 'CRM, responsables y contexto',
        detail: 'El equipo toma el caso, conversa y deja cada decisión auditada.',
      },
      style: nodeBaseStyle,
    },
    {
      id: 'insight',
      type: 'journey',
      position: { x: 742, y: 115 },
      data: {
        eyebrow: 'Resultado',
        label: journey.insight,
        detail: 'Una vista operativa para priorizar, responder y mejorar el servicio.',
      },
      style: nodeBaseStyle,
    },
  ];
};

const buildEdges = (animated: boolean): Edge[] => [
  ['channels-agent', 'channels', 'agent'],
  ['agent-operation', 'agent', 'operation'],
  ['agent-team', 'agent', 'team'],
  ['operation-insight', 'operation', 'insight'],
  ['team-insight', 'team', 'insight'],
].map(([id, source, target]) => ({
  id,
  source,
  target,
  type: 'smoothstep',
  animated,
  markerEnd: { type: MarkerType.ArrowClosed, color: 'hsl(var(--primary))' },
  style: { stroke: 'hsl(var(--primary) / 0.62)', strokeWidth: 1.8 },
}));

const mobileSteps = (mode: JourneyMode) => {
  const journey = journeys[mode];
  return [
    { icon: MessagesSquare, label: 'Canales', detail: 'WhatsApp, web y voz' },
    { icon: Bot, label: 'Agente', detail: 'Comprende y ejecuta con validación' },
    { icon: Headphones, label: 'Operación', detail: journey.outcome },
    { icon: BarChart3, label: 'Gestión', detail: journey.insight },
  ];
};

const ServiceJourneyFlow = () => {
  const [mode, setMode] = useState<JourneyMode>('gobierno');
  const reduceMotion = useReducedMotion();
  const canRenderInteractiveFlow = typeof ResizeObserver !== 'undefined';
  const nodes = useMemo(() => buildNodes(mode), [mode]);
  const edges = useMemo(() => buildEdges(!reduceMotion), [reduceMotion]);
  const compactSteps = mobileSteps(mode);

  return (
    <div
      className="mt-9 overflow-hidden rounded-[16px] border border-border bg-card shadow-sm"
      role="region"
      aria-label="Recorrido conectado"
    >
      <div className="flex flex-col gap-4 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-primary/10 text-primary">
            {mode === 'gobierno' ? <Landmark className="h-5 w-5" aria-hidden="true" /> : <Building2 className="h-5 w-5" aria-hidden="true" />}
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">Recorrido conectado</p>
            <p className="text-xs text-muted-foreground">Elegí un contexto para ver cómo se vinculan los módulos.</p>
          </div>
        </div>
        <div className="grid grid-cols-2 rounded-[10px] border border-border bg-muted/35 p-1" role="group" aria-label="Contexto del recorrido">
          {(['gobierno', 'empresa'] as const).map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={mode === item}
              onClick={() => setMode(item)}
              className={`min-h-10 rounded-[8px] px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                mode === item ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-background hover:text-foreground'
              }`}
            >
              {item === 'gobierno' ? 'Gobierno' : 'Empresa'}
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={mode}
          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
          transition={{ duration: reduceMotion ? 0 : 0.24, ease: 'easeOut' }}
        >
          {canRenderInteractiveFlow ? (
            <div className="hidden h-[390px] bg-[radial-gradient(circle_at_50%_45%,hsl(var(--primary)/0.08),transparent_48%)] md:block">
              <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                fitView
                fitViewOptions={{ padding: 0.12, minZoom: 0.78, maxZoom: 1.04 }}
                minZoom={0.68}
                maxZoom={1.2}
                nodesDraggable={false}
                nodesConnectable={false}
                elementsSelectable={false}
                zoomOnScroll={false}
                panOnScroll={false}
                preventScrolling={false}
                aria-label={`Recorrido operativo para ${mode}`}
              >
                <Background color="hsl(var(--border))" gap={22} size={1} variant={BackgroundVariant.Dots} />
                <Controls showInteractive={false} position="bottom-right" />
              </ReactFlow>
            </div>
          ) : null}

          <ol
            className={`divide-y divide-border ${canRenderInteractiveFlow ? 'md:hidden' : ''}`}
            aria-label={`Recorrido operativo para ${mode}`}
          >
            {compactSteps.map((step, index) => {
              const Icon = step.icon;
              return (
                <li key={step.label} className="flex items-center gap-3 px-4 py-4">
                  <span className="flex h-9 w-9 flex-none items-center justify-center rounded-[9px] bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold uppercase tracking-[0.11em] text-primary">{String(index + 1).padStart(2, '0')} · {step.label}</p>
                    <p className="mt-1 text-sm leading-5 text-foreground">{step.detail}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </motion.div>
      </AnimatePresence>

      <div className="border-t border-border bg-muted/25 px-4 py-3 text-xs leading-5 text-muted-foreground sm:px-6">
        Diagrama de capacidades. Los canales, integraciones y automatizaciones se habilitan según la configuración contratada.
      </div>
    </div>
  );
};

export default ServiceJourneyFlow;

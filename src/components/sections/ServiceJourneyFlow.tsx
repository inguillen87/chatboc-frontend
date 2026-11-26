import React, { useMemo, useState } from "react";
import "@xyflow/react/dist/style.css";
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
} from "@xyflow/react";

type JourneyMode = "gobierno" | "empresa";

type JourneyNodeData = {
  eyebrow: string;
  label: string;
  detail: string;
  emphasis?: boolean;
};

const nodeBaseStyle: React.CSSProperties = {
  width: 196,
  border: "1px solid hsl(var(--border))",
  borderRadius: 12,
  background: "hsl(var(--card))",
  color: "hsl(var(--foreground))",
  boxShadow: "none",
  padding: 0,
};

const platformNodeStyle: React.CSSProperties = {
  ...nodeBaseStyle,
  border: "1px solid hsl(var(--primary))",
  background: "hsl(var(--primary))",
  color: "hsl(var(--primary-foreground))",
};

const journeys: Record<JourneyMode, { outcome: string; detail: string; insight: string }> = {
  gobierno: {
    outcome: "Reclamos, trámites y participación",
    detail: "Crea casos, recibe evidencia, deriva al área responsable y registra encuestas.",
    insight: "Estados, plazos, categorías y lectura territorial",
  },
  empresa: {
    outcome: "Consultas, catálogo y pedidos",
    detail: "Responde precios, arma pedidos, confirma compras y conserva el seguimiento posventa.",
    insight: "Conversión, demanda, operación y servicio",
  },
};

const JourneyNode = ({ data }: { data: JourneyNodeData }) => (
  <div className="relative p-4 text-left">
    <Handle type="target" position={Position.Left} className="!h-2 !w-2 !border !border-background !bg-primary" />
    <div>
      <div
        className={`text-xs font-semibold ${
          data.emphasis ? "text-primary-foreground/85" : "text-primary"
        }`}
      >
        {data.eyebrow}
      </div>
      <div className="mt-1.5 text-[15px] font-semibold leading-5">{data.label}</div>
      <div
        className={`mt-2 text-xs leading-4 ${
          data.emphasis ? "text-primary-foreground/90" : "text-slate-600 dark:text-muted-foreground"
        }`}
      >
        {data.detail}
      </div>
    </div>
    <Handle type="source" position={Position.Right} className="!h-2 !w-2 !border !border-background !bg-primary" />
  </div>
);

const nodeTypes = { journey: JourneyNode };

const buildNodes = (mode: JourneyMode): Node<JourneyNodeData>[] => {
  const journey = journeys[mode];
  return [
    {
      id: "channels",
      type: "journey",
      position: { x: 0, y: 115 },
      data: {
        eyebrow: "Entrada",
        label: "WhatsApp, web y audio",
        detail: "Texto, audios transcriptos, fotos, documentos y ubicación.",
      },
      style: nodeBaseStyle,
    },
    {
      id: "agent",
      type: "journey",
      position: { x: 252, y: 115 },
      data: {
        eyebrow: "Orquestación",
        label: "Agente Chatboc",
        detail: "Ordena el pedido, pide los datos faltantes y ejecuta la acción configurada.",
        emphasis: true,
      },
      style: platformNodeStyle,
    },
    {
      id: "operation",
      type: "journey",
      position: { x: 504, y: 28 },
      data: {
        eyebrow: mode === "gobierno" ? "Gestión pública" : "Operación comercial",
        label: journey.outcome,
        detail: journey.detail,
      },
      style: nodeBaseStyle,
    },
    {
      id: "team",
      type: "journey",
      position: { x: 504, y: 202 },
      data: {
        eyebrow: "Atención humana",
        label: "CRM, responsables y contexto",
        detail: "Tu equipo toma el caso, responde y deja cada paso registrado.",
      },
      style: nodeBaseStyle,
    },
    {
      id: "insight",
      type: "journey",
      position: { x: 758, y: 115 },
      data: {
        eyebrow: "Resultado",
        label: journey.insight,
        detail: "Un tablero operativo para priorizar, responder y ajustar el servicio.",
      },
      style: nodeBaseStyle,
    },
  ];
};

const buildEdges = (): Edge[] =>
  [
    ["channels-agent", "channels", "agent"],
    ["agent-operation", "agent", "operation"],
    ["agent-team", "agent", "team"],
    ["operation-insight", "operation", "insight"],
    ["team-insight", "team", "insight"],
  ].map(([id, source, target]) => ({
    id,
    source,
    target,
    type: "smoothstep",
    animated: false,
    markerEnd: { type: MarkerType.ArrowClosed, color: "hsl(var(--primary))" },
    style: { stroke: "hsl(var(--primary) / 0.55)", strokeWidth: 1.5 },
  }));

const mobileSteps = (mode: JourneyMode) => {
  const journey = journeys[mode];
  return [
    { label: "Canales", detail: "WhatsApp, web y audio" },
    { label: "Agente", detail: "Ordena el pedido y ejecuta con validación" },
    { label: "Operación", detail: journey.outcome },
    { label: "Gestión", detail: journey.insight },
  ];
};

const ServiceJourneyFlow = () => {
  const [mode, setMode] = useState<JourneyMode>("gobierno");
  const canRenderInteractiveFlow = typeof ResizeObserver !== "undefined";
  const nodes = useMemo(() => buildNodes(mode), [mode]);
  const edges = useMemo(() => buildEdges(), []);
  const compactSteps = mobileSteps(mode);

  return (
    <div
      className="mt-10 overflow-hidden rounded-[12px] border border-border bg-card"
      role="region"
      aria-label="Recorrido conectado"
    >
      <div className="flex flex-col gap-4 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <p className="text-sm font-semibold text-foreground">Recorrido conectado</p>
          <p className="mt-0.5 text-xs text-slate-600 dark:text-muted-foreground">
            Elegí un contexto para ver cómo se vinculan los módulos.
          </p>
        </div>
        <div
          className="grid grid-cols-2 rounded-[8px] border border-border bg-muted/35 p-1"
          role="group"
          aria-label="Contexto del recorrido"
        >
          {(["gobierno", "empresa"] as const).map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={mode === item}
              onClick={() => setMode(item)}
              className={`min-h-10 rounded-[8px] px-4 text-sm font-semibold transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                mode === item
                  ? "bg-primary text-primary-foreground"
                  : "text-slate-600 hover:text-foreground dark:text-muted-foreground"
              }`}
            >
              {item === "gobierno" ? "Gobierno" : "Empresa"}
            </button>
          ))}
        </div>
      </div>

      {canRenderInteractiveFlow ? (
        <div className="hidden h-[390px] bg-background md:block">
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
            <Background color="hsl(var(--border))" gap={24} size={1} variant={BackgroundVariant.Dots} />
            <Controls showInteractive={false} position="bottom-right" />
          </ReactFlow>
        </div>
      ) : null}

      <ol
        className={`divide-y divide-border ${canRenderInteractiveFlow ? "md:hidden" : ""}`}
        aria-label={`Recorrido operativo para ${mode}`}
      >
        {compactSteps.map((step, index) => (
          <li key={step.label} className="grid grid-cols-[2rem_1fr] gap-3 px-5 py-4">
            <span className="text-xs font-semibold tabular-nums text-primary pt-0.5">
              {String(index + 1).padStart(2, "0")}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">{step.label}</p>
              <p className="mt-1 text-sm leading-5 text-slate-600 dark:text-muted-foreground">{step.detail}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="border-t border-border bg-muted/20 px-5 py-3 text-xs leading-5 text-slate-600 dark:text-muted-foreground sm:px-6">
        Diagrama de capacidades. Los canales, integraciones y automatizaciones se habilitan según la configuración
        contratada.
      </div>
    </div>
  );
};

export default ServiceJourneyFlow;

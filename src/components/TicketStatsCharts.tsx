import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  Title,
  Filler,
} from "chart.js";
import type { ChartOptions } from "chart.js";
import React from "react";

ChartJS.register(
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  Title,
  Filler,
);

export interface ChartBlock {
  title: string;
  data: Record<string, number>;
}

interface Props {
  charts?: ChartBlock[];
  sampleSize?: number;
  sparseThreshold?: number;
  contextLabel?: string;
  privacyFloor?: number;
  privacySuppressed?: boolean;
}

export const TICKET_CHART_THEME = {
  bar: "rgba(59, 130, 246, 0.72)",
  barHover: "rgba(37, 99, 235, 0.92)",
  tooltip: "rgba(15, 23, 42, 0.96)",
  tooltipText: "#f8fafc",
  tooltipBorder: "rgba(148, 163, 184, 0.35)",
  axisText: "#94a3b8",
  grid: "rgba(148, 163, 184, 0.18)",
} as const;

function SingleChart({ title, data }: ChartBlock) {
  const labels = Object.keys(data);
  const values = labels.map((key) => {
    const value = data[key];
    return typeof value === "number" && Number.isFinite(value)
      ? value
      : Number(value) || 0;
  });

  const chartData = {
    labels,
    datasets: [
      {
        label: title,
        data: values,
        backgroundColor: TICKET_CHART_THEME.bar,
        hoverBackgroundColor: TICKET_CHART_THEME.barHover,
        borderRadius: 6,
        maxBarThickness: 48,
      },
    ],
  };

  const options: ChartOptions<"bar"> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: { display: false },
      tooltip: {
        backgroundColor: TICKET_CHART_THEME.tooltip,
        titleColor: TICKET_CHART_THEME.tooltipText,
        bodyColor: TICKET_CHART_THEME.tooltipText,
        borderColor: TICKET_CHART_THEME.tooltipBorder,
        borderWidth: 1,
      },
    },
    scales: {
      x: {
        ticks: {
          color: TICKET_CHART_THEME.axisText,
          maxRotation: 40,
          minRotation: 0,
          autoSkip: true,
        },
        grid: { display: false },
      },
      y: {
        beginAtZero: true,
        ticks: {
          color: TICKET_CHART_THEME.axisText,
          precision: 0,
        },
        grid: {
          color: TICKET_CHART_THEME.grid,
        },
      },
    },
    layout: {
      padding: {
        top: 8,
        bottom: 8,
        left: 0,
        right: 0,
      },
    },
  };

  return (
    <div className="flex h-full flex-col rounded-lg border border-border bg-card/80 p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <div className="mt-4 h-64">
        <Bar data={chartData} options={options} updateMode="resize" />
      </div>
    </div>
  );
}

function formatChartLabel(value: string): string {
  const normalized = value.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  if (!normalized) return "Sin dato";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function SparseChartSummary({
  charts,
  sampleSize,
  contextLabel,
}: {
  charts: ChartBlock[];
  sampleSize: number;
  contextLabel: string;
}) {
  return (
    <section
      data-testid="ticket-stats-sparse-summary"
      aria-labelledby="ticket-stats-sparse-title"
      className="rounded-xl border border-border/70 bg-card p-4 shadow-sm sm:p-5"
    >
      <div className="flex flex-col gap-3 border-b border-border/70 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Analítica descriptiva
          </p>
          <h3
            id="ticket-stats-sparse-title"
            className="mt-1 text-lg font-semibold text-foreground"
          >
            Distribución de la evidencia disponible
          </h3>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
            Con este volumen se muestran valores exactos y proporciones, sin
            ejes que puedan exagerar diferencias pequeñas.
          </p>
        </div>
        <div className="w-fit rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-right">
          <p className="text-xs text-muted-foreground">Muestra visible</p>
          <p className="font-mono text-sm font-semibold text-foreground">
            {sampleSize} {contextLabel}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {charts.map((chart, chartIndex) => {
          const entries = Object.entries(chart.data)
            .map(
              ([label, value]) =>
                [
                  label,
                  Number.isFinite(value) ? value : Number(value) || 0,
                ] as const,
            )
            .filter(([, value]) => value > 0)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 6);
          const total = entries.reduce((sum, [, value]) => sum + value, 0);

          return (
            <article
              key={`${chart.title}-${chartIndex}`}
              className="rounded-lg border border-border/70 bg-background p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <h4 className="text-sm font-semibold text-foreground">
                  {chart.title}
                </h4>
                <span className="rounded-full bg-muted px-2 py-1 font-mono text-[11px] text-muted-foreground">
                  total {total}
                </span>
              </div>
              <ol className="mt-4 space-y-3">
                {entries.map(([label, value], index) => {
                  const share =
                    total > 0 ? Math.round((value / total) * 100) : 0;
                  return (
                    <li key={label} className="space-y-1.5">
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <span className="min-w-0 truncate font-medium text-foreground">
                          {index + 1}. {formatChartLabel(label)}
                        </span>
                        <span className="shrink-0 font-mono text-muted-foreground">
                          {value} · {share}%
                        </span>
                      </div>
                      <div
                        className="h-1.5 overflow-hidden rounded-full bg-muted"
                        role="img"
                        aria-label={`${formatChartLabel(label)}: ${value}, ${share}%`}
                      >
                        <div
                          className="h-full rounded-full bg-blue-600"
                          style={{ width: `${share}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ol>
            </article>
          );
        })}
      </div>

      <p className="mt-4 text-xs leading-5 text-muted-foreground">
        Lectura operativa, no inferencial: se ampliarán comparaciones y
        tendencias cuando la muestra alcance volumen suficiente.
      </p>
    </section>
  );
}

function PrivacyProtectedChartSummary({
  privacyFloor,
}: {
  privacyFloor?: number;
}) {
  return (
    <section
      data-testid="ticket-stats-privacy-protected"
      role="status"
      className="rounded-xl border border-border/70 bg-card p-5 shadow-sm"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
        Analítica protegida
      </p>
      <h3 className="mt-1 text-lg font-semibold text-foreground">
        Desglose reservado por privacidad
      </h3>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
        La muestra visible todavía no alcanza el umbral requerido para publicar
        categorías, estados o zonas sin aumentar el riesgo de reidentificación.
      </p>
      {typeof privacyFloor === "number" && privacyFloor > 0 ? (
        <p className="mt-3 w-fit rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs font-medium text-foreground">
          Umbral institucional: {privacyFloor} casos agregados
        </p>
      ) : null}
    </section>
  );
}

export default function TicketStatsCharts({
  charts,
  sampleSize,
  sparseThreshold = 8,
  contextLabel = "registros",
  privacyFloor,
  privacySuppressed = false,
}: Props) {
  if (!charts || charts.length === 0) return null;
  if (
    privacySuppressed ||
    (typeof sampleSize === "number" &&
      typeof privacyFloor === "number" &&
      privacyFloor > 0 &&
      sampleSize < privacyFloor)
  ) {
    return <PrivacyProtectedChartSummary privacyFloor={privacyFloor} />;
  }
  if (
    typeof sampleSize === "number" &&
    sampleSize >= 0 &&
    sampleSize < sparseThreshold
  ) {
    return (
      <SparseChartSummary
        charts={charts}
        sampleSize={sampleSize}
        contextLabel={contextLabel}
      />
    );
  }
  return (
    <div className="grid auto-rows-[minmax(0,1fr)] gap-6 md:grid-cols-2 xl:grid-cols-3">
      {charts.map((c, idx) => (
        <SingleChart key={`${c.title}-${idx}`} {...c} />
      ))}
    </div>
  );
}

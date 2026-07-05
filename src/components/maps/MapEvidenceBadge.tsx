import { AlertTriangle, Database, Radar, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export type MapEvidenceInput = {
  source?: string | null;
  fuente?: string | null;
  provider?: string | null;
  contractVersion?: string | null;
  requestId?: string | null;
  usingSyntheticPoints?: boolean | null;
  synthetic?: boolean | null;
  pointCount?: number | null;
  cellCount?: number | null;
  featureCount?: number | null;
  coveragePct?: number | null;
  withCoordinates?: number | null;
  withoutCoordinates?: number | null;
  updatedAt?: string | null;
  generatedAt?: string | null;
  empty?: boolean | null;
  label?: string | null;
  metadata?: Record<string, unknown> | null;
  locationQuality?: Record<string, unknown> | null;
};

export type MapEvidence = {
  source?: string;
  provider?: string;
  contractVersion?: string;
  requestId?: string;
  usingSyntheticPoints: boolean;
  pointCount: number;
  cellCount: number;
  featureCount: number;
  coveragePct?: number;
  withCoordinates?: number;
  withoutCoordinates?: number;
  updatedAt?: string;
  empty: boolean;
  label?: string;
};

type BuildMapEvidenceArgs = {
  evidence?: MapEvidenceInput | null;
  metadata?: Record<string, unknown> | null;
  locationQuality?: Record<string, unknown> | null;
  points?: unknown[] | null;
  cells?: unknown[] | null;
  features?: unknown[] | null;
  source?: string | null;
  provider?: string | null;
  contractVersion?: string | null;
  requestId?: string | null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const pickString = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return undefined;
};

const pickNumber = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
};

const pickBoolean = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (["true", "1", "yes", "si"].includes(normalized)) return true;
      if (["false", "0", "no"].includes(normalized)) return false;
    }
  }
  return undefined;
};

const normalizeCount = (value: unknown, fallback: number) => {
  const parsed = pickNumber(value);
  return Math.max(0, Math.round(parsed ?? fallback));
};

const formatShortDate = (value?: string) => {
  if (!value) return undefined;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return value;
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
};

export function buildMapEvidence({
  evidence,
  metadata,
  locationQuality,
  points,
  cells,
  features,
  source,
  provider,
  contractVersion,
  requestId,
}: BuildMapEvidenceArgs): MapEvidence {
  const evidenceMetadata = isRecord(evidence?.metadata) ? evidence?.metadata : null;
  const explicitMetadata = isRecord(metadata) ? metadata : null;
  const mergedMetadata = {
    ...(explicitMetadata ?? {}),
    ...(evidenceMetadata ?? {}),
  };
  const renderContract = isRecord(mergedMetadata.render_contract)
    ? mergedMetadata.render_contract
    : null;
  const quality = isRecord(evidence?.locationQuality)
    ? evidence?.locationQuality
    : isRecord(locationQuality)
      ? locationQuality
      : isRecord(mergedMetadata.location_quality)
        ? mergedMetadata.location_quality
        : null;

  const pointCount = normalizeCount(
    evidence?.pointCount ?? mergedMetadata.point_count ?? mergedMetadata.points_count,
    points?.length ?? 0,
  );
  const featureCount = normalizeCount(
    evidence?.featureCount ?? mergedMetadata.feature_count ?? mergedMetadata.features_count,
    features?.length ?? 0,
  );
  const cellCount = normalizeCount(
    evidence?.cellCount ?? mergedMetadata.cell_count ?? mergedMetadata.cells_count,
    cells?.length ?? 0,
  );
  const usingSyntheticPoints = Boolean(
    pickBoolean(
      evidence?.usingSyntheticPoints,
      evidence?.synthetic,
      mergedMetadata.using_synthetic_points,
      mergedMetadata.synthetic,
    ) ||
      (typeof renderContract?.state === "string" &&
        ["demo_fallback", "synthetic", "fallback"].includes(renderContract.state)),
  );

  return {
    source: pickString(evidence?.source, evidence?.fuente, source, mergedMetadata.source, mergedMetadata.fuente),
    provider: pickString(evidence?.provider, provider, mergedMetadata.provider, mergedMetadata.provider_hint),
    contractVersion: pickString(
      evidence?.contractVersion,
      contractVersion,
      mergedMetadata.contract_version,
      renderContract?.contract_version,
    ),
    requestId: pickString(evidence?.requestId, requestId, mergedMetadata.request_id),
    usingSyntheticPoints,
    pointCount,
    cellCount,
    featureCount,
    coveragePct: pickNumber(
      evidence?.coveragePct,
      quality?.coverage_pct,
      mergedMetadata.coverage_pct,
      mergedMetadata.coverage,
    ),
    withCoordinates: pickNumber(evidence?.withCoordinates, quality?.with_coordinates),
    withoutCoordinates: pickNumber(evidence?.withoutCoordinates, quality?.without_coordinates),
    updatedAt: pickString(evidence?.updatedAt, evidence?.generatedAt, mergedMetadata.generated_at, mergedMetadata.updated_at),
    empty: Boolean(evidence?.empty) || pointCount + featureCount + cellCount === 0,
    label: pickString(evidence?.label),
  };
}

type MapEvidenceBadgeProps = {
  evidence?: MapEvidenceInput | MapEvidence | null;
  className?: string;
};

export function MapEvidenceBadge({ evidence, className }: MapEvidenceBadgeProps) {
  const normalized = buildMapEvidence({ evidence });

  const variant = normalized.usingSyntheticPoints
    ? "synthetic"
    : normalized.empty
      ? "empty"
      : normalized.source || normalized.provider || normalized.requestId
        ? "verified"
        : "unknown";

  const config = {
    verified: {
      Icon: ShieldCheck,
      title: normalized.label ?? "Datos reales",
      className: "border-emerald-300/50 bg-emerald-950/82 text-emerald-50 shadow-emerald-950/20",
      dot: "bg-emerald-300",
    },
    synthetic: {
      Icon: AlertTriangle,
      title: normalized.label ?? "Demo sintetico",
      className: "border-amber-300/55 bg-amber-950/85 text-amber-50 shadow-amber-950/25",
      dot: "bg-amber-300",
    },
    empty: {
      Icon: Radar,
      title: normalized.label ?? "Sin datos",
      className: "border-slate-300/30 bg-slate-950/82 text-slate-100 shadow-slate-950/20",
      dot: "bg-slate-400",
    },
    unknown: {
      Icon: Database,
      title: normalized.label ?? "Fuente sin confirmar",
      className: "border-sky-300/40 bg-sky-950/82 text-sky-50 shadow-sky-950/20",
      dot: "bg-sky-300",
    },
  }[variant];

  const details = [
    normalized.pointCount || normalized.featureCount
      ? `${Math.max(normalized.pointCount, normalized.featureCount)} puntos`
      : null,
    normalized.coveragePct !== undefined ? `Cobertura ${normalized.coveragePct}%` : null,
    normalized.source ? `Fuente ${normalized.source}` : normalized.provider ? `Mapa ${normalized.provider}` : null,
    normalized.updatedAt ? `Act. ${formatShortDate(normalized.updatedAt)}` : null,
    normalized.requestId ? `Req ${normalized.requestId.slice(0, 8)}` : null,
  ].filter(Boolean);

  const { Icon } = config;

  return (
    <div
      className={cn(
        "pointer-events-none max-w-[min(82vw,24rem)] rounded-xl border px-3 py-2 text-xs shadow-xl backdrop-blur-md",
        config.className,
        className,
      )}
    >
      <div className="flex items-center gap-2 font-semibold">
        <span className={cn("h-2 w-2 rounded-full", config.dot)} />
        <Icon className="h-3.5 w-3.5" />
        <span>{config.title}</span>
      </div>
      {details.length ? (
        <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] leading-relaxed opacity-85">
          {details.map((detail) => (
            <span key={detail}>{detail}</span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

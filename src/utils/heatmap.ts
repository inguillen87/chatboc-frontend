import type { HeatPoint, HeatmapBreakdownItem } from "@/services/statsService";

const EARTH_RADIUS_METERS = 6371000;

const toRadians = (value: number) => (value * Math.PI) / 180;

const haversineDistanceMeters = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number => {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const toBreakdownList = (
  entries: Map<string, { count: number; weight: number }>,
  totalWeight: number,
  limit: number,
): HeatmapBreakdownItem[] =>
  Array.from(entries.entries())
    .map(([label, data]) => ({
      label,
      count: data.count,
      weight: Number(data.weight.toFixed(2)),
      percentage:
        totalWeight > 0 ? Number(((data.weight / totalWeight) * 100).toFixed(2)) : 0,
    }))
    .sort((a, b) => b.weight - a.weight || b.count - a.count)
    .slice(0, limit);

const estimateClusterRadius = (points: HeatPoint[]): number => {
  if (points.length <= 1) {
    return 220;
  }

  let minLat = points[0].lat;
  let maxLat = points[0].lat;
  let minLng = points[0].lng;
  let maxLng = points[0].lng;

  for (const point of points) {
    if (point.lat < minLat) minLat = point.lat;
    if (point.lat > maxLat) maxLat = point.lat;
    if (point.lng < minLng) minLng = point.lng;
    if (point.lng > maxLng) maxLng = point.lng;
  }

  const avgLat = (minLat + maxLat) / 2;
  const latMeters = Math.abs(maxLat - minLat) * 111320;
  const lngMeters = Math.abs(maxLng - minLng) * 111320 * Math.cos(toRadians(avgLat));
  const diagonalMeters = Math.sqrt(latMeters ** 2 + lngMeters ** 2);
  if (!Number.isFinite(diagonalMeters) || diagonalMeters === 0) {
    return 220;
  }

  const baseRadius = diagonalMeters / Math.sqrt(points.length);
  return clamp(baseRadius, 120, 1800);
};

const updateBreakdown = (
  map: Map<string, { count: number; weight: number }>,
  label: string | null | undefined,
  weight: number,
) => {
  if (!label) return;
  const normalized = label.trim();
  if (!normalized) return;
  const current = map.get(normalized) ?? { count: 0, weight: 0 };
  current.count += 1;
  current.weight += weight;
  map.set(normalized, current);
};

const parseDate = (value: string | null | undefined): number | null => {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
};

interface ClusterAccumulator {
  id: string;
  lat: number;
  lng: number;
  sumLatWeight: number;
  sumLngWeight: number;
  totalWeight: number;
  clusterSize: number;
  maxDistanceMeters: number;
  tickets: Set<string>;
  categorias: Map<string, { count: number; weight: number }>;
  barrios: Map<string, { count: number; weight: number }>;
  estados: Map<string, { count: number; weight: number }>;
  tipos: Map<string, { count: number; weight: number }>;
  severidades: Map<string, { count: number; weight: number }>;
  latestTicketTimestamp: number | null;
  representative?: HeatPoint & { weight: number };
}

export interface ClusterOptions {
  radiusMeters?: number;
  maxBreakdownItems?: number;
  maxTicketSamples?: number;
}

export function clusterHeatmapPoints(
  rawPoints: HeatPoint[] | undefined,
  options: ClusterOptions = {},
): HeatPoint[] {
  const points = (rawPoints ?? []).filter(
    (point): point is HeatPoint & { lat: number; lng: number } =>
      Boolean(point) &&
      Number.isFinite(point.lat) &&
      Number.isFinite(point.lng),
  );

  if (!points.length) {
    return [];
  }

  const alreadyClustered = points.every(
    (point) => point.source === "cell" || typeof point.clusterId === "string" || typeof (point as any).cellId === "string",
  );

  if (alreadyClustered) {
    return points.map((point, index) => {
      const totalWeight = Number.isFinite(point.totalWeight)
        ? Number(point.totalWeight)
        : Number.isFinite(point.weight)
        ? Number(point.weight)
        : 1;
      const inferredSize =
        point.clusterSize ??
        point.pointCount ??
        (Number.isFinite(point.weight) ? Math.max(1, Math.round(Number(point.weight))) : 1);
      const clusterSize = inferredSize > 0 ? inferredSize : 1;
      const averageWeight =
        point.averageWeight ?? Number((totalWeight / (clusterSize || 1)).toFixed(2));
      const radiusMeters = point.radiusMeters ?? clamp(Math.sqrt(clusterSize || 1) * 85, 80, 2000);

      return {
        ...point,
        clusterId: point.clusterId ?? point.cellId ?? `cluster-${index + 1}`,
        clusterSize,
        totalWeight,
        averageWeight,
        radiusMeters,
        source: point.source ?? "cell",
      } satisfies HeatPoint;
    });
  }

  const radiusMeters = clamp(
    options.radiusMeters ?? estimateClusterRadius(points),
    80,
    2000,
  );
  const maxBreakdownItems = options.maxBreakdownItems ?? 5;
  const maxTicketSamples = options.maxTicketSamples ?? 5;

  const clusters: ClusterAccumulator[] = [];

  for (const point of points) {
    const weight = Number.isFinite(point.weight) && (point.weight ?? 0) > 0 ? point.weight ?? 1 : 1;

    let bestCluster: ClusterAccumulator | null = null;
    let bestDistance = Infinity;

    for (const cluster of clusters) {
      const distance = haversineDistanceMeters(point.lat, point.lng, cluster.lat, cluster.lng);
      if (distance <= radiusMeters && distance < bestDistance) {
        bestCluster = cluster;
        bestDistance = distance;
      }
    }

    if (!bestCluster) {
      const newCluster: ClusterAccumulator = {
        id: `cluster-${clusters.length + 1}`,
        lat: point.lat,
        lng: point.lng,
        sumLatWeight: point.lat * weight,
        sumLngWeight: point.lng * weight,
        totalWeight: weight,
        clusterSize: 1,
        maxDistanceMeters: 0,
        tickets: new Set(point.ticket ? [point.ticket] : []),
        categorias: new Map(),
        barrios: new Map(),
        estados: new Map(),
        tipos: new Map(),
        severidades: new Map(),
        latestTicketTimestamp: parseDate(point.last_ticket_at),
        representative: { ...point, weight },
      };

      updateBreakdown(newCluster.categorias, point.categoria, weight);
      updateBreakdown(newCluster.barrios, point.barrio ?? point.distrito, weight);
      updateBreakdown(newCluster.estados, point.estado, weight);
      updateBreakdown(newCluster.tipos, point.tipo_ticket, weight);
      updateBreakdown(newCluster.severidades, point.severidad, weight);
      clusters.push(newCluster);
      continue;
    }

    bestCluster.clusterSize += 1;
    bestCluster.totalWeight += weight;
    bestCluster.sumLatWeight += point.lat * weight;
    bestCluster.sumLngWeight += point.lng * weight;
    bestCluster.lat = bestCluster.sumLatWeight / bestCluster.totalWeight;
    bestCluster.lng = bestCluster.sumLngWeight / bestCluster.totalWeight;
    bestCluster.maxDistanceMeters = Math.max(bestCluster.maxDistanceMeters, bestDistance);
    if (point.ticket) {
      bestCluster.tickets.add(point.ticket);
    }

    updateBreakdown(bestCluster.categorias, point.categoria, weight);
    updateBreakdown(bestCluster.barrios, point.barrio ?? point.distrito, weight);
    updateBreakdown(bestCluster.estados, point.estado, weight);
    updateBreakdown(bestCluster.tipos, point.tipo_ticket, weight);
    updateBreakdown(bestCluster.severidades, point.severidad, weight);

    const candidateTimestamp = parseDate(point.last_ticket_at);
    if (
      candidateTimestamp !== null &&
      (bestCluster.latestTicketTimestamp === null || candidateTimestamp > bestCluster.latestTicketTimestamp)
    ) {
      bestCluster.latestTicketTimestamp = candidateTimestamp;
    }

    if (bestCluster.representative) {
      const rep = bestCluster.representative;
      const repWeight = rep.weight ?? 1;
      if (weight > repWeight) {
        bestCluster.representative = { ...point, weight };
      } else if (weight === repWeight) {
        const repTimestamp = parseDate(rep.last_ticket_at);
        if (
          candidateTimestamp !== null &&
          (repTimestamp === null || candidateTimestamp > repTimestamp)
        ) {
          bestCluster.representative = { ...point, weight };
        }
      }
    } else {
      bestCluster.representative = { ...point, weight };
    }
  }

  return clusters.map((cluster) => {
    const totalWeight = Number(cluster.totalWeight.toFixed(2));
    const averageWeight = Number((cluster.totalWeight / cluster.clusterSize).toFixed(2));
    const categorias = toBreakdownList(cluster.categorias, cluster.totalWeight, maxBreakdownItems);
    const barrios = toBreakdownList(cluster.barrios, cluster.totalWeight, maxBreakdownItems);
    const estados = toBreakdownList(cluster.estados, cluster.totalWeight, maxBreakdownItems);
    const tipos = toBreakdownList(cluster.tipos, cluster.totalWeight, maxBreakdownItems);
    const severidades = toBreakdownList(cluster.severidades, cluster.totalWeight, maxBreakdownItems);

    const representative = cluster.representative;

    return {
      ...representative,
      lat: cluster.lat,
      lng: cluster.lng,
      weight: totalWeight,
      totalWeight,
      averageWeight,
      clusterId: cluster.id,
      clusterSize: cluster.clusterSize,
      radiusMeters,
      maxDistanceMeters: Number(cluster.maxDistanceMeters.toFixed(2)),
      sampleTickets: Array.from(cluster.tickets).slice(0, maxTicketSamples),
      aggregatedCategorias: categorias,
      aggregatedBarrios: barrios,
      aggregatedEstados: estados,
      aggregatedTipos: tipos,
      aggregatedSeveridades: severidades,
      last_ticket_at:
        cluster.latestTicketTimestamp !== null
          ? new Date(cluster.latestTicketTimestamp).toISOString()
          : representative?.last_ticket_at ?? null,
    } satisfies HeatPoint;
  });
}

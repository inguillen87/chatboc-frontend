import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/utils/api';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ChartContainer } from '@/components/ui/chart';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Button } from '@/components/ui/button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import useRequireRole from '@/hooks/useRequireRole';
import type { Role } from '@/utils/roles';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface StatItem {
  label: string;
  value: number;
  unit?: string;
}

type CountMetric = {
  name: string;
  count: number;
};

type ValueMetric = {
  name: string;
  value: number;
};

interface MonthlyTrendMetric {
  month: string;
  label: string;
  nuevos: number;
  resueltos: number;
  vencidos: number;
  reabiertos: number;
}

interface SatisfactionTrendMetric {
  month: string;
  label: string;
  average: number;
}

interface BacklogMetric {
  range: string;
  count: number;
}

interface CategoryResolutionMetric {
  category: string;
  avgHours: number;
}

interface HeatmapCell {
  timeSlot: string;
  count: number;
}

interface HeatmapRow {
  day: string;
  slots: HeatmapCell[];
}

interface AgentPerformanceMetric {
  agent: string;
  tickets: number;
  resolved: number;
  sla: number;
  satisfaction: number;
  firstResponse: number;
}

interface StatsResponse {
  stats: StatItem[];
  categoryBreakdown?: CountMetric[];
  statusBreakdown?: ValueMetric[];
  priorityBreakdown?: CountMetric[];
  channelBreakdown?: CountMetric[];
  barrioBreakdown?: CountMetric[];
  monthlyTrend?: MonthlyTrendMetric[];
  satisfactionTrend?: SatisfactionTrendMetric[];
  satisfactionSummary?: {
    average: number;
    nps: number;
    promoters: number;
    passives: number;
    detractors: number;
    responseRate: number;
  };
  satisfactionDistribution?: ValueMetric[];
  heatmap?: HeatmapRow[];
  backlogAging?: BacklogMetric[];
  categoryResolution?: CategoryResolutionMetric[];
  agentPerformance?: AgentPerformanceMetric[];
}

interface FallbackFilters {
  rubros: string[];
  barrios: string[];
  tipos: string[];
  rangos: string[];
}

interface FilterState {
  rubro?: string;
  barrio?: string;
  tipo?: string;
  rango?: string;
}

interface TicketRecord {
  id: string;
  rubro: string;
  barrio: string;
  tipo: string;
  status: string;
  category: string;
  priority: string;
  channel: string;
  createdAt: Date;
  resolvedAt?: Date;
  resolutionTimeHours: number;
  satisfaction: number;
  firstResponseHours: number;
  reopened: boolean;
  surveyResponded: boolean;
  agent: string;
}

const FALLBACK_FILTERS: FallbackFilters = {
  rubros: [
    'Atención ciudadana',
    'Servicios públicos',
    'Obras urbanas',
    'Ambiente',
    'Seguridad',
  ],
  barrios: [
    'Centro',
    'Norte',
    'Sur',
    'Este',
    'Oeste',
    'Ribera',
    'Universidad',
    'Industrial',
  ],
  tipos: ['Reclamo', 'Sugerencia', 'Incidente', 'Consulta', 'Seguimiento'],
  rangos: [
    'Últimos 7 días',
    'Últimos 30 días',
    'Últimos 90 días',
    'Últimos 180 días',
    'Último año',
    'Histórico',
  ],
};

const FALLBACK_RANGE_MAP: Record<string, number | null> = {
  Histórico: null,
  'Último año': 365,
  'Últimos 180 días': 180,
  'Últimos 90 días': 90,
  'Últimos 30 días': 30,
  'Últimos 7 días': 7,
};

const FALLBACK_DAYS = [
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
  'Domingo',
];

const FALLBACK_TIME_SLOTS = ['Mañana', 'Mediodía', 'Tarde', 'Noche'];

const FALLBACK_PIE_COLORS = [
  '#2563eb',
  '#16a34a',
  '#f97316',
  '#a855f7',
  '#0ea5e9',
  '#f43f5e',
  '#facc15',
  '#10b981',
];

const FALLBACK_CATEGORIES_BY_RUBRO: Record<string, string[]> = {
  'Atención ciudadana': [
    'Documentación',
    'Turnos virtuales',
    'Asistencia social',
    'Gestiones online',
  ],
  'Servicios públicos': [
    'Alumbrado',
    'Recolección',
    'Transporte',
    'Agua y saneamiento',
    'Espacios verdes',
  ],
  'Obras urbanas': [
    'Bacheo',
    'Cloacas',
    'Cordón cuneta',
    'Veredas',
    'Planificación urbana',
  ],
  Ambiente: [
    'Arbolado',
    'Residuos especiales',
    'Control animal',
    'Limpieza de arroyos',
    'Educación ambiental',
  ],
  Seguridad: [
    'Prevención',
    'Tránsito',
    'Emergencias',
    'Monitoreo urbano',
    'Seguridad vial',
  ],
};

const FALLBACK_STATUSES = [
  'Nuevo',
  'Asignado',
  'En progreso',
  'Derivado',
  'En espera',
  'Resuelto',
  'Cerrado',
  'Vencido',
  'Reabierto',
];

const FALLBACK_PRIORITIES = ['Alta', 'Media', 'Baja'];

const FALLBACK_CHANNELS = [
  'Web',
  'App móvil',
  'Oficina',
  'Teléfono',
  'Redes sociales',
  'Email',
];

const FALLBACK_AGENTS = [
  'Equipo Centro',
  'Equipo Norte',
  'Equipo Sur',
  'Mesa Digital',
  'Gestión Integral',
  'Supervisión',
];

const RESOLVED_STATUSES = new Set(['Resuelto', 'Cerrado']);

const FALLBACK_TICKETS = generateSyntheticTickets();

function createRandom(seed: number) {
  let value = seed % 2147483647;
  if (value <= 0) {
    value += 2147483646;
  }
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

function determineTimeSlot(hour: number) {
  if (hour < 11) return 'Mañana';
  if (hour < 14) return 'Mediodía';
  if (hour < 19) return 'Tarde';
  return 'Noche';
}

function formatMonthLabel(year: number, month: number) {
  const months = [
    'Ene',
    'Feb',
    'Mar',
    'Abr',
    'May',
    'Jun',
    'Jul',
    'Ago',
    'Sep',
    'Oct',
    'Nov',
    'Dic',
  ];
  return `${months[month]} ${year}`;
}

function createEmptyHeatmap(): HeatmapRow[] {
  return FALLBACK_DAYS.map((day) => ({
    day,
    slots: FALLBACK_TIME_SLOTS.map((timeSlot) => ({ timeSlot, count: 0 })),
  }));
}

function generateSyntheticTickets(count = 360): TicketRecord[] {
  const random = createRandom(20240830);
  const now = new Date();
  const tickets: TicketRecord[] = [];

  for (let i = 0; i < count; i += 1) {
    const rubro = FALLBACK_FILTERS.rubros[i % FALLBACK_FILTERS.rubros.length];
    const barrios = FALLBACK_FILTERS.barrios;
    const barrio = barrios[(i * 5 + 3) % barrios.length];
    const tipos = FALLBACK_FILTERS.tipos;
    const tipo = tipos[(i * 7 + 1) % tipos.length];

    const statusRoll = random();
    let status = 'Nuevo';
    if (statusRoll < 0.32) status = 'Resuelto';
    else if (statusRoll < 0.57) status = 'Cerrado';
    else if (statusRoll < 0.72) status = 'En progreso';
    else if (statusRoll < 0.82) status = 'Asignado';
    else if (statusRoll < 0.9) status = 'Derivado';
    else if (statusRoll < 0.95) status = 'Vencido';
    else status = 'Reabierto';

    const categoryList = FALLBACK_CATEGORIES_BY_RUBRO[rubro] || ['General'];
    const category =
      categoryList[(i * 13 + 5) % categoryList.length];
    const priority =
      FALLBACK_PRIORITIES[(i * 17 + 4) % FALLBACK_PRIORITIES.length];
    const channel = FALLBACK_CHANNELS[(i * 19 + 6) % FALLBACK_CHANNELS.length];
    const agent = FALLBACK_AGENTS[(i * 23 + 1) % FALLBACK_AGENTS.length];

    const daysAgo = Math.floor(random() * 365);
    const createdAt = new Date(now.getTime() - daysAgo * 86400000);
    const hour = Math.floor(random() * 24);
    createdAt.setHours(hour, Math.floor(random() * 60), 0, 0);

    let resolutionTimeHours = Math.round(24 + random() * 60);
    let resolvedAt: Date | undefined;
    if (RESOLVED_STATUSES.has(status) || status === 'Reabierto') {
      const priorityFactor =
        priority === 'Alta' ? 0.75 : priority === 'Media' ? 0.95 : 1.2;
      resolutionTimeHours = Math.max(
        4,
        Math.round((18 + random() * 72) * priorityFactor),
      );
      resolvedAt = new Date(
        createdAt.getTime() + resolutionTimeHours * 3600000,
      );
      if (resolvedAt.getTime() > now.getTime()) {
        resolvedAt = new Date(
          now.getTime() - Math.round(random() * 72) * 3600000,
        );
        resolutionTimeHours = Math.max(
          3,
          Math.round(
            (resolvedAt.getTime() - createdAt.getTime()) / 3600000,
          ),
        );
      }
    } else if (status === 'Vencido') {
      resolutionTimeHours = Math.round(80 + random() * 120);
    }

    const reopened = status === 'Reabierto' || random() < 0.07;
    const surveyResponded = random() < 0.7;

    const firstResponseHours = Math.max(
      1,
      Math.round(
        (1.5 + random() * 6) *
          (priority === 'Alta' ? 0.6 : priority === 'Baja' ? 1.3 : 1),
      ),
    );

    const satisfactionBase = resolvedAt
      ? 3.4 + random() * 1.5 - (priority === 'Baja' ? 0.2 : 0) - (reopened ? 0.4 : 0)
      : 2.6 + random() * 0.8;
    const satisfaction = Number(
      Math.min(5, Math.max(1.5, satisfactionBase)).toFixed(2),
    );

    tickets.push({
      id: `T-${createdAt.getFullYear()}-${String(i + 1).padStart(4, '0')}`,
      rubro,
      barrio,
      tipo,
      status,
      category,
      priority,
      channel,
      createdAt,
      resolvedAt,
      resolutionTimeHours,
      satisfaction,
      firstResponseHours,
      reopened,
      surveyResponded,
      agent,
    });
  }

  return tickets;
}

function formatValue(value: number) {
  if (Number.isNaN(value)) return '0';
  if (Number.isInteger(value)) return value.toLocaleString('es-AR');
  return value.toLocaleString('es-AR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  });
}

function getFallbackFilters(): FallbackFilters {
  return {
    rubros: [...FALLBACK_FILTERS.rubros],
    barrios: [...FALLBACK_FILTERS.barrios],
    tipos: [...FALLBACK_FILTERS.tipos],
    rangos: [...FALLBACK_FILTERS.rangos],
  };
}

function buildFallbackStats(filters: FilterState): StatsResponse {
  const now = new Date();
  const rangeKey =
    filters.rango && filters.rango in FALLBACK_RANGE_MAP
      ? filters.rango
      : 'Histórico';
  const daysRange = FALLBACK_RANGE_MAP[rangeKey ?? 'Histórico'];
  const cutoff =
    typeof daysRange === 'number'
      ? new Date(now.getTime() - daysRange * 86400000)
      : null;

  const filteredTickets = FALLBACK_TICKETS.filter((ticket) => {
    if (filters.rubro && ticket.rubro !== filters.rubro) return false;
    if (filters.barrio && ticket.barrio !== filters.barrio) return false;
    if (filters.tipo && ticket.tipo !== filters.tipo) return false;
    if (cutoff && ticket.createdAt < cutoff) return false;
    return true;
  });

  if (filteredTickets.length === 0) {
    return {
      stats: [
        { label: 'Tickets registrados', value: 0 },
        { label: 'Tickets resueltos', value: 0 },
        { label: 'Tickets cerrados', value: 0 },
        { label: 'Tickets vencidos', value: 0 },
        { label: 'Tickets pendientes', value: 0 },
        { label: 'Satisfacción promedio', value: 0 },
      ],
      heatmap: createEmptyHeatmap(),
      backlogAging: [
        '0-3 días',
        '4-7 días',
        '8-15 días',
        '16-30 días',
        '31-60 días',
        '+60 días',
      ].map((range) => ({ range, count: 0 })),
      agentPerformance: [],
      categoryBreakdown: [],
      statusBreakdown: [],
      priorityBreakdown: [],
      channelBreakdown: [],
      barrioBreakdown: [],
      satisfactionDistribution: [],
      satisfactionTrend: [],
      monthlyTrend: [],
      categoryResolution: [],
      satisfactionSummary: {
        average: 0,
        detractors: 0,
        passives: 0,
        promoters: 0,
        nps: 0,
        responseRate: 0,
      },
    };
  }

  const resolvedTickets = filteredTickets.filter((ticket) =>
    RESOLVED_STATUSES.has(ticket.status),
  );
  const closedTickets = filteredTickets.filter(
    (ticket) => ticket.status === 'Cerrado',
  );
  const expiredTickets = filteredTickets.filter(
    (ticket) => ticket.status === 'Vencido',
  );
  const newTickets = filteredTickets.filter(
    (ticket) => ticket.status === 'Nuevo',
  );
  const pendingTickets = filteredTickets.length - resolvedTickets.length;
  const reopenedTickets = filteredTickets.filter((ticket) => ticket.reopened);
  const surveyResponses = filteredTickets.filter(
    (ticket) => ticket.surveyResponded,
  ).length;

  const avgResolution = resolvedTickets.length
    ? resolvedTickets.reduce(
        (sum, ticket) => sum + ticket.resolutionTimeHours,
        0,
      ) / resolvedTickets.length
    : 0;
  const avgFirstResponse =
    filteredTickets.reduce(
      (sum, ticket) => sum + ticket.firstResponseHours,
      0,
    ) / filteredTickets.length;

  const satisfactionValues = resolvedTickets.map(
    (ticket) => ticket.satisfaction,
  );
  const avgSatisfaction = satisfactionValues.length
    ? satisfactionValues.reduce((sum, value) => sum + value, 0) /
      satisfactionValues.length
    : 0;
  const promoters = satisfactionValues.filter((value) => value >= 4.5).length;
  const detractors = satisfactionValues.filter((value) => value < 3).length;
  const passives = Math.max(
    satisfactionValues.length - promoters - detractors,
    0,
  );
  const nps = satisfactionValues.length
    ? Math.round(
        ((promoters - detractors) / satisfactionValues.length) * 100,
      )
    : 0;

  const slaThreshold = 72;
  const slaCompliance = resolvedTickets.filter(
    (ticket) => ticket.resolutionTimeHours <= slaThreshold,
  ).length;
  const slaPercent = resolvedTickets.length
    ? Math.round((slaCompliance / resolvedTickets.length) * 100)
    : 0;

  const stats: StatItem[] = [
    { label: 'Tickets registrados', value: filteredTickets.length },
    { label: 'Tickets resueltos', value: resolvedTickets.length },
    { label: 'Tickets cerrados', value: closedTickets.length },
    { label: 'Tickets vencidos', value: expiredTickets.length },
    { label: 'Tickets nuevos', value: newTickets.length },
    { label: 'Tickets pendientes', value: pendingTickets },
    { label: 'Tickets reabiertos', value: reopenedTickets.length },
    { label: 'Cumplimiento SLA', value: slaPercent, unit: '%' },
    {
      label: 'Tiempo resolución promedio',
      value: Number(avgResolution.toFixed(1)),
      unit: 'h',
    },
    {
      label: 'Primer respuesta promedio',
      value: Number(avgFirstResponse.toFixed(1)),
      unit: 'h',
    },
    {
      label: 'Satisfacción promedio',
      value: Number(avgSatisfaction.toFixed(2)),
    },
    { label: 'Encuestas respondidas', value: surveyResponses },
  ];

  const countBy = (
    items: TicketRecord[],
    selector: (ticket: TicketRecord) => string,
  ) => {
    const counts = new Map<string, number>();
    items.forEach((ticket) => {
      const key = selector(ticket);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  };

  const categoryBreakdown = countBy(
    filteredTickets,
    (ticket) => ticket.category,
  ).slice(0, 12);
  const statusCounts = new Map<string, number>();
  FALLBACK_STATUSES.forEach((status) => statusCounts.set(status, 0));
  filteredTickets.forEach((ticket) => {
    statusCounts.set(
      ticket.status,
      (statusCounts.get(ticket.status) ?? 0) + 1,
    );
  });
  const statusBreakdown: ValueMetric[] = Array.from(statusCounts.entries())
    .map(([name, value]) => ({ name, value }))
    .filter((entry) => entry.value > 0)
    .sort((a, b) => b.value - a.value);

  const priorityBreakdown = countBy(
    filteredTickets,
    (ticket) => ticket.priority,
  );
  const channelBreakdown = countBy(
    filteredTickets,
    (ticket) => ticket.channel,
  );
  const barrioBreakdown = countBy(
    filteredTickets,
    (ticket) => ticket.barrio,
  ).slice(0, 10);

  const monthlyMap = new Map<string, MonthlyTrendMetric>();
  filteredTickets.forEach((ticket) => {
    const createdMonthKey = `${ticket.createdAt.getFullYear()}-${String(
      ticket.createdAt.getMonth() + 1,
    ).padStart(2, '0')}`;
    const createdLabel = formatMonthLabel(
      ticket.createdAt.getFullYear(),
      ticket.createdAt.getMonth(),
    );
    if (!monthlyMap.has(createdMonthKey)) {
      monthlyMap.set(createdMonthKey, {
        month: createdMonthKey,
        label: createdLabel,
        nuevos: 0,
        resueltos: 0,
        vencidos: 0,
        reabiertos: 0,
      });
    }
    const monthData = monthlyMap.get(createdMonthKey)!;
    monthData.nuevos += 1;
    if (ticket.status === 'Vencido') monthData.vencidos += 1;
    if (ticket.status === 'Reabierto' || ticket.reopened)
      monthData.reabiertos += 1;

    if (ticket.resolvedAt && RESOLVED_STATUSES.has(ticket.status)) {
      const resolvedMonthKey = `${ticket.resolvedAt.getFullYear()}-${String(
        ticket.resolvedAt.getMonth() + 1,
      ).padStart(2, '0')}`;
      const resolvedLabel = formatMonthLabel(
        ticket.resolvedAt.getFullYear(),
        ticket.resolvedAt.getMonth(),
      );
      if (!monthlyMap.has(resolvedMonthKey)) {
        monthlyMap.set(resolvedMonthKey, {
          month: resolvedMonthKey,
          label: resolvedLabel,
          nuevos: 0,
          resueltos: 0,
          vencidos: 0,
          reabiertos: 0,
        });
      }
      const resolvedMonth = monthlyMap.get(resolvedMonthKey)!;
      resolvedMonth.resueltos += 1;
    } else if (RESOLVED_STATUSES.has(ticket.status)) {
      monthData.resueltos += 1;
    }
  });

  const monthlyTrend = Array.from(monthlyMap.values())
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-12);

  const satisfactionMap = new Map<
    string,
    { month: string; label: string; total: number; count: number }
  >();
  resolvedTickets.forEach((ticket) => {
    const date = ticket.resolvedAt ?? ticket.createdAt;
    const key = `${date.getFullYear()}-${String(
      date.getMonth() + 1,
    ).padStart(2, '0')}`;
    const label = formatMonthLabel(date.getFullYear(), date.getMonth());
    if (!satisfactionMap.has(key)) {
      satisfactionMap.set(key, { month: key, label, total: 0, count: 0 });
    }
    const entry = satisfactionMap.get(key)!;
    entry.total += ticket.satisfaction;
    entry.count += 1;
  });

  const satisfactionTrend = Array.from(satisfactionMap.values())
    .map((entry) => ({
      month: entry.month,
      label: entry.label,
      average: Number((entry.total / entry.count).toFixed(2)),
    }))
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-12);

  const heatmap = createEmptyHeatmap();
  const heatmapIndex = new Map<string, HeatmapCell>();
  heatmap.forEach((row) => {
    row.slots.forEach((slot) => {
      heatmapIndex.set(`${row.day}-${slot.timeSlot}`, slot);
    });
  });
  filteredTickets.forEach((ticket) => {
    const dayIndex = (ticket.createdAt.getDay() + 6) % 7;
    const day = FALLBACK_DAYS[dayIndex];
    const timeSlot = determineTimeSlot(ticket.createdAt.getHours());
    const key = `${day}-${timeSlot}`;
    const cell = heatmapIndex.get(key);
    if (cell) cell.count += 1;
  });

  const backlogBuckets: { label: string; max: number }[] = [
    { label: '0-3 días', max: 3 },
    { label: '4-7 días', max: 7 },
    { label: '8-15 días', max: 15 },
    { label: '16-30 días', max: 30 },
    { label: '31-60 días', max: 60 },
    { label: '+60 días', max: Infinity },
  ];
  const backlogCounts = backlogBuckets.map(() => 0);
  filteredTickets
    .filter((ticket) => !RESOLVED_STATUSES.has(ticket.status))
    .forEach((ticket) => {
      const diff = Math.floor(
        (now.getTime() - ticket.createdAt.getTime()) / 86400000,
      );
      const index = backlogBuckets.findIndex((bucket) => diff <= bucket.max);
      if (index >= 0) backlogCounts[index] += 1;
    });
  const backlogAging = backlogBuckets.map((bucket, index) => ({
    range: bucket.label,
    count: backlogCounts[index],
  }));

  const categoryResolution = resolvedTickets.length
    ? (() => {
        const totals = new Map<string, { total: number; count: number }>();
        resolvedTickets.forEach((ticket) => {
          const entry = totals.get(ticket.category) ?? { total: 0, count: 0 };
          entry.total += ticket.resolutionTimeHours;
          entry.count += 1;
          totals.set(ticket.category, entry);
        });
        return Array.from(totals.entries())
          .map(([category, { total, count }]) => ({
            category,
            avgHours: Number((total / count).toFixed(1)),
          }))
          .sort((a, b) => a.avgHours - b.avgHours)
          .slice(0, 10);
      })()
    : [];

  const agentPerformance = (() => {
    const agents = new Map<
      string,
      {
        tickets: number;
        resolved: number;
        satisfactionTotal: number;
        satisfactionCount: number;
        firstResponseTotal: number;
        sla: number;
      }
    >();
    filteredTickets.forEach((ticket) => {
      const agent = agents.get(ticket.agent) ?? {
        tickets: 0,
        resolved: 0,
        satisfactionTotal: 0,
        satisfactionCount: 0,
        firstResponseTotal: 0,
        sla: 0,
      };
      agent.tickets += 1;
      agent.firstResponseTotal += ticket.firstResponseHours;
      if (RESOLVED_STATUSES.has(ticket.status)) {
        agent.resolved += 1;
        agent.satisfactionTotal += ticket.satisfaction;
        agent.satisfactionCount += 1;
        if (ticket.resolutionTimeHours <= slaThreshold) agent.sla += 1;
      }
      agents.set(ticket.agent, agent);
    });
    return Array.from(agents.entries())
      .map(([agent, value]) => ({
        agent,
        tickets: value.tickets,
        resolved: value.resolved,
        sla: value.resolved
          ? Math.round((value.sla / value.resolved) * 100)
          : 0,
        satisfaction: value.satisfactionCount
          ? Number(
              (value.satisfactionTotal / value.satisfactionCount).toFixed(2),
            )
          : 0,
        firstResponse: value.tickets
          ? Number((value.firstResponseTotal / value.tickets).toFixed(1))
          : 0,
      }))
      .sort((a, b) => b.resolved - a.resolved)
      .slice(0, 6);
  })();

  const satisfactionDistribution: ValueMetric[] = [
    { name: 'Promotores', value: promoters },
    { name: 'Pasivos', value: passives },
    { name: 'Detractores', value: detractors },
  ];

  return {
    stats,
    categoryBreakdown,
    statusBreakdown,
    priorityBreakdown,
    channelBreakdown,
    barrioBreakdown,
    monthlyTrend,
    satisfactionTrend,
    satisfactionSummary: {
      average: Number(avgSatisfaction.toFixed(2)),
      nps,
      promoters,
      passives,
      detractors,
      responseRate: Math.round(
        (surveyResponses / filteredTickets.length) * 100,
      ),
    },
    satisfactionDistribution,
    heatmap,
    backlogAging,
    categoryResolution,
    agentPerformance,
  };
}

export default function MunicipalStats() {
  useRequireRole(['admin', 'super_admin'] as Role[]);
  const [data, setData] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rubros, setRubros] = useState<string[]>([]);
  const [barrios, setBarrios] = useState<string[]>([]);
  const [tipos, setTipos] = useState<string[]>([]);
  const [rangos, setRangos] = useState<string[]>([]);
  const [filtroRubro, setFiltroRubro] = useState('');
  const [filtroBarrio, setFiltroBarrio] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroRango, setFiltroRango] = useState('');
  const [usingFallback, setUsingFallback] = useState(false);

  useEffect(() => {
    let active = true;
    apiFetch<{
      rubros: string[];
      barrios: string[];
      tipos: string[];
      rangos: string[];
    }>('/municipal/stats/filters')
      .then((resp) => {
        if (!active) return;
        setRubros(resp.rubros || []);
        setBarrios(resp.barrios || []);
        setTipos(resp.tipos || []);
        setRangos(resp.rangos || []);
      })
      .catch((err) => {
        console.warn('Using fallback filters for municipal stats', err);
        if (!active) return;
        const fallback = getFallbackFilters();
        setRubros(fallback.rubros);
        setBarrios(fallback.barrios);
        setTipos(fallback.tipos);
        setRangos(fallback.rangos);
      });
    return () => {
      active = false;
    };
  }, []);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (filtroRubro) params.append('rubro', filtroRubro);
    if (filtroBarrio) params.append('barrio', filtroBarrio);
    if (filtroTipo) params.append('tipo', filtroTipo);
    if (filtroRango) params.append('rango', filtroRango);

    try {
      const resp = await apiFetch<StatsResponse>(
        `/municipal/stats?${params.toString()}`,
      );
      setData(resp);
      setUsingFallback(false);
    } catch (err) {
      console.warn('Using synthetic municipal stats fallback', err);
      const fallbackData = buildFallbackStats({
        rubro: filtroRubro || undefined,
        barrio: filtroBarrio || undefined,
        tipo: filtroTipo || undefined,
        rango: filtroRango || undefined,
      });
      setData(fallbackData);
      setUsingFallback(true);
      setError(null);
    } finally {
      setLoading(false);
    }
  }, [filtroRubro, filtroBarrio, filtroTipo, filtroRango]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const heatmapMax = useMemo(() => {
    if (!data?.heatmap?.length) return 0;
    return data.heatmap.reduce((max, row) => {
      const rowMax = row.slots.reduce(
        (slotMax, slot) => Math.max(slotMax, slot.count),
        0,
      );
      return Math.max(max, rowMax);
    }, 0);
  }, [data]);

  const timeSlots =
    data?.heatmap?.[0]?.slots.map((slot) => slot.timeSlot) || FALLBACK_TIME_SLOTS;

  if (loading)
    return <p className="p-4 text-center">Cargando estadísticas...</p>;
  if (error)
    return (
      <p className="p-4 text-destructive text-center">Error: {error}</p>
    );
  if (!data || !Array.isArray(data.stats) || data.stats.length === 0)
    return (
      <p className="p-4 text-center text-muted-foreground">
        No hay estadísticas disponibles con los filtros actuales.
      </p>
    );

  return (
    <div className="p-4 max-w-6xl mx-auto space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-extrabold text-primary">
          Estadísticas Municipales
        </h1>
        {usingFallback ? (
          <p className="text-sm text-muted-foreground bg-muted/60 border border-dashed border-border rounded-md p-3">
            Mostrando analíticas simuladas mientras se restablece la conexión
            con el servidor.
          </p>
        ) : null}
      </div>

      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="filters">
          <AccordionTrigger>Filtros</AccordionTrigger>
          <AccordionContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              {rubros.length > 0 && (
                <Select value={filtroRubro} onValueChange={setFiltroRubro}>
                  <SelectTrigger>
                    <SelectValue placeholder="Rubro" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todos</SelectItem>
                    {rubros.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {barrios.length > 0 && (
                <Select value={filtroBarrio} onValueChange={setFiltroBarrio}>
                  <SelectTrigger>
                    <SelectValue placeholder="Barrio" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todos</SelectItem>
                    {barrios.map((b) => (
                      <SelectItem key={b} value={b}>
                        {b}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {tipos.length > 0 && (
                <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todos</SelectItem>
                    {tipos.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {rangos.length > 0 && (
                <Select value={filtroRango} onValueChange={setFiltroRango}>
                  <SelectTrigger>
                    <SelectValue placeholder="Período" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todos</SelectItem>
                    {rangos.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <Button onClick={fetchStats} className="w-full">
              Aplicar filtros
            </Button>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {data.stats.map((item) => (
          <Card key={item.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {item.label}
              </CardTitle>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                className="h-4 w-4 text-muted-foreground"
              >
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatValue(item.value)}
                {item.unit ? (
                  <span className="ml-1 text-sm font-semibold text-muted-foreground">
                    {item.unit}
                  </span>
                ) : null}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {data.categoryBreakdown?.length ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">
                Tickets por categoría
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ChartContainer
                  config={{ tickets: { label: 'Tickets', color: '#2563eb' } }}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={data.categoryBreakdown.map((item) => ({
                        name: item.name,
                        tickets: item.count,
                      }))}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tickFormatter={(value) => value.slice(0, 14)} />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Legend />
                      <Bar
                        dataKey="tickets"
                        fill="var(--color-tickets)"
                        radius={4}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {data.statusBreakdown?.length ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Tickets por estado</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ChartContainer config={{ estados: { label: 'Estado' } }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.statusBreakdown}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={60}
                        outerRadius={110}
                        paddingAngle={3}
                        label
                      >
                        {data.statusBreakdown.map((entry, index) => (
                          <Cell
                            key={entry.name}
                            fill={
                              FALLBACK_PIE_COLORS[index % FALLBACK_PIE_COLORS.length]
                            }
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {data.priorityBreakdown?.length ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Prioridad de tickets</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ChartContainer
                  config={{ tickets: { label: 'Tickets', color: '#0ea5e9' } }}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={data.priorityBreakdown.map((item) => ({
                        name: item.name,
                        tickets: item.count,
                      }))}
                      layout="vertical"
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" allowDecimals={false} />
                      <YAxis dataKey="name" type="category" width={90} />
                      <Tooltip />
                      <Bar
                        dataKey="tickets"
                        fill="var(--color-tickets)"
                        radius={4}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {data.channelBreakdown?.length ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Canales de ingreso</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ChartContainer
                  config={{ tickets: { label: 'Tickets', color: '#f97316' } }}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={data.channelBreakdown.map((item) => ({
                        name: item.name,
                        tickets: item.count,
                      }))}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tickFormatter={(value) => value.slice(0, 14)} />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Legend />
                      <Bar
                        dataKey="tickets"
                        fill="var(--color-tickets)"
                        radius={4}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>

      {data.monthlyTrend?.length ? (
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl">
              Evolución mensual de tickets
            </CardTitle>
            <CardDescription>
              Comparativo de tickets nuevos, resueltos, vencidos y reabiertos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-96">
              <ChartContainer
                config={{
                  nuevos: { label: 'Nuevos', color: '#2563eb' },
                  resueltos: { label: 'Resueltos', color: '#16a34a' },
                  vencidos: { label: 'Vencidos', color: '#f97316' },
                  reabiertos: { label: 'Reabiertos', color: '#f59e0b' },
                }}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.monthlyTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="nuevos"
                      stroke="var(--color-nuevos)"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="resueltos"
                      stroke="var(--color-resueltos)"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="vencidos"
                      stroke="var(--color-vencidos)"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="reabiertos"
                      stroke="var(--color-reabiertos)"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </ChartContainer>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {data.satisfactionTrend?.length || data.satisfactionDistribution?.length ? (
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl">
              Satisfacción de personas usuarias
            </CardTitle>
            <CardDescription>
              Seguimiento de encuestas, NPS y distribución de respuestas
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.satisfactionSummary ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-6 text-sm">
                <div className="rounded-md border p-3">
                  <p className="text-muted-foreground">Promedio general</p>
                  <p className="text-lg font-semibold">
                    {formatValue(data.satisfactionSummary.average)}
                  </p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-muted-foreground">NPS</p>
                  <p className="text-lg font-semibold">
                    {data.satisfactionSummary.nps}%
                  </p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-muted-foreground">Promotores</p>
                  <p className="text-lg font-semibold">
                    {data.satisfactionSummary.promoters}
                  </p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-muted-foreground">Tasa de respuesta</p>
                  <p className="text-lg font-semibold">
                    {data.satisfactionSummary.responseRate}%
                  </p>
                </div>
              </div>
            ) : null}
            <div className="grid gap-6 lg:grid-cols-2">
              {data.satisfactionTrend?.length ? (
                <div className="h-72">
                  <ChartContainer
                    config={{ average: { label: 'Promedio', color: '#0ea5e9' } }}
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={data.satisfactionTrend}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="label" />
                        <YAxis domain={[0, 5]} allowDecimals />
                        <Tooltip />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="average"
                          stroke="var(--color-average)"
                          strokeWidth={2}
                          dot
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </div>
              ) : null}

              {data.satisfactionDistribution?.length ? (
                <div className="h-72">
                  <ChartContainer config={{ distribucion: { label: 'Distribución' } }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={data.satisfactionDistribution}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={50}
                          outerRadius={110}
                          paddingAngle={4}
                          label
                        >
                          {data.satisfactionDistribution.map((entry, index) => (
                            <Cell
                              key={entry.name}
                              fill={
                                FALLBACK_PIE_COLORS[
                                  (index + 3) % FALLBACK_PIE_COLORS.length
                                ]
                              }
                            />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {data.heatmap?.length ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Mapa de calor de ingresos</CardTitle>
            <CardDescription>
              Distribución de tickets por día de la semana y franja horaria
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <div
                className="grid gap-2 text-xs sm:text-sm"
                style={{
                  gridTemplateColumns: `auto repeat(${timeSlots.length}, minmax(0, 1fr))`,
                }}
              >
                <div className="font-semibold text-muted-foreground" />
                {timeSlots.map((slot) => (
                  <div
                    key={slot}
                    className="text-center font-medium text-muted-foreground"
                  >
                    {slot}
                  </div>
                ))}
                {data.heatmap.map((row) => (
                  <React.Fragment key={row.day}>
                    <div className="flex items-center font-medium text-muted-foreground">
                      {row.day}
                    </div>
                    {timeSlots.map((slot) => {
                      const cell = row.slots.find((s) => s.timeSlot === slot);
                      const value = cell?.count ?? 0;
                      const intensity = heatmapMax ? value / heatmapMax : 0;
                      const background = `rgba(37, 99, 235, ${0.12 + intensity * 0.6})`;
                      const color = intensity > 0.55 ? 'var(--background)' : 'var(--foreground)';
                      return (
                        <div
                          key={`${row.day}-${slot}`}
                          className="rounded-md p-2 text-center font-semibold"
                          style={{ backgroundColor: background, color }}
                        >
                          {value}
                        </div>
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {data.barrioBreakdown?.length ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Volumen por zona</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ChartContainer
                  config={{ tickets: { label: 'Tickets', color: '#9333ea' } }}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={data.barrioBreakdown.map((item) => ({
                        name: item.name,
                        tickets: item.count,
                      }))}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tickFormatter={(value) => value.slice(0, 14)} />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Legend />
                      <Bar
                        dataKey="tickets"
                        fill="var(--color-tickets)"
                        radius={4}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {data.categoryResolution?.length ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">
                Tiempo de resolución por categoría
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ChartContainer
                  config={{ avgHours: { label: 'Horas', color: '#14b8a6' } }}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.categoryResolution}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="category"
                        tickFormatter={(value) => value.slice(0, 14)}
                      />
                      <YAxis allowDecimals />
                      <Tooltip
                        formatter={(value: number) => `${formatValue(value)} h`}
                      />
                      <Legend />
                      <Bar
                        dataKey="avgHours"
                        fill="var(--color-avgHours)"
                        radius={4}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>

      {data.backlogAging?.length ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">
              Antigüedad de tickets pendientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ChartContainer
                config={{ tickets: { label: 'Tickets', color: '#facc15' } }}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data.backlogAging.map((item) => ({
                      range: item.range,
                      tickets: item.count,
                    }))}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="range" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Bar
                      dataKey="tickets"
                      fill="var(--color-tickets)"
                      radius={4}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {data.agentPerformance?.length ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Desempeño de equipos</CardTitle>
            <CardDescription>
              Resolución, SLA y tiempos de respuesta promedio por equipo
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Equipo</TableHead>
                  <TableHead>Tickets</TableHead>
                  <TableHead>Resueltos</TableHead>
                  <TableHead>Cumplimiento SLA</TableHead>
                  <TableHead>Satisfacción</TableHead>
                  <TableHead>1ª respuesta</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.agentPerformance.map((agent) => (
                  <TableRow key={agent.agent}>
                    <TableCell className="font-medium">{agent.agent}</TableCell>
                    <TableCell>{agent.tickets}</TableCell>
                    <TableCell>{agent.resolved}</TableCell>
                    <TableCell>{agent.sla}%</TableCell>
                    <TableCell>{formatValue(agent.satisfaction)}</TableCell>
                    <TableCell>{formatValue(agent.firstResponse)} h</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableCaption>
                {usingFallback
                  ? 'Datos simulados mientras se restablece la conexión con el servidor.'
                  : 'Información provista por la plataforma municipal.'}
              </TableCaption>
            </Table>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}


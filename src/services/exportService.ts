import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { Ticket, Message } from '@/types/tickets';
import { getContactPhone } from '@/utils/ticket';
import { fmtAR } from '@/utils/date';
import { HeatPoint, TicketStatsResponse } from '@/services/statsService';

const formatDate = (dateString: string) => fmtAR(dateString);

const getTicketData = (ticket: Ticket) => {
  const data: { [key: string]: any } = {
    'Ticket ID': ticket.nro_ticket,
    'Asunto': ticket.asunto,
    'Estado': ticket.estado,
    'Categoría': ticket.categoria || 'N/A',
    'Fecha de Creación': formatDate(ticket.fecha),
    'Cliente': ticket.nombre_usuario || 'Usuario Desconocido',
    'Email': ticket.email_usuario || ticket.email || 'N/A',
    'Teléfono': getContactPhone(ticket) || 'N/A',
    'Dirección': ticket.direccion || 'N/A',
    'Canal': ticket.channel || 'N/A',
    'Descripción': ticket.description || 'N/A',
  };

  if (ticket.assignedAgent) {
    data['Agente Asignado'] = ticket.assignedAgent.nombre_usuario;
    data['Email Agente'] = ticket.assignedAgent.email || 'N/A';
    data['Teléfono Agente'] = ticket.assignedAgent.phone || 'N/A';
  }

  return data;
};

const addPdfHeader = (doc: jsPDF, title: string) => {
  // const logo = '... a base64 string ...'; // we will ask the user for this
  // doc.addImage(logo, 'PNG', 14, 12, 40, 15);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(45, 55, 72);
  doc.text(title, doc.internal.pageSize.width / 2, 20, { align: 'center' });
  doc.setLineWidth(0.5);
  doc.line(14, 28, doc.internal.pageSize.width - 14, 28);
};

const addPdfFooter = (doc: jsPDF) => {
    const pageCount = (doc as any).internal.getNumberOfPages();
    doc.setFontSize(10);
    doc.setTextColor(150);
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.text(`Página ${i} de ${pageCount}`, doc.internal.pageSize.width - 20, doc.internal.pageSize.height - 10);
        doc.text('© Chatboc', 14, doc.internal.pageSize.height - 10);
    }
}


export const exportToPdf = (ticket: Ticket, messages: Message[]) => {
  if (!ticket) return;
  const doc = new jsPDF();
  const ticketData = getTicketData(ticket);

  addPdfHeader(doc, `Ticket #${ticket.nro_ticket}`);

  // Ticket Details
  autoTable(doc, {
    startY: 40,
    head: [['Campo', 'Valor']],
    body: Object.entries(ticketData),
    theme: 'grid',
    headStyles: { fillColor: [79, 129, 189], textColor: 255 },
    styles: {
      font: 'helvetica',
      fontSize: 10
    }
  });

  // Messages History
  if (messages && messages.length > 0) {
    doc.addPage();
    doc.setFontSize(20);
    doc.setTextColor(40);
    doc.text('Historial de Mensajes', 14, 22);

    autoTable(doc, {
      startY: 30,
      head: [['Fecha', 'Autor', 'Mensaje']],
      body: messages.map(msg => [
        formatDate(msg.timestamp),
        msg.author === 'agent' ? (msg.agentName || 'Agente') : 'Usuario',
        msg.content,
      ]),
      theme: 'grid',
      headStyles: { fillColor: [22, 160, 133] },
    });
  }

  addPdfFooter(doc);
  doc.save(`ticket_${ticket.nro_ticket}.pdf`);
};

export const exportToXlsx = (ticket: Ticket, messages: Message[]) => {
  if (!ticket) return;
  const ticketData = getTicketData(ticket);
  const ticketWorksheet = XLSX.utils.json_to_sheet(Object.entries(ticketData).map(([key, value]) => ({ Campo: key, Valor: value })));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, ticketWorksheet, 'Detalles del Ticket');

  if (messages && messages.length > 0) {
    const messagesWorksheet = XLSX.utils.json_to_sheet(
      messages.map(msg => ({
        Fecha: formatDate(msg.timestamp),
        Autor: msg.author === 'agent' ? (msg.agentName || 'Agente') : 'Usuario',
        Mensaje: msg.content,
      }))
    );
    XLSX.utils.book_append_sheet(workbook, messagesWorksheet, 'Historial de Mensajes');
  }

  XLSX.writeFile(workbook, `ticket_${ticket.nro_ticket}.xlsx`);
};

export const exportToExcel = (tickets: Ticket[]) => {
  const headerStyle = {
    font: { bold: true, color: { rgb: "FFFFFF" } },
    fill: { fgColor: { rgb: "4F81BD" } },
    alignment: { horizontal: "center", vertical: "center" },
  };

  const sheetData = tickets.map(ticket => ({
    'ID': ticket.nro_ticket,
    'Asunto': ticket.asunto,
    'Estado': ticket.estado,
    'Fecha': new Date(ticket.fecha).toLocaleString(),
    'Cliente': ticket.nombre_usuario || 'Desconocido',
    'Email': ticket.email_usuario || ticket.email || '',
    'Teléfono': getContactPhone(ticket) || '',
    'Dirección': ticket.direccion || '',
    'Canal': ticket.channel || '',
    'Descripción': ticket.description || '',
    'Agente Asignado': ticket.assignedAgent?.nombre_usuario || '',
  }));

  const worksheet = XLSX.utils.json_to_sheet(sheetData);

  // Add a title row
  const title = 'Reporte de Tickets';
  const titleRow = [[title]];
  XLSX.utils.sheet_add_aoa(worksheet, titleRow, { origin: 'A1' });
  worksheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: Object.keys(sheetData[0]).length - 1 } }];
  worksheet['A1'].s = {
    font: { bold: true, sz: 16, color: { rgb: "FFFFFF" } },
    fill: { fgColor: { rgb: "2F5496" } },
    alignment: { horizontal: "center", vertical: "center" },
  };

  // Apply styles to header
  const header = Object.keys(sheetData[0]);
  for (let i = 0; i < header.length; i++) {
    const cellRef = XLSX.utils.encode_cell({ c: i, r: 1 });
    if (worksheet[cellRef]) {
      worksheet[cellRef].s = headerStyle;
    }
  }

  // Adjust column widths
  const colWidths = header.map(key => ({
    wch: Math.max(
      key.length,
      ...sheetData.map(row => (row[key as keyof typeof row] ? row[key as keyof typeof row].toString().length : 0))
    ) + 2
  }));
  worksheet['!cols'] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Tickets');

  XLSX.writeFile(workbook, 'tickets.xlsx');
};

export const exportAllToPdf = (tickets: Ticket[]) => {
  const doc = new jsPDF();
  addPdfHeader(doc, 'Resumen de Tickets');

  autoTable(doc, {
    startY: 40,
    head: [['ID', 'Asunto', 'Estado', 'Cliente', 'Fecha', 'Canal', 'Agente']],
    body: tickets.map(ticket => [
      ticket.nro_ticket,
      ticket.asunto,
      ticket.estado,
      ticket.nombre_usuario || 'N/A',
      formatDate(ticket.fecha),
      ticket.channel || 'N/A',
      ticket.assignedAgent?.nombre_usuario || 'N/A',
    ]),
    theme: 'grid',
    headStyles: { fillColor: [79, 129, 189], textColor: 255 },
    styles: {
        font: 'helvetica',
        fontSize: 10
    }
  });

  addPdfFooter(doc);
  doc.save('resumen_tickets.pdf');
};

const formatNumberValue = (value: number): string => {
  if (!Number.isFinite(value)) return '0';
  if (Number.isInteger(value)) return value.toLocaleString('es-AR');
  return value.toLocaleString('es-AR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  });
};

const safeNumberValue = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatTitleCase = (value: string): string =>
  value
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(' ');

const formatOptional = (value: string | null | undefined, fallback = '—'): string => {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
};

const formatAverageHours = (value: number | null | undefined): string => {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  return Number.isInteger(value)
    ? value.toString()
    : value.toFixed(2);
};

const ensurePdfSpace = (doc: jsPDF, cursor: number, minHeight = 18): number => {
  const pageHeight = doc.internal.pageSize.height || 0;
  if (cursor + minHeight > pageHeight - 20) {
    doc.addPage();
    return 20;
  }
  return cursor;
};

const addPdfSection = (
  doc: jsPDF,
  cursor: number,
  title: string,
  head: string[],
  body: (string | number)[][],
): number => {
  if (!body || body.length === 0) return cursor;
  cursor = ensurePdfSpace(doc, cursor, 14);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 14, cursor);
  cursor += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  cursor = ensurePdfSpace(doc, cursor, 12);
  autoTable(doc, {
    startY: cursor,
    head: [head],
    body,
    theme: 'grid',
    headStyles: { fillColor: [79, 129, 189], textColor: 255 },
    styles: {
      font: 'helvetica',
      fontSize: 10,
    },
  });
  const lastTable = (doc as any).lastAutoTable;
  const nextCursor = lastTable?.finalY ? lastTable.finalY + 10 : cursor + 10;
  return nextCursor;
};

const toLatLngString = (value: number | undefined): string => {
  if (typeof value !== 'number' || Number.isNaN(value)) return '';
  return value.toFixed(5);
};

interface AnalyticsMunicipality {
  name: string;
  totalTickets: number;
  categories?: Record<string, number>;
  averageResponseHours?: number | null;
  statuses?: Record<string, number>;
}

interface AnalyticsCategoryTotal {
  name: string;
  value: number;
}

interface AnalyticsFilterSummary {
  category: string;
  gender: string;
  ageMin: string;
  ageMax: string;
  statuses: string[];
}

export interface MunicipalAnalyticsExportOptions {
  municipalities: AnalyticsMunicipality[];
  statusKeys: string[];
  statusTotals?: Record<string, number>;
  categoryTotals: AnalyticsCategoryTotal[];
  totals: {
    totalTickets: number;
    averageResponseHours: number;
    ticketsLabel: string;
  };
  filters: AnalyticsFilterSummary;
  genderTotals?: Record<string, number>;
  ageRanges?: Record<string, number>;
  charts?: TicketStatsResponse['charts'];
  heatmap: HeatPoint[];
  categoryKey: string;
}

export const exportMunicipalAnalyticsPdf = (options: MunicipalAnalyticsExportOptions) => {
  if (!options) return;
  const doc = new jsPDF();
  addPdfHeader(doc, 'Analíticas Municipales');
  let cursor = 40;

  const filtersBody = [
    ['Categoría', formatOptional(options.filters.category, 'Todas')],
    ['Género', formatOptional(options.filters.gender, 'Todos')],
    ['Edad mínima', formatOptional(options.filters.ageMin, '—')],
    ['Edad máxima', formatOptional(options.filters.ageMax, '—')],
    [
      'Estados',
      options.filters.statuses && options.filters.statuses.length > 0
        ? options.filters.statuses.join(', ')
        : 'Todos',
    ],
  ];
  cursor = addPdfSection(doc, cursor, 'Filtros aplicados', ['Filtro', 'Valor'], filtersBody);

  const summaryBody = [
    ['Total de tickets', formatNumberValue(options.totals.totalTickets)],
    [
      'Promedio de respuesta (h)',
      Number.isFinite(options.totals.averageResponseHours)
        ? formatNumberValue(options.totals.averageResponseHours)
        : '0',
    ],
    ['Métrica principal', options.totals.ticketsLabel],
    ['Municipios analizados', options.municipalities.length.toString()],
  ];
  cursor = addPdfSection(doc, cursor, 'Resumen general', ['Indicador', 'Valor'], summaryBody);

  if (options.municipalities.length > 0) {
    const statusHeaders = options.statusKeys.map((status) => formatTitleCase(status));
    const head = [
      'Municipio',
      options.totals.ticketsLabel,
      'Prom. respuesta (h)',
      ...statusHeaders,
    ];
    const body = options.municipalities.map((municipality) => {
      const ticketsValue = options.categoryKey === 'all'
        ? safeNumberValue(municipality.totalTickets)
        : safeNumberValue(municipality.categories?.[options.categoryKey]);
      const average = formatAverageHours(municipality.averageResponseHours);
      const statusValues = options.statusKeys.map((status) =>
        formatNumberValue(safeNumberValue(municipality.statuses?.[status])),
      );
      return [
        municipality.name,
        formatNumberValue(ticketsValue),
        average,
        ...statusValues,
      ];
    });
    cursor = addPdfSection(doc, cursor, 'Detalle por municipio', head, body);
  }

  if (options.statusTotals && Object.keys(options.statusTotals).length > 0) {
    const statusBody = Object.entries(options.statusTotals).map(([status, value]) => [
      formatTitleCase(status),
      formatNumberValue(safeNumberValue(value)),
    ]);
    cursor = addPdfSection(doc, cursor, 'Estados generales', ['Estado', 'Tickets'], statusBody);
  }

  const filteredCategoryTotals = options.categoryTotals.filter((item) => safeNumberValue(item.value) > 0);
  if (filteredCategoryTotals.length > 0) {
    const categoryBody = filteredCategoryTotals.map((item) => [
      formatTitleCase(item.name),
      formatNumberValue(safeNumberValue(item.value)),
    ]);
    cursor = addPdfSection(doc, cursor, 'Distribución por categoría', ['Categoría', 'Tickets'], categoryBody);
  }

  if (options.genderTotals && Object.keys(options.genderTotals).length > 0) {
    const genderBody = Object.entries(options.genderTotals).map(([key, value]) => [
      formatTitleCase(key),
      formatNumberValue(safeNumberValue(value)),
    ]);
    cursor = addPdfSection(doc, cursor, 'Distribución por género', ['Género', 'Tickets'], genderBody);
  }

  if (options.ageRanges && Object.keys(options.ageRanges).length > 0) {
    const ageBody = Object.entries(options.ageRanges).map(([key, value]) => [
      formatTitleCase(key),
      formatNumberValue(safeNumberValue(value)),
    ]);
    cursor = addPdfSection(doc, cursor, 'Distribución por rango etario', ['Rango', 'Tickets'], ageBody);
  }

  const chartRows: (string | number)[][] = [];
  options.charts?.forEach((chart) => {
    if (!chart || !chart.data) return;
    const title = chart.title || 'Indicador';
    Object.entries(chart.data).forEach(([key, value]) => {
      chartRows.push([
        title,
        formatTitleCase(String(key)),
        formatNumberValue(safeNumberValue(value)),
      ]);
    });
  });
  if (chartRows.length > 0) {
    cursor = addPdfSection(
      doc,
      cursor,
      'Indicadores adicionales',
      ['Indicador', 'Detalle', 'Valor'],
      chartRows,
    );
  }

  if (options.heatmap.length > 0) {
    const heatmapBody = options.heatmap.map((point) => [
      formatOptional(point.distrito),
      formatOptional(point.barrio),
      formatOptional(point.categoria),
      formatOptional(point.tipo_ticket),
      formatOptional(point.estado),
      formatNumberValue(safeNumberValue(point.weight ?? 1)),
      toLatLngString(point.lat),
      toLatLngString(point.lng),
    ]);
    cursor = addPdfSection(
      doc,
      cursor,
      'Mapa de calor',
      ['Distrito', 'Barrio', 'Categoría', 'Tipo', 'Estado', 'Tickets', 'Lat', 'Lng'],
      heatmapBody,
    );
  }

  addPdfFooter(doc);
  doc.save('analiticas_municipales.pdf');
};

export const exportMunicipalAnalyticsExcel = (options: MunicipalAnalyticsExportOptions) => {
  if (!options) return;
  const workbook = XLSX.utils.book_new();

  const summaryRows: Record<string, string | number>[] = [
    { Indicador: 'Categoría', Valor: options.filters.category || 'Todas' },
    { Indicador: 'Género', Valor: options.filters.gender || 'Todos' },
    { Indicador: 'Edad mínima', Valor: options.filters.ageMin || '—' },
    { Indicador: 'Edad máxima', Valor: options.filters.ageMax || '—' },
    {
      Indicador: 'Estados',
      Valor:
        options.filters.statuses && options.filters.statuses.length > 0
          ? options.filters.statuses.join(', ')
          : 'Todos',
    },
    { Indicador: 'Total de tickets', Valor: safeNumberValue(options.totals.totalTickets) },
    {
      Indicador: 'Promedio de respuesta (h)',
      Valor: Number.isFinite(options.totals.averageResponseHours)
        ? Number(options.totals.averageResponseHours.toFixed(2))
        : 0,
    },
    { Indicador: 'Métrica principal', Valor: options.totals.ticketsLabel },
    { Indicador: 'Municipios analizados', Valor: options.municipalities.length },
  ];
  const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Resumen');

  if (options.municipalities.length > 0) {
    const statusHeaders = options.statusKeys.map((status) => formatTitleCase(status));
    const rows = options.municipalities.map((municipality) => {
      const ticketsValue = options.categoryKey === 'all'
        ? safeNumberValue(municipality.totalTickets)
        : safeNumberValue(municipality.categories?.[options.categoryKey]);
      const row: Record<string, string | number> = {
        Municipio: municipality.name,
        [options.totals.ticketsLabel]: ticketsValue,
        'Promedio respuesta (h)':
          typeof municipality.averageResponseHours === 'number'
            ? Number(municipality.averageResponseHours.toFixed(2))
            : '',
      };
      statusHeaders.forEach((header, index) => {
        const statusKey = options.statusKeys[index];
        row[header] = safeNumberValue(municipality.statuses?.[statusKey]);
      });
      return row;
    });
    const sheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, sheet, 'Municipios');
  }

  if (options.statusTotals && Object.keys(options.statusTotals).length > 0) {
    const rows = Object.entries(options.statusTotals).map(([status, value]) => ({
      Estado: formatTitleCase(status),
      Tickets: safeNumberValue(value),
    }));
    const sheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, sheet, 'Estados');
  }

  const filteredCategoryTotals = options.categoryTotals.filter((item) => safeNumberValue(item.value) > 0);
  if (filteredCategoryTotals.length > 0) {
    const rows = filteredCategoryTotals.map((item) => ({
      Categoría: formatTitleCase(item.name),
      Tickets: safeNumberValue(item.value),
    }));
    const sheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, sheet, 'Categorías');
  }

  if (options.genderTotals && Object.keys(options.genderTotals).length > 0) {
    const rows = Object.entries(options.genderTotals).map(([key, value]) => ({
      Género: formatTitleCase(key),
      Tickets: safeNumberValue(value),
    }));
    const sheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, sheet, 'Género');
  }

  if (options.ageRanges && Object.keys(options.ageRanges).length > 0) {
    const rows = Object.entries(options.ageRanges).map(([key, value]) => ({
      Rango: formatTitleCase(key),
      Tickets: safeNumberValue(value),
    }));
    const sheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, sheet, 'Rangos Etarios');
  }

  const chartRows: Record<string, string | number>[] = [];
  options.charts?.forEach((chart) => {
    if (!chart || !chart.data) return;
    const title = chart.title || 'Indicador';
    Object.entries(chart.data).forEach(([key, value]) => {
      chartRows.push({
        Indicador: title,
        Detalle: formatTitleCase(String(key)),
        Valor: safeNumberValue(value),
      });
    });
  });
  if (chartRows.length > 0) {
    const sheet = XLSX.utils.json_to_sheet(chartRows);
    XLSX.utils.book_append_sheet(workbook, sheet, 'Indicadores');
  }

  if (options.heatmap.length > 0) {
    const rows = options.heatmap.map((point) => ({
      Distrito: formatOptional(point.distrito, ''),
      Barrio: formatOptional(point.barrio, ''),
      Categoría: formatOptional(point.categoria, ''),
      Tipo: formatOptional(point.tipo_ticket, ''),
      Estado: formatOptional(point.estado, ''),
      Tickets: safeNumberValue(point.weight ?? 1),
      Latitud: point.lat ?? '',
      Longitud: point.lng ?? '',
    }));
    const sheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, sheet, 'Mapa de calor');
  }

  XLSX.writeFile(workbook, 'analiticas_municipales.xlsx');
};

interface StatsItem {
  label: string;
  value: number;
  unit?: string;
}

interface StatsCountMetric {
  name: string;
  count: number;
}

interface StatsValueMetric {
  name: string;
  value: number;
}

interface StatsMonthlyTrend {
  month: string;
  label: string;
  nuevos: number;
  resueltos: number;
  vencidos: number;
  reabiertos: number;
}

interface StatsSatisfactionTrend {
  month: string;
  label: string;
  average: number;
}

interface StatsBacklogMetric {
  range: string;
  count: number;
}

interface StatsCategoryResolution {
  category: string;
  avgHours: number;
}

interface StatsHeatmapCell {
  timeSlot: string;
  count: number;
}

interface StatsHeatmapRow {
  day: string;
  slots: StatsHeatmapCell[];
}

interface StatsAgentPerformance {
  agent: string;
  tickets: number;
  resolved: number;
  sla: number;
  satisfaction: number;
  firstResponse: number;
}

interface MunicipalStatsData {
  stats: StatsItem[];
  categoryBreakdown?: StatsCountMetric[];
  statusBreakdown?: StatsValueMetric[];
  priorityBreakdown?: StatsCountMetric[];
  channelBreakdown?: StatsCountMetric[];
  barrioBreakdown?: StatsCountMetric[];
  monthlyTrend?: StatsMonthlyTrend[];
  satisfactionTrend?: StatsSatisfactionTrend[];
  satisfactionSummary?: {
    average: number;
    nps: number;
    promoters: number;
    passives: number;
    detractors: number;
    responseRate: number;
  };
  satisfactionDistribution?: StatsValueMetric[];
  heatmap?: StatsHeatmapRow[];
  backlogAging?: StatsBacklogMetric[];
  categoryResolution?: StatsCategoryResolution[];
  agentPerformance?: StatsAgentPerformance[];
}

export interface MunicipalStatsExportOptions {
  data: MunicipalStatsData;
  filters: {
    rubro: string;
    barrio: string;
    tipo: string;
    rango: string;
  };
  usingFallback?: boolean;
}

const flattenHeatmap = (rows: StatsHeatmapRow[] | undefined) => {
  if (!rows) return [] as (string | number)[][];
  const entries: (string | number)[][] = [];
  rows.forEach((row) => {
    row.slots.forEach((slot) => {
      entries.push([
        row.day,
        slot.timeSlot,
        formatNumberValue(safeNumberValue(slot.count)),
      ]);
    });
  });
  return entries;
};

export const exportMunicipalStatsPdf = (options: MunicipalStatsExportOptions) => {
  if (!options) return;
  const { data } = options;
  const doc = new jsPDF();
  addPdfHeader(doc, 'Estadísticas Municipales');
  let cursor = 40;

  const filterBody = [
    ['Rubro', formatOptional(options.filters.rubro, 'Todos')],
    ['Barrio', formatOptional(options.filters.barrio, 'Todos')],
    ['Tipo', formatOptional(options.filters.tipo, 'Todos')],
    ['Período', formatOptional(options.filters.rango, 'Todos')],
    [
      'Fuente de datos',
      options.usingFallback ? 'Datos simulados por el frontend' : 'Datos provistos por el backend',
    ],
  ];
  cursor = addPdfSection(doc, cursor, 'Filtros aplicados', ['Filtro', 'Valor'], filterBody);

  const statsBody = data.stats.map((item) => [
    item.label,
    `${formatNumberValue(safeNumberValue(item.value))}${item.unit ? ` ${item.unit}` : ''}`,
  ]);
  cursor = addPdfSection(doc, cursor, 'Indicadores destacados', ['Indicador', 'Valor'], statsBody);

  if (data.categoryBreakdown?.length) {
    const body = data.categoryBreakdown.map((item) => [
      item.name,
      formatNumberValue(safeNumberValue(item.count)),
    ]);
    cursor = addPdfSection(doc, cursor, 'Tickets por categoría', ['Categoría', 'Tickets'], body);
  }

  if (data.statusBreakdown?.length) {
    const body = data.statusBreakdown.map((item) => [
      item.name,
      formatNumberValue(safeNumberValue(item.value)),
    ]);
    cursor = addPdfSection(doc, cursor, 'Tickets por estado', ['Estado', 'Total'], body);
  }

  if (data.priorityBreakdown?.length) {
    const body = data.priorityBreakdown.map((item) => [
      item.name,
      formatNumberValue(safeNumberValue(item.count)),
    ]);
    cursor = addPdfSection(doc, cursor, 'Prioridad de tickets', ['Prioridad', 'Tickets'], body);
  }

  if (data.channelBreakdown?.length) {
    const body = data.channelBreakdown.map((item) => [
      item.name,
      formatNumberValue(safeNumberValue(item.count)),
    ]);
    cursor = addPdfSection(doc, cursor, 'Tickets por canal', ['Canal', 'Tickets'], body);
  }

  if (data.barrioBreakdown?.length) {
    const body = data.barrioBreakdown.map((item) => [
      item.name,
      formatNumberValue(safeNumberValue(item.count)),
    ]);
    cursor = addPdfSection(doc, cursor, 'Volumen por zona', ['Zona', 'Tickets'], body);
  }

  if (data.monthlyTrend?.length) {
    const body = data.monthlyTrend.map((item) => [
      item.label || item.month,
      formatNumberValue(safeNumberValue(item.nuevos)),
      formatNumberValue(safeNumberValue(item.resueltos)),
      formatNumberValue(safeNumberValue(item.vencidos)),
      formatNumberValue(safeNumberValue(item.reabiertos)),
    ]);
    cursor = addPdfSection(
      doc,
      cursor,
      'Tendencia mensual',
      ['Período', 'Nuevos', 'Resueltos', 'Vencidos', 'Reabiertos'],
      body,
    );
  }

  if (data.satisfactionTrend?.length) {
    const body = data.satisfactionTrend.map((item) => [
      item.label || item.month,
      formatNumberValue(safeNumberValue(item.average)),
    ]);
    cursor = addPdfSection(
      doc,
      cursor,
      'Satisfacción promedio',
      ['Período', 'Promedio'],
      body,
    );
  }

  if (data.satisfactionSummary) {
    const { average, nps, promoters, passives, detractors, responseRate } = data.satisfactionSummary;
    const body = [
      ['Promedio general', formatNumberValue(safeNumberValue(average))],
      ['NPS', `${formatNumberValue(safeNumberValue(nps))}%`],
      ['Promotores', formatNumberValue(safeNumberValue(promoters))],
      ['Pasivos', formatNumberValue(safeNumberValue(passives))],
      ['Detractores', formatNumberValue(safeNumberValue(detractors))],
      ['Tasa de respuesta', `${formatNumberValue(safeNumberValue(responseRate))}%`],
    ];
    cursor = addPdfSection(doc, cursor, 'Resumen de satisfacción', ['Indicador', 'Valor'], body);
  }

  if (data.satisfactionDistribution?.length) {
    const body = data.satisfactionDistribution.map((item) => [
      item.name,
      formatNumberValue(safeNumberValue(item.value)),
    ]);
    cursor = addPdfSection(
      doc,
      cursor,
      'Distribución de respuestas',
      ['Categoría', 'Valor'],
      body,
    );
  }

  if (data.backlogAging?.length) {
    const body = data.backlogAging.map((item) => [
      item.range,
      formatNumberValue(safeNumberValue(item.count)),
    ]);
    cursor = addPdfSection(
      doc,
      cursor,
      'Antigüedad de tickets pendientes',
      ['Rango', 'Tickets'],
      body,
    );
  }

  if (data.categoryResolution?.length) {
    const body = data.categoryResolution.map((item) => [
      item.category,
      formatNumberValue(safeNumberValue(item.avgHours)),
    ]);
    cursor = addPdfSection(
      doc,
      cursor,
      'Tiempo de resolución por categoría',
      ['Categoría', 'Horas'],
      body,
    );
  }

  if (data.agentPerformance?.length) {
    const body = data.agentPerformance.map((agent) => [
      agent.agent,
      formatNumberValue(safeNumberValue(agent.tickets)),
      formatNumberValue(safeNumberValue(agent.resolved)),
      `${formatNumberValue(safeNumberValue(agent.sla))}%`,
      formatNumberValue(safeNumberValue(agent.satisfaction)),
      `${formatNumberValue(safeNumberValue(agent.firstResponse))} h`,
    ]);
    cursor = addPdfSection(
      doc,
      cursor,
      'Desempeño de equipos',
      ['Equipo', 'Tickets', 'Resueltos', 'SLA', 'Satisfacción', '1ª respuesta'],
      body,
    );
  }

  const heatmapEntries = flattenHeatmap(data.heatmap);
  if (heatmapEntries.length > 0) {
    cursor = addPdfSection(
      doc,
      cursor,
      'Mapa de calor',
      ['Día', 'Franja', 'Tickets'],
      heatmapEntries,
    );
  }

  addPdfFooter(doc);
  doc.save('estadisticas_municipales.pdf');
};

export const exportMunicipalStatsExcel = (options: MunicipalStatsExportOptions) => {
  if (!options) return;
  const { data } = options;
  const workbook = XLSX.utils.book_new();

  const summaryRows: Record<string, string | number>[] = [
    { Indicador: 'Rubro', Valor: options.filters.rubro || 'Todos' },
    { Indicador: 'Barrio', Valor: options.filters.barrio || 'Todos' },
    { Indicador: 'Tipo', Valor: options.filters.tipo || 'Todos' },
    { Indicador: 'Período', Valor: options.filters.rango || 'Todos' },
    {
      Indicador: 'Fuente de datos',
      Valor: options.usingFallback ? 'Datos simulados por el frontend' : 'Datos provistos por el backend',
    },
  ];
  data.stats.forEach((item) => {
    summaryRows.push({
      Indicador: item.label,
      Valor: item.unit
        ? `${safeNumberValue(item.value)} ${item.unit}`
        : safeNumberValue(item.value),
    });
  });
  const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Resumen');

  if (data.categoryBreakdown?.length) {
    const rows = data.categoryBreakdown.map((item) => ({
      Categoría: item.name,
      Tickets: safeNumberValue(item.count),
    }));
    const sheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, sheet, 'Categorías');
  }

  if (data.statusBreakdown?.length) {
    const rows = data.statusBreakdown.map((item) => ({
      Estado: item.name,
      Valor: safeNumberValue(item.value),
    }));
    const sheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, sheet, 'Estados');
  }

  if (data.priorityBreakdown?.length) {
    const rows = data.priorityBreakdown.map((item) => ({
      Prioridad: item.name,
      Tickets: safeNumberValue(item.count),
    }));
    const sheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, sheet, 'Prioridades');
  }

  if (data.channelBreakdown?.length) {
    const rows = data.channelBreakdown.map((item) => ({
      Canal: item.name,
      Tickets: safeNumberValue(item.count),
    }));
    const sheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, sheet, 'Canales');
  }

  if (data.barrioBreakdown?.length) {
    const rows = data.barrioBreakdown.map((item) => ({
      Zona: item.name,
      Tickets: safeNumberValue(item.count),
    }));
    const sheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, sheet, 'Zonas');
  }

  if (data.monthlyTrend?.length) {
    const rows = data.monthlyTrend.map((item) => ({
      Período: item.label || item.month,
      Nuevos: safeNumberValue(item.nuevos),
      Resueltos: safeNumberValue(item.resueltos),
      Vencidos: safeNumberValue(item.vencidos),
      Reabiertos: safeNumberValue(item.reabiertos),
    }));
    const sheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, sheet, 'Tendencia mensual');
  }

  if (data.satisfactionTrend?.length) {
    const rows = data.satisfactionTrend.map((item) => ({
      Período: item.label || item.month,
      Promedio: safeNumberValue(item.average),
    }));
    const sheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, sheet, 'Satisfacción');
  }

  if (data.satisfactionSummary) {
    const { average, nps, promoters, passives, detractors, responseRate } = data.satisfactionSummary;
    const rows = [
      { Indicador: 'Promedio general', Valor: safeNumberValue(average) },
      { Indicador: 'NPS', Valor: `${safeNumberValue(nps)}%` },
      { Indicador: 'Promotores', Valor: safeNumberValue(promoters) },
      { Indicador: 'Pasivos', Valor: safeNumberValue(passives) },
      { Indicador: 'Detractores', Valor: safeNumberValue(detractors) },
      { Indicador: 'Tasa de respuesta', Valor: `${safeNumberValue(responseRate)}%` },
    ];
    const sheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, sheet, 'Resumen satisfacción');
  }

  if (data.satisfactionDistribution?.length) {
    const rows = data.satisfactionDistribution.map((item) => ({
      Categoría: item.name,
      Valor: safeNumberValue(item.value),
    }));
    const sheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, sheet, 'Distribución satisfacción');
  }

  if (data.backlogAging?.length) {
    const rows = data.backlogAging.map((item) => ({
      Rango: item.range,
      Tickets: safeNumberValue(item.count),
    }));
    const sheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, sheet, 'Backlog');
  }

  if (data.categoryResolution?.length) {
    const rows = data.categoryResolution.map((item) => ({
      Categoría: item.category,
      Horas: safeNumberValue(item.avgHours),
    }));
    const sheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, sheet, 'Resolución');
  }

  if (data.agentPerformance?.length) {
    const rows = data.agentPerformance.map((agent) => ({
      Equipo: agent.agent,
      Tickets: safeNumberValue(agent.tickets),
      Resueltos: safeNumberValue(agent.resolved),
      SLA: `${safeNumberValue(agent.sla)}%`,
      Satisfacción: safeNumberValue(agent.satisfaction),
      '1ª respuesta (h)': safeNumberValue(agent.firstResponse),
    }));
    const sheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, sheet, 'Equipos');
  }

  if (data.heatmap?.length) {
    const rows: Record<string, string | number>[] = [];
    data.heatmap.forEach((row) => {
      row.slots.forEach((slot) => {
        rows.push({
          Día: row.day,
          Franja: slot.timeSlot,
          Tickets: safeNumberValue(slot.count),
        });
      });
    });
    if (rows.length > 0) {
      const sheet = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(workbook, sheet, 'Mapa de calor');
    }
  }

  XLSX.writeFile(workbook, 'estadisticas_municipales.xlsx');
};

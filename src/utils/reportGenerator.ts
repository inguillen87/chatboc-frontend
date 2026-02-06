import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { AiReportResponse, SalesAnalyticsResponse, TicketStatsResponse, HeatPoint } from '@/services/statsService';

interface ReportData {
  tenantName: string;
  segment: 'pyme' | 'municipio';
  dateRange: { start?: string; end: string };
  aiReport?: AiReportResponse | null;
  salesData?: SalesAnalyticsResponse | null;
  ticketStats?: any; // Using looser type for flexibility with UI state
  heatmapData?: HeatPoint[];
}

// --- PROFESSIONAL STYLING CONSTANTS ---
const COLORS = {
  primary: '#4f46e5', // Indigo 600
  secondary: '#10b981', // Emerald 500
  text: '#1f2937', // Gray 800
  textLight: '#6b7280', // Gray 500
  bgLight: '#f3f4f6', // Gray 100
  white: '#ffffff',
};

const LOGO_TEXT = "CHATBOC INTELLIGENCE";

export const generatePdfReport = (data: ReportData) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  let yPos = 20;

  // --- HEADER ---
  doc.setFillColor(COLORS.primary);
  doc.rect(0, 0, pageWidth, 15, 'F');

  doc.setTextColor(COLORS.white);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(LOGO_TEXT, 15, 10);

  doc.setFont('helvetica', 'normal');
  doc.text(data.tenantName.toUpperCase(), pageWidth - 15, 10, { align: 'right' });

  yPos = 30;

  // --- TITLE ---
  doc.setTextColor(COLORS.primary);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  const title = data.segment === 'pyme' ? "Reporte de Gestión Comercial" : "Informe de Gestión Municipal";
  doc.text(title, 15, yPos);

  yPos += 8;
  doc.setTextColor(COLORS.textLight);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const dateStr = `Periodo: ${data.dateRange.start ? new Date(data.dateRange.start).toLocaleDateString() : 'Inicio'} - ${new Date(data.dateRange.end).toLocaleDateString()}`;
  doc.text(dateStr, 15, yPos);

  yPos += 15;

  // --- AI EXECUTIVE SUMMARY ---
  if (data.aiReport) {
    doc.setFillColor(COLORS.bgLight);
    doc.roundedRect(15, yPos, pageWidth - 30, 45, 3, 3, 'F');

    doc.setTextColor(COLORS.primary);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text("Resumen Ejecutivo (IA)", 20, yPos + 10);

    doc.setTextColor(COLORS.text);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const summaryLines = doc.splitTextToSize(data.aiReport.summary, pageWidth - 40);
    doc.text(summaryLines, 20, yPos + 20);

    yPos += 55;

    // Opportunities & Threats
    const colWidth = (pageWidth - 40) / 2;

    if (data.aiReport.opportunities.length > 0) {
      doc.setTextColor(COLORS.secondary);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text("Oportunidades", 15, yPos);

      doc.setTextColor(COLORS.text);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      data.aiReport.opportunities.slice(0, 5).forEach((op, i) => {
        doc.text(`• ${op}`, 15, yPos + 7 + (i * 5));
      });
    }

    if (data.aiReport.threats.length > 0) {
      doc.setTextColor('#ef4444'); // Red
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text("Atención Requerida", 15 + colWidth, yPos);

      doc.setTextColor(COLORS.text);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      data.aiReport.threats.slice(0, 5).forEach((th, i) => {
        doc.text(`• ${th}`, 15 + colWidth, yPos + 7 + (i * 5));
      });
    }

    yPos += 40;
  }

  // --- KPIS SECTION ---
  doc.setTextColor(COLORS.primary);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text("Indicadores Clave de Desempeño", 15, yPos);
  yPos += 10;

  const kpiData = [];
  if (data.segment === 'pyme' && data.salesData) {
    kpiData.push(['Ingresos Totales', `$${data.salesData.revenue.toLocaleString()}`]);
    kpiData.push(['Ticket Promedio', `$${data.salesData.average_ticket.toLocaleString()}`]);
    kpiData.push(['Total Pedidos', data.salesData.total_orders.toString()]);
    kpiData.push(['Tasa Conversión', `${data.salesData.conversion_rate}%`]);
  } else if (data.ticketStats) {
      // Extract aggregate if available
      // For now, placeholder or partial data
      kpiData.push(['Total Tickets', 'N/A']);
  }

  autoTable(doc, {
    startY: yPos,
    head: [['Métrica', 'Valor']],
    body: kpiData,
    theme: 'grid',
    headStyles: { fillColor: COLORS.primary },
    styles: { fontSize: 10, cellPadding: 5 },
    columnStyles: { 0: { fontStyle: 'bold' } }
  });

  yPos = (doc as any).lastAutoTable.finalY + 15;

  // --- DETAILED TABLES ---
  // Sales by Product / Categories
  if (data.salesData && data.salesData.sales_by_product.length > 0) {
    doc.text("Top Productos / Servicios", 15, yPos);
    yPos += 5;

    autoTable(doc, {
      startY: yPos,
      head: [['Producto', 'Cantidad Vendida']],
      body: data.salesData.sales_by_product.map(p => [p.name, p.count]),
      theme: 'striped',
      headStyles: { fillColor: COLORS.secondary },
      styles: { fontSize: 9 }
    });

    yPos = (doc as any).lastAutoTable.finalY + 15;
  }

  // Heatmap / Geo Data Summary
  if (data.heatmapData && data.heatmapData.length > 0) {
      // Add page if needed
      if (yPos > pageHeight - 50) {
          doc.addPage();
          yPos = 20;
      }

      doc.setTextColor(COLORS.primary);
      doc.setFontSize(14);
      doc.text("Distribución Geográfica (Top Zonas)", 15, yPos);
      yPos += 10;

      // Aggregate by 'barrio' or 'distrito'
      const zones: Record<string, number> = {};
      data.heatmapData.forEach(p => {
          const zone = p.barrio || p.distrito || 'Desconocido';
          zones[zone] = (zones[zone] || 0) + (p.weight || 1);
      });

      const zoneRows = Object.entries(zones)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([zone, val]) => [zone, Math.round(val)]);

       autoTable(doc, {
        startY: yPos,
        head: [['Zona / Barrio', 'Intensidad (Activity Score)']],
        body: zoneRows,
        theme: 'striped',
        headStyles: { fillColor: COLORS.primary },
      });
  }

  // --- FOOTER ---
  const pageCount = (doc as any).internal.getNumberOfPages();
  for(let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(COLORS.textLight);
    doc.text(`Generado el ${new Date().toLocaleDateString()} via Chatboc Analytics - Página ${i} de ${pageCount}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
  }

  doc.save(`reporte_${data.segment}_${new Date().toISOString().split('T')[0]}.pdf`);
};

export const generateExcelReport = (data: ReportData) => {
  const wb = XLSX.utils.book_new();

  // --- SHEET 1: RESUMEN ---
  const summaryRows = [
    ["Reporte de Gestión", data.tenantName],
    ["Periodo", `${data.dateRange.start} - ${data.dateRange.end}`],
    [],
    ["RESUMEN EJECUTIVO (IA)"],
    [data.aiReport?.summary || "Sin datos"],
    [],
    ["OPORTUNIDADES DETECTADAS"],
    ...(data.aiReport?.opportunities.map(o => [o]) || []),
    [],
    ["ALERTA / AMENAZAS"],
    ...(data.aiReport?.threats.map(t => [t]) || []),
  ];

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(wb, wsSummary, "Resumen");

  // --- SHEET 2: METRICAS ---
  if (data.salesData) {
      const metricsRows = [
          ["Métrica", "Valor"],
          ["Ingresos Totales", data.salesData.revenue],
          ["Ticket Promedio", data.salesData.average_ticket],
          ["Total Pedidos", data.salesData.total_orders],
          ["Conversión", data.salesData.conversion_rate],
      ];
      const wsMetrics = XLSX.utils.aoa_to_sheet(metricsRows);
      XLSX.utils.book_append_sheet(wb, wsMetrics, "KPIs Comerciales");

      // Products
      const productRows = [
          ["Producto", "Cantidad"],
          ...data.salesData.sales_by_product.map(p => [p.name, p.count])
      ];
      const wsProds = XLSX.utils.aoa_to_sheet(productRows);
      XLSX.utils.book_append_sheet(wb, wsProds, "Top Productos");
  }

  // --- SHEET 3: GEO DATA ---
  if (data.heatmapData) {
      const geoHeader = ["Latitud", "Longitud", "Peso/Intensidad", "Barrio", "Categoría", "Estado"];
      const geoRows = data.heatmapData.map(p => [
          p.lat,
          p.lng,
          p.weight || 1,
          p.barrio || "",
          p.categoria || "",
          p.estado || ""
      ]);
      const wsGeo = XLSX.utils.aoa_to_sheet([geoHeader, ...geoRows]);
      XLSX.utils.book_append_sheet(wb, wsGeo, "Datos Geográficos");
  }

  XLSX.writeFile(wb, `reporte_${data.segment}_${new Date().toISOString().split('T')[0]}.xlsx`);
};

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { jsPDF } from "jspdf";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const catalogDir = path.join(root, "public", "demo-catalogs");
const manifestPath = path.join(catalogDir, "manifest.json");

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

const palettes = {
  Gobierno: {
    primary: [8, 33, 115],
    accent: [37, 99, 235],
    soft: [239, 246, 255],
    label: "Gobiernos",
  },
  Empresas: {
    primary: [12, 74, 110],
    accent: [14, 165, 233],
    soft: [240, 249, 255],
    label: "Empresas",
  },
  Colegios: {
    primary: [88, 28, 135],
    accent: [147, 51, 234],
    soft: [250, 245, 255],
    label: "Colegios",
  },
};

const packagesBySector = {
  Gobierno: [
    ["Mesa digital", "Consultas, turnos y reclamos basicos.", "Demo incluido"],
    ["Operaciones", "SLA, mapas, reportes y action center.", "Plan gobierno"],
    ["Omnicanal", "WhatsApp, widget, voz realtime y handoff.", "Plan enterprise"],
  ],
  Empresas: [
    ["Catalogo demo", "Productos, servicios y FAQs comerciales.", "Demo incluido"],
    ["Ventas asistidas", "Pedidos, checkout preview y handoff comercial.", "Plan pyme"],
    ["Operacion premium", "Analytics, rewards, pagos y voz realtime.", "Plan enterprise"],
  ],
  Colegios: [
    ["Secretaria digital", "Consultas frecuentes, certificados y comunicados.", "Demo incluido"],
    ["Familias", "Asistencia, documentos, pagos y admisiones.", "Plan colegio"],
    ["Operaciones escolares", "Casos sensibles, heatmap y trazabilidad.", "Plan enterprise"],
  ],
};

const questionsBySector = {
  Gobierno: [
    "Quiero iniciar un reclamo con ubicacion",
    "Necesito consultar el estado de mi ticket",
    "Quiero hablar con un operador",
  ],
  Empresas: [
    "Consultar disponibilidad",
    "Tomar pedido por WhatsApp",
    "Necesito una propuesta comercial",
  ],
  Colegios: [
    "Justificar inasistencia",
    "Consultar secretaria",
    "Adjuntar certificado medico",
  ],
};

const drawWrapped = (doc, text, x, y, maxWidth, lineHeight = 14) => {
  const lines = doc.splitTextToSize(text, maxWidth);
  doc.text(lines, x, y);
  return y + lines.length * lineHeight;
};

const addTitle = (doc, title, x, y, palette) => {
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(title, x, y);
  doc.setDrawColor(...palette.accent);
  doc.setLineWidth(0.7);
  doc.line(x, y + 4, x + 28, y + 4);
};

const buildPdf = (item) => {
  const palette = palettes[item.sector] ?? palettes.Empresas;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 44;
  const contentWidth = pageWidth - margin * 2;

  doc.setFillColor(...palette.primary);
  doc.rect(0, 0, pageWidth, 142, "F");
  doc.setFillColor(...palette.accent);
  doc.roundedRect(margin, 28, 118, 26, 8, 8, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("CHATBOC DEMO", margin + 14, 45);
  doc.setFontSize(25);
  doc.text(item.title, margin, 84, { maxWidth: contentWidth });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(226, 232, 240);
  doc.text(`${palette.label} - Catalogo descargable`, margin, 110);

  let y = 176;
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Experiencia guiada para probar Chatboc", margin, y);
  y += 22;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(71, 85, 105);
  y = drawWrapped(
    doc,
    `Este material acompana el recorrido demo de ${item.title}. Sirve para probar consultas, acciones, derivaciones, adjuntos y seguimiento sin depender de contenido local hardcodeado.`,
    margin,
    y,
    contentWidth,
  );

  y += 22;
  addTitle(doc, "Capacidades incluidas", margin, y, palette);
  y += 26;
  const features = Array.isArray(item.features) && item.features.length ? item.features : ["Chat guiado", "Tickets", "Analytics", "Handoff"];
  const cardWidth = (contentWidth - 18) / 2;
  features.slice(0, 4).forEach((feature, index) => {
    const x = margin + (index % 2) * (cardWidth + 18);
    const cardY = y + Math.floor(index / 2) * 58;
    doc.setFillColor(...palette.soft);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, cardY, cardWidth, 44, 8, 8, "FD");
    doc.setTextColor(...palette.accent);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(`0${index + 1}`, x + 12, cardY + 18);
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(10);
    doc.text(feature, x + 42, cardY + 18, { maxWidth: cardWidth - 54 });
  });

  y += 132;
  addTitle(doc, "Paquetes demo", margin, y, palette);
  y += 26;
  (packagesBySector[item.sector] ?? packagesBySector.Empresas).forEach(([name, detail, price], index) => {
    doc.setFillColor(index % 2 === 0 ? 255 : 248, index % 2 === 0 ? 255 : 250, index % 2 === 0 ? 255 : 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, y, contentWidth, 48, 8, 8, "FD");
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(name, margin + 14, y + 18);
    doc.setTextColor(71, 85, 105);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.text(detail, margin + 14, y + 34, { maxWidth: contentWidth - 160 });
    doc.setTextColor(...palette.accent);
    doc.setFont("helvetica", "bold");
    doc.text(price, margin + contentWidth - 120, y + 26, { maxWidth: 110, align: "right" });
    y += 56;
  });

  y += 10;
  addTitle(doc, "Preguntas sugeridas", margin, y, palette);
  y += 26;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(51, 65, 85);
  (questionsBySector[item.sector] ?? questionsBySector.Empresas).forEach((question) => {
    doc.setFillColor(...palette.soft);
    doc.roundedRect(margin, y - 12, contentWidth, 28, 7, 7, "F");
    doc.text(`"${question}"`, margin + 12, y + 5, { maxWidth: contentWidth - 24 });
    y += 36;
  });

  doc.setDrawColor(226, 232, 240);
  doc.line(margin, 780, pageWidth - margin, 780);
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(8);
  doc.text("Generado por Chatboc - Material demo", margin, 800);
  doc.text("Precios y paquetes referenciales.", pageWidth - margin, 800, { align: "right" });
  return Buffer.from(doc.output("arraybuffer"));
};

fs.mkdirSync(catalogDir, { recursive: true });

for (const item of manifest.items) {
  const fileName = path.basename(item.href);
  const outputPath = path.join(catalogDir, fileName);
  fs.writeFileSync(outputPath, buildPdf(item));
  console.log(`Generated ${path.relative(root, outputPath)}`);
}


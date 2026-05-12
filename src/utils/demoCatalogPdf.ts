import type { DemoCatalogAsset } from "@/data/demoCatalogAssets";

const sectorLabel: Record<DemoCatalogAsset["sector"], string> = {
  gobierno: "Gobiernos",
  empresas: "Empresas",
  educacion: "Colegios",
};

const drawWrappedText = (
  doc: any,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
) => {
  const lines = doc.splitTextToSize(text, maxWidth);
  doc.text(lines, x, y);
  return y + lines.length * lineHeight;
};

const addSectionTitle = (doc: any, title: string, x: number, y: number) => {
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(title, x, y);
  doc.setDrawColor(37, 99, 235);
  doc.setLineWidth(0.7);
  doc.line(x, y + 4, x + 28, y + 4);
};

export const downloadDemoCatalogPdf = async (asset: DemoCatalogAsset) => {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 44;
  const contentWidth = pageWidth - margin * 2;
  const now = new Date();

  doc.setFillColor(8, 33, 115);
  doc.rect(0, 0, pageWidth, 142, "F");
  doc.setFillColor(37, 99, 235);
  doc.roundedRect(margin, 28, 118, 26, 8, 8, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("CHATBOC DEMO", margin + 14, 45);

  doc.setFontSize(26);
  doc.text(asset.title, margin, 84, { maxWidth: contentWidth });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(203, 213, 225);
  doc.text(`${sectorLabel[asset.sector]} · Catalogo descargable`, margin, 110);

  let y = 176;
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(asset.subtitle || "Experiencia demo lista para probar", margin, y);
  y += 22;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(71, 85, 105);
  y = drawWrappedText(
    doc,
    asset.description ||
      "Material de prueba para recorrer conversaciones, acciones, derivaciones y datos operativos desde Chatboc.",
    margin,
    y,
    contentWidth,
    14,
  );

  y += 22;
  addSectionTitle(doc, "Lo que podes probar", margin, y);
  y += 26;
  const highlights = asset.highlights?.length
    ? asset.highlights
    : ["Atencion guiada", "Acciones contextuales", "Seguimiento operativo", "Derivacion humana"];
  const cardWidth = (contentWidth - 18) / 2;
  highlights.slice(0, 4).forEach((item, index) => {
    const x = margin + (index % 2) * (cardWidth + 18);
    const cardY = y + Math.floor(index / 2) * 58;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, cardY, cardWidth, 44, 8, 8, "FD");
    doc.setTextColor(37, 99, 235);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(`0${index + 1}`, x + 12, cardY + 18);
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(10);
    doc.text(item, x + 42, cardY + 18, { maxWidth: cardWidth - 54 });
  });

  y += 132;
  addSectionTitle(doc, "Catalogo / paquetes demo", margin, y);
  y += 26;
  const packages = asset.packages?.length
    ? asset.packages
    : [
        { name: "Base", detail: "Recorrido guiado y consultas frecuentes.", price: "Demo incluido" },
        { name: "Operativo", detail: "Tickets, acciones, adjuntos y seguimiento.", price: "Plan activo" },
        { name: "Enterprise", detail: "Analytics, voz realtime, WhatsApp y handoff.", price: "Plan premium" },
      ];

  packages.slice(0, 4).forEach((item, index) => {
    doc.setFillColor(index % 2 === 0 ? 255 : 248, index % 2 === 0 ? 255 : 250, index % 2 === 0 ? 255 : 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, y, contentWidth, 48, 8, 8, "FD");
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(item.name, margin + 14, y + 18);
    doc.setTextColor(71, 85, 105);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.text(item.detail, margin + 14, y + 34, { maxWidth: contentWidth - 160 });
    doc.setTextColor(37, 99, 235);
    doc.setFont("helvetica", "bold");
    doc.text(item.price, margin + contentWidth - 120, y + 26, { maxWidth: 110, align: "right" });
    y += 56;
  });

  y += 10;
  addSectionTitle(doc, "Flujos sugeridos", margin, y);
  y += 26;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(51, 65, 85);
  (asset.workflows || ["Iniciar consulta", "Adjuntar contexto", "Confirmar accion", "Recibir resumen"]).slice(0, 5).forEach((item) => {
    doc.circle(margin + 4, y - 3, 2, "F");
    doc.text(item, margin + 16, y);
    y += 17;
  });

  const questions = asset.questions || [
    "Quiero iniciar una consulta",
    "Necesito hablar con una persona",
    "Puedo adjuntar una imagen o documento?",
  ];
  y += 12;
  addSectionTitle(doc, "Preguntas para probar", margin, y);
  y += 26;
  doc.setTextColor(71, 85, 105);
  questions.slice(0, 3).forEach((item) => {
    doc.setFillColor(239, 246, 255);
    doc.roundedRect(margin, y - 12, contentWidth, 28, 7, 7, "F");
    doc.text(`"${item}"`, margin + 12, y + 5, { maxWidth: contentWidth - 24 });
    y += 36;
  });

  doc.setDrawColor(226, 232, 240);
  doc.line(margin, 780, pageWidth - margin, 780);
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(8);
  doc.text(`Generado por Chatboc · ${now.toLocaleDateString("es-AR")}`, margin, 800);
  doc.text("Material demo. Los precios y paquetes son referenciales.", pageWidth - margin, 800, { align: "right" });

  doc.save(`${asset.slug}-chatboc-demo.pdf`);
};

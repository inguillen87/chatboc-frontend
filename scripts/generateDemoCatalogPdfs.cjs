const fs = require('fs');
const path = require('path');

const outputDir = path.join(__dirname, '..', 'public', 'demo-catalogs');

const catalogs = [
  ['municipio', 'Municipio inteligente', 'Gobierno', ['Mesa de entrada digital', 'Reclamos con ubicacion', 'Turnos y tramites', 'WhatsApp ciudadano']],
  ['concejo-deliberante', 'Concejo deliberante', 'Gobierno', ['Expedientes y sesiones', 'Consultas vecinales', 'Agenda legislativa', 'Derivacion a bloque']],
  ['legisladores', 'Legisladores y bloques', 'Gobierno', ['Proyectos', 'Territorio', 'Agenda publica', 'Consultas ciudadanas']],
  ['campana-electoral', 'Campana electoral', 'Gobierno', ['Voluntarios', 'Propuestas', 'Recorridas', 'Segmentos territoriales']],
  ['almacen', 'Almacen de barrio', 'Empresas', ['Pedidos por foto', 'Promos semanales', 'Stock basico', 'Entrega barrial']],
  ['bodega', 'Bodega boutique', 'Empresas', ['Catalogo de vinos', 'Catas privadas', 'Maridajes', 'Envios premium']],
  ['kiosco', 'Kiosco 24hs', 'Empresas', ['Combos rapidos', 'Bebidas frias', 'Snacks', 'Pedidos por WhatsApp']],
  ['restaurante', 'Restaurante', 'Empresas', ['Menu digital', 'Reservas', 'Delivery', 'Promos por horario']],
  ['ferreteria', 'Ferreteria tecnica', 'Empresas', ['Catalogo tecnico', 'Asesoramiento', 'Cotizaciones', 'Stock por sucursal']],
  ['tienda_ropa', 'Tienda de ropa', 'Empresas', ['Talles y colores', 'Reservas', 'Cambios', 'Colecciones']],
  ['logistica', 'Logistica y transporte', 'Empresas', ['Seguimiento', 'Cotizacion', 'Retiros', 'Entrega programada']],
  ['seguros', 'Seguros y riesgos', 'Empresas', ['Polizas', 'Siniestros', 'Leads', 'Handoff humano']],
  ['fintech', 'Fintech y banca', 'Empresas', ['Onboarding', 'Reclamos', 'KYC', 'Soporte 24/7']],
  ['inmobiliaria', 'Inmobiliaria', 'Empresas', ['Propiedades', 'Visitas', 'Reservas', 'Leads calificados']],
  ['industria', 'Industria y energia', 'Empresas', ['Soporte tecnico', 'Ventas B2B', 'Mantenimiento', 'Operaciones']],
  ['clinica', 'Clinica medica', 'Empresas', ['Turnos', 'Estudios', 'Consultas', 'Recordatorios']],
  ['farmacia', 'Farmacia', 'Empresas', ['Recetas', 'Disponibilidad', 'Envios', 'Pagos']],
  ['colegio-demo', 'Colegio privado integral', 'Colegios', ['Inasistencias', 'Comunicados', 'Secretaria', 'Casos sensibles']],
  ['colegio-bilingue', 'Instituto bilingue', 'Colegios', ['Admisiones', 'Agenda', 'Cuotas', 'Convivencia']],
  ['escuela-publica', 'Escuela publica', 'Colegios', ['Asistencia', 'Certificados', 'Orientacion', 'Comedor']],
  ['supervision-escolar', 'Supervision escolar', 'Colegios', ['Casos por sede', 'Derivaciones', 'Reportes', 'Seguimiento']],
];

const escapePdf = (value) =>
  String(value)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/[^\x20-\x7E]/g, '');

const money = (value) => `$${value.toLocaleString('es-AR')}`;

const buildPdf = ({ slug, title, sector, features }) => {
  const base = 89000 + slug.length * 1700;
  const plans = [
    ['Starter', money(base), 'Widget + demo guiada + reportes basicos'],
    ['Growth', money(base * 2), 'Widget, WhatsApp, tickets y analytics'],
    ['Enterprise', 'A medida', 'Realtime voice, integraciones y SLA avanzado'],
  ];

  const lines = [];
  const text = (x, y, size, value) => {
    lines.push(`BT /F1 ${size} Tf ${x} ${y} Td (${escapePdf(value)}) Tj ET`);
  };
  const box = (x, y, w, h, color) => {
    lines.push(`${color} rg ${x} ${y} ${w} ${h} re f`);
  };

  box(0, 742, 595, 100, '0.02 0.14 0.42');
  text(48, 800, 22, 'Chatboc Demo Catalog');
  text(48, 772, 34, title);
  text(48, 748, 12, `${sector} / ${slug}`);

  text(48, 704, 16, 'Experiencia incluida');
  features.forEach((item, index) => {
    text(62, 676 - index * 24, 12, `- ${item}`);
  });

  text(48, 552, 16, 'Paquetes demo');
  plans.forEach((plan, index) => {
    const y = 512 - index * 70;
    box(48, y - 18, 499, 52, index === 1 ? '0.92 0.96 1' : '0.96 0.97 0.99');
    text(66, y + 10, 14, plan[0]);
    text(220, y + 10, 14, plan[1]);
    text(66, y - 10, 11, plan[2]);
  });

  text(48, 270, 16, 'Como se prueba');
  [
    '1. Elegi el pilar y la categoria en /demo.',
    '2. Abrí el widget y consulta por precios, disponibilidad o tramites.',
    '3. Pedi derivacion humana, resumen por WhatsApp o descarga de catalogo.',
  ].forEach((item, index) => text(62, 242 - index * 24, 12, item));

  box(0, 0, 595, 54, '0.02 0.14 0.42');
  text(48, 22, 11, 'Catalogo demo generado para Chatboc. Valores y ejemplos no contractuales.');

  const stream = lines.join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(stream, 'utf8')} >>\nstream\n${stream}\nendstream`,
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return pdf;
};

fs.mkdirSync(outputDir, { recursive: true });

const manifest = catalogs.map(([slug, title, sector, features]) => {
  const fileName = `${slug}.pdf`;
  fs.writeFileSync(
    path.join(outputDir, fileName),
    buildPdf({ slug, title, sector, features }),
    'binary',
  );
  return {
    slug,
    title,
    sector,
    href: `/demo-catalogs/${fileName}`,
    features,
  };
});

fs.writeFileSync(
  path.join(outputDir, 'manifest.json'),
  `${JSON.stringify({ version: 'demo.catalog_assets.v1', items: manifest }, null, 2)}\n`,
);

console.log(`Generated ${manifest.length} demo catalogs in ${outputDir}`);

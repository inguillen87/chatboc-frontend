import { Rubro } from '@/types/rubro';

// Defined static hierarchy for Demos
// This structure forces a clean layout regardless of backend fragmentation
export const DEMO_HIERARCHY: Rubro[] = [
  // --- ROOT 1: Sector Público ---
  {
    id: 1,
    nombre: "Sector Público",
    clave: "publico_root",
    padre_id: null,
    subrubros: [
      {
        id: 11,
        nombre: "Gobiernos locales",
        padre_id: 1,
        subrubros: [
          {
            id: 101,
            nombre: "Municipio Digital",
            padre_id: 11,
            demo: { id: 101, slug: "municipio", nombre: "Municipio Digital", descripcion: "Trámites, reclamos y turismo en un solo asistente." },
          },
        ],
      },
      {
        id: 12,
        nombre: "Atención ciudadana",
        padre_id: 1,
        subrubros: [
          {
            id: 102,
            nombre: "Reclamos y Servicios",
            padre_id: 12,
            demo: { id: 102, slug: "municipio", nombre: "Reclamos en línea", descripcion: "Seguimiento de pedidos, reclamos y turnos." },
          },
          {
            id: 103,
            nombre: "Turismo y Cultura",
            padre_id: 12,
            demo: { id: 103, slug: "municipio", nombre: "Agenda Turística", descripcion: "Eventos, reservas y encuestas en vivo." },
          },
        ],
      },
    ],
  },

  // --- ROOT 2: Empresas ---
  {
    id: 2,
    nombre: "Empresas",
    clave: "empresas_root",
    padre_id: null,
    subrubros: [
      {
        id: 21,
        nombre: "Alimentos y Bebidas",
        padre_id: 2,
        subrubros: [
          { id: 204, nombre: "Bodega Boutique", padre_id: 21, demo: { id: 204, slug: "bodega", nombre: "Bodega Demo", descripcion: "Cartilla de vinos, reservas y envíos." } },
          { id: 206, nombre: "Restaurante & Takeaway", padre_id: 21, demo: { id: 206, slug: "bodega", nombre: "Restaurante Demo", descripcion: "Menús dinámicos, reservas y pagos." } },
          { id: 205, nombre: "Kiosco 24hs", padre_id: 21, demo: { id: 205, slug: "almacen", nombre: "Kiosco Demo", descripcion: "Pedidos rápidos con catálogo visual." } }
        ]
      },
      {
        id: 22,
        nombre: "Retail y Comercios",
        padre_id: 2,
        subrubros: [
           { id: 202, nombre: "Ferretería Técnica", padre_id: 22, demo: { id: 202, slug: "ferreteria", nombre: "Ferretería Demo", descripcion: "Catálogo con fichas técnicas y stock." } },
           { id: 203, nombre: "Moda y Calzado", padre_id: 22, demo: { id: 203, slug: "local_comercial_general", nombre: "Retail Demo", descripcion: "Catálogo con talles, reservas y entregas." } },
           { id: 201, nombre: "Mercados y Almacenes", padre_id: 22, demo: { id: 201, slug: "almacen", nombre: "Mercado Demo", descripcion: "Órdenes por foto y programación de envíos." } }
        ]
      },
      {
        id: 23,
        nombre: "Servicios Profesionales",
        padre_id: 2,
        subrubros: [
          { id: 302, nombre: "Logística y Transporte", padre_id: 23, demo: { id: 302, slug: "ferreteria", nombre: "Logística Demo", descripcion: "Cotizaciones, seguimiento y tickets." } },
          { id: 303, nombre: "Seguros y Riesgos", padre_id: 23, demo: { id: 303, slug: "medico_general", nombre: "Seguros Demo", descripcion: "Gestión de pólizas y siniestros 24/7." } },
          { id: 304, nombre: "Fintech y Banca", padre_id: 23, demo: { id: 304, slug: "medico_general", nombre: "Fintech Demo", descripcion: "Onboarding digital y consultas de cuentas." } },
          { id: 305, nombre: "Inmobiliaria", padre_id: 23, demo: { id: 305, slug: "medico_general", nombre: "Inmobiliaria Demo", descripcion: "Agenda de visitas, fichas y reservas." } }
        ]
      },
      {
        id: 24,
        nombre: "Salud y Bienestar",
        padre_id: 2,
        subrubros: [
          { id: 301, nombre: "Clínicas y Centros", padre_id: 24, demo: { id: 301, slug: "medico_general", nombre: "Clínica Demo", descripcion: "Turnos inteligentes y recordatorios." } },
          { id: 307, nombre: "Farmacias", padre_id: 24, demo: { id: 307, slug: "almacen", nombre: "Farmacia Demo", descripcion: "Recetas, envíos y asesor virtual." } }
        ]
      },
      {
        id: 25,
        nombre: "Producción e Industria",
        padre_id: 2,
        subrubros: [
          { id: 306, nombre: "Industria y Soporte", padre_id: 25, demo: { id: 306, slug: "ferreteria", nombre: "Industria Demo", descripcion: "Tickets técnicos, ventas y seguimiento." } }
        ]
      }
    ]
  }
];

// Helper to flatten if needed, though we usually prefer tree
export const getFlatDemoDemos = () => {
    const demos: Rubro[] = [];
    const traverse = (nodes: Rubro[]) => {
        nodes.forEach(node => {
            if (node.demo) demos.push(node);
            if (node.subrubros) traverse(node.subrubros);
        });
    };
    traverse(DEMO_HIERARCHY);
    return demos;
};

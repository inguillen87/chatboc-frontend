import { Rubro } from '@/types/rubro';

// Defined static hierarchy for Demos
// This structure forces a clean layout regardless of backend fragmentation
export const DEMO_HIERARCHY: Rubro[] = [
  // --- ROOT 1: Soluciones para Sector Público (Antes Municipios y Gobierno) ---
  {
    id: 1,
    nombre: "Soluciones para Sector Público",
    clave: "municipios_root",
    padre_id: null,
    subrubros: [
      {
        id: 11,
        nombre: "Municipios",
        padre_id: 1,
        subrubros: [
           { id: 101, nombre: "Municipio Inteligente", padre_id: 11, demo: { id: 101, slug: "municipio", nombre: "Municipio Inteligente", descripcion: "Trámites, reclamos y turismo." } }
        ]
      }
    ]
  },

  // --- ROOT 2: Soluciones para Empresas (Antes Locales Comerciales) ---
  {
    id: 2,
    nombre: "Soluciones para Empresas",
    clave: "comerciales_root",
    padre_id: null,
    subrubros: [
      {
        id: 21,
        nombre: "Alimentación y Bebidas",
        padre_id: 2,
        subrubros: [
          { id: 201, nombre: "Almacén de Barrio", padre_id: 21, demo: { id: 201, slug: "almacen", nombre: "Almacén Demo", descripcion: "Pedidos por foto y stock." } },
          { id: 204, nombre: "Bodega Boutique", padre_id: 21, demo: { id: 204, slug: "bodega", nombre: "Bodega Demo", descripcion: "Vinos, catas y envíos." } },
          { id: 205, nombre: "Kiosco 24hs", padre_id: 21, demo: { id: 205, slug: "almacen", nombre: "Kiosco Demo", descripcion: "Snacks y bebidas." } },
          { id: 206, nombre: "Gastronomía", padre_id: 21, demo: { id: 206, slug: "bodega", nombre: "Restaurante Demo", descripcion: "Reservas y menú digital." } }
        ]
      },
      {
        id: 22,
        nombre: "Retail y Comercios",
        padre_id: 2,
        subrubros: [
           { id: 202, nombre: "Ferretería Técnica", padre_id: 22, demo: { id: 202, slug: "ferreteria", nombre: "Ferretería Demo", descripcion: "Asesoramiento y catálogo." } },
           { id: 203, nombre: "Tienda de Ropa", padre_id: 22, demo: { id: 203, slug: "local_comercial_general", nombre: "Tienda de Ropa Demo", descripcion: "Moda, talles y reservas." } }
        ]
      },
      {
        id: 23,
        nombre: "Servicios Profesionales",
        padre_id: 2,
        subrubros: [
          { id: 302, nombre: "Logística y Transporte", padre_id: 23, demo: { id: 302, slug: "ferreteria", nombre: "Logística Demo", descripcion: "Seguimiento y cotizaciones." } },
          { id: 303, nombre: "Seguros y Riesgos", padre_id: 23, demo: { id: 303, slug: "medico_general", nombre: "Seguros Demo", descripcion: "Pólizas y siniestros." } },
          { id: 304, nombre: "Fintech y Banca", padre_id: 23, demo: { id: 304, slug: "medico_general", nombre: "Fintech Demo", descripcion: "Atención al cliente 24/7." } },
          { id: 305, nombre: "Inmobiliaria", padre_id: 23, demo: { id: 305, slug: "medico_general", nombre: "Inmobiliaria Demo", descripcion: "Propiedades y citas." } },
          { id: 306, nombre: "Energía e Industria", padre_id: 23, demo: { id: 306, slug: "ferreteria", nombre: "Industria Demo", descripcion: "Soporte técnico y ventas." } }
        ]
      },
      {
        id: 24,
        nombre: "Salud y Bienestar",
        padre_id: 2,
        subrubros: [
          { id: 301, nombre: "Salud y Medicina", padre_id: 24, demo: { id: 301, slug: "medico_general", nombre: "Clínica Demo", descripcion: "Turnos y consultas." } },
          { id: 307, nombre: "Farmacia", padre_id: 24, demo: { id: 307, slug: "almacen", nombre: "Farmacia Demo", descripcion: "Recetas y envíos." } }
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

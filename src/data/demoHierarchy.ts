import { Rubro } from '@/types/rubro';
import type { DemoSectorGroup } from '@/features/demo/demoTypes';

export const DEMO_SECTOR_GROUPS: DemoSectorGroup[] = [
  {
    key: 'gobierno',
    label: 'Gobiernos',
    description: 'Municipios, concejos, legisladores, campanas y atencion publica.',
    cta_label: 'Iniciar demo publica',
    tenant_slug: 'municipio',
  },
  {
    key: 'empresas',
    label: 'Empresas',
    description: 'Comercios, servicios, salud, industria, ventas y operaciones.',
    cta_label: 'Iniciar demo empresa',
    tenant_slug: 'bodega',
  },
  {
    key: 'educacion',
    label: 'Colegios',
    description: 'Instituciones publicas y privadas, secretaria, familias, casos escolares y WhatsApp.',
    cta_label: 'Iniciar demo colegio',
    tenant_slug: 'colegio-demo',
  },
];

export const DEMO_HIERARCHY: Rubro[] = [
  {
    id: 1,
    nombre: 'Gobiernos y sector publico',
    clave: 'municipios_root',
    padre_id: null,
    subrubros: [
      {
        id: 11,
        nombre: 'Municipios',
        padre_id: 1,
        subrubros: [
          {
            id: 101,
            nombre: 'Municipio inteligente',
            padre_id: 11,
            demo: {
              id: 101,
              slug: 'municipio',
              nombre: 'Municipio inteligente',
              descripcion: 'Tramites, reclamos, turnos, turismo y WhatsApp.',
            },
          },
        ],
      },
      {
        id: 12,
        nombre: 'Instituciones legislativas',
        padre_id: 1,
        subrubros: [
          {
            id: 121,
            nombre: 'Concejo deliberante',
            padre_id: 12,
            demo: {
              id: 121,
              slug: 'concejo-deliberante',
              nombre: 'Concejo deliberante demo',
              descripcion: 'Sesiones, expedientes, proyectos y consultas vecinales.',
            },
          },
          {
            id: 122,
            nombre: 'Legisladores y bloques',
            padre_id: 12,
            demo: {
              id: 122,
              slug: 'legisladores',
              nombre: 'Legisladores demo',
              descripcion: 'Agenda territorial, proyectos y atencion ciudadana.',
            },
          },
        ],
      },
      {
        id: 13,
        nombre: 'Comunicacion publica',
        padre_id: 1,
        subrubros: [
          {
            id: 131,
            nombre: 'Campana electoral',
            padre_id: 13,
            demo: {
              id: 131,
              slug: 'campana-electoral',
              nombre: 'Campana electoral demo',
              descripcion: 'Propuestas, voluntarios, recorridas y seguimiento territorial.',
            },
          },
        ],
      },
    ],
  },
  {
    id: 2,
    nombre: 'Empresas y comercios',
    clave: 'comerciales_root',
    padre_id: null,
    subrubros: [
      {
        id: 21,
        nombre: 'Alimentos y bebidas',
        padre_id: 2,
        subrubros: [
          {
            id: 201,
            nombre: 'Almacen de barrio',
            padre_id: 21,
            demo: {
              id: 201,
              slug: 'almacen',
              nombre: 'Almacen demo',
              descripcion: 'Pedidos por foto, stock, promos y entregas.',
            },
          },
          {
            id: 204,
            nombre: 'Bodega boutique',
            padre_id: 21,
            demo: {
              id: 204,
              slug: 'bodega',
              nombre: 'Bodega demo',
              descripcion: 'Vinos, catas, catalogo, envios y ventas consultivas.',
            },
          },
          {
            id: 205,
            nombre: 'Kiosco 24hs',
            padre_id: 21,
            demo: {
              id: 205,
              slug: 'kiosco',
              nombre: 'Kiosco demo',
              descripcion: 'Snacks, bebidas, combos y pedidos rapidos.',
            },
          },
          {
            id: 206,
            nombre: 'Restaurante',
            padre_id: 21,
            demo: {
              id: 206,
              slug: 'restaurante',
              nombre: 'Restaurante demo',
              descripcion: 'Reservas, menu digital, delivery y consultas.',
            },
          },
        ],
      },
      {
        id: 22,
        nombre: 'Retail y tiendas',
        padre_id: 2,
        subrubros: [
          {
            id: 202,
            nombre: 'Ferreteria tecnica',
            padre_id: 22,
            demo: {
              id: 202,
              slug: 'ferreteria',
              nombre: 'Ferreteria demo',
              descripcion: 'Asesoramiento, catalogo, cotizaciones y stock.',
            },
          },
          {
            id: 203,
            nombre: 'Tienda de ropa',
            padre_id: 22,
            demo: {
              id: 203,
              slug: 'tienda_ropa',
              nombre: 'Tienda de ropa demo',
              descripcion: 'Talles, colores, reservas, carrito y cambios.',
            },
          },
        ],
      },
      {
        id: 23,
        nombre: 'Servicios profesionales',
        padre_id: 2,
        subrubros: [
          {
            id: 302,
            nombre: 'Logistica y transporte',
            padre_id: 23,
            demo: {
              id: 302,
              slug: 'logistica',
              nombre: 'Logistica demo',
              descripcion: 'Seguimiento, cotizaciones, retiros y entregas.',
            },
          },
          {
            id: 303,
            nombre: 'Seguros y riesgos',
            padre_id: 23,
            demo: {
              id: 303,
              slug: 'seguros',
              nombre: 'Seguros demo',
              descripcion: 'Polizas, siniestros, leads y derivacion humana.',
            },
          },
          {
            id: 304,
            nombre: 'Fintech y banca',
            padre_id: 23,
            demo: {
              id: 304,
              slug: 'fintech',
              nombre: 'Fintech demo',
              descripcion: 'Atencion 24/7, onboarding, reclamos y KYC.',
            },
          },
          {
            id: 305,
            nombre: 'Inmobiliaria',
            padre_id: 23,
            demo: {
              id: 305,
              slug: 'inmobiliaria',
              nombre: 'Inmobiliaria demo',
              descripcion: 'Propiedades, visitas, leads y reservas.',
            },
          },
          {
            id: 306,
            nombre: 'Industria y energia',
            padre_id: 23,
            demo: {
              id: 306,
              slug: 'industria',
              nombre: 'Industria demo',
              descripcion: 'Soporte tecnico, ventas B2B y operaciones.',
            },
          },
        ],
      },
      {
        id: 24,
        nombre: 'Salud y bienestar',
        padre_id: 2,
        subrubros: [
          {
            id: 301,
            nombre: 'Clinica medica',
            padre_id: 24,
            demo: {
              id: 301,
              slug: 'clinica',
              nombre: 'Clinica demo',
              descripcion: 'Turnos, consultas, estudios y seguimiento.',
            },
          },
          {
            id: 307,
            nombre: 'Farmacia',
            padre_id: 24,
            demo: {
              id: 307,
              slug: 'farmacia',
              nombre: 'Farmacia demo',
              descripcion: 'Recetas, disponibilidad, entregas y pagos.',
            },
          },
        ],
      },
    ],
  },
  {
    id: 3,
    nombre: 'Colegios e instituciones educativas',
    clave: 'educacion_root',
    padre_id: null,
    subrubros: [
      {
        id: 31,
        nombre: 'Colegios privados',
        padre_id: 3,
        subrubros: [
          {
            id: 311,
            nombre: 'Colegio privado integral',
            padre_id: 31,
            demo: {
              id: 311,
              slug: 'colegio-demo',
              nombre: 'Colegio demo',
              descripcion: 'Secretaria, inasistencias, comunicados y familias.',
            },
          },
          {
            id: 312,
            nombre: 'Instituto bilingue',
            padre_id: 31,
            demo: {
              id: 312,
              slug: 'colegio-bilingue',
              nombre: 'Instituto bilingue demo',
              descripcion: 'Admisiones, agenda, cuotas y convivencia.',
            },
          },
        ],
      },
      {
        id: 32,
        nombre: 'Educacion publica',
        padre_id: 3,
        subrubros: [
          {
            id: 321,
            nombre: 'Escuela publica',
            padre_id: 32,
            demo: {
              id: 321,
              slug: 'escuela-publica',
              nombre: 'Escuela publica demo',
              descripcion: 'Asistencia, certificados, comunicados y orientacion.',
            },
          },
          {
            id: 322,
            nombre: 'Supervision escolar',
            padre_id: 32,
            demo: {
              id: 322,
              slug: 'supervision-escolar',
              nombre: 'Supervision escolar demo',
              descripcion: 'Casos por sede, derivaciones y seguimiento.',
            },
          },
        ],
      },
    ],
  },
];

export const getFlatDemoDemos = () => {
  const demos: Rubro[] = [];
  const traverse = (nodes: Rubro[]) => {
    nodes.forEach((node) => {
      if (node.demo) demos.push(node);
      if (node.subrubros) traverse(node.subrubros);
    });
  };
  traverse(DEMO_HIERARCHY);
  return demos;
};

import '@testing-library/jest-dom';

// Puedes añadir aquí configuraciones globales para tus tests si es necesario.
// Por ejemplo, mocks globales, etc.

// Mock de react-router-dom para useNavigate y useParams
// Esto es un mock muy básico. Puede que necesites ajustarlo
// o usar una librería como `jest-react-router-mock` si los tests son complejos.
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn((path: string) => console.log(`Mocked navigate to: ${path}`)),
    useParams: () => ({
      pymeId: 'test-pyme-id', // Valor por defecto para pymeId
      mappingId: undefined, // Valor por defecto para mappingId
      // Puedes añadir otros parámetros comunes aquí o ajustarlos por test
    }),
    Link: ({ children, to }: { children: React.ReactNode, to: string }) =>
      React.createElement('a', { href: to }, children),
  };
});


// Mock para `apiFetch` globalmente para evitar llamadas reales a API en tests unitarios/integración.
// Deberás ajustar el mock para que devuelva datos específicos según el test si es necesario.
vi.mock('@/utils/api', async () => {
  const actual = await vi.importActual('@/utils/api');
  return {
    ...actual,
    apiFetch: vi.fn((url: string, options?: RequestInit) => {
      console.log(`Mocked apiFetch call to: ${url} with options:`, options);
      if (url.includes('/catalog-mappings') && options?.method === 'POST') {
        return Promise.resolve({ id: 'new-mapping-id', ...JSON.parse(options.body as string) });
      }
      if (url.includes('/catalog-mappings/') && (options?.method === 'PUT' || !options?.method)) {
        // For GET by id or PUT
        return Promise.resolve({
          id: url.substring(url.lastIndexOf('/') + 1),
          name: 'Test Mapping Loaded',
          pymeId: 'test-pyme-id',
          mappings: { 'nombre': 'Product Name', 'precio': 'Price' },
          fileSettings: { hasHeaders: true, skipRows: 0 }
        });
      }
      // Default mock response for other GET requests or unhandled cases
      return Promise.resolve({});
    }),
    getErrorMessage: (error: any, defaultMessage?: string) => {
      if (error instanceof Error) return error.message;
      if (typeof error === 'string') return error;
      return defaultMessage || 'An unknown error occurred';
    }
  };
});


// Mock para los parsers de archivos, ya que JSDOM no tiene FileSystem ni la capacidad de leer archivos reales.
// Deberás simular la salida de estos parsers en tus tests.
vi.mock('papaparse', () => ({
  default: {
    parse: vi.fn((fileContent, config) => {
      console.log('Mocked Papa.parse called with config:', config);
      // Simulate parsing based on config or provide fixed data
      if (config?.preview && (fileContent as string).includes("Nombre,Precio")) { // Simple check for content
         return {
          data: [
            ['Nombre', 'Precio', 'SKU'], // Headers
            ['Producto 1', '100', 'P1'],
            ['Producto 2', '200', 'P2'],
          ],
          errors: [],
          meta: { delimiter: ',', PME_ID: 'test-pyme-id' },
        };
      }
      return { data: [], errors: [{message: "Mock parse error"}], meta: {} };
    }),
  }
}));

vi.mock('xlsx', () => ({
  read: vi.fn((data, opts) => {
    console.log('Mocked XLSX.read called');
    return {
      SheetNames: ['Sheet1', 'Sheet2'],
      Sheets: {
        'Sheet1': {
          '!ref': 'A1:C3', // Example range
           // Raw cell objects, consult XLSX docs for exact structure if needed for complex tests
        },
        'Sheet2': {},
      },
    };
  }),
  utils: {
    sheet_to_json: vi.fn((worksheet, opts) => {
      console.log('Mocked XLSX.utils.sheet_to_json called with opts:', opts);
      if (opts && opts.header === 1) { // Array of arrays
        if (worksheet === mockXlsxSheets.Sheet1) { // Check which sheet is being parsed
          return [
            ['Name', 'Price', 'Code'], // Headers
            ['Excel Product 1', '150', 'E1'],
            ['Excel Product 2', '250', 'E2'],
          ];
        }
      }
      return []; // Default empty data
    }),
  },
}));

// Helper to access the mock sheet data if needed in tests
export const mockXlsxSheets = {
  Sheet1: { /* some identifier or content for Sheet1 */ },
  Sheet2: { /* some identifier or content for Sheet2 */ },
};


// Mock para toast
vi.mock('@/components/ui/use-toast', () => ({
  toast: vi.fn((props) => {
    console.log('Toast called:', props.title, props.description);
  }),
  // Si tienes un ToasterProvider o algo similar, también podrías necesitar mockearlo o envolver tus componentes de test con él.
}));

// Para 'lucide-react' icons, si causan problemas en JSDOM (a veces lo hacen)
// Puedes mockearlos para que devuelvan un simple div o span.
// Esto es un mock genérico para todos los iconos de lucide-react.
// Si solo usas algunos específicos, puedes mockearlos individualmente.
vi.mock('lucide-react', async () => {
  const actual = await vi.importActual('lucide-react');
  const icons = actual as Record<string, React.FC<any>>;
  const mockedIcons: Record<string, React.FC<any>> = {};

  for (const key in icons) {
    // eslint-disable-next-line react/display-name
    mockedIcons[key] = (props: any) => React.createElement('div', { ...props, 'data-lucide-icon': key });
  }

  return {
    ...mockedIcons, // Export all icons mocked
    // Si necesitas exportar algo más de lucide-react que no sea un icono, agrégalo aquí.
    // Por ejemplo, si usaras `createLucideIcon` u otras utilidades directamente.
  };
});


// Limpiar mocks después de cada test si es necesario (buena práctica)
// afterEach(() => {
//   vi.clearAllMocks();
// });

// Configuración global para JSDOM si necesitas extenderla
// Object.defineProperty(window, 'matchMedia', {
//   writable: true,
//   value: vi.fn().mockImplementation(query => ({
//     matches: false,
//     media: query,
//     onchange: null,
//     addListener: vi.fn(), // deprecated
//     removeListener: vi.fn(), // deprecated
//     addEventListener: vi.fn(),
//     removeEventListener: vi.fn(),
//     dispatchEvent: vi.fn(),
//   })),
// });
import React from 'react'; // Necesario para React.createElement en el mock de Link/lucide-react
import { vi } from 'vitest'; // Necesario para vi.mock, vi.fn etc.

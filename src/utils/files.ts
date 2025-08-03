import * as XLSX from 'xlsx';
import Papa from 'papaparse';

// src/utils/files.ts
export const formatFileSize = (bytes?: number): string => {
  if (bytes === undefined || bytes === null || isNaN(bytes)) return '';
  if (bytes === 0) return '(0 KB)';

  const k = 1024;
  
  if (bytes < k) {
    return `(${bytes} Bytes)`;
  }
  
  if (bytes < 104857.6) { // Menos de 0.1 MB (pero >= 1KB), mostrar en KB
    return `(${(bytes / k).toFixed(1)} KB)`;
  } else { // 0.1 MB o más, mostrar en MB
    return `(${(bytes / (k * k)).toFixed(1)} MB)`;
  }
};


// --- NEW FILE PARSING LOGIC ---

export interface ProductData {
  [key: string]: any; // Allows any string key
  nombre?: string;
  precio?: number | string;
  sku?: string;
  // ... other fields from your systemFields
}

export interface MappingConfig {
  mappings: Record<string, string | null>; // { systemFieldKey: userColumnName }
  fileSettings: {
    hasHeaders: boolean;
    skipRows: number;
    sheetName?: string;
  };
}

export interface ParseResult {
  data: ProductData[];
  errors: string[];
}

/**
 * Parses an entire catalog file (CSV or Excel) based on a mapping configuration.
 * @param file The file to parse.
 * @param config The mapping configuration.
 * @returns A promise that resolves to a ParseResult.
 */
export async function parseCatalogFile(
  file: File,
  config: MappingConfig
): Promise<ParseResult> {
  const { mappings, fileSettings } = config;
  const result: ParseResult = { data: [], errors: [] };

  try {
    const fileType = file.name.split('.').pop()?.toLowerCase();
    let rawData: any[] = [];

    // 1. Read file into a consistent format (array of objects or array of arrays)
    if (fileType === 'csv' || fileType === 'txt') {
      const text = await file.text();
      const papaResult = Papa.parse(text, {
        header: fileSettings.hasHeaders,
        skipEmptyLines: true,
      });

      if (papaResult.errors.length > 0) {
        result.errors.push(...papaResult.errors.map(e => e.message));
        return result;
      }
      rawData = papaResult.data;

    } else if (fileType === 'xlsx' || fileType === 'xls') {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const sheetName = fileSettings.sheetName || workbook.SheetNames[0];
      if (!workbook.SheetNames.includes(sheetName)) {
        throw new Error(`La hoja "${sheetName}" no se encuentra en el archivo.`);
      }
      const worksheet = workbook.Sheets[sheetName];
      // `sheet_to_json` with `header: 1` gives array of arrays, `header: 'A'` would give objects with A,B,C keys
      // using `defval: ''` is important to not skip empty cells
      rawData = XLSX.utils.sheet_to_json(worksheet, {
        header: fileSettings.hasHeaders ? undefined : 1, // undefined lets library auto-detect, 1 gives array of arrays
        defval: '',
      });
    } else {
      throw new Error(`Tipo de archivo no soportado: ${fileType}`);
    }

    // Skip initial rows if necessary (for data that has no headers but junk at the top)
    const dataToProcess = rawData.slice(fileSettings.skipRows);

    // 2. Map the raw data to structured product data
    const invertedMapping: Record<string, string> = {}; // { userColumnName: systemFieldKey }
    for (const key in mappings) {
      if (mappings[key]) {
        invertedMapping[mappings[key] as string] = key;
      }
    }

    result.data = dataToProcess.map((row: any) => {
      const product: ProductData = {};
      for (const userHeader in row) {
        const systemKey = invertedMapping[userHeader];
        if (systemKey) {
          product[systemKey] = row[userHeader];
        } else {
          // Store unmapped columns if needed, for example under a special key
          // product.unmapped = { ...product.unmapped, [userHeader]: row[userHeader] };
        }
      }
      // TODO: Add data cleaning/type conversion logic here if needed
      // e.g., ensure price is a number
      if (product.precio && typeof product.precio === 'string') {
          product.precio = parseFloat(product.precio.replace(/[^0-9.,]/g, '').replace(',', '.'));
          if(isNaN(product.precio)) product.precio = undefined;
      }

      return product;
    }).filter(p => p.nombre); // Filter out rows that don't have at least a product name

  } catch (e: any) {
    result.errors.push(e.message || "Un error desconocido ocurrió durante el parseo.");
  }

  return result;
}
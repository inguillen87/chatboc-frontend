import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/use-toast';
import { ArrowLeft, Loader2, UploadCloud, AlertTriangle, Save, Wand2 } from 'lucide-react';
import { apiFetch, getErrorMessage } from '@/utils/api';
import { DEFAULT_SYSTEM_FIELDS, SystemField, MatchedMapping, suggestMappings } from '@/utils/columnMatcher';
import ColumnMappingRow from '@/components/admin/ColumnMappingRow'; // New component
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import Papa from 'papaparse'; // For CSV parsing
import * as XLSX from 'xlsx'; // For Excel parsing

// Define the structure for a saved mapping configuration
interface SavedMappingConfig {
  id?: string; // or number, depending on your backend
  pymeId: string;
  name: string; // User-defined name for this mapping configuration
  mappings: Record<string, string | null>; // { systemFieldKey: userColumnName }
  fileSettings: {
    hasHeaders: boolean;
    skipRows: number;
    delimiter?: string; // For CSV
    sheetName?: string; // For Excel
  };
}

import { useLocation } from 'react-router-dom'; // Import useLocation

const CatalogMappingPage: React.FC = () => {
  const { pymeId, mappingId } = useParams<{ pymeId: string; mappingId?: string }>();
  const navigate = useNavigate();
  const location = useLocation(); // Get location object

  // Attempt to get preloadedFile from navigation state
  const preloadedFile = (location.state as { preloadedFile?: File })?.preloadedFile;

  const [file, setFile] = useState<File | null>(preloadedFile || null);
  const [userColumns, setUserColumns] = useState<string[]>([]);
  const [currentMappings, setCurrentMappings] = useState<Record<string, string | null>>({});
  const [suggestedMappingsCache, setSuggestedMappingsCache] = useState<Record<string, string | null>>({});

  const [systemFields] = useState<SystemField[]>(DEFAULT_SYSTEM_FIELDS);

  const [hasHeaders, setHasHeaders] = useState(true);
  const [skipRows, setSkipRows] = useState(0);
  const [csvDelimiter, setCsvDelimiter] = useState<string>(',');
  const [excelSheetName, setExcelSheetName] = useState<string>('');
  const [availableSheetNames, setAvailableSheetNames] = useState<string[]>([]);

  const [mappingName, setMappingName] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load existing mapping configuration if mappingId is present
  useEffect(() => {
    if (mappingId && pymeId) {
      setIsLoading(true);
      apiFetch<SavedMappingConfig>(`/pymes/${pymeId}/catalog-mappings/${mappingId}`)
        .then(config => {
          setMappingName(config.name);
          setCurrentMappings(config.mappings);
          setHasHeaders(config.fileSettings.hasHeaders);
          setSkipRows(config.fileSettings.skipRows);
          if (config.fileSettings.delimiter) setCsvDelimiter(config.fileSettings.delimiter);
          if (config.fileSettings.sheetName) setExcelSheetName(config.fileSettings.sheetName);
          // Note: File itself is not loaded, user needs to re-upload if they want to re-parse headers
          // Or, we could store userColumns in the backend if that's desired. For now, re-parse is fine.
          toast({ title: "Configuración de mapeo cargada." });
        })
        .catch(err => {
          setError(getErrorMessage(err, "Error al cargar la configuración de mapeo."));
          toast({ variant: "destructive", title: "Error", description: getErrorMessage(err) });
        })
        .finally(() => setIsLoading(false));
    } else if (preloadedFile && !mappingId) { // If creating new and file is preloaded
      // Automatically parse headers for the preloaded file
      // Ensure this only runs once or is idempotent if component re-renders
      // No need to call setFile again as it's initialized in useState
      // The parseFileHeaders will be called by the useEffect below that watches `file`
    }
  }, [mappingId, pymeId, preloadedFile]); // Add preloadedFile to dependency array

  // Effect to parse file when `file` state changes (either by upload or preload)
  useEffect(() => {
    if (file) {
       // Reset relevant states when a new file is set (or preloaded)
      setError(null);
      setUserColumns([]);
      setCurrentMappings({});
      setSuggestedMappingsCache({});
      setExcelSheetName('');
      setAvailableSheetNames([]);
      // Default parsing options, can be adjusted by user later
      parseFileHeaders(file, true, 0, undefined, undefined);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]); // Only depends on `file` object itself. parseFileHeaders has its own deps.


  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
      setUserColumns([]); // Reset columns until parsed
      setCurrentMappings({}); // Reset mappings
      setSuggestedMappingsCache({});
      // The main parsing logic will be triggered by the useEffect watching `file`
    }
  };

  const parseFileHeaders = useCallback(async (
    currentFile: File,
    usesHeaders: boolean,
    rowsToSkip: number,
    selectedSheet?: string,
    delimiter?: string
  ) => {
    if (!currentFile) return;
    setIsParsing(true);
    setError(null);

    try {
      let headers: string[] = [];
      const fileType = currentFile.name.split('.').pop()?.toLowerCase();

      if (fileType === 'csv' || fileType === 'txt') {
        const text = await currentFile.text();
        const result = Papa.parse(text, {
          preview: rowsToSkip + (usesHeaders ? 1 : 5), // Preview enough rows
          delimiter: delimiter || undefined, // Auto-detect if not provided
          skipEmptyLines: true,
        });

        if (result.errors.length > 0) {
          throw new Error(`Error al parsear CSV: ${result.errors[0].message}`);
        }

        const dataRows = result.data as string[][];
        if (usesHeaders) {
          if (dataRows.length > rowsToSkip) {
            headers = dataRows[rowsToSkip].map(h => h?.trim() || `Columna Sin Nombre ${dataRows[rowsToSkip].indexOf(h) + 1}`);
          } else {
            throw new Error("No hay suficientes filas para extraer encabezados después de saltar las filas especificadas.");
          }
        } else {
          headers = dataRows[rowsToSkip]?.map((_, index) => `Columna ${index + 1}`) || [];
        }
        if(!delimiter && result.meta.delimiter) setCsvDelimiter(result.meta.delimiter);


      } else if (fileType === 'xlsx' || fileType === 'xls') {
        const arrayBuffer = await currentFile.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });

        const sheetNames = workbook.SheetNames;
        setAvailableSheetNames(sheetNames);

        const targetSheetName = selectedSheet || sheetNames[0];
        if (!sheetNames.includes(targetSheetName)) {
            throw new Error(`La hoja "${targetSheetName}" no se encuentra en el archivo Excel.`);
        }
        setExcelSheetName(targetSheetName); // Ensure this is set for future reference

        const worksheet = workbook.Sheets[targetSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, {
          header: 1, // Get arrays of arrays
          range: rowsToSkip, // This effectively skips rows from the top
          defval: '', // Default value for empty cells
        }) as string[][];

        if (usesHeaders) {
          if (jsonData.length > 0) {
            headers = jsonData[0].map(h => String(h)?.trim() || `Columna Sin Nombre ${jsonData[0].indexOf(h) + 1}`);
          } else {
            throw new Error("No hay suficientes filas para extraer encabezados en la hoja seleccionada después de saltar las filas especificadas.");
          }
        } else {
           headers = jsonData[0]?.map((_, index) => `Columna ${index + 1}`) || [];
        }
      } else {
        throw new Error("Tipo de archivo no soportado. Por favor, sube un CSV o Excel.");
      }

      setUserColumns(headers);
      if (headers.length > 0) {
        // Auto-suggest mappings
        const suggestions = suggestMappings(headers, systemFields);
        const newMappings: Record<string, string | null> = {};
        const newSuggestedCache: Record<string, string | null> = {};
        suggestions.forEach(s => {
          newMappings[s.systemFieldKey] = s.userColumn;
          if (s.userColumn) {
            newSuggestedCache[s.systemFieldKey] = s.userColumn;
          }
        });
        setCurrentMappings(newMappings);
        setSuggestedMappingsCache(newSuggestedCache);
        toast({ title: "Encabezados procesados y mapeos sugeridos." });
      } else {
        toast({ variant: "destructive", title: "Advertencia", description: "No se encontraron encabezados/columnas en el archivo con la configuración actual." });
      }

    } catch (e: any) {
      setError(getErrorMessage(e, "Error al procesar el archivo."));
      setUserColumns([]);
      setCurrentMappings({});
      setSuggestedMappingsCache({});
      toast({ variant: "destructive", title: "Error de Parseo", description: getErrorMessage(e) });
    } finally {
      setIsParsing(false);
    }
  }, [systemFields]); // Added systemFields dependency

  const handleMappingChange = (systemFieldKey: string, userColumn: string | null) => {
    setCurrentMappings(prev => ({ ...prev, [systemFieldKey]: userColumn }));
    // If user manually changes a field, it's no longer "suggested" in the same way
    // but the cache helps to re-apply if parsing options change.
  };

  const handleReparse = () => {
    if (file) {
      parseFileHeaders(file, hasHeaders, skipRows, excelSheetName || availableSheetNames[0], csvDelimiter);
    } else {
      toast({ variant: "destructive", title: "Error", description: "Por favor, selecciona un archivo primero." });
    }
  };

  const handleSaveMapping = async () => {
    if (!pymeId) {
      toast({ variant: "destructive", title: "Error", description: "ID de PYME no encontrado." });
      return;
    }
    if (!mappingName.trim()) {
      toast({ variant: "destructive", title: "Error", description: "Por favor, asigna un nombre a esta configuración de mapeo." });
      return;
    }
    if (Object.values(currentMappings).every(v => v === null)) {
        toast({ variant: "destructive", title: "Error", description: "Debes mapear al menos una columna." });
        return;
    }
    // Basic validation: ensure at least 'nombre' (product name) is mapped
    const nameFieldKey = systemFields.find(f => f.label.toLowerCase().includes("nombre"))?.key;
    if (nameFieldKey && !currentMappings[nameFieldKey]) {
        toast({ variant: "destructive", title: "Error", description: "El campo 'Nombre del Producto' (o similar) es obligatorio y debe ser mapeado." });
        return;
    }


    setIsLoading(true);
    const configToSave: SavedMappingConfig = {
      pymeId,
      name: mappingName.trim(),
      mappings: currentMappings,
      fileSettings: {
        hasHeaders,
        skipRows,
        delimiter: file?.name.endsWith('.csv') || file?.name.endsWith('.txt') ? csvDelimiter : undefined,
        sheetName: file?.name.endsWith('.xlsx') || file?.name.endsWith('.xls') ? excelSheetName : undefined,
      },
    };

    const url = mappingId
      ? `/pymes/${pymeId}/catalog-mappings/${mappingId}`
      : `/pymes/${pymeId}/catalog-mappings`;
    const method = mappingId ? 'PUT' : 'POST';

    try {
      const saved = await apiFetch<SavedMappingConfig>(url, { method, body: configToSave });
      toast({ title: "¡Guardado!", description: `Configuración de mapeo "${saved.name}" guardada.` });
      if (!mappingId && saved.id) { // If new, redirect to edit page
        navigate(`/admin/pyme/${pymeId}/catalog-mappings/${saved.id}`, { replace: true });
      } else if (mappingId) {
        // If updating, might want to refresh or confirm. For now, simple toast.
      } else {
         // If it was a new mapping but backend didn't return an ID in a standard way for some reason.
         // Could navigate back to a list page or pyme detail page.
         navigate(`/admin/pyme/${pymeId}`);
      }
    } catch (err) {
      toast({ variant: "destructive", title: "Error al Guardar", description: getErrorMessage(err) });
    } finally {
      setIsLoading(false);
    }
  };

  // Effect to re-parse when file processing options change, only if a file is present
  useEffect(() => {
    if (file) {
      const timer = setTimeout(() => { // Debounce parsing
        parseFileHeaders(file, hasHeaders, skipRows, excelSheetName || (availableSheetNames.length > 0 ? availableSheetNames[0] : undefined), csvDelimiter);
      }, 500);
      return () => clearTimeout(timer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasHeaders, skipRows, csvDelimiter, excelSheetName, file]); // We don't include parseFileHeaders here to avoid loop, its own deps are managed.

  return (
    <div className="container mx-auto p-4 md:p-8">
      <Button variant="outline" size="sm" onClick={() => navigate(`/admin/pyme/${pymeId}`)} className="mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" /> Volver a PYME
      </Button>

      <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-6">
        {mappingId ? "Editar Configuración de Mapeo" : "Crear Nueva Configuración de Mapeo de Catálogo"}
      </h1>

      {error && (
        <div className="bg-destructive/10 border border-destructive text-destructive p-4 rounded-md mb-6 flex items-center">
          <AlertTriangle className="h-5 w-5 mr-3" />
          <div>
            <h4 className="font-semibold">Error</h4>
            <p className="text-sm">{error}</p>
          </div>
        </div>
      )}

      <div className="space-y-8">
        {/* Sección 1: Nombre y Carga de Archivo */}
        <div className="bg-card p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4 text-foreground">1. Configuración General y Archivo</h2>
          <div className="space-y-4">
            <div>
              <Label htmlFor="mappingName" className="text-sm font-medium">Nombre de la Configuración</Label>
              <Input
                id="mappingName"
                type="text"
                value={mappingName}
                onChange={(e) => setMappingName(e.target.value)}
                placeholder="Ej: Mapeo Estándar Productos, Lista Proveedor X"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="fileUpload" className="text-sm font-medium">Archivo de Ejemplo (CSV, Excel)</Label>
              <div className="mt-1 flex items-center space-x-3">
                <Input
                  id="fileUpload"
                  type="file"
                  accept=".csv,.xls,.xlsx,.txt"
                  onChange={handleFileChange}
                  className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                />
                {file && (isParsing ?
                  <Loader2 className="h-5 w-5 animate-spin text-primary" /> :
                  <Button onClick={handleReparse} variant="outline" size="sm" title="Forzar re-análisis del archivo">
                    <Wand2 className="h-4 w-4"/>
                  </Button>
                )}
              </div>
              {file && <p className="text-xs text-muted-foreground mt-1">Archivo seleccionado: {file.name}</p>}
              <p className="text-xs text-muted-foreground mt-1">
                Sube un archivo de ejemplo para detectar las columnas y configurar el mapeo. Este archivo no se guarda, solo se usa para la configuración.
              </p>
            </div>
          </div>
        </div>

        {/* Sección 2: Opciones de Parseo */}
        {(file || userColumns.length > 0) && (
          <div className="bg-card p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4 text-foreground">2. Opciones de Lectura del Archivo</h2>
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="hasHeaders"
                  checked={hasHeaders}
                  onCheckedChange={setHasHeaders}
                />
                <Label htmlFor="hasHeaders">El archivo tiene encabezados en la primera fila (o después de saltar filas)</Label>
              </div>
              <div>
                <Label htmlFor="skipRows">Filas a saltar al inicio del archivo</Label>
                <Input
                  id="skipRows"
                  type="number"
                  min="0"
                  value={skipRows}
                  onChange={(e) => setSkipRows(parseInt(e.target.value, 10) || 0)}
                  className="mt-1 w-24"
                />
              </div>
              {file?.name.toLowerCase().endsWith('.csv') || file?.name.toLowerCase().endsWith('.txt') ? (
                <div>
                  <Label htmlFor="csvDelimiter">Delimitador CSV (vacío para auto-detectar)</Label>
                  <Input
                    id="csvDelimiter"
                    type="text"
                    value={csvDelimiter}
                    onChange={(e) => setCsvDelimiter(e.target.value)}
                    placeholder="Ej: , ; | टैब"
                    className="mt-1 w-32"
                  />
                </div>
              ) : null}
              {(file?.name.toLowerCase().endsWith('.xls') || file?.name.toLowerCase().endsWith('.xlsx')) && availableSheetNames.length > 0 && (
                <div>
                  <Label htmlFor="excelSheetName">Hoja de Excel a usar</Label>
                  <select
                    id="excelSheetName"
                    value={excelSheetName || availableSheetNames[0]}
                    onChange={(e) => setExcelSheetName(e.target.value)}
                    className="mt-1 block w-full rounded-md border-border bg-input p-2 focus:border-primary focus:ring-primary sm:text-sm"
                  >
                    {availableSheetNames.map(sheet => (
                      <option key={sheet} value={sheet}>{sheet}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Sección 3: Mapeo de Columnas */}
        {isParsing && (
            <div className="flex items-center justify-center p-8 bg-card rounded-lg shadow">
                <Loader2 className="h-8 w-8 animate-spin text-primary mr-3" />
                <p className="text-muted-foreground">Analizando archivo y sugiriendo mapeos...</p>
            </div>
        )}

        {!isParsing && userColumns.length > 0 && (
          <div className="bg-card p-6 rounded-lg shadow">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-foreground">3. Mapeo de Columnas</h2>
              {/* <Button onClick={handleAutoSuggest} variant="outline" size="sm" disabled={isParsing}>
                <Wand2 className="mr-2 h-4 w-4" /> Re-Sugerir Mapeos
              </Button> */}
            </div>
            <p className="text-sm text-muted-foreground mb-1">
              Para cada campo del sistema, selecciona la columna correspondiente de tu archivo.
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              Los campos marcados con <span className="text-destructive">*</span> son recomendados.
              Las sugerencias automáticas están marcadas con ✨.
            </p>
            <div className="border border-border rounded-md">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 items-center py-3 px-4 bg-muted/50 font-semibold border-b border-border">
                <div>Campo del Sistema</div>
                <div className="col-span-1 md:col-span-2">Columna de tu Archivo</div>
              </div>
              {systemFields.map((field) => (
                <ColumnMappingRow
                  key={field.key}
                  systemField={field}
                  userColumns={userColumns}
                  selectedValue={currentMappings[field.key] || null}
                  onMappingChange={handleMappingChange}
                  isSuggested={!!suggestedMappingsCache[field.key] && currentMappings[field.key] === suggestedMappingsCache[field.key]}
                  // similarity={0} // TODO: Could pass similarity score if stored from suggestMappings
                />
              ))}
            </div>
          </div>
        )}

        {/* Sección 4: Acciones */}
        <div className="flex justify-end space-x-3 mt-8">
          <Button variant="outline" onClick={() => navigate(`/admin/pyme/${pymeId}`)} disabled={isLoading}>
            Cancelar
          </Button>
          <Button onClick={handleSaveMapping} disabled={isLoading || isParsing || userColumns.length === 0}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Save className="mr-2 h-4 w-4" />
            {mappingId ? "Guardar Cambios" : "Crear Configuración"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CatalogMappingPage;

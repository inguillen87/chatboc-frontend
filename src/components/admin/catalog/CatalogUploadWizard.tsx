import React, { useState, useCallback, useMemo } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  Upload, FileText, CheckCircle2, AlertTriangle,
  ArrowRight, Loader2, XCircle, Save
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { apiClient } from '@/api/client';
import { toast } from 'sonner';
import { CatalogPreviewV1, ColumnMapping, CatalogField } from '@/types/catalog-import';
import { ImportMappingTable } from './ImportMappingTable';
import { cn } from '@/lib/utils';
import { looksLikeImageColumn } from '@/utils/marketImages';
import {catalogImportUserError,safeCatalogImportDetail,type CatalogImportUserError} from '@/utils/catalogImportError';

interface CatalogUploadWizardProps {
  tenantSlug: string;
  onFinish?: () => void;
  templateUrl?: string | null;
  templateLabel?: string | null;
  supportedModes?: CatalogImportMode[];
}

type WizardStep = 'upload' | 'processing' | 'preview' | 'result';
type CatalogImportMode = 'upsert' | 'replace' | 'stock_only';

const MODE_LABELS: Record<CatalogImportMode, { label: string; description: string }> = {
  upsert: {
    label: 'Actualizar y crear',
    description: 'Actualiza por SKU y crea items faltantes cuando backend lo permita.',
  },
  replace: {
    label: 'Reemplazar catálogo',
    description: 'Reemplaza el catálogo de la organización sólo cuando confirmes.',
  },
  stock_only: {
    label: 'Solo stock',
    description: 'Actualiza stock por SKU y no debe crear productos nuevos.',
  },
};

const asRecord = (value: unknown): Record<string, any> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, any>) : {};

const asArray = (value: unknown): any[] => (Array.isArray(value) ? value : []);

const normalizePreviewResponse = (response: any, file?: File | null): CatalogPreviewV1 => {
  const record = asRecord(response);
  const summary = asRecord(record.summary || record.inventory_summary || record.quality_summary);
  const rows = asArray(record.rows_sample || record.rows || record.preview_rows || record.items_sample || record.items);
  const columns = asArray(record.columns || record.detected_columns);
  const inferredColumns =
    columns.length > 0
      ? columns
      : Object.keys(asRecord(rows[0]?.cells || rows[0])).map((key) => ({
          key,
          label: key,
          type: 'string' as const,
        }));

  return {
    job_id: String(record.job_id || record.upload_id || record.id || record.upload_token || ''),
    status: record.status || 'preview_ready',
    file: {
      name: record.file?.name || file?.name || 'catalogo',
      type: record.file?.type || 'unknown',
      size: record.file?.size || file?.size,
    },
    summary: {
      detected_rows:
        summary.detected_rows ??
        summary.total_rows ??
        record.detected_rows ??
        rows.length,
      detected_columns:
        summary.detected_columns ??
        record.detected_columns ??
        inferredColumns.length,
      confidence_global:
        summary.confidence_global ??
        summary.confidence ??
        record.confidence_global ??
        1,
      warnings: asArray(summary.warnings || record.warnings).map(String),
      total_estimated_rows: summary.total_estimated_rows ?? summary.total_rows,
      image_summary: asRecord(summary.image_summary),
    },
    columns: inferredColumns.map((column: any, index: number) => ({
      key: String(column.key || column.id || column.name || `col_${index}`),
      label: String(column.label || column.title || column.name || column.key || `Columna ${index + 1}`),
      type: column.type || 'string',
      confidence: column.confidence,
      sampleValues: column.sampleValues || column.sample_values,
    })),
    rows_sample: rows.map((row: any, index: number) => ({
      row_id: String(row.row_id || row.id || index + 1),
      cells: asRecord(row.cells || row),
      row_confidence: row.row_confidence || row.confidence,
      warnings: asArray(row.warnings).map(String),
    })),
    errors: asArray(record.errors).map((error: any) => ({
      code: String(error.code || error.reason_code || 'import_error'),
      message: String(error.message || error.detail || error.reason_code || 'Error de importacion'),
      action: error.action,
      field: error.field,
    })),
    image_summary: asRecord(record.image_summary || summary.image_summary),
    imagenes_detectadas: record.imagenes_detectadas,
  };
};

const CatalogUploadWizard: React.FC<CatalogUploadWizardProps> = ({
  tenantSlug,
  onFinish,
  templateUrl,
  templateLabel,
  supportedModes = ['upsert', 'replace', 'stock_only'],
}) => {
  const [step, setStep] = useState<WizardStep>('upload');
  const [file, setFile] = useState<File | null>(null);

  // Job & Preview State
  const [jobId, setJobId] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<CatalogPreviewV1 | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [mode, setMode] = useState<CatalogImportMode>(supportedModes[0] || 'upsert');
  const [resultData, setResultData] = useState<any>(null);

  // UI State
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<CatalogImportUserError | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const activeModes = useMemo(() => supportedModes.length ? supportedModes : ['upsert'], [supportedModes]);

  // --- Step 1: Upload Logic ---
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      setError(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv', '.tsv'],
      'text/plain': ['.txt'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/pdf': ['.pdf']
    },
    maxFiles: 1,
    multiple: false
  } as any);

  const handleUpload = async () => {
    if (!file) return;

    setIsProcessing(true);
    setStep('processing');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('tenant_slug', tenantSlug);
      formData.append('mode', mode);
      formData.append('source', 'admin_upload');

      // Call API (expects CatalogPreviewV1 structure).
      let response: CatalogPreviewV1;
      try {
        response = normalizePreviewResponse(await apiClient.adminCreateCatalogImport(tenantSlug, formData), file);
      } catch (e) {
        console.warn("Catalog import v2 API failed, trying legacy upload", e);
        response = normalizePreviewResponse(await apiClient.adminUploadCatalog(tenantSlug, formData), file);
      }

      // Initialize default mapping based on column names (heuristic)
      const initialMapping: ColumnMapping = {};
      if (response.columns) {
        response.columns.forEach(col => {
          const lower = col.label.toLowerCase();
          if (lower.includes('precio') || lower.includes('price')) initialMapping[col.key] = 'price';
          else if (lower.includes('nombre') || lower.includes('producto') || lower.includes('descripcion')) initialMapping[col.key] = 'product_name';
          else if (lower.includes('sku') || lower.includes('codigo')) initialMapping[col.key] = 'sku';
          else if (lower.includes('stock')) initialMapping[col.key] = 'stock';
          else if (lower.includes('categoria')) initialMapping[col.key] = 'category';
          else if (lower.includes('galeria') || lower.includes('gallery') || lower.includes('imagenes') || lower.includes('images')) initialMapping[col.key] = 'gallery_urls';
          else if (lower.includes('alt')) initialMapping[col.key] = 'image_alt';
          else if (looksLikeImageColumn(lower)) initialMapping[col.key] = 'image_url';
          else initialMapping[col.key] = 'ignore';
        });
      }

      setJobId(response.job_id);
      setPreviewData(response);
      setResultData(null);
      setMapping(initialMapping);
      setHasUnsavedChanges(false);

      // If status is failed, we still show preview step but with error UI
      setStep('preview');

    } catch (err: any) {
      setError(catalogImportUserError(err,'upload'));
      setStep('upload'); // Go back to upload on hard fail
    } finally {
      setIsProcessing(false);
    }
  };

  // --- Step 3: Mapping & Preview Logic ---
  const handleMappingChange = (colKey: string, field: CatalogField) => {
    setMapping(prev => ({ ...prev, [colKey]: field }));
  };

  const handleCellValueChange = (rowId: string, colKey: string, value: any) => {
    if (!previewData) return;
    setHasUnsavedChanges(true);
    // Update local preview state (optimistic)
    const newRows = previewData.rows_sample.map(row => {
      if (row.row_id === rowId) {
        return { ...row, cells: { ...row.cells, [colKey]: value } };
      }
      return row;
    });
    setPreviewData({ ...previewData, rows_sample: newRows });
  };

  const handleSaveChanges = async () => {
    if (!jobId || !previewData) return;
    setIsSaving(true);
    try {
      try {
        await apiClient.adminUpdateCatalogImport(tenantSlug, jobId, {
          rows: previewData.rows_sample,
          mode,
          mapping,
        });
      } catch (error) {
        console.warn("Catalog import v2 preview update failed, trying legacy update", error);
        await apiClient.adminUpdateImportPreview(tenantSlug, jobId, {
          rows: previewData.rows_sample
        });
      }
      setHasUnsavedChanges(false);
      toast.success("Cambios guardados");
    } catch (err: any) {
      const failure=catalogImportUserError(err,'save');
      toast.error(failure.title,{description:`${failure.message} ${failure.action}`});
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirm = async () => {
    if (!jobId || !previewData) return;
    setIsProcessing(true);

    try {
      // Validate required fields
      const mappedFields = Object.values(mapping);
      const hasRequiredFields =
        mode === 'stock_only'
          ? mappedFields.includes('sku') && mappedFields.includes('stock')
          : mappedFields.includes('product_name') && mappedFields.includes('price');
      if (!hasRequiredFields) {
         toast.error(mode === 'stock_only' ? "Debes mapear al menos 'SKU' y 'Stock'" : "Debes mapear al menos 'Nombre Producto' y 'Precio'");
         setIsProcessing(false);
         return;
      }

      // Optional: Auto-save if changes pending
      if (hasUnsavedChanges) {
         try {
           await apiClient.adminUpdateCatalogImport(tenantSlug, jobId, {
              rows: previewData.rows_sample,
              mode,
              mapping,
           });
         } catch (error) {
           console.warn("Catalog import v2 preview update before commit failed, trying legacy update", error);
           await apiClient.adminUpdateImportPreview(tenantSlug, jobId, {
              rows: previewData.rows_sample
           });
         }
      }

      let commitResponse: any;
      try {
        commitResponse = await apiClient.adminCommitCatalogImport(tenantSlug, jobId, {
          mode,
          mapping,
        });
      } catch (error) {
        console.warn("Catalog import v2 commit failed, trying legacy confirm", error);
        commitResponse = await apiClient.adminConfirmCatalog(tenantSlug, {
          upload_token: jobId,
          mapping_override: mapping as any
        });
      }

      setResultData(commitResponse);
      setStep('result');
      toast.success("Catalogo importado correctamente");
    } catch (err: any) {
      const failure=catalogImportUserError(err,'commit');
      toast.error(failure.title,{description:`${failure.message} ${failure.action}`});
    } finally {
      setIsProcessing(false);
    }
  };

  // --- Renderers ---

  const renderUpload = () => (
    <div className="space-y-6 py-8">
      <div
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed rounded-lg p-12 flex flex-col items-center justify-center text-center cursor-pointer transition-colors",
          isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50",
          error && "border-destructive/50 bg-destructive/5"
        )}
      >
        <input {...(getInputProps() as React.InputHTMLAttributes<HTMLInputElement>)} />
        <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center mb-4">
           {isProcessing ? <Loader2 className="h-8 w-8 animate-spin text-primary" /> : <Upload className="h-8 w-8 text-muted-foreground" />}
        </div>

        <h3 className="text-lg font-medium mb-2">
          {isDragActive ? "Solta el archivo aca..." : "Arrastra tu archivo o haz clic"}
        </h3>
        <p className="text-sm text-muted-foreground max-w-sm mb-4">
          Sube PDF, Excel, CSV, TSV o TXT. La IA prepara una vista editable con productos, precios, stock, descripciones e imagenes cuando el archivo las trae.
        </p>

        {file && (
          <div className="flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium">
            <FileText className="h-4 w-4" />
            {file.name}
          </div>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {activeModes.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setMode(option)}
            className={cn(
              "rounded-lg border p-3 text-left transition",
              mode === option ? "border-primary bg-primary/5 text-primary" : "border-border hover:bg-muted/50",
            )}
          >
            <span className="text-sm font-semibold">{MODE_LABELS[option]?.label || option}</span>
            <span className="mt-1 block text-xs text-muted-foreground">{MODE_LABELS[option]?.description}</span>
          </button>
        ))}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{error.title}</AlertTitle>
          <AlertDescription><p>{error.message}</p><p className="mt-1">{error.action}</p></AlertDescription>
        </Alert>
      )}

      <div className="flex justify-between items-center">
         {templateUrl && templateLabel && (
           <Button
             variant="ghost"
             onClick={() => {
               window.open(templateUrl, "_blank");
             }}
           >
             {templateLabel}
           </Button>
         )}
         <Button onClick={handleUpload} disabled={!file || isProcessing}>
           {isProcessing ? "Analizando…" : "Analizar catálogo"} <ArrowRight className="ml-2 h-4 w-4" />
         </Button>
      </div>
    </div>
  );

  const renderProcessing = () => (
    <div className="py-16 flex flex-col items-center justify-center space-y-6 text-center">
      <div className="relative">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
        <div className="absolute inset-0 flex items-center justify-center text-xs font-bold">IA</div>
      </div>
      <div className="space-y-2 max-w-md w-full">
        <h3 className="text-xl font-medium">La IA está leyendo tu catálogo</h3>
        <p className="text-sm text-muted-foreground">
          Prepara columnas, productos e imágenes detectadas. Nada se publica hasta que confirmes.
        </p>
      </div>
    </div>
  );

  const renderPreview = () => {
    if (!previewData) return null;

    const isFailed = previewData.status === 'failed';
    const hasWarnings = previewData.summary?.warnings?.length > 0;
    const hasErrors = previewData.errors?.length > 0;
    const showTable = !isFailed || (previewData.rows_sample && previewData.rows_sample.length > 0);
    const imageSummary = previewData.image_summary ?? previewData.summary?.image_summary ?? null;
    const detectedImages =
      previewData.imagenes_detectadas ??
      imageSummary?.with_images ??
      previewData.rows_sample?.filter((row) =>
        Object.values(row.cells || {}).some(
          (value) =>
            typeof value === 'string' &&
            /^https?:\/\//i.test(value) &&
            /\.(png|jpe?g|webp|gif)(\?|#|$)/i.test(value),
        ),
      ).length ??
      0;

    return (
      <div className="space-y-4">
        {/* Header Stats */}
        <div className="flex items-start justify-between bg-muted/30 p-4 rounded-lg border">
          <div className="space-y-1">
            <h3 className="font-medium flex items-center gap-2">
              Resultado del análisis
              {isFailed ? (
                 <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700">No se pudo leer</span>
              ) : (
                 <span className="inline-flex items-center rounded-full border border-green-200 bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-800">
                    {previewData.summary?.detected_rows} productos detectados
                 </span>
              )}
            </h3>
            <p className="text-sm text-muted-foreground">
              Revisá lo que la IA encontró, corregí las columnas y confirmá sólo cuando esté listo.
            </p>
          </div>
          <div className="text-right text-xs text-muted-foreground">
             <div>Confianza: {Math.round((previewData.summary?.confidence_global || 0) * 100)}%</div>
             <div>Columnas: {previewData.summary?.detected_columns}</div>
             <div>Imágenes: {detectedImages}</div>
             <div>Modo: {MODE_LABELS[mode]?.label || mode}</div>
          </div>
        </div>

        {imageSummary || detectedImages ? (
          <div className="grid gap-3 rounded-lg border bg-background p-3 text-sm md:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">Con imagen</p>
              <p className="text-lg font-semibold">{imageSummary?.with_images ?? detectedImages}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Sin imagen</p>
              <p className="text-lg font-semibold">{imageSummary?.missing_images ?? 0}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Columnas aceptadas</p>
              <p className="text-sm font-medium">imagen, foto, thumbnail, galeria</p>
            </div>
          </div>
        ) : null}

        {/* Errors / Warnings */}
        {(hasErrors || hasWarnings) && (
          <div className="space-y-2">
            {hasErrors && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertTitle>Necesita revisión</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc pl-4 mt-1 space-y-1">
                    {previewData.errors.map((e, i) => (
                      <li key={i}>{safeCatalogImportDetail(e.message,'Hay un dato que necesita revisión.')} {e.action && <b>- {safeCatalogImportDetail(e.action,'Revisá el dato marcado antes de continuar.')}</b>}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
            {hasWarnings && !isFailed && (
              <Alert className="bg-amber-50 border-amber-200 text-amber-800">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertTitle>Observaciones</AlertTitle>
                <AlertDescription>
                   <ul className="list-disc pl-4 mt-1">
                     {previewData.summary.warnings.slice(0, 3).map((w, i) => <li key={i}>{safeCatalogImportDetail(w,'Revisá los datos detectados antes de continuar.')}</li>)}
                   </ul>
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* Main Mapping Table */}
        {showTable ? (
          <ImportMappingTable
            preview={previewData}
            mapping={mapping}
            onMappingChange={handleMappingChange}
            onCellValueChange={handleCellValueChange}
          />
        ) : (
           <div className="border border-dashed rounded-lg p-12 flex flex-col items-center justify-center text-center text-muted-foreground">
              <XCircle className="h-10 w-10 mb-4 text-destructive/50" />
              <p>No se encontraron datos estructurados válidos.</p>
              <p className="text-sm">Probá con otro archivo o revisá los errores indicados arriba.</p>
           </div>
        )}

        {/* Actions */}
        <div className="flex justify-between pt-4">
          <Button variant="outline" onClick={() => { setStep('upload'); setFile(null); }}>
             Cancelar / Subir otro
          </Button>

          <div className="flex gap-2">
            {hasUnsavedChanges && showTable && (
               <Button variant="secondary" onClick={handleSaveChanges} disabled={isSaving}>
                  {isSaving && <Loader2 className="animate-spin mr-2 h-4 w-4" />}
                  <Save className="mr-2 h-4 w-4" /> Guardar Cambios
               </Button>
            )}

            <Button onClick={handleConfirm} disabled={isProcessing || isFailed}>
               {isProcessing ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
               Publicar productos
            </Button>
          </div>
        </div>
      </div>
    );
  };

  const renderResult = () => (
    <div className="py-12 flex flex-col items-center justify-center text-center space-y-6">
      <div className="h-20 w-20 bg-green-100 rounded-full flex items-center justify-center">
        <CheckCircle2 className="h-10 w-10 text-green-600" />
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">Catalogo publicado</h2>
        <p className="text-muted-foreground">
          La importacion quedo confirmada por backend. Revisa request_id, catalog_version y filas omitidas antes de operar.
        </p>
      </div>
      {resultData ? (
        <div className="w-full max-w-xl rounded-lg border bg-muted/30 p-4 text-left text-sm">
          <div className="grid gap-2 md:grid-cols-2">
            {resultData.request_id ? <div><span className="text-muted-foreground">request_id:</span> {String(resultData.request_id)}</div> : null}
            {resultData.catalog_version ? <div><span className="text-muted-foreground">catalog_version:</span> {String(resultData.catalog_version)}</div> : null}
            {resultData.mode ? <div><span className="text-muted-foreground">modo:</span> {String(resultData.mode)}</div> : null}
            {resultData.stock_updated !== undefined ? <div><span className="text-muted-foreground">stock actualizado:</span> {String(resultData.stock_updated)}</div> : null}
          </div>
          {resultData.summary ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {Object.entries(resultData.summary).map(([key, value]) => (
                <span key={key} className="rounded-full border bg-background px-2 py-1 text-xs">{key}: {String(value)}</span>
              ))}
            </div>
          ) : null}
          {Array.isArray(resultData.skipped_rows) && resultData.skipped_rows.length > 0 ? (
            <div className="mt-3 text-xs text-muted-foreground">
              Filas omitidas: {resultData.skipped_rows.slice(0, 3).map((row: any) => row.sku || row.reason_code || row.reason || 'fila').join(', ')}
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="flex gap-4">
        <Button variant="outline" onClick={() => {
           setStep('upload');
           setFile(null);
           setPreviewData(null);
        }}>
          Importar otro archivo
        </Button>
        <Button onClick={onFinish}>
          Ver catalogo <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  return (
    <Card className="w-full max-w-5xl mx-auto shadow-lg border-muted/40">
      <CardHeader>
        <div className="flex items-center justify-between">
           <div>
             <CardTitle>Importar catalogo con IA</CardTitle>
             <CardDescription>Convierte archivos reales en productos editables para el marketplace</CardDescription>
           </div>
           {/* Step Indicator */}
           <div className="flex items-center gap-2 text-sm">
              <span className={cn("px-2 py-1 rounded", step === 'upload' ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>1. Subir</span>
              <span className="text-muted-foreground">-&gt;</span>
              <span className={cn("px-2 py-1 rounded", step === 'preview' ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>2. Revisar</span>
              <span className="text-muted-foreground">-&gt;</span>
              <span className={cn("px-2 py-1 rounded", step === 'result' ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>3. Listo</span>
           </div>
        </div>
      </CardHeader>
      <CardContent>
        {step === 'upload' && renderUpload()}
        {step === 'processing' && renderProcessing()}
        {step === 'preview' && renderPreview()}
        {step === 'result' && renderResult()}
      </CardContent>
    </Card>
  );
};

export default CatalogUploadWizard;

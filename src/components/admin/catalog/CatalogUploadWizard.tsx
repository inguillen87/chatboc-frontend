import React, { useState, useEffect, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  Upload, FileText, CheckCircle2, AlertTriangle,
  ArrowRight, Loader2, XCircle, Settings2, RefreshCw, Save
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { apiClient } from '@/api/client';
import { toast } from 'sonner';
import { CatalogPreviewV1, ColumnMapping, CatalogField, ImportStatus } from '@/types/catalog-import';
import { ImportMappingTable } from './ImportMappingTable';
import { cn } from '@/lib/utils';

interface CatalogUploadWizardProps {
  tenantSlug: string;
  onFinish?: () => void;
}

type WizardStep = 'upload' | 'processing' | 'preview' | 'result';

const CatalogUploadWizard: React.FC<CatalogUploadWizardProps> = ({ tenantSlug, onFinish }) => {
  const [step, setStep] = useState<WizardStep>('upload');
  const [file, setFile] = useState<File | null>(null);

  // Job & Preview State
  const [jobId, setJobId] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<CatalogPreviewV1 | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});

  // UI State
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

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
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/pdf': ['.pdf']
    },
    maxFiles: 1,
    multiple: false
  });

  const handleUpload = async () => {
    if (!file) return;

    setIsProcessing(true);
    setStep('processing');
    setUploadProgress(10);

    try {
      const formData = new FormData();
      formData.append('file', file);

      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 500);

      // Call API (Expects CatalogPreviewV1 structure)
      // If backend is not ready, we might need a mock fallback here
      let response: CatalogPreviewV1;
      try {
        response = await apiClient.adminUploadCatalog(tenantSlug, formData);
      } catch (e) {
         // Fallback mock for demonstration if API fails or doesn't exist yet
         console.warn("API failed, using mock data for demo", e);
         clearInterval(progressInterval);
         throw e; // remove this if you want to force mock
      }

      clearInterval(progressInterval);
      setUploadProgress(100);

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
          else initialMapping[col.key] = 'ignore';
        });
      }

      setJobId(response.job_id);
      setPreviewData(response);
      setMapping(initialMapping);
      setHasUnsavedChanges(false);

      // If status is failed, we still show preview step but with error UI
      setStep('preview');

    } catch (err: any) {
      setError(err.message || 'Error al subir el archivo');
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
      await apiClient.adminUpdateImportPreview(tenantSlug, jobId, {
        rows: previewData.rows_sample
      });
      setHasUnsavedChanges(false);
      toast.success("Cambios guardados");
    } catch (err: any) {
      toast.error("Error al guardar cambios: " + err.message);
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
      if (!mappedFields.includes('product_name') || !mappedFields.includes('price')) {
         toast.error("Debes mapear al menos 'Nombre Producto' y 'Precio'");
         setIsProcessing(false);
         return;
      }

      // Optional: Auto-save if changes pending
      if (hasUnsavedChanges) {
         await apiClient.adminUpdateImportPreview(tenantSlug, jobId, {
            rows: previewData.rows_sample
         });
      }

      await apiClient.adminConfirmCatalog(tenantSlug, {
        upload_token: jobId, // using job_id as token
        mapping_override: mapping as any // backend expects simple map
      });

      setStep('result');
      toast.success("Catálogo importado correctamente");
    } catch (err: any) {
      toast.error("Error al confirmar importación: " + err.message);
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
        <input {...getInputProps()} />
        <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center mb-4">
           {isProcessing ? <Loader2 className="h-8 w-8 animate-spin text-primary" /> : <Upload className="h-8 w-8 text-muted-foreground" />}
        </div>

        <h3 className="text-lg font-medium mb-2">
          {isDragActive ? "Suelta el archivo aquí..." : "Arrastra tu archivo o haz clic"}
        </h3>
        <p className="text-sm text-muted-foreground max-w-sm mb-4">
          Soportamos PDF, Excel (.xlsx) y CSV. Detectaremos tablas automáticamente.
        </p>

        {file && (
          <div className="flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium">
            <FileText className="h-4 w-4" />
            {file.name}
          </div>
        )}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex justify-between items-center">
         <Button variant="ghost" onClick={handleDownloadTemplate}>
           Descargar plantilla ejemplo </Button>
         <Button onClick={handleUpload} disabled={!file || isProcessing}>
           {isProcessing ? "Procesando..." : "Analizar Archivo"} <ArrowRight className="ml-2 h-4 w-4" />
         </Button>
      </div>
    </div>
  );

  const renderProcessing = () => (
    <div className="py-16 flex flex-col items-center justify-center space-y-6 text-center">
      <div className="relative">
         {/* Replaced generic Spinner with a nicer Loading state or Skeleton if we had one for big blocks, but here spinner + text is standard */}
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
        <div className="absolute inset-0 flex items-center justify-center text-xs font-bold">AI</div>
      </div>
      <div className="space-y-2 max-w-md w-full">
        <h3 className="text-xl font-medium">Analizando documento...</h3>
        <div className="space-y-2">
           <Skeleton className="h-4 w-3/4 mx-auto" />
           <Skeleton className="h-4 w-1/2 mx-auto" />
        </div>
      </div>
      <Progress value={uploadProgress} className="w-64" />
    </div>
  );

  const renderPreview = () => {
    if (!previewData) return null;

    const isFailed = previewData.status === 'failed';
    const hasWarnings = previewData.summary?.warnings?.length > 0;
    const hasErrors = previewData.errors?.length > 0;
    const showTable = !isFailed || (previewData.rows_sample && previewData.rows_sample.length > 0);

    return (
      <div className="space-y-4">
        {/* Header Stats */}
        <div className="flex items-start justify-between bg-muted/30 p-4 rounded-lg border">
          <div className="space-y-1">
            <h3 className="font-medium flex items-center gap-2">
              Resultados del análisis
              {isFailed ? (
                 <Badge variant="destructive">Falló</Badge>
              ) : (
                 <Badge variant={hasWarnings ? "secondary" : "default"} className="bg-green-100 text-green-800 border-green-200">
                    {previewData.summary?.detected_rows} productos detectados
                 </Badge>
              )}
            </h3>
            <p className="text-sm text-muted-foreground">
              Revisa y ajusta el mapeo de columnas antes de importar.
            </p>
          </div>
          <div className="text-right text-xs text-muted-foreground">
             <div>Confianza Global: {Math.round((previewData.summary?.confidence_global || 0) * 100)}%</div>
             <div>Columnas: {previewData.summary?.detected_columns}</div>
          </div>
        </div>

        {/* Errors / Warnings */}
        {(hasErrors || hasWarnings) && (
          <div className="space-y-2">
            {hasErrors && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertTitle>Errores Críticos</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc pl-4 mt-1 space-y-1">
                    {previewData.errors.map((e, i) => (
                      <li key={i}>{e.message} {e.action && <b>- {e.action}</b>}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
            {hasWarnings && !isFailed && (
              <Alert className="bg-amber-50 border-amber-200 text-amber-800">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertTitle>Advertencias</AlertTitle>
                <AlertDescription>
                   <ul className="list-disc pl-4 mt-1">
                     {previewData.summary.warnings.slice(0, 3).map((w, i) => <li key={i}>{w}</li>)}
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
              <p className="text-sm">Intenta subir un archivo diferente o revisa los errores arriba.</p>
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
               Confirmar e Importar
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
        <h2 className="text-2xl font-bold">¡Importación Exitosa!</h2>
        <p className="text-muted-foreground">
          Los productos se han cargado a tu catálogo correctamente.
        </p>
      </div>
      <div className="flex gap-4">
        <Button variant="outline" onClick={() => {
           setStep('upload');
           setFile(null);
           setPreviewData(null);
        }}>
          Importar otro archivo
        </Button>
        <Button onClick={onFinish}>
          Ver Catálogo <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  return (
    <Card className="w-full max-w-5xl mx-auto shadow-lg border-muted/40">
      <CardHeader>
        <div className="flex items-center justify-between">
           <div>
             <CardTitle>Importar Catálogo</CardTitle>
             <CardDescription>Sube tu lista de precios en PDF o Excel</CardDescription>
           </div>
           {/* Step Indicator */}
           <div className="flex items-center gap-2 text-sm">
              <span className={cn("px-2 py-1 rounded", step === 'upload' ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>1. Subir</span>
              <span className="text-muted-foreground">→</span>
              <span className={cn("px-2 py-1 rounded", step === 'preview' ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>2. Revisar</span>
              <span className="text-muted-foreground">→</span>
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

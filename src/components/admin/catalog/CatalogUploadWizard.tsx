import React, { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Upload, FileText, CheckCircle2, AlertTriangle, ArrowRight, RefreshCw, X } from 'lucide-react';
import { useTenant } from '@/context/TenantContext';
import { apiClient } from '@/api/client';
import { toast } from 'sonner';
import { importService } from '@/services/importService';
import { Input } from '@/components/ui/input';

interface CatalogUploadWizardProps {
  onFinish?: () => void;
}

type WizardStep = 'upload' | 'preview' | 'result';

const CatalogUploadWizard: React.FC<CatalogUploadWizardProps> = ({ onFinish }) => {
  const { currentSlug } = useTenant();
  const [step, setStep] = useState<WizardStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [tenantId, setTenantId] = useState<number | null>(null);
  const [previewItems, setPreviewItems] = useState<Array<Record<string, unknown>>>([]);
  const [previewColumns, setPreviewColumns] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);

  const canConfirm = previewItems.length > 0;
  const resolvedColumns = useMemo(() => {
    if (previewColumns.length > 0) {
      return previewColumns;
    }
    return previewItems.length > 0
      ? Object.keys(previewItems[0]).map((key) => ({ key, label: key }))
      : [];
  }, [previewColumns, previewItems]);
  const isPlainTextPreview =
    resolvedColumns.length === 1 &&
    (resolvedColumns[0]?.label || resolvedColumns[0]?.key)?.toLowerCase().includes('contenido');

  const updatePreviewField = (rowIndex: number, column: string, value: string) => {
    setPreviewItems((prev) => {
      const next = [...prev];
      const current = next[rowIndex] ?? {};
      next[rowIndex] = { ...current, [column]: value };
      return next;
    });
  };

  // Fetch tenant ID needed for importService
  useEffect(() => {
    const fetchTenantId = async () => {
        if (!currentSlug) return;
        try {
            // Using getChatTheme as a proxy to get the full tenant object with ID
            // Since there is no dedicated "getPublicTenant" in apiClient that returns ID securely/reliably for admin ops
            // The config endpoint is for admins and returns the Tenant object.
            const config = await apiClient.getChatTheme(currentSlug);
            if (config && config.tenant && config.tenant.id) {
                setTenantId(Number(config.tenant.id));
            }
        } catch (e) {
            console.error("Failed to resolve tenant ID", e);
        }
    };
    fetchTenantId();
  }, [currentSlug]);

  // -- Step 1: Upload Logic --
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const startUpload = async () => {
    if (!file || !currentSlug) return;

    // For preview we can use ID 0 (generic) if real ID is not yet loaded, but prefer real ID.
    // The endpoint supports pyme_id=0 for preview.
    const effectiveId = tenantId || 0;

    setIsProcessing(true);
    setUploadProgress(10);

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 500);

      // Use importService which matches the new backend flow
      const preview = await importService.uploadFile(effectiveId, file, 'generic', currentSlug);

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (preview && preview.items_preview) {
        setPreviewItems(preview.items_preview);
        setPreviewColumns(preview.columns ?? []);
        setStep('preview');
        setIsPreviewModalOpen(true);
      } else {
          toast.error("La respuesta del servidor no fue válida.");
      }

    } catch (error) {
      console.error("Upload failed", error);
      toast.error("Error al subir el archivo. Verificá el formato.");
    } finally {
      setIsProcessing(false);
    }
  };

  // -- Step 2: Preview Logic --
  const confirmUpload = async () => {
    if (!file || !currentSlug) return;
    // Commit requires real tenant ID. If we used 0 for preview, we must have the real ID now.
    if (!tenantId) {
        toast.error("No se pudo identificar la cuenta para confirmar. Intente recargar.");
        return;
    }

    setIsProcessing(true);

    try {
        // commitImport re-uploads the file in the stateless flow.
        // We also send the `previewItems` payload when available so the backend can apply inline edits.

        await importService.commitImport(tenantId, file, 'generic', currentSlug, previewItems);

        setStep('result');
        toast.success("Catálogo actualizado correctamente.");
    } catch (error) {
        console.error("Confirmation failed", error);
        toast.error("Error al confirmar la importación.");
    } finally {
        setIsProcessing(false);
    }
  };

  // -- Render Helpers --

  const renderUploadStep = () => (
    <div className="space-y-6">
        <div
            className="border-2 border-dashed border-muted-foreground/25 rounded-xl p-10 flex flex-col items-center justify-center text-center hover:bg-muted/10 transition-colors cursor-pointer"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => document.getElementById('catalog-file-input')?.click()}
        >
            <input
                id="catalog-file-input"
                type="file"
                accept=".xlsx,.csv,.xls"
                className="hidden"
                onChange={handleFileChange}
            />
            <div className="bg-primary/10 p-4 rounded-full mb-4">
                <Upload className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-medium mb-1">Arrastrá tu archivo aquí</h3>
            <p className="text-sm text-muted-foreground mb-4">o hacé clic para buscar (Excel o CSV)</p>
            {file && (
                <div className="flex items-center gap-2 bg-background border px-3 py-2 rounded shadow-sm max-w-sm">
                    <FileText className="h-4 w-4 text-blue-500" />
                    <span className="text-sm truncate font-medium">{file.name}</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6 ml-2" onClick={(e) => { e.stopPropagation(); setFile(null); }}>
                        <X className="h-3 w-3" />
                    </Button>
                </div>
            )}
        </div>

        <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-sm text-blue-800">
            <h4 className="font-semibold flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4"/> Importante
            </h4>
            <ul className="list-disc pl-5 space-y-1">
                <li>El archivo debe tener cabeceras: <b>SKU, Nombre, Precio, Stock</b>.</li>
                <li>Los precios no deben incluir el símbolo de moneda ($).</li>
                <li>Si el producto ya existe (mismo SKU), se actualizará.</li>
            </ul>
        </div>

        {isProcessing && (
            <div className="space-y-2">
                <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Procesando archivo...</span>
                    <span>{uploadProgress}%</span>
                </div>
                <Progress value={uploadProgress} className="h-2" />
            </div>
        )}
    </div>
  );

  const renderPreviewTable = (containerClassName: string) => (
    <div
      className={`${containerClassName} ${isPlainTextPreview ? 'border-amber-200 bg-amber-50/30' : ''}`.trim()}
    >
      {isPlainTextPreview && (
        <div className="flex items-center gap-2 border-b border-amber-200 px-3 py-2 text-xs text-amber-700">
          <AlertTriangle className="h-4 w-4" />
          <span className="font-medium">{resolvedColumns[0]?.label ?? resolvedColumns[0]?.key}</span>
        </div>
      )}
      <table className="w-full min-w-max text-sm">
        <thead className="bg-gray-100 sticky top-0 z-10">
          <tr>
            {resolvedColumns.map((column) => (
              <th key={column.key} className="p-2 text-left font-medium text-gray-600 whitespace-nowrap">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {previewItems.map((item, idx) => (
            <tr key={idx} className="border-b hover:bg-gray-50">
              {resolvedColumns.map((column) => (
                <td key={`${idx}-${column.key}`} className="p-2">
                  <Input
                    value={item[column.key] === null || item[column.key] === undefined ? '' : String(item[column.key])}
                    onChange={(e) => updatePreviewField(idx, column.key, e.target.value)}
                    className="h-8 border-transparent hover:border-input focus:border-input bg-transparent"
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderPreviewStep = () => (
    <div className="space-y-4">
        <div className="flex items-center justify-between">
            <div>
                <h3 className="text-lg font-medium">Vista Previa</h3>
                <p className="text-sm text-muted-foreground">
                    Detectamos <b>{previewItems.length}</b> productos.
                </p>
            </div>
            <div className="flex gap-2">
                 <Button variant="outline" onClick={() => setStep('upload')}>Atrás</Button>
            </div>
        </div>

        <div className="flex justify-end">
          <Button variant="outline" onClick={() => setIsPreviewModalOpen(true)}>
            Ver en pantalla completa
          </Button>
        </div>

        {!isPreviewModalOpen && renderPreviewTable("border rounded-md max-h-96 overflow-y-auto")}

        <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
            Nota: Podés editar los valores antes de confirmar la importación.
        </p>

        <div className="flex items-center justify-end gap-3 pt-4 border-t">
             <Button onClick={confirmUpload} disabled={isProcessing || !canConfirm}>
                {isProcessing && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                Confirmar e Importar
             </Button>
        </div>

        <Dialog open={isPreviewModalOpen} onOpenChange={setIsPreviewModalOpen}>
          <DialogContent className="max-w-6xl h-[85vh]">
            <DialogHeader>
              <DialogTitle>Vista previa completa</DialogTitle>
              <DialogDescription>
                Revisá el detalle detectado por la IA antes de confirmar la importación. Productos detectados: {previewItems.length}.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-lg border bg-muted/40 p-4">
                <div>
                  <p className="text-sm text-muted-foreground">Productos detectados</p>
                  <p className="text-xl font-semibold">{previewItems.length}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Warnings</p>
                  <p className="text-sm font-medium">{previewItems.flatMap((item) => item.errors ?? []).length}</p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <div className="max-h-[55vh] overflow-y-auto">
                  {renderPreviewTable("border rounded-md")}
                </div>
              </div>
            </div>
            <DialogFooter className="gap-2 sm:justify-between">
              <Button variant="outline" onClick={() => setIsPreviewModalOpen(false)}>
                Editar
              </Button>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setIsPreviewModalOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={confirmUpload} disabled={isProcessing || !canConfirm}>
                  {isProcessing && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                  Confirmar e Importar
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
    </div>
  );

  const renderResultStep = () => (
    <div className="flex flex-col items-center justify-center py-10 text-center space-y-6">
        <div className="h-20 w-20 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircle2 className="h-10 w-10 text-green-600" />
        </div>
        <div className="space-y-2">
            <h2 className="text-2xl font-bold">¡Importación Exitosa!</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
                Se ha procesado el archivo correctamente.
            </p>
        </div>
        <div className="flex gap-4">
            <Button variant="outline" onClick={() => {
                setStep('upload');
                setFile(null);
                setPreviewItems([]);
            }}>
                Subir otro archivo
            </Button>
            <Button onClick={onFinish}>
                Ir al Catálogo <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
        </div>
    </div>
  );

  return (
    <Card className="w-full max-w-4xl mx-auto border-0 shadow-none sm:border sm:shadow-sm">
      <CardHeader>
        <CardTitle>Importación de Catálogo</CardTitle>
        <CardDescription>Sube tus productos masivamente usando un archivo Excel o CSV.</CardDescription>
      </CardHeader>
      <CardContent>
        {step === 'upload' && renderUploadStep()}
        {step === 'preview' && renderPreviewStep()}
        {step === 'result' && renderResultStep()}
      </CardContent>
      {step === 'upload' && (
        <CardFooter className="flex justify-end">
            <Button onClick={startUpload} disabled={!file || isProcessing}>
                {isProcessing ? "Procesando..." : "Analizar Archivo"}
            </Button>
        </CardFooter>
      )}
    </Card>
  );
};

export default CatalogUploadWizard;

import React, { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Upload, FileText, CheckCircle2, AlertTriangle, ArrowRight, RefreshCw, X } from 'lucide-react';
import { useTenant } from '@/context/TenantContext';
import { apiClient } from '@/api/client';
import { toast } from 'sonner';
import CatalogItemsTable, { CatalogPreviewItem } from './CatalogItemsTable';
import { importService } from '@/services/importService';
import { getPreviewFieldValue, getPreviewMetadataEntries, hasMeaningfulValue, parsePreviewNumber } from '@/utils/catalogPreview';

interface CatalogUploadWizardProps {
  onFinish?: () => void;
}

type WizardStep = 'upload' | 'preview' | 'result';

const CatalogUploadWizard: React.FC<CatalogUploadWizardProps> = ({ onFinish }) => {
  const { currentSlug } = useTenant();
  const [step, setStep] = useState<WizardStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [tenantId, setTenantId] = useState<number | null>(null);
  const [previewItems, setPreviewItems] = useState<CatalogPreviewItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [resultSummary, setResultSummary] = useState<{ processed: number; errors: number } | null>(null);

  const previewQuality = useMemo(() => {
    const hasNames = previewItems.some((item) => hasMeaningfulValue(item.name));
    const hasPrices = previewItems.some((item) => parsePreviewNumber(item.price) !== null);
    return { hasNames, hasPrices };
  }, [previewItems]);

  const canConfirm = previewItems.length > 0 && previewQuality.hasNames && previewQuality.hasPrices;

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
        // Map response to CatalogPreviewItem
        const mappedItems: CatalogPreviewItem[] = preview.items_preview.map((item: any, idx: number) => {
          const nameValue =
            getPreviewFieldValue(item, ['nombre', 'name', 'producto', 'producto_nombre', 'descripcion', 'description', 'titulo', 'title']) ??
            '';
          const priceValue =
            getPreviewFieldValue(item, ['precio', 'price', 'precio_unitario', 'unit_price', 'precio_por_caja', 'price_per_box']) ?? 0;
          const skuValue = getPreviewFieldValue(item, ['sku', 'SKU', 'codigo', 'code']) ?? `TMP-${idx}`;
          const categoryValue = getPreviewFieldValue(item, ['category', 'categoria']) ?? '';
          const stockValue = getPreviewFieldValue(item, ['stock', 'cantidad', 'qty']) ?? 0;

          return {
            id: idx,
            sku: String(skuValue),
            name: String(nameValue),
            price: priceValue as number | string,
            stock: stockValue as number | string,
            category: String(categoryValue),
            metadata: getPreviewMetadataEntries(item),
            errors: preview.warnings || [], // This maps global warnings to items if specific item errors aren't provided
            warnings: []
          };
        });

        setPreviewItems(mappedItems);
        setStep('preview');
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
  const handleItemUpdate = (id: string | number, field: keyof CatalogPreviewItem, value: any) => {
    setPreviewItems(prev => prev.map(item =>
        item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const handleItemDelete = (id: string | number) => {
    setPreviewItems(prev => prev.filter(item => item.id !== id));
  };

  const confirmUpload = async () => {
    if (!file || !currentSlug) return;
    // Commit requires real tenant ID. If we used 0 for preview, we must have the real ID now.
    if (!tenantId) {
        toast.error("No se pudo identificar la cuenta para confirmar. Intente recargar.");
        return;
    }

    setIsProcessing(true);

    try {
        // commitImport re-uploads the file in the stateless flow
        // Note: Inline edits in preview (handleItemUpdate) are NOT persisted because we send the original file.
        // To support inline edits, the backend would need to accept the JSON payload or we'd need to modify the file client-side (complex).
        // For this MVP, we warn the user or just send the file.
        // Ideally we would send the `previewItems` as JSON, but importService.commitImport sends the file.
        // We will stick to the file for now as per backend spec "fixed 404... catalog-upload".

        await importService.commitImport(tenantId, file, 'generic', currentSlug);

        setResultSummary({
            processed: previewItems.length,
            errors: 0
        });
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

        <CatalogItemsTable
            items={previewItems}
            onUpdate={handleItemUpdate}
            onDelete={handleItemDelete}
            // ReadOnly true because edits aren't persisted in this file-based flow yet
            readOnly={true}
        />

        <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
            Nota: La edición en línea no está disponible en este modo. Suba un archivo corregido si detecta errores.
        </p>

        <div className="flex items-center justify-end gap-3 pt-4 border-t">
             <Button onClick={confirmUpload} disabled={isProcessing || !canConfirm}>
                {isProcessing && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                Confirmar e Importar
             </Button>
        </div>
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

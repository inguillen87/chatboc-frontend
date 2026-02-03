import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, CheckCircle, Upload, AlertTriangle } from 'lucide-react';
import { importService, ImportPreview } from '../../services/importService';
import { useTenant } from '@/context/TenantContext';
import {
  getPreviewFallbackValue,
  getPreviewFieldValue,
  getPreviewMetadataEntries,
  hasMeaningfulValue,
  parsePreviewNumber,
} from '@/utils/catalogPreview';

interface Props {
  tenantId: number;
  tenantSlug?: string;
  onComplete: () => void;
}

const ImportWizard: React.FC<Props> = ({ tenantId, tenantSlug, onComplete }) => {
  const { currentSlug: contextSlug } = useTenant();
  const effectiveSlug = tenantSlug || contextSlug;
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [file, setFile] = useState<File | null>(null);
  const [processor, setProcessor] = useState('generic');
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);

  const canConfirm = (preview?.items_preview.length ?? 0) > 0;

  const previewColumns = useMemo(() => {
    if (!preview) {
      return [];
    }
    if (preview.columns && preview.columns.length > 0) {
      return preview.columns;
    }
    const firstRow = preview.items_preview[0];
    return firstRow ? Object.keys(firstRow) : [];
  }, [preview]);

  const updatePreviewField = (
    itemIndex: number,
    key: string,
    value: string
  ) => {
    if (!preview) return;
    const newItems = [...preview.items_preview];
    const current = newItems[itemIndex];
    newItems[itemIndex] = { ...current, [key]: value };
    setPreview({ ...preview, items_preview: newItems });
  };

  const renderPreviewTable = (containerClassName: string) => (
    <div className={containerClassName}>
      <table className="w-full text-sm">
        <thead className="bg-gray-100 sticky top-0 z-10">
          <tr>
            {previewColumns.map((column) => (
              <th key={column} className="p-2 text-left font-medium text-gray-600">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {preview?.items_preview.map((item, idx) => (
            <tr key={idx} className="border-b hover:bg-gray-50">
              {previewColumns.map((column) => (
                <td key={`${idx}-${column}`} className="p-2">
                  <Input
                    value={item[column] === null || item[column] === undefined ? '' : String(item[column])}
                    onChange={(e) => updatePreviewField(idx, column, e.target.value)}
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

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (event.dataTransfer.files && event.dataTransfer.files[0]) {
      setFile(event.dataTransfer.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    try {
      // Step 1: Stateless Upload & Preview
      const previewData = await importService.uploadFile(tenantId, file, processor, effectiveSlug || undefined);
      // We receive the preview directly.
      setPreview(previewData);
      setStep(2);
      setIsPreviewModalOpen(true);
    } catch (e) {
      console.error(e);
      alert("Error uploading file");
    } finally {
      setLoading(false);
    }
  };

  const handleCommit = async () => {
    if (!file) return;
    setLoading(true);
    try {
      // Step 2: Stateless Commit (Send file again)
      // Note: We ignore overrides for now as the backend stateless flow typically re-processes the file.
      // If we supported inline edits in the future, we'd send the 'preview.items_preview' as JSON instead of the file.
      const res = await importService.commitImport(
        tenantId,
        file,
        processor,
        effectiveSlug || undefined,
        preview?.items_preview
      );
      setResult(res);
      setStep(3);
    } catch (e) {
      console.error(e);
      alert("Error saving catalog");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle>Importar Catálogo - Paso {step}</CardTitle>
      </CardHeader>

      <CardContent>
        {step === 1 && (
          <div className="space-y-6">
            <div
                className="border-2 border-dashed border-gray-300 rounded-lg p-10 text-center hover:bg-gray-50 transition-colors cursor-pointer"
                onDragOver={(event) => event.preventDefault()}
                onDrop={handleDrop}
                onClick={() => document.getElementById('file')?.click()}
            >
                <Upload className="h-10 w-10 text-gray-400 mx-auto mb-4" />
                <p className="text-sm font-medium text-gray-700">Arrastra tu archivo aquí o haz clic para subir</p>
                <p className="text-xs text-gray-500 mt-1">Soporta PDF, Excel (.xlsx) y CSV</p>
                <Input id="file" type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                {file && (
                    <div className="mt-4 flex items-center justify-center gap-2 text-sm text-green-600 font-medium">
                        <CheckCircle className="h-4 w-4" /> {file.name}
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-blue-50 p-4 rounded-md text-xs text-blue-800">
                    <strong>Tip:</strong> Asegúrate que tu Excel tenga columnas como "Nombre", "Precio" y "SKU".
                </div>
                <div className="bg-blue-50 p-4 rounded-md text-xs text-blue-800">
                    <strong>Imágenes:</strong> Si tienes URLs de imágenes, inclúyelas en una columna "Imagen" o "Foto".
                </div>
            </div>

            <div className="space-y-2">
              <Label>Tipo de Catálogo</Label>
              <Select value={processor} onValueChange={setProcessor}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="generic">Genérico</SelectItem>
                  <SelectItem value="bodega">Bodega / Vinos</SelectItem>
                  <SelectItem value="corralon">Corralón / Construcción</SelectItem>
                  <SelectItem value="indumentaria">Indumentaria</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {step === 2 && preview && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 bg-blue-50 rounded-lg">
                <CheckCircle className="text-blue-500" />
                <div>
                    <p className="font-medium">Detectados: {preview.total_detected} productos</p>
                    <p className="text-sm text-gray-500">Confianza: {(preview.confidence * 100).toFixed(0)}%</p>
                </div>
            </div>

            {preview.warnings.length > 0 && (
                <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Advertencias</AlertTitle>
                    <AlertDescription>
                        <ul>
                            {preview.warnings.map((w, i) => <li key={i}>{w}</li>)}
                        </ul>
                    </AlertDescription>
                </Alert>
            )}

            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setIsPreviewModalOpen(true)}>
                Ver en pantalla completa
              </Button>
            </div>

            {!isPreviewModalOpen && renderPreviewTable("border rounded-md max-h-96 overflow-y-auto")}

            <Dialog open={isPreviewModalOpen} onOpenChange={setIsPreviewModalOpen}>
              <DialogContent className="max-w-6xl h-[85vh]">
                <DialogHeader>
                  <DialogTitle>Vista previa completa</DialogTitle>
                  <DialogDescription>
                    Revisá el detalle detectado por la IA antes de confirmar la importación. Productos detectados: {preview.total_detected}.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-lg border bg-muted/40 p-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Productos detectados</p>
                      <p className="text-xl font-semibold">{preview.total_detected}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Confianza</p>
                      <p className="text-xl font-semibold">{(preview.confidence * 100).toFixed(0)}%</p>
                    </div>
                    {preview.warnings.length > 0 && (
                      <div>
                        <p className="text-sm text-muted-foreground">Warnings</p>
                        <p className="text-sm font-medium">{preview.warnings.length}</p>
                      </div>
                    )}
                  </div>
                  <div className="overflow-x-auto">
                    {renderPreviewTable("border rounded-md max-h-[55vh] overflow-y-auto")}
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
                    <Button onClick={handleCommit} disabled={loading || !canConfirm}>
                      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Confirmar {preview?.items_preview.length} items
                    </Button>
                  </div>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}

        {step === 3 && result && (
            <div className="text-center py-8">
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <h3 className="text-2xl font-bold">¡Importación Exitosa!</h3>
                <p className="text-gray-600 mt-2">Se crearon {result.created_count} productos nuevos.</p>
            </div>
        )}
      </CardContent>

      <CardFooter className="justify-between">
        {step === 1 && (
            <Button onClick={handleUpload} disabled={!file || loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Subir y Analizar
            </Button>
        )}

        {step === 2 && (
            <>
                <Button variant="outline" onClick={() => setStep(1)}>Atrás</Button>
                <div className="space-x-2">
                   <Button variant="ghost" onClick={() => {
                      // Reset changes (optional feature, just reload preview logic if implemented)
                      // For now just allow cancelling
                      setStep(1);
                   }}>
                     Cancelar
                   </Button>
                   <Button onClick={handleCommit} disabled={loading || !canConfirm}>
                      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Confirmar {preview?.items_preview.length} items
                   </Button>
                </div>
            </>
        )}

        {step === 3 && (
            <Button onClick={onComplete} className="w-full">Finalizar</Button>
        )}
      </CardFooter>
    </Card>
  );
};

export default ImportWizard;

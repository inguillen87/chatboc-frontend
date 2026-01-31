import React, { useState } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle, Upload, AlertTriangle } from 'lucide-react';
import { importService, ImportPreview } from '../../services/importService';
import { useTenant } from '@/context/TenantContext';

interface Props {
  tenantId: number;
  onComplete: () => void;
}

const ImportWizard: React.FC<Props> = ({ tenantId, onComplete }) => {
  const { currentSlug } = useTenant();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [file, setFile] = useState<File | null>(null);
  const [processor, setProcessor] = useState('generic');
  const [uploadId, setUploadId] = useState<number | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const res = await importService.uploadFile(tenantId, file, processor, currentSlug || undefined);
      setUploadId(res.upload_id);

      // Poll for preview or just get it if sync (backend depends)
      // Assuming backend processes fast enough or we poll.
      // For MVP we assume the POST triggers process or we call getPreview immediately.
      // Let's call getPreview:
      const previewData = await importService.getPreview(res.upload_id, currentSlug || undefined);
      setPreview(previewData);
      setStep(2);
    } catch (e) {
      console.error(e);
      alert("Error uploading file");
    } finally {
      setLoading(false);
    }
  };

  const handleCommit = async () => {
    if (!uploadId) return;
    setLoading(true);
    try {
      const res = await importService.commitImport(uploadId, {}, currentSlug || undefined);
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
          <div className="space-y-4">
            <div className="grid w-full max-w-sm items-center gap-1.5">
              <Label htmlFor="file">Archivo (PDF, Excel, CSV)</Label>
              <Input id="file" type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
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

            <div className="border rounded-md max-h-64 overflow-y-auto">
                <table className="w-full text-sm">
                    <thead className="bg-gray-100 sticky top-0">
                        <tr>
                            <th className="p-2 text-left">Nombre</th>
                            <th className="p-2 text-left">Precio</th>
                            <th className="p-2 text-left">SKU</th>
                        </tr>
                    </thead>
                    <tbody>
                        {preview.items_preview.map((item, idx) => (
                            <tr key={idx} className="border-b">
                                <td className="p-2">{item.nombre}</td>
                                <td className="p-2">${item.precio}</td>
                                <td className="p-2 text-gray-500">{item.sku || '-'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
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
                <Button onClick={handleCommit} disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Confirmar e Importar
                </Button>
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

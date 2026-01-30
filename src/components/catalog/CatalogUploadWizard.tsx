import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, ArrowRight, Save, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/api/client';
import { useTenant } from '@/context/TenantContext';

interface CatalogUploadWizardProps {
  onSuccess?: () => void;
}

type UploadStatus = 'idle' | 'analyzing' | 'mapping' | 'preview' | 'confirming' | 'success' | 'error';

interface PreviewData {
  status: 'preview_ready' | 'needs_mapping';
  preview_items: any[];
  detected_columns: string[];
  expected_fields: string[];
  upload_token: string;
  stats?: {
    total_rows: number;
    confidence_score: number;
  };
  message?: string;
}

const CatalogUploadWizard: React.FC<CatalogUploadWizardProps> = ({ onSuccess }) => {
  const { currentSlug } = useTenant();
  const [step, setStep] = useState<UploadStatus>('idle');
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState('');
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Step 1: File Selection
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      handleUpload(acceptedFiles[0]);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'text/csv': ['.csv']
    },
    maxFiles: 1
  });

  const handleUpload = async (uploadFile?: File, uploadUrl?: string) => {
    if (!currentSlug) return;
    setStep('analyzing');
    setErrorMsg(null);

    try {
      let payload;
      if (uploadFile) {
        const formData = new FormData();
        formData.append('file', uploadFile);
        payload = formData;
      } else if (uploadUrl) {
        payload = { file_url: uploadUrl };
      } else {
        return;
      }

      const response = await apiClient.adminUploadCatalog(currentSlug, payload);
      setPreviewData(response);

      // Auto-initialize mapping if needed
      if (response.status === 'needs_mapping' || response.expected_fields) {
          const initialMapping: Record<string, string> = {};
          // Simple auto-match heuristic
          response.expected_fields.forEach((field: string) => {
              const match = response.detected_columns.find((col: string) =>
                  col.toLowerCase().includes(field.toLowerCase()) ||
                  field.toLowerCase().includes(col.toLowerCase())
              );
              if (match) {
                  initialMapping[field] = match;
              }
          });
          setMapping(initialMapping);
      }

      setStep(response.status === 'needs_mapping' ? 'mapping' : 'preview');
    } catch (error: any) {
      console.error("Upload failed", error);
      setErrorMsg(error?.message || "Error al analizar el archivo.");
      setStep('error');
    }
  };

  // Step 2: Mapping Logic
  const handleMappingChange = (field: string, column: string) => {
    setMapping(prev => ({ ...prev, [field]: column }));
  };

  const confirmMapping = () => {
    setStep('preview');
  };

  // Step 3: Confirmation
  const handleConfirm = async () => {
    if (!currentSlug || !previewData) return;
    setStep('confirming');

    try {
      const payload = {
        upload_token: previewData.upload_token,
        mapping_override: mapping
      };

      await apiClient.adminConfirmCatalog(currentSlug, payload);
      setStep('success');
      toast.success("Catálogo importado correctamente.");
      if (onSuccess) onSuccess();
    } catch (error: any) {
      console.error("Confirmation failed", error);
      if (error?.message?.includes("partial_success")) {
          toast.warning("Importación parcial: algunos items fueron omitidos.");
          setStep('success'); // Still consider it a "success" flow to move on
      } else {
          setErrorMsg(error?.message || "Error al confirmar la importación.");
          setStep('error');
      }
    }
  };

  const reset = () => {
    setStep('idle');
    setFile(null);
    setUrl('');
    setPreviewData(null);
    setMapping({});
    setErrorMsg(null);
  };

  if (step === 'success') {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardContent className="flex flex-col items-center justify-center p-8 text-center space-y-4">
          <div className="rounded-full bg-green-100 p-3">
            <CheckCircle2 className="h-10 w-10 text-green-600" />
          </div>
          <h3 className="text-xl font-semibold text-green-900">¡Importación Exitosa!</h3>
          <p className="text-green-700 max-w-xs">
            El catálogo se está procesando en segundo plano. Los productos aparecerán en breve.
          </p>
          <Button onClick={reset} className="bg-green-600 hover:bg-green-700 text-white">
            Subir otro archivo
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-4xl mx-auto shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary"/> Importador de Catálogo
        </CardTitle>
        <CardDescription>Sube tu lista de productos en Excel o CSV para actualizar tu tienda.</CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Progress Stepper */}
        <div className="flex justify-between mb-8 relative">
           <div className="absolute top-1/2 left-0 w-full h-0.5 bg-muted -z-10" />
           {['Carga', 'Mapeo', 'Confirmación'].map((label, index) => {
               const isActive =
                 (index === 0 && step === 'idle') ||
                 (index === 1 && (step === 'mapping' || step === 'analyzing')) ||
                 (index === 2 && (step === 'preview' || step === 'confirming'));
               const isCompleted =
                 (index === 0 && step !== 'idle') ||
                 (index === 1 && (step === 'preview' || step === 'confirming' || step === 'success'));

               return (
                   <div key={label} className="flex flex-col items-center bg-background px-2">
                       <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 font-bold text-sm transition-colors ${isActive ? 'border-primary bg-primary text-primary-foreground' : isCompleted ? 'border-primary bg-primary/20 text-primary' : 'border-muted text-muted-foreground'}`}>
                           {isCompleted ? <CheckCircle2 className="h-4 w-4"/> : index + 1}
                       </div>
                       <span className={`text-xs mt-1 font-medium ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>{label}</span>
                   </div>
               );
           })}
        </div>

        {errorMsg && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{errorMsg}</AlertDescription>
          </Alert>
        )}

        {/* STEP 1: UPLOAD */}
        {step === 'idle' || step === 'error' ? (
          <Tabs defaultValue="file" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="file">Subir Archivo</TabsTrigger>
              <TabsTrigger value="url">Desde URL</TabsTrigger>
            </TabsList>

            <TabsContent value="file">
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50'}`}
              >
                <input {...getInputProps()} />
                <div className="flex flex-col items-center gap-2">
                    <div className="p-4 rounded-full bg-muted">
                        <Upload className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <p className="text-lg font-medium">Arrastra tu archivo aquí</p>
                    <p className="text-sm text-muted-foreground">o haz clic para seleccionar (Excel, CSV)</p>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="url" className="space-y-4">
               <div className="space-y-2">
                  <Label>URL del archivo (Google Sheets público, Dropbox, etc)</Label>
                  <div className="flex gap-2">
                      <Input
                        placeholder="https://..."
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                      />
                      <Button onClick={() => handleUpload(undefined, url)} disabled={!url}>
                         Analizar
                      </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Asegúrate de que el enlace sea público y directo.</p>
               </div>
            </TabsContent>
          </Tabs>
        ) : null}

        {/* LOADING STATE */}
        {step === 'analyzing' && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-lg font-medium animate-pulse">Analizando estructura del archivo...</p>
                <p className="text-sm text-muted-foreground">Esto puede tomar unos segundos.</p>
            </div>
        )}

        {/* STEP 2: MAPPING */}
        {step === 'mapping' && previewData && (
            <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 flex gap-3 items-start">
                    <AlertTriangle className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div>
                        <h4 className="font-semibold text-blue-900">Revisión de Columnas</h4>
                        <p className="text-sm text-blue-700">Algunas columnas no se identificaron automáticamente. Por favor, asigna los campos correspondientes.</p>
                    </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                    {previewData.expected_fields.map(field => {
                         const isMapped = !!mapping[field];
                         return (
                             <Card key={field} className={`border ${isMapped ? 'border-green-200 bg-green-50/30' : 'border-yellow-200 bg-yellow-50/30'}`}>
                                 <CardContent className="p-4 flex items-center justify-between gap-4">
                                     <div className="space-y-1">
                                         <Label className="capitalize font-bold">{field.replace('_', ' ')}</Label>
                                         <p className="text-xs text-muted-foreground">Campo requerido por el sistema</p>
                                     </div>
                                     <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                                     <div className="w-48">
                                         <Select
                                            value={mapping[field] || "ignore"}
                                            onValueChange={(val) => handleMappingChange(field, val === "ignore" ? "" : val)}
                                         >
                                            <SelectTrigger className={isMapped ? "border-green-500" : ""}>
                                                <SelectValue placeholder="Seleccionar..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="ignore" className="text-muted-foreground italic">Ignorar columna</SelectItem>
                                                {previewData.detected_columns.map(col => (
                                                    <SelectItem key={col} value={col}>{col}</SelectItem>
                                                ))}
                                            </SelectContent>
                                         </Select>
                                     </div>
                                 </CardContent>
                             </Card>
                         );
                    })}
                </div>
            </div>
        )}

        {/* STEP 3: PREVIEW */}
        {(step === 'preview' || step === 'confirming') && previewData && (
            <div className="space-y-4">
                 <div className="flex justify-between items-center bg-muted/30 p-4 rounded-lg border">
                     <div>
                         <p className="text-sm font-medium">Resumen del Análisis</p>
                         <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                             <span>Filas detectadas: <strong>{previewData.stats?.total_rows || 'N/A'}</strong></span>
                             <span>Confianza: <strong>{((previewData.stats?.confidence_score || 0) * 100).toFixed(0)}%</strong></span>
                         </div>
                     </div>
                     <Button variant="outline" size="sm" onClick={() => setStep('mapping')}>
                         <RefreshCw className="mr-2 h-3 w-3" /> Editar Mapeo
                     </Button>
                 </div>

                 <div className="border rounded-md overflow-hidden">
                    <Table>
                        <TableHeader className="bg-muted">
                            <TableRow>
                                {Object.keys(previewData.preview_items[0] || {}).slice(0, 5).map(header => (
                                    <TableHead key={header}>{header}</TableHead>
                                ))}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {previewData.preview_items.map((row, i) => (
                                <TableRow key={i}>
                                    {Object.values(row).slice(0, 5).map((val: any, j) => (
                                        <TableCell key={j} className="font-mono text-xs truncate max-w-[150px]">
                                            {String(val)}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                 </div>
                 <p className="text-xs text-center text-muted-foreground">Mostrando primeras 5 filas como vista previa.</p>
            </div>
        )}

      </CardContent>

      <CardFooter className="flex justify-between bg-muted/10 py-4">
         {step === 'idle' ? (
             <p className="text-xs text-muted-foreground">Soporta .xlsx, .csv (Max 5MB)</p>
         ) : (
             <Button variant="ghost" onClick={reset} disabled={step === 'confirming'}>Cancelar</Button>
         )}

         {step === 'mapping' && (
             <Button onClick={confirmMapping} disabled={Object.keys(mapping).length === 0}>
                 Continuar <ArrowRight className="ml-2 h-4 w-4" />
             </Button>
         )}

         {step === 'preview' && (
             <Button onClick={handleConfirm} disabled={step === 'confirming'}>
                 {step === 'confirming' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                 Confirmar Importación
             </Button>
         )}
      </CardFooter>
    </Card>
  );
};

export default CatalogUploadWizard;

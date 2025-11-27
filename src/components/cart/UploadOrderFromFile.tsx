import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Upload, Loader2, FileWarning } from 'lucide-react';
import { ApiError, apiFetch, getErrorMessage } from '@/utils/api';
import { useTenant } from '@/context/TenantContext';

interface UploadOrderFromFileProps {
  onCartUpdated?: (items: unknown) => void;
}

const UploadOrderFromFile: React.FC<UploadOrderFromFileProps> = ({ onCartUpdated }) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { currentSlug } = useTenant();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [missingItems, setMissingItems] = useState<string[]>([]);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    setMissingItems([]);
    setSuccessMessage(null);
    setStatusMessage('Analizando archivo y extrayendo productos...');
    setProgress(10);

    try {
      const formData = new FormData();
      formData.append('file', file);
      if (currentSlug) {
        formData.append('tenant', currentSlug);
      }

      const response = await apiFetch<{ items?: unknown; items_no_encontrados?: string[]; resumen?: string }>(
        '/api/pedidos/from-file',
        {
          method: 'POST',
          body: formData,
          sendAnonId: true,
          tenantSlug: currentSlug ?? undefined,
          suppressPanel401Redirect: true,
        },
        (res) => {
          const total = Number(res.headers.get('Content-Length'));
          if (Number.isFinite(total) && total > 0) {
            setProgress(70);
            setStatusMessage('Procesando respuesta del servidor...');
          }
        },
      );

      setProgress(90);

      if (response?.items && typeof onCartUpdated === 'function') {
        onCartUpdated(response.items);
      }

      if (Array.isArray(response?.items_no_encontrados)) {
        setMissingItems(response.items_no_encontrados.filter((item) => typeof item === 'string'));
      }

      setSuccessMessage(response?.resumen ?? 'Hemos armado un carrito en base a tu nota de pedido.');
      setStatusMessage('Archivo procesado correctamente.');
    } catch (uploadError) {
      if (uploadError instanceof ApiError) {
        const contentType = String(uploadError.body?.contentType || '').toLowerCase();
        if (contentType.includes('text/html')) {
          console.warn('[UploadOrderFromFile] Respuesta inesperada al importar archivo', uploadError.body?.raw);
          setError(
            'El servidor devolvió una respuesta inesperada al interpretar el archivo (posible bloqueo CORS, sesión expirada o redirección). Revisa que estés autenticado y que tu conexión/origen estén permitidos, o comunícate con el administrador si el problema persiste.',
          );
        } else {
          setError(getErrorMessage(uploadError, 'No pudimos interpretar el archivo. Intenta nuevamente.'));
        }
      } else if (uploadError instanceof TypeError) {
        setError(
          'No pudimos contactar al servidor para procesar el archivo (posible problema de conexión o CORS). Verifica tu red y vuelve a intentarlo.',
        );
      } else {
        setError(getErrorMessage(uploadError, 'No pudimos interpretar el archivo. Intenta nuevamente.'));
      }
      setStatusMessage(null);
    } finally {
      setProgress(100);
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.csv,.xls,.xlsx,.doc,.docx"
          onChange={handleFileChange}
          disabled={uploading}
          className="max-w-xs"
        />
        <Button type="button" variant="secondary" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
          {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />} Subir nota de pedido
        </Button>
      </div>

      {uploading && <Progress value={progress} className="h-2" />}

      {statusMessage && (
        <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
          {statusMessage}
        </p>
      )}

      {successMessage && (
        <Alert className="border-green-200 bg-green-50 text-green-900">
          <AlertTitle>Archivo procesado</AlertTitle>
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Error al procesar</AlertTitle>
          <AlertDescription>
            {error}
            <br />
            Verifica que el archivo tenga el formato correcto y que tu sesión siga activa. Si el problema persiste, intenta nuevamente más tarde.
          </AlertDescription>
        </Alert>
      )}

      {missingItems.length > 0 && (
        <Alert className="border-amber-200 bg-amber-50 text-amber-900">
          <FileWarning className="h-4 w-4" />
          <AlertTitle>Productos no identificados</AlertTitle>
          <AlertDescription>
            No pudimos asociar los siguientes ítems: {missingItems.join(', ')}. Puedes cargarlos manualmente.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default UploadOrderFromFile;

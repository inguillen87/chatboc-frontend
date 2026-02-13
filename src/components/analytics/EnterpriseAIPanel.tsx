import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { enterpriseService } from '@/services/enterpriseService';
import { ApiError } from '@/utils/api';

interface Props {
  tenantId: number;
  tenantSlug?: string;
  scope: string;
}

const EnterpriseAIPanel = ({ tenantId, tenantSlug, scope }: Props) => {
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);
  const [recommendationsError, setRecommendationsError] = useState<string | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [draftResponse, setDraftResponse] = useState<any | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);

  const handleLoadRecommendations = async () => {
    if (!tenantId) return;
    setLoadingRecommendations(true);
    setRecommendationsError(null);
    try {
      const response = await enterpriseService.getProductRecommendations({ tenant_id: tenantId, limit: 8 }, tenantSlug);
      const rows = response?.items || response?.recommendations || [];
      setRecommendations(Array.isArray(rows) ? rows : []);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setRecommendationsError('No tenés permisos para ver recomendaciones.');
      } else if (err instanceof ApiError && err.status === 404) {
        setRecommendationsError('No encontramos recomendaciones para este tenant.');
      } else if (err instanceof ApiError && err.status === 400) {
        setRecommendationsError('La solicitud de recomendaciones es inválida.');
      } else {
        setRecommendationsError('No se pudieron cargar recomendaciones.');
      }
    } finally {
      setLoadingRecommendations(false);
    }
  };

  const handleUpload = async () => {
    if (!tenantId || !file) return;
    setUploading(true);
    setDraftError(null);
    try {
      const response = await enterpriseService.uploadOrderDraftFromDocument(tenantId, file, tenantSlug);
      setDraftResponse(response);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setDraftError('No tenés permisos para generar borradores.');
      } else if (err instanceof ApiError && err.status === 400) {
        setDraftError('Archivo inválido. Verificá tamaño/formato e intentá nuevamente.');
      } else {
        setDraftError('No se pudo procesar el documento.');
      }
    } finally {
      setUploading(false);
    }
  };

  const draftItems = Array.isArray(draftResponse?.draft_items) ? draftResponse.draft_items : [];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Productos recomendados</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button onClick={handleLoadRecommendations} disabled={loadingRecommendations || !tenantId}>
            {loadingRecommendations ? 'Cargando...' : 'Cargar recomendaciones IA'}
          </Button>
          {recommendationsError ? <p className="text-sm text-destructive">{recommendationsError}</p> : null}
          {recommendations.length > 0 ? (
            <ul className="space-y-2 text-sm">
              {recommendations.map((item, idx) => (
                <li key={item.id ?? idx} className="rounded border p-2">
                  {item.nombre ?? item.name ?? item.product_name ?? `Recomendación ${idx + 1}`}
                </li>
              ))}
            </ul>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Borrador de pedido desde documento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.webp"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
          <Button onClick={handleUpload} disabled={!file || uploading || !tenantId}>
            {uploading ? 'Procesando...' : 'Generar borrador IA'}
          </Button>
          {draftError ? <p className="text-sm text-destructive">{draftError}</p> : null}

          {draftResponse ? (
            <div className="space-y-2 text-sm">
              <p>
                Matched: {draftResponse?.matched_count ?? 0} · Unmatched: {draftResponse?.unmatched_count ?? 0}
              </p>
              {draftItems.length > 0 ? (
                <div className="max-h-48 overflow-auto rounded border">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted">
                      <tr>
                        <th className="p-2">Ítem</th>
                        <th className="p-2">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {draftItems.map((row: any, idx: number) => (
                        <tr key={idx} className="border-t">
                          <td className="p-2">{row?.name ?? row?.item ?? row?.descripcion ?? `Ítem ${idx + 1}`}</td>
                          <td className="p-2">{row?.match_status ?? 'unknown'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
};

export default EnterpriseAIPanel;

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { enterpriseService } from '@/services/enterpriseService';
import { ApiError } from '@/utils/api';
import { toast } from 'sonner';
import { resolveDraftCounts, validateOrderDraftFile, ORDER_DRAFT_ALLOWED_EXTENSIONS } from '@/utils/enterpriseAi';

interface Props {
  tenantId: number;
  tenantSlug?: string;
  scope: string;
}

interface DraftItem {
  name: string;
  match_status: string;
  quantity: number;
}

const EnterpriseAIPanel = ({ tenantId, tenantSlug, scope }: Props) => {
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);
  const [recommendationsError, setRecommendationsError] = useState<string | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [draftResponse, setDraftResponse] = useState<any | null>(null);
  const [draftItems, setDraftItems] = useState<DraftItem[]>([]);
  const [draftError, setDraftError] = useState<string | null>(null);

  const { matched: resolvedMatchedCount, unmatched: resolvedUnmatchedCount } = useMemo(
    () => resolveDraftCounts(draftItems, draftResponse?.matched_count, draftResponse?.unmatched_count),
    [draftItems, draftResponse],
  );

  const handleLoadRecommendations = async () => {
    if (!tenantId) return;
    setLoadingRecommendations(true);
    setRecommendationsError(null);
    try {
      const response = await enterpriseService.getProductRecommendations(
        { tenant_id: tenantId, limit: 8, scope },
        tenantSlug,
      );
      const rows = response?.items || response?.recommendations || [];
      const nextRows = Array.isArray(rows) ? rows : [];
      setRecommendations(nextRows);
      if (nextRows.length === 0) {
        toast.info('No se encontraron recomendaciones para este filtro.');
      } else {
        toast.success('Recomendaciones cargadas.');
      }
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

  const handleFileSelection = (selectedFile: File | null) => {
    setDraftError(null);
    setDraftResponse(null);
    setDraftItems([]);

    const validation = validateOrderDraftFile(selectedFile);
    if (!validation.valid) {
      setFile(null);
      if (validation.message) setDraftError(validation.message);
      return;
    }

    setFile(selectedFile);
  };

  const handleUpload = async () => {
    if (!tenantId || !file) return;
    setUploading(true);
    setDraftError(null);
    try {
      const response = await enterpriseService.uploadOrderDraftFromDocument(tenantId, file, tenantSlug);
      setDraftResponse(response);
      const rows = Array.isArray(response?.draft_items)
        ? response.draft_items.map((row: any, idx: number) => ({
            name: String(row?.name ?? row?.item ?? row?.descripcion ?? `Ítem ${idx + 1}`),
            match_status: String(row?.match_status ?? 'unknown'),
            quantity: Number(row?.quantity ?? row?.qty ?? 1),
          }))
        : [];
      setDraftItems(rows);
      toast.success('Borrador generado correctamente.');
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

  const handleDraftItemChange = (index: number, field: keyof DraftItem, value: string) => {
    setDraftItems((current) =>
      current.map((item, currentIndex) => {
        if (currentIndex !== index) return item;
        if (field === 'quantity') {
          return { ...item, quantity: Number(value || 0) };
        }
        return { ...item, [field]: value };
      }),
    );
  };

  const downloadDraftJson = () => {
    const payload = {
      tenant_id: tenantId,
      matched_count: resolvedMatchedCount,
      unmatched_count: resolvedUnmatchedCount,
      draft_items: draftItems,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'draft_items.json';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('JSON descargado.');
  };

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
          {recommendationsError ? (
            <div className="space-y-2">
              <p className="text-sm text-destructive">{recommendationsError}</p>
              <Button variant="outline" size="sm" onClick={handleLoadRecommendations}>
                Reintentar recomendaciones
              </Button>
            </div>
          ) : null}
          {!loadingRecommendations && !recommendationsError && recommendations.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía no hay recomendaciones cargadas.</p>
          ) : null}
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
            accept={ORDER_DRAFT_ALLOWED_EXTENSIONS.join(',')}
            onChange={(event) => handleFileSelection(event.target.files?.[0] ?? null)}
          />
          <Button onClick={handleUpload} disabled={!file || uploading || !tenantId}>
            {uploading ? 'Procesando...' : 'Generar borrador IA'}
          </Button>
          {draftError ? (
            <div className="space-y-2">
              <p className="text-sm text-destructive">{draftError}</p>
              <Button variant="outline" size="sm" onClick={handleUpload} disabled={!file || uploading || !tenantId}>
                Reintentar borrador
              </Button>
            </div>
          ) : null}

          {draftResponse ? (
            <div className="space-y-2 text-sm">
              <p>
                Matched: {resolvedMatchedCount} · Unmatched: {resolvedUnmatchedCount}
              </p>

              {draftItems.length > 0 ? (
                <div className="space-y-2">
                  <div className="max-h-56 overflow-auto rounded border">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-muted sticky top-0">
                        <tr>
                          <th className="p-2">Ítem</th>
                          <th className="p-2">Cantidad</th>
                          <th className="p-2">Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {draftItems.map((row, idx) => (
                          <tr key={idx} className="border-t align-top">
                            <td className="p-2">
                              <Input
                                value={row.name}
                                onChange={(event) => handleDraftItemChange(idx, 'name', event.target.value)}
                                className="h-8 text-xs"
                              />
                            </td>
                            <td className="p-2">
                              <Input
                                type="number"
                                min={0}
                                value={row.quantity}
                                onChange={(event) => handleDraftItemChange(idx, 'quantity', event.target.value)}
                                className="h-8 text-xs"
                              />
                            </td>
                            <td className="p-2">
                              <Input
                                value={row.match_status}
                                onChange={(event) => handleDraftItemChange(idx, 'match_status', event.target.value)}
                                className="h-8 text-xs"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <Button variant="outline" onClick={downloadDraftJson}>
                    Descargar JSON editado
                  </Button>
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

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { enterpriseService } from '@/services/enterpriseService';
import { ApiError } from '@/utils/api';
import { getEnterpriseErrorMessage } from '@/utils/enterpriseErrors';
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

const ORDER_DRAFT_MANUAL_REVIEW_MESSAGE = 'Revision manual requerida: no hay borrador editable para descargar.';
const ORDER_DRAFT_MANUAL_REVIEW_STATES = new Set(['manual_review', 'legacy', 'failed', 'ai_unavailable']);

const normalizeDraftSignal = (value: unknown) => String(value ?? '').trim().toLowerCase();

const hasDraftErrorValue = (value: unknown) => {
  if (Array.isArray(value)) return value.length > 0;
  return Boolean(value);
};

const resolveUsableDraftItems = (response: any): DraftItem[] => {
  if (!Array.isArray(response?.draft_items)) return [];

  return response.draft_items
    .map((row: any): DraftItem | null => {
      const rawName =
        row?.name ?? row?.nombre ?? row?.item ?? row?.descripcion ?? row?.description ?? row?.source_name ?? row?.product_name;
      const name = String(rawName ?? '').trim();
      if (!name) return null;

      const quantity = Number(row?.quantity ?? row?.qty ?? 1);
      return {
        name,
        match_status: String(row?.match_status ?? 'unknown'),
        quantity: Number.isFinite(quantity) ? quantity : 1,
      };
    })
    .filter((item): item is DraftItem => item !== null);
};

const responseRequiresManualReview = (response: any) => {
  const crmState = normalizeDraftSignal(response?.crm_state);
  const status = normalizeDraftSignal(response?.status);
  const providerStatus = normalizeDraftSignal(response?.provider_status ?? response?.source?.provider_status);

  return (
    ORDER_DRAFT_MANUAL_REVIEW_STATES.has(crmState) ||
    ORDER_DRAFT_MANUAL_REVIEW_STATES.has(status) ||
    providerStatus === 'failed' ||
    hasDraftErrorValue(response?.row_errors) ||
    hasDraftErrorValue(response?.error)
  );
};

const asManualReviewDraftResponse = (response: any) => ({
  ...(response ?? {}),
  crm_state: 'manual_review',
  status: 'manual_review',
  matched_count: 0,
  unmatched_count: 0,
  draft_items: [],
});

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
  const draftRequiresManualReview = draftResponse?.crm_state === 'manual_review';

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
      const status = err instanceof ApiError ? err.status : undefined;
      setRecommendationsError(getEnterpriseErrorMessage(status, 'load_recommendations'));
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
      const rows = resolveUsableDraftItems(response);

      if (rows.length === 0 || responseRequiresManualReview(response)) {
        setDraftResponse(asManualReviewDraftResponse(response));
        setDraftItems([]);
        return;
      }

      setDraftResponse(response);
      setDraftItems(rows);
      toast.success('Borrador generado correctamente.');
    } catch (err) {
      const status = err instanceof ApiError ? err.status : undefined;
      setDraftError(getEnterpriseErrorMessage(status, 'upload_order_draft'));
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
              {draftRequiresManualReview ? (
                <p className="text-sm text-muted-foreground">{ORDER_DRAFT_MANUAL_REVIEW_MESSAGE}</p>
              ) : null}
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

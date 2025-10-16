import { useMemo, useState } from 'react';
import { CheckCircle2, Clock, FilePlus2, ShieldCheck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type { SurveySnapshot } from '@/types/encuestas';

interface TransparencyTabProps {
  snapshots?: SurveySnapshot[];
  onCreateSnapshot: (payload?: { rango?: string }) => Promise<void>;
  onPublishSnapshot: (snapshotId: number) => Promise<void>;
  onVerifyResponse: (snapshotId: number, respuestaId: number) => Promise<{ ok: boolean; valido: boolean }>;
  isCreating?: boolean;
  isPublishing?: boolean;
  isVerifying?: boolean;
}

const isSnapshotRecord = (value: unknown): value is SurveySnapshot => {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === 'number' && typeof record.creado_at === 'string';
};

const collectSnapshotCandidates = (value: unknown, target: SurveySnapshot[]) => {
  if (!value) return;
  if (Array.isArray(value)) {
    value.forEach((item) => collectSnapshotCandidates(item, target));
    return;
  }
  if (isSnapshotRecord(value)) {
    target.push(value);
    return;
  }
  if (typeof value === 'object') {
    for (const nested of Object.values(value)) {
      collectSnapshotCandidates(nested, target);
    }
  }
};

const normalizeSnapshots = (value: unknown): SurveySnapshot[] => {
  const normalized: SurveySnapshot[] = [];
  collectSnapshotCandidates(value, normalized);
  return normalized;
};

export const TransparencyTab = ({
  snapshots,
  onCreateSnapshot,
  onPublishSnapshot,
  onVerifyResponse,
  isCreating,
  isPublishing,
  isVerifying,
}: TransparencyTabProps) => {
  const [range, setRange] = useState('');
  const [snapshotId, setSnapshotId] = useState<number | null>(null);
  const [responseId, setResponseId] = useState('');
  const [verificationResult, setVerificationResult] = useState<string | null>(null);

  const normalizedSnapshots = useMemo(() => normalizeSnapshots(snapshots), [snapshots]);

  const handleCreateSnapshot = async () => {
    await onCreateSnapshot(range ? { rango: range } : undefined);
    setRange('');
  };

  const handlePublishSnapshot = async (id: number) => {
    await onPublishSnapshot(id);
  };

  const handleVerify = async () => {
    if (!snapshotId || !responseId) return;
    const numericResponse = Number(responseId);
    if (!Number.isFinite(numericResponse)) return;
    const result = await onVerifyResponse(snapshotId, numericResponse);
    setVerificationResult(result.valido ? 'válida' : 'no válida');
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Snapshots de transparencia</CardTitle>
          <CardDescription>Creá cortes de control para auditar resultados y compartir evidencia con la ciudadanía.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px] space-y-2">
              <label className="text-sm font-medium">Rango de fechas (opcional)</label>
              <Input
                value={range}
                onChange={(event) => setRange(event.target.value)}
                placeholder="Ej: 2024-06-01 a 2024-06-15"
              />
            </div>
            <Button onClick={handleCreateSnapshot} disabled={isCreating} className="inline-flex items-center gap-2">
              <FilePlus2 className="h-4 w-4" /> {isCreating ? 'Creando…' : 'Crear snapshot'}
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="py-2 pr-4">Etiqueta</th>
                  <th className="py-2 pr-4">Creado</th>
                  <th className="py-2 pr-4">Publicado</th>
                  <th className="py-2 pr-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {normalizedSnapshots.map((snapshot) => (
                  <tr key={snapshot.id} className="border-b border-border/40">
                    <td className="py-2 pr-4">
                      <div className="flex flex-col">
                        <span className="font-medium">{snapshot.etiqueta || `Snapshot #${snapshot.id}`}</span>
                        {snapshot.rango && (
                          <span className="text-xs text-muted-foreground">{snapshot.rango}</span>
                        )}
                      </div>
                    </td>
                    <td className="py-2 pr-4">
                      <div className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-4 w-4" /> {new Date(snapshot.creado_at).toLocaleString()}
                      </div>
                    </td>
                    <td className="py-2 pr-4">
                      {snapshot.publicado_at ? (
                        <div className="inline-flex items-center gap-1 text-xs text-emerald-600">
                          <ShieldCheck className="h-4 w-4" /> {new Date(snapshot.publicado_at).toLocaleString()}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Pendiente</span>
                      )}
                    </td>
                    <td className="py-2 pr-4 text-right">
                      {!snapshot.publicado_at && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="inline-flex items-center gap-2"
                          onClick={() => handlePublishSnapshot(snapshot.id)}
                          disabled={isPublishing}
                        >
                          <CheckCircle2 className="h-4 w-4" /> {isPublishing ? 'Publicando…' : 'Publicar'}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
                {!normalizedSnapshots.length && (
                  <tr>
                    <td colSpan={4} className="py-4 text-center text-muted-foreground">
                      Aún no creaste snapshots. Generá uno para fijar un estado verificable de la encuesta.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Verificar respuesta</CardTitle>
          <CardDescription>Ingresá el ID de respuesta y el snapshot publicado para validar si está incluido.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Snapshot</label>
              <Input
                type="number"
                min={1}
                value={snapshotId ?? ''}
                onChange={(event) => setSnapshotId(event.target.value ? Number(event.target.value) : null)}
                placeholder="ID de snapshot"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Respuesta</label>
              <Input
                type="number"
                min={1}
                value={responseId}
                onChange={(event) => setResponseId(event.target.value)}
                placeholder="ID de respuesta"
              />
            </div>
          </div>
          <Button onClick={handleVerify} disabled={isVerifying || !snapshotId || !responseId}>
            {isVerifying ? 'Verificando…' : 'Verificar'}
          </Button>
          {verificationResult && (
            <p className="text-sm text-muted-foreground">
              La respuesta #{responseId} es <span className="font-semibold">{verificationResult}</span> en el snapshot seleccionado.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

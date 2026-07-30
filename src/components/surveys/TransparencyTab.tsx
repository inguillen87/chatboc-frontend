import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, FilePlus2, FlaskConical } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type {
  SnapshotCreatePayload,
  SnapshotVerificationResult,
  SurveySnapshot,
} from '@/types/encuestas';

interface TransparencyTabProps {
  snapshots?: SurveySnapshot[];
  onCreateSnapshot: (payload: SnapshotCreatePayload) => Promise<void>;
  onSimulateAnchor: (snapshotId: number) => Promise<void>;
  onVerifyResponse: (snapshotId: number, respuestaId: number) => Promise<SnapshotVerificationResult>;
  isCreating?: boolean;
  isPublishing?: boolean;
  isVerifying?: boolean;
}

const toIsoDate = (value: string): string | null => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

const snapshotStatus = (snapshot: SurveySnapshot) => {
  if (snapshot.externally_verified) {
    return { label: 'Verificado externamente', className: 'text-emerald-600' };
  }
  if (snapshot.is_simulated || snapshot.anchor_status === 'simulated') {
    return { label: 'Simulacion local - no publicada', className: 'text-amber-700' };
  }
  if (snapshot.anchor_status === 'unverified') {
    return { label: 'Referencia externa no verificada', className: 'text-amber-700' };
  }
  if (snapshot.anchor_status === 'failed') {
    return { label: 'Fallo de evidencia', className: 'text-destructive' };
  }
  return { label: 'Corte Merkle local', className: 'text-muted-foreground' };
};

export const TransparencyTab = ({
  snapshots,
  onCreateSnapshot,
  onSimulateAnchor,
  onVerifyResponse,
  isCreating,
  isPublishing,
  isVerifying,
}: TransparencyTabProps) => {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [snapshotId, setSnapshotId] = useState<number | null>(null);
  const [responseId, setResponseId] = useState('');
  const [verificationResult, setVerificationResult] = useState<SnapshotVerificationResult | null>(null);

  const normalizedSnapshots = useMemo(
    () => (Array.isArray(snapshots) ? snapshots.filter((item) => Number.isFinite(item?.id)) : []),
    [snapshots],
  );
  const snapshotSelectValue = snapshotId ? String(snapshotId) : undefined;
  const parsedFrom = toIsoDate(fromDate);
  const parsedTo = toIsoDate(toDate);
  const validRange = Boolean(parsedFrom && parsedTo && parsedFrom <= parsedTo);

  useEffect(() => {
    setVerificationResult(null);
  }, [snapshotId, responseId]);

  const handleCreateSnapshot = async () => {
    if (!parsedFrom || !parsedTo || parsedFrom > parsedTo) return;
    await onCreateSnapshot({ desde: parsedFrom, hasta: parsedTo });
    setFromDate('');
    setToDate('');
  };

  const handleVerify = () => {
    if (!snapshotId || !responseId) return;
    const numericResponse = Number(responseId);
    if (!Number.isInteger(numericResponse) || numericResponse <= 0) return;
    void onVerifyResponse(snapshotId, numericResponse)
      .then(setVerificationResult)
      .catch(() => setVerificationResult(null));
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-3 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="font-semibold">Evidencia local, no publicacion blockchain</p>
          <p>
            Estos cortes permiten comprobar inclusion y consistencia Merkle dentro de Chatboc. No certifican
            resultados ni acreditan una transaccion en una red externa.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cortes locales de integridad</CardTitle>
          <CardDescription>
            Elegi un rango completo. El backend calcula un Merkle root sobre las respuestas incluidas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="snapshot-from">Desde</label>
              <Input
                id="snapshot-from"
                type="datetime-local"
                value={fromDate}
                onChange={(event) => setFromDate(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="snapshot-to">Hasta</label>
              <Input
                id="snapshot-to"
                type="datetime-local"
                value={toDate}
                onChange={(event) => setToDate(event.target.value)}
              />
            </div>
            <Button
              onClick={handleCreateSnapshot}
              disabled={isCreating || !validRange}
              className="inline-flex items-center gap-2"
            >
              <FilePlus2 className="h-4 w-4" /> {isCreating ? 'Creando...' : 'Crear corte local'}
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="py-2 pr-4">Snapshot</th>
                  <th className="py-2 pr-4">Rango</th>
                  <th className="py-2 pr-4">Estado de evidencia</th>
                  <th className="py-2 pr-4 text-right">Respuestas</th>
                  <th className="py-2 pr-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {normalizedSnapshots.map((snapshot) => {
                  const status = snapshotStatus(snapshot);
                  return (
                    <tr key={snapshot.id} className="border-b border-border/40">
                      <td className="py-2 pr-4">
                        <div className="flex flex-col">
                          <span className="font-medium">Snapshot #{snapshot.id}</span>
                          <code className="max-w-[220px] truncate text-xs text-muted-foreground" title={snapshot.root_hash}>
                            {snapshot.root_hash}
                          </code>
                        </div>
                      </td>
                      <td className="py-2 pr-4 text-xs text-muted-foreground">
                        <div>{new Date(snapshot.desde_at).toLocaleString()}</div>
                        <div>{new Date(snapshot.hasta_at).toLocaleString()}</div>
                      </td>
                      <td className="py-2 pr-4">
                        <div className={`inline-flex items-center gap-1 text-xs ${status.className}`}>
                          {snapshot.is_simulated ? <FlaskConical className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                          {status.label}
                        </div>
                      </td>
                      <td className="py-2 pr-4 text-right">{snapshot.total_respuestas.toLocaleString('es-AR')}</td>
                      <td className="py-2 pr-4 text-right">
                        {!snapshot.is_simulated && !snapshot.externally_verified && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="inline-flex items-center gap-2"
                            onClick={() => onSimulateAnchor(snapshot.id)}
                            disabled={isPublishing}
                          >
                            <FlaskConical className="h-4 w-4" />
                            {isPublishing ? 'Simulando...' : 'Generar referencia local'}
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {!normalizedSnapshots.length && (
                  <tr>
                    <td colSpan={5} className="py-4 text-center text-muted-foreground">
                      Todavia no hay cortes locales de integridad.
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
          <CardTitle>Comprobar inclusion local</CardTitle>
          <CardDescription>
            Confirma si una respuesta integra el Merkle root local. No verifica publicacion externa.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Snapshot</label>
              {normalizedSnapshots.length ? (
                <Select
                  value={snapshotSelectValue}
                  onValueChange={(value) => setSnapshotId(value ? Number(value) : null)}
                  disabled={isVerifying}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Elegi un snapshot" />
                  </SelectTrigger>
                  <SelectContent>
                    {normalizedSnapshots.map((snapshot) => (
                      <SelectItem key={snapshot.id} value={String(snapshot.id)}>
                        Snapshot #{snapshot.id} - {snapshot.total_respuestas} resp.
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input disabled placeholder="Crea un corte para comprobar inclusion" />
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="snapshot-response-id">Respuesta</label>
              <Input
                id="snapshot-response-id"
                type="number"
                min={1}
                value={responseId}
                onChange={(event) => setResponseId(event.target.value)}
                placeholder="ID de respuesta"
              />
            </div>
          </div>
          <Button onClick={handleVerify} disabled={isVerifying || !snapshotId || !responseId}>
            {isVerifying ? 'Comprobando...' : 'Comprobar inclusion local'}
          </Button>
          {verificationResult && (
            <div className="flex gap-2 rounded-md border p-3 text-sm">
              {verificationResult.local_proof_valid ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
              ) : (
                <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />
              )}
              <p>
                {verificationResult.local_proof_valid
                  ? `La respuesta #${responseId} esta incluida en este corte local.`
                  : `No se pudo demostrar la inclusion local de la respuesta #${responseId}.`}{' '}
                <strong>No se verifico una publicacion externa.</strong>
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

import React, { useEffect, useMemo, useState } from 'react';
import type { SaasAction } from '@/api/v2/saas';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

export type TicketShareActionKind = 'location' | 'form' | 'attachment';
export type TicketShareActionPayload = { lat?: number; lng?: number; label?: string; address?: string; capture_source?: 'manual' | 'operator_browser_geolocation'; form_id?: number; attachment_id?: number };
type PlainRecord = Record<string, unknown>;
type VerifiedOption = { id: number; label: string };

interface TicketShareActionDialogProps {
  action: SaasAction | null;
  kind: TicketShareActionKind;
  open: boolean;
  replyContract?: PlainRecord;
  attachments?: unknown[];
  submitting?: boolean;
  errorMessage?: string | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (payload: TicketShareActionPayload) => void;
}

const asRecord = (value: unknown): PlainRecord => value && typeof value === 'object' && !Array.isArray(value) ? value as PlainRecord : {};
const text = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim() : null;
const positiveId = (value: unknown) => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};
const getAttachmentOptions = (attachments: unknown[] = []): VerifiedOption[] => attachments.flatMap((candidate) => {
  const item = asRecord(candidate);
  const id = positiveId(item.id ?? item.attachment_id);
  const label = text(item.filename ?? item.file_name ?? item.name ?? item.nombre);
  return id && label ? [{ id, label }] : [];
});
const getFormOptions = (action: SaasAction | null): VerifiedOption[] => {
  const raw = asRecord(action?.raw);
  const options = Array.isArray(raw.options) ? raw.options : [];
  return options.flatMap((candidate) => {
    const item = asRecord(candidate);
    const id = positiveId(item.form_id ?? item.id);
    const label = text(item.label ?? item.name ?? item.title);
    const evidence = asRecord(item.evidence);
    const approved = item.approved === true && item.tenant_owned === true && item.tenant_verified === true &&
      evidence.approved === true && evidence.tenant_owned === true && evidence.flow_contract_verified === true;
    return id && label && approved ? [{ id, label }] : [];
  });
};
const disabledReason = (kind: TicketShareActionKind, action: SaasAction) => action.disabled_reason?.trim() || `El backend marcó ${kind === 'location' ? 'la ubicación' : kind === 'form' ? 'el formulario' : 'el adjunto'} como no disponible.`;

export const getTicketShareActionBlockReason = (kind: TicketShareActionKind, action: SaasAction | null, _replyContract?: PlainRecord, attachments: unknown[] = []): string | null => {
  if (!action) return 'Este ticket no publicó una acción backend compatible.';
  if (action.enabled !== true || action.disabled === true) return disabledReason(kind, action);
  if ((action.method || '').toUpperCase() !== 'POST' || !action.endpoint?.startsWith('/')) return 'La acción no publicó un endpoint POST seguro.';
  if (action.delivery_mode !== 'crm_only' || action.external_dispatch !== false || action.delivery_contract_version !== 'inbox.action_delivery.v2') return 'La acción no publicó el contrato CRM-only auditable esperado.';
  const required = new Set(action.requires || []);
  if (!required.has('Idempotency-Key')) return 'La acción no exige una identidad idempotente.';
  if (kind === 'location' && (!required.has('lat') || !required.has('lng'))) return 'La acción no exige coordenadas WGS84 completas.';
  if (kind === 'attachment') {
    if (!required.has('attachment_id')) return 'La acción no exige un attachment_id verificable.';
    if (!getAttachmentOptions(attachments).length) return 'No hay adjuntos existentes con ID verificable en este ticket. Esta acción no carga archivos nuevos.';
  }
  if (kind === 'form') {
    if (!required.has('form_id')) return 'La acción no exige un form_id verificable.';
    if (!getFormOptions(action).length) return 'El backend no publicó formularios reales, aprobados y pertenecientes al tenant para este ticket.';
  }
  return null;
};

const parseCoordinate = (value: string) => value.trim() && Number.isFinite(Number(value)) ? Number(value) : null;
const supportsCaptureSource = (action: SaasAction | null) => {
  const raw = asRecord(action?.raw);
  const acceptedFields = Array.isArray(raw.accepted_fields) ? raw.accepted_fields : [];
  return new Set([...(action?.requires || []), ...acceptedFields]).has('capture_source');
};
const TicketShareActionDialog: React.FC<TicketShareActionDialogProps> = ({ action, kind, open, attachments = [], submitting = false, errorMessage, onOpenChange, onConfirm }) => {
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [label, setLabel] = useState('');
  const [address, setAddress] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [geoStatus, setGeoStatus] = useState<string | null>(null);
  const [captureSource, setCaptureSource] = useState<'manual' | 'operator_browser_geolocation'>('manual');
  const options = useMemo(() => kind === 'attachment' ? getAttachmentOptions(attachments) : getFormOptions(action), [action, attachments, kind]);
  useEffect(() => {
    if (!open) return;
    setLatitude(''); setLongitude(''); setLabel(''); setAddress(''); setSelectedId(''); setValidationError(null); setGeoStatus(null); setCaptureSource('manual');
  }, [action?.id, kind, open]);
  const useCurrentLocation = () => {
    if (!navigator.geolocation) { setGeoStatus('Este navegador no ofrece geolocalización. Podés ingresar las coordenadas manualmente.'); return; }
    setGeoStatus('Solicitando permiso de ubicación…');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => { setLatitude(coords.latitude.toFixed(6)); setLongitude(coords.longitude.toFixed(6)); setCaptureSource('operator_browser_geolocation'); setGeoStatus('GPS del dispositivo del operador cargado. Revisalo antes de guardar.'); },
      () => setGeoStatus('No se pudo obtener la ubicación. Podés ingresarla manualmente.'),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  };
  const handleConfirm = () => {
    setValidationError(null);
    if (kind !== 'location') {
      const id = positiveId(selectedId);
      if (!id || !options.some((option) => option.id === id)) { setValidationError(kind === 'form' ? 'Seleccioná un formulario aprobado.' : 'Seleccioná un adjunto existente del ticket.'); return; }
      onConfirm(kind === 'form' ? { form_id: id } : { attachment_id: id }); return;
    }
    const lat = parseCoordinate(latitude); const lng = parseCoordinate(longitude);
    if (lat === null || lng === null || lat < -90 || lat > 90 || lng < -180 || lng > 180) { setValidationError('Ingresá latitud y longitud WGS84 dentro de rangos válidos.'); return; }
    onConfirm({ lat, lng, ...(supportsCaptureSource(action) ? { capture_source: captureSource } : {}), ...(label.trim() ? { label: label.trim().slice(0, 100) } : {}), ...(address.trim() ? { address: address.trim().slice(0, 300) } : {}) });
  };
  const noun = kind === 'location' ? 'ubicación' : kind === 'form' ? 'formulario' : 'adjunto';
  return <Dialog open={open} onOpenChange={(next) => !submitting && onOpenChange(next)}><DialogContent className="max-w-lg">
    <DialogHeader><DialogTitle>{action?.label || `Guardar ${noun}`}</DialogTitle><DialogDescription>Se guardará en CRM, no se enviará externamente. Esta acción no confirma WhatsApp ni entrega al ciudadano.</DialogDescription></DialogHeader>
    {kind === 'location' ? <div className="space-y-4">
      <Button type="button" variant="outline" onClick={useCurrentLocation}>Usar mi ubicación</Button>
      <p className="text-xs text-muted-foreground" aria-live="polite">{geoStatus || 'La geolocalización sólo se solicita al presionar el botón.'}</p>
      <p className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-950">El GPS corresponde al dispositivo del operador. No modifica ni prueba la ubicación reportada del reclamo.</p>
      <div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1 text-sm">Latitud<Input aria-label="Latitud WGS84" inputMode="decimal" value={latitude} onChange={(e) => { setLatitude(e.target.value); setCaptureSource('manual'); }} /></label><label className="space-y-1 text-sm">Longitud<Input aria-label="Longitud WGS84" inputMode="decimal" value={longitude} onChange={(e) => { setLongitude(e.target.value); setCaptureSource('manual'); }} /></label></div>
      <label className="space-y-1 text-sm">Etiqueta opcional<Input value={label} maxLength={100} onChange={(e) => setLabel(e.target.value)} /></label>
      <label className="space-y-1 text-sm">Referencia opcional<Input value={address} maxLength={300} onChange={(e) => setAddress(e.target.value)} /></label>
    </div> : <label className="space-y-1.5 text-sm">{kind === 'form' ? 'Formulario aprobado' : 'Adjunto existente'}<select aria-label={kind === 'form' ? 'Formulario aprobado' : 'Adjunto existente'} className="h-10 w-full rounded-md border border-input bg-background px-3" value={selectedId} onChange={(e) => setSelectedId(e.target.value)}><option value="">Seleccionar</option>{options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>}
    {(validationError || errorMessage) ? <p role="alert" className="text-sm text-destructive">{validationError || errorMessage}</p> : null}
    <DialogFooter><Button type="button" variant="outline" disabled={submitting} onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="button" disabled={submitting} onClick={handleConfirm}>{submitting ? 'Guardando…' : 'Guardar en CRM'}</Button></DialogFooter>
  </DialogContent></Dialog>;
};
export default TicketShareActionDialog;

/** Exact row identities and observed owners, never display numbers or guessed nulls. */
export type AssignmentSourceModel = 'MunicipioTicket' | 'TenantTicket' | 'PymeTicket';
export interface TicketAssignmentTarget {
  source_model: AssignmentSourceModel;
  id: string | number;
  expected_assignee_id: string | number | null;
}

type RecordValue = Record<string, unknown>;
export const assignmentRecord = (value: unknown): RecordValue =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as RecordValue
    : {};

export const exactAssignmentId = (value: unknown): string | number => {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) return value;
  if (typeof value === 'string' && /^[1-9]\d*$/.test(value)) return value;
  throw new Error('No se pudo verificar la identidad del caso o su responsable. Actualizá la lista.');
};

export const assignmentTargetKey = (target: Pick<TicketAssignmentTarget, 'source_model' | 'id'>) =>
  `${target.source_model}:${target.id}`;

export const readAssignmentTarget = (value: unknown): TicketAssignmentTarget => {
  const row = assignmentRecord(value);
  if (!['MunicipioTicket', 'TenantTicket', 'PymeTicket'].includes(String(row.source_model))) {
    throw new Error('No se pudo verificar el tipo de caso. Actualizá la lista.');
  }
  const ids = ['id', 'ticket_id'].filter((key) => Object.hasOwn(row, key)).map((key) => exactAssignmentId(row[key]));
  if (!ids.length || new Set(ids.map(String)).size !== 1) {
    throw new Error('Los identificadores del caso no coinciden. Actualizá la lista.');
  }
  if (!Object.hasOwn(row, 'assignee_id')) {
    throw new Error('No se publicó el responsable actual. Actualizá la lista antes de asignar.');
  }
  return {
    source_model: row.source_model as AssignmentSourceModel,
    id: ids[0],
    expected_assignee_id: row.assignee_id === null ? null : exactAssignmentId(row.assignee_id),
  };
};

export const requireAssignmentTenant = (value: unknown, tenantSlug: string) => {
  const tenant = assignmentRecord(assignmentRecord(value).tenant);
  if (!tenantSlug || tenant.slug !== tenantSlug) {
    throw new Error('La lista no corresponde a la organización seleccionada. Volvé a cargarla.');
  }
};

export interface AssignmentPreview {
  tenantSlug: string;
  targets: Array<TicketAssignmentTarget & { expected_suggested_assignee_id: string | number }>;
  signature: string;
}

export const readAssignmentPreview = (
  value: unknown,
  tenantSlug: string,
  requested: TicketAssignmentTarget[],
): AssignmentPreview => {
  const response = assignmentRecord(value);
  requireAssignmentTenant(response, tenantSlug);
  if (response.contract_version !== 'employee.routing.auto_assign.v1' || response.dry_run !== true || !Array.isArray(response.items)) {
    throw new Error('No recibimos una vista previa verificable. Volvé a previsualizar.');
  }
  const requestedByKey = new Map(requested.map((target) => [assignmentTargetKey(target), target]));
  if (requestedByKey.size !== requested.length) throw new Error('La lista contiene casos repetidos. Volvé a cargarla.');
  const seen = new Set<string>();
  const targets: AssignmentPreview['targets'] = [];
  const signatures: string[] = [];
  for (const itemValue of response.items) {
    const item = assignmentRecord(itemValue);
    const target = readAssignmentTarget(item.ticket);
    const key = assignmentTargetKey(target);
    const original = requestedByKey.get(key);
    if (!original || seen.has(key) || String(original.expected_assignee_id) !== String(target.expected_assignee_id)) {
      throw new Error('La lista o sus responsables cambiaron. Volvé a previsualizar.');
    }
    seen.add(key);
    if (item.suggested_assignee === null) continue;
    const suggestedId = exactAssignmentId(assignmentRecord(item.suggested_assignee).id);
    targets.push({ ...target, expected_suggested_assignee_id: suggestedId });
    signatures.push(`${key}:${target.expected_assignee_id}:${suggestedId}`);
  }
  if (seen.size !== requestedByKey.size) throw new Error('La lista cambió desde que se cargó. Volvé a previsualizar.');
  if (!targets.length) throw new Error('No hay asignaciones compatibles verificadas para aplicar.');
  return { tenantSlug, targets, signature: signatures.sort().join('|') };
};

export const requireConfirmedAutoAssignments = (value: unknown, preview: AssignmentPreview) => {
  const result = assignmentRecord(value);
  requireAssignmentTenant(result, preview.tenantSlug);
  if (result.contract_version !== 'employee.routing.auto_assign.v1' || result.dry_run !== false || !Array.isArray(result.items)) {
    throw new Error('No recibimos confirmación verificable. Actualizá la lista antes de reintentar.');
  }
  const expected = new Set(preview.targets.map(assignmentTargetKey));
  const confirmed = new Set<string>();
  const signatures: string[] = [];
  for (const raw of result.items) {
    const item = assignmentRecord(raw);
    const target = readAssignmentTarget(item.ticket);
    const key = assignmentTargetKey(target);
    if (!expected.has(key) || confirmed.has(key) || item.applied !== true) {
      throw new Error('No se confirmaron todas las asignaciones. Actualizá la lista para revisar el resultado.');
    }
    const assigneeId = exactAssignmentId(assignmentRecord(item.assignment).assignee_id);
    signatures.push(`${key}:${target.expected_assignee_id}:${assigneeId}`);
    confirmed.add(key);
  }
  if (confirmed.size !== expected.size || result.applied_count !== confirmed.size || signatures.sort().join('|') !== preview.signature) {
    throw new Error('No se confirmaron todas las asignaciones. Actualizá la lista para revisar el resultado.');
  }
};

export const resolveLeadAssignmentTarget = (leadValue: unknown, routingValue: unknown, tenantSlug: string): TicketAssignmentTarget => {
  const lead = assignmentRecord(leadValue);
  const sourceModel = ({ municipio: 'MunicipioTicket', pyme: 'PymeTicket' } as const)[lead.ticket_type as 'municipio' | 'pyme'];
  if (!sourceModel || lead.source_model !== sourceModel) {
    throw new Error('La autoasignación no está disponible para este tipo de caso. Abrí el caso para gestionarlo.');
  }
  const id = exactAssignmentId(lead.ticket_id);
  if (Object.hasOwn(lead, 'source_id') && String(exactAssignmentId(lead.source_id)) !== String(id)) {
    throw new Error('Los identificadores del caso no coinciden. Actualizá la lista.');
  }
  if (lead.tenant_slug !== undefined && lead.tenant_slug !== tenantSlug) {
    throw new Error('El caso no corresponde a la organización seleccionada.');
  }
  const routing = assignmentRecord(routingValue);
  requireAssignmentTenant(routing, tenantSlug);
  if (routing.contract_version !== 'employee.routing.v1') throw new Error('Actualizá la lista para verificar el responsable actual.');
  const open = assignmentRecord(routing.queues).open;
  const rows = Array.isArray(open) ? open.filter((row) => {
    const record = assignmentRecord(row);
    return record.source_model === sourceModel && [record.id, record.ticket_id].some((rowId) => String(rowId) === String(id));
  }) : [];
  if (rows.length !== 1) throw new Error('No se publicó un responsable verificable para este caso. Actualizá la lista.');
  const target = readAssignmentTarget(rows[0]);
  if (String(target.id) !== String(id)) throw new Error('La identidad del caso no coincide. Actualizá la lista.');
  return target;
};

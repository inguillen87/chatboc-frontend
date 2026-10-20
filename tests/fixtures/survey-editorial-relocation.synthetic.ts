import type { RelocationAction, RelocationPreview, RelocationReceipt, RestorePreview, RestoreReceipt } from '@/api/surveyEditorialRelocation';
import type { SurveyListResponse } from '@/types/encuestas';

export const syntheticRelocationSource = { id: 31, slug: 'organization-a', nombre: 'Organización A' };
export const syntheticRelocationTarget = { id: 72, slug: 'organization-b', nombre: 'Organización B' };
export const syntheticRelocationKey = '12345678-1234-4567-89ab-123456789abc';
export const syntheticRelocationAction: RelocationAction = {
  contract_version: 'surveys.editorial_relocation_action.v1', can_preview: true,
  label: 'Reubicar contenido', description: 'Revisá los instrumentos y la organización de destino.', max_surveys: 5,
  ui: { selection_label: 'Instrumentos de origen', target_label: 'Organización de destino', preview_label: 'Revisar selección',
    cancel_label: 'Cerrar', loading_label: 'Consultando operación…', history_label: 'Consultar archivo de origen',
    check_status_label: 'Consultar estado', uncertain_message: 'Resultado sin comprobar. Consultá el estado; no reenvíes la operación.',
    conflict_message: 'La revisión cambió. Consultá una nueva revisión.', success_message: 'Archivo y borradores verificados.',
    directory_error: 'No se pudo consultar el directorio.', preview_error: 'No se pudo verificar la selección.',
    source_history_label: 'Respuestas conservadas en origen', destination_count_label: 'Respuestas en borrador',
    restore_title: 'Restaurar originales', restore_label: 'Restaurar originales', restore_confirm_label: 'Restaurar sin publicar', restore_notice: 'Conservamos las respuestas y los borradores de destino; no publicamos los originales.',
    restore_success_message: 'Restauración verificada sin publicar.' },
};
export const syntheticRelocationPreview = (): RelocationPreview => ({
  contract_version: 'surveys.editorial_relocation_preview.v1', can_apply: true,
  source_tenant: syntheticRelocationSource, target_tenant: syntheticRelocationTarget,
  items: [701, 702, 703, 704, 705].map((survey_id, index) => ({ survey_id, title: `Instrumento ${index + 1}`,
    state: index === 1 ? 'borrador' : index === 0 ? 'cerrada' : 'publicada',
    structure_revision: index + 1, editorial_sha256: String(index + 1).repeat(64), response_count_all_time: [101, 0, 200, 100, 100][index] })),
  ui: { confirm_label: 'Archivar originales y crear borradores', preservation_notice: 'Se conservan los originales y sus 501 respuestas históricas.',
    draft_notice: 'Las copias se crean como borradores, con cero respuestas.', published_warning: 'La publicación y participación en los originales quedarán cerradas.',
    response_count_label: 'Respuestas de todo el historial' },
});
export const syntheticRelocationReceipt = (preview = syntheticRelocationPreview(), key = syntheticRelocationKey): RelocationReceipt => ({
  contract_version: 'surveys.editorial_relocation_receipt.v1', state: 'originals_archived_destination_drafts_created',
  operation_id: 'synthetic-operation-1', idempotency_key: key, source_tenant: preview.source_tenant, target_tenant: preview.target_tenant,
  copied_responses: false, items: preview.items.map(item => ({ source_survey_id: item.survey_id, destination_survey_id: item.survey_id + 100,
    original_previous_state: item.state, source_state: 'archivada', destination_state: 'borrador',
    source_response_count_all_time: item.response_count_all_time, destination_response_count_all_time: 0, source_editorial_sha256: item.editorial_sha256 })),
});
export const syntheticRelocationList = (): SurveyListResponse => ({
  contract_version: 'surveys.admin_list.v2', tenant: syntheticRelocationSource, editorial_relocation: syntheticRelocationAction,
  data: syntheticRelocationPreview().items.map(item => ({ id: item.survey_id, slug: `instrument-${item.survey_id}`,
    titulo: item.title, tipo: 'opinion', estado: item.state, preguntas: [], tenant_id: syntheticRelocationSource.id,
    // These filtered display metrics intentionally disagree with all-time counts.
    metricas: { total_respuestas: 0, respuestas_ultimas_24h: 0, respuestas_con_coordenadas: 0, participantes_unicos: 0, ultima_respuesta_at: null } })),
});
export const syntheticRestoreKey = '87654321-4321-4567-89ab-123456789abc';
export const syntheticArchive = { archive_idempotency_key: syntheticRelocationKey, archive_operation_id: 'synthetic-operation-1', source_editorial_sha256: '1'.repeat(64) };
export const syntheticRestorePreview = (): RestorePreview => ({
  contract_version: 'surveys.editorial_restore_preview.v1', source_tenant: syntheticRelocationSource,
  archive_idempotency_key: syntheticArchive.archive_idempotency_key, archive_operation_id: syntheticArchive.archive_operation_id,
  can_apply: true, published: false, preserved_responses: true, ui: { ...syntheticRelocationAction.ui, response_count_label: 'Respuestas de todo el historial' },
  items: syntheticRelocationPreview().items.map(item => ({ ...item, state: 'archivada', can_restore: true, restore_state: item.state === 'borrador' && item.response_count_all_time === 0 ? 'borrador' : 'cerrada' })),
});
export const syntheticRestoreReceipt = (preview = syntheticRestorePreview(), key = syntheticRestoreKey): RestoreReceipt => ({
  contract_version: 'surveys.editorial_restore_receipt.v1', state: 'originals_restored_without_publishing', operation_id: 'synthetic-restore-operation',
  archive_idempotency_key: preview.archive_idempotency_key, archive_operation_id: preview.archive_operation_id, idempotency_key: key,
  source_tenant: preview.source_tenant, preserved_responses: true, published: false, destination_drafts_unchanged: true,
  items: preview.items.map(item => ({ source_survey_id: item.survey_id, source_state: item.restore_state, source_response_count_all_time: item.response_count_all_time, source_editorial_sha256: item.editorial_sha256 })),
});
export const syntheticArchiveList = (): SurveyListResponse => ({ ...syntheticRelocationList(), include_archived: true,
  data: syntheticRelocationList().data.map(item => ({ ...item, estado: 'archivada' })),
  archived_editorial_relocations: Object.fromEntries(syntheticRelocationPreview().items.map(item => [item.survey_id, { ...syntheticArchive, source_editorial_sha256: item.editorial_sha256 }])),
});

export type EnterpriseErrorContext =
  | 'load_bot_settings'
  | 'save_bot_settings'
  | 'load_recommendations'
  | 'upload_order_draft'
  | 'executive_summary';

const DEFAULT_MESSAGES: Record<EnterpriseErrorContext, string> = {
  load_bot_settings: 'No se pudo cargar la configuración.',
  save_bot_settings: 'No se pudo guardar la configuración.',
  load_recommendations: 'No se pudieron cargar recomendaciones.',
  upload_order_draft: 'No se pudo procesar el documento.',
  executive_summary: 'No se pudo generar el resumen ejecutivo.',
};

export const getEnterpriseErrorMessage = (status: number | undefined, context: EnterpriseErrorContext) => {
  if (status === 403) return 'No tenés permisos para esta acción.';
  if (status === 404) return 'No encontramos información para este tenant o recurso.';

  if (status === 400) {
    if (context === 'upload_order_draft') return 'Archivo inválido. Verificá tamaño/formato e intentá nuevamente.';
    if (context === 'load_recommendations') return 'La solicitud de recomendaciones es inválida.';
    if (context === 'load_bot_settings' || context === 'save_bot_settings') {
      return 'La configuración enviada es inválida.';
    }
    return 'La solicitud es inválida.';
  }

  return DEFAULT_MESSAGES[context];
};

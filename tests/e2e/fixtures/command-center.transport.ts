// Preview-only service boundary. No network calls, credentials or production records.
const missingEvidence = new URLSearchParams(location.search).has('unknown');
const tenant_slug = 'qa-command-center';

export const backofficeService = {
  getInboxSummary: async () => ({
    contract_version: 'backoffice.inbox_summary.v1', tenant_slug,
    summary: {
      open: 55, unassigned: 55,
      ...(missingEvidence ? {} : {
        sla_risk: 0, sla_breached: 0, sla_at_risk: 0,
        sla_known: 0, sla_unknown: 55, sla_eligible: 55,
      }),
    },
    recommended_views: [
      { id: 'review', label: 'Revisar la bandeja de atención', description: 'Recomendación sintética enviada por el servicio de prueba.' },
    ],
  }),
  getOrdersSummary: async () => ({
    contract_version: 'backoffice.orders_summary.v1', tenant_slug,
    summary: { active: 0, unassigned: null }, active_orders: [],
  }),
  getContactsSummary: async () => ({
    contract_version: 'backoffice.contacts_summary.v1', tenant_slug, summary: { total: 186 },
  }),
  getTeamCoverageSummary: async () => ({
    contract_version: 'backoffice.team_coverage_summary.v1', tenant_slug, summary: { active_employees: 6 },
  }),
  requestExecutiveSummary: async () => ({
    headline: 'Resumen solicitado en la prueba sintética',
    data_quality_notes: ['Los valores de esta vista no provienen de una organización real.'],
  }),
  // The real download helper is covered separately. This preview exercises the error UI
  // instead of producing a file that could be mistaken for a real operational report.
  requestExport: async () => { throw new Error('La vista sintética no genera reportes.'); },
};

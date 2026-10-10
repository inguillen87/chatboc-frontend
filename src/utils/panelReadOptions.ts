/** Private reads use the panel session and an explicit scope, independent of the public widget. */
export const panelReadOptions = (tenantSlug?: string | null) => ({
  ...(tenantSlug ? { tenantSlug, omitTenant: false } : { omitTenant: true }),
  persistTenantSlug: false,
  isWidgetRequest: false,
  omitEntityToken: true,
  omitChatSessionId: true,
  omitCredentials: false,
  singleAttempt: true,
  allowStartupRecovery: true,
} as const);

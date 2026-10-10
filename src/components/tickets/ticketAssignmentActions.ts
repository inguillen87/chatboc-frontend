import type { SaasAction } from '@/api/v2/saas';

type AssignmentActionId = 'assign' | 'claim';
export type TicketAssignmentActions = Record<AssignmentActionId, SaasAction | null>;

export const isTicketAssignmentAction = (action: SaasAction): boolean =>
  action?.id === 'assign' || action?.id === 'claim';

// Normalization may synthesize label=id. Ownership controls require published copy.
const publishedLabel = (action: SaasAction): string | null => {
  if (action.raw !== undefined && action.raw !== null) {
    if (typeof action.raw !== 'object' || Array.isArray(action.raw)) return null;
    const raw = action.raw as Record<string, unknown>;
    for (const key of ['label', 'title', 'name', 'action', 'text']) {
      const value = raw[key];
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
    return null;
  }
  return typeof action.label === 'string' && action.label.trim() ? action.label.trim() : null;
};

/** Missing, disabled, ambiguous or unlabelled contracts never grant an action. */
export function ticketAssignmentActions(actions?: readonly SaasAction[]): TicketAssignmentActions {
  const result: TicketAssignmentActions = { assign: null, claim: null };
  if (!Array.isArray(actions)) return result;
  for (const id of ['assign', 'claim'] as const) {
    const matches = actions.filter(action => action?.id === id);
    if (matches.length !== 1) continue;
    const action = matches[0];
    if (action.disabled === true || action.enabled === false) continue;
    const label = publishedLabel(action);
    if (label) result[id] = { ...action, label };
  }
  return result;
}

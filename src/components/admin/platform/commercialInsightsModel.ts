import { COMMERCIAL_STAGES, filterCommercialLeads, isCommercialStage, type CommercialLead } from './commercialFollowUp';
export type CommercialAttention = 'all' | 'quiet' | 'unknown';
export type CommercialSort = 'recent' | 'oldest' | 'name';
export type CommercialActivity = 'recent' | 'quiet' | 'unknown';
const DAY = 86400000;
export const isOpenCommercialLead = (lead: CommercialLead) => isCommercialStage(lead.stage) && !['ganado', 'perdido'].includes(lead.stage);
/** A naive, malformed or future timestamp cannot establish elapsed time. */
export function commercialActivityTimestamp(value: string | null, now: number): number | null {
  if (!value || !Number.isFinite(now)) return null;
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,9})?)?(Z|[+-]\d{2}:?\d{2})$/i.exec(value);
  if (!match || Number(match[2]) > 23 || Number(match[3]) > 59 || Number(match[4] || 0) > 59) return null;
  const date = Date.parse(`${match[1]}T00:00:00Z`);
  const timestamp = Date.parse(value);
  if (!Number.isFinite(date) || new Date(date).toISOString().slice(0, 10) !== match[1] ||
      !Number.isFinite(timestamp) || timestamp > now) return null;
  return timestamp;
}
export function commercialActivity(lead: CommercialLead, now: number): CommercialActivity {
  const timestamp = commercialActivityTimestamp(lead.lastSeen, now);
  return timestamp === null ? 'unknown' : now - timestamp >= 7 * DAY ? 'quiet' : 'recent';
}
export function buildCommercialInsights(items: CommercialLead[], now: number) {
  const stages: Record<string, number> = Object.fromEntries(COMMERCIAL_STAGES.map((stage) => [stage, 0]));
  stages.unknown = 0;
  const activity: Record<CommercialActivity, number> = { recent: 0, quiet: 0, unknown: 0 };
  for (const item of items) {
    stages[isCommercialStage(item.stage) ? item.stage : 'unknown'] += 1;
    if (isOpenCommercialLead(item)) activity[commercialActivity(item, now)] += 1;
  }
  return { total: items.length, stages, activity,
    open: activity.recent + activity.quiet + activity.unknown, won: stages.ganado, lost: stages.perdido };
}
export function queryCommercialLeads(items: CommercialLead[], query: string, stage: string,
  attention: CommercialAttention, sort: CommercialSort, now: number): CommercialLead[] {
  const filtered = filterCommercialLeads(items, query, stage === 'unknown' ? 'all' : stage)
    .filter((lead) => (stage !== 'unknown' || !isCommercialStage(lead.stage)) &&
      (attention === 'all' || (isOpenCommercialLead(lead) && commercialActivity(lead, now) === attention)));
  return filtered.sort((a, b) => {
    if (sort === 'name') return a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }) || a.key.localeCompare(b.key);
    const first = commercialActivityTimestamp(a.lastSeen, now), second = commercialActivityTimestamp(b.lastSeen, now);
    if (first === null && second !== null) return 1;
    if (second === null && first !== null) return -1;
    return first !== null && second !== null && first !== second ? (sort === 'recent' ? second - first : first - second) : a.key.localeCompare(b.key);
  });
}

import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

export function loadGuide(path = new URL('./guide.json', import.meta.url), expected) {
  const bytes = readFileSync(path);
  if (expected && createHash('sha256').update(bytes).digest('hex') !== expected) throw new Error('guide_digest_mismatch');
  const guide = JSON.parse(bytes);
  if (guide.contract_version !== 'accessible.support.guide.v1' || guide.evaluation_only !== true
      || Object.values(guide.policy).some((value) => value !== false)) throw new Error('guide_invalid');
  for (const [key, node] of Object.entries(guide.nodes)) {
    if (key !== node.id || !node.source_pages.length || node.source_pages.some((p) => !Number.isInteger(p) || p < 1 || p > 14)
      || new Set(node.actions.map((a) => a.code)).size !== node.actions.length
      || node.actions.some((a) => !Object.hasOwn(guide.nodes, a.target))) throw new Error('guide_navigation_invalid');
  }
  return guide;
}
export function responseFor(guide, nodeId = 'start', selection = null) {
  if (!Object.hasOwn(guide.nodes, nodeId)) return null;
  let target = nodeId;
  if (selection !== null) {
    if (typeof selection !== 'string' || selection.length > 16) return null;
    const code = selection.trim().toLowerCase();
    if (['hola', 'inicio'].includes(code)) target = 'start';
    else if (['menu', 'menú'].includes(code)) target = 'main';
    else { const action = guide.nodes[nodeId].actions.find((a) => a.code === code); if (!action) return null; target = action.target; }
  }
  return { ...guide.nodes[target], contract_version: guide.contract_version, evaluation_only: true };
}

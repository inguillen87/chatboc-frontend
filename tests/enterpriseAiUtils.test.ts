import { describe, expect, it } from 'vitest';
import { countMatchStatuses, isMatchedStatus, resolveDraftCounts, validateOrderDraftFile } from '@/utils/enterpriseAi';

describe('enterpriseAi utils', () => {
  it('detects matched vs unmatched statuses correctly', () => {
    expect(isMatchedStatus('matched')).toBe(true);
    expect(isMatchedStatus('MATCH')).toBe(true);
    expect(isMatchedStatus('unmatched')).toBe(false);
    expect(isMatchedStatus('not_matched')).toBe(false);
  });

  it('counts matched/unmatched without false positives', () => {
    const counts = countMatchStatuses([
      { match_status: 'matched' },
      { match_status: 'unmatched' },
      { match_status: 'MATCH' },
      { match_status: 'unknown' },
    ]);
    expect(counts.matched).toBe(2);
    expect(counts.unmatched).toBe(2);
  });

  it('resolves counts from fallback when there are no editable items', () => {
    const counts = resolveDraftCounts([], 5, 7);
    expect(counts.matched).toBe(5);
    expect(counts.unmatched).toBe(7);
  });

  it('validates order draft file extension and size', () => {
    const validFile = new File([new Uint8Array(10)], 'pedido.pdf', { type: 'application/pdf' });
    const invalidExt = new File([new Uint8Array(10)], 'pedido.exe', { type: 'application/octet-stream' });
    const largeFile = new File([new Uint8Array(6 * 1024 * 1024)], 'pedido.pdf', { type: 'application/pdf' });

    expect(validateOrderDraftFile(validFile).valid).toBe(true);
    expect(validateOrderDraftFile(invalidExt).valid).toBe(false);
    expect(validateOrderDraftFile(largeFile).valid).toBe(false);
  });
});

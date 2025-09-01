import { toLocalISOString } from '@/utils/fecha';

describe('toLocalISOString', () => {
  it('returns ISO string preserving local time', () => {
    const date = new Date(2024, 0, 1, 12, 30, 0); // Jan 1 2024 12:30 local
    const iso = toLocalISOString(date);
    expect(iso).toBe('2024-01-01T12:30:00');
    expect(iso.endsWith('Z')).toBe(false);
  });
});

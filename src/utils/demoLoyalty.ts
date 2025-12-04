import getOrCreateAnonId from '@/utils/anonId';
import { safeLocalStorage } from '@/utils/safeLocalStorage';

export interface DemoLoyaltySummary {
  points: number;
  surveysCompleted: number;
  suggestionsShared: number;
  claimsFiled: number;
  lastUpdated: number;
}

const STORAGE_KEY = 'chatboc_demo_loyalty_summary';

const hashString = (input: string): number => {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash);
};

const pseudoRandomInRange = (seed: string, min: number, max: number): number => {
  const spread = max - min;
  const hashed = hashString(seed);
  return min + (hashed % (spread + 1));
};

const persistSummary = (summary: DemoLoyaltySummary): void => {
  try {
    safeLocalStorage.setItem(STORAGE_KEY, JSON.stringify(summary));
  } catch {
    // Ignore storage errors
  }
};

export const getDemoLoyaltySummary = (): DemoLoyaltySummary => {
  try {
    const raw = safeLocalStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DemoLoyaltySummary;
      if (typeof parsed?.points === 'number' && parsed.points > 0) {
        return parsed;
      }
    }
  } catch {
    // Ignore parse errors and rebuild
  }

  const anonId = getOrCreateAnonId();
  const points = pseudoRandomInRange(`${anonId}-puntos`, 4200, 11800);
  const surveysCompleted = pseudoRandomInRange(`${anonId}-surveys`, 6, 18);
  const suggestionsShared = pseudoRandomInRange(`${anonId}-ideas`, 2, 9);
  const claimsFiled = pseudoRandomInRange(`${anonId}-claims`, 1, 5);

  const summary: DemoLoyaltySummary = {
    points,
    surveysCompleted,
    suggestionsShared,
    claimsFiled,
    lastUpdated: Date.now(),
  };

  persistSummary(summary);
  return summary;
};

// Ensure the demo helper remains available in environments that reference it globally
try {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).getDemoLoyaltySummary = getDemoLoyaltySummary;
} catch {
  // noop for SSR or non-browser environments
}

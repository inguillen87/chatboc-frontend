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

const persistSummary = (summary: DemoLoyaltySummary): void => {
  try {
    safeLocalStorage.setItem(STORAGE_KEY, JSON.stringify(summary));
  } catch {
    // Ignore storage errors
  }
};

export const getDemoLoyaltySummary = (): DemoLoyaltySummary => {
  // Return fixed values for the specific "Rich Demo" requested by the user.
  // "Saldo disponible 11.697 pts"
  // "Encuestas y sondeos respondidos 7"
  // "Ideas y reclamos registrados 12"

  const summary: DemoLoyaltySummary = {
    points: 11697,
    surveysCompleted: 7,
    suggestionsShared: 8, // Split 12 into suggestions and claims arbitrarily or keep as sum
    claimsFiled: 4,       // 8 + 4 = 12 total interactions
    lastUpdated: Date.now(),
  };

  persistSummary(summary);
  return summary;
};

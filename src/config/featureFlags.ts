export const FEATURE_ENCUESTAS = import.meta.env.VITE_FEATURE_ENCUESTAS === 'true';

export type FeatureFlag = 'encuestas';

export const isFeatureEnabled = (flag: FeatureFlag): boolean => {
  switch (flag) {
    case 'encuestas':
      return FEATURE_ENCUESTAS;
    default:
      return false;
  }
};

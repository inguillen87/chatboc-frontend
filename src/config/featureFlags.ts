const rawEncuestasFlag = import.meta.env.VITE_FEATURE_ENCUESTAS;

export const FEATURE_ENCUESTAS =
  rawEncuestasFlag === undefined || rawEncuestasFlag === ''
    ? true
    : rawEncuestasFlag === 'true' || rawEncuestasFlag === '1';

export type FeatureFlag = 'encuestas';

export const isFeatureEnabled = (flag: FeatureFlag): boolean => {
  switch (flag) {
    case 'encuestas':
      return FEATURE_ENCUESTAS;
    default:
      return false;
  }
};

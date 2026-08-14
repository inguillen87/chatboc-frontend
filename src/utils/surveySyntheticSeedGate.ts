/**
 * Synthetic response generation is a local-development QA tool.
 * Production and preview builds must not expose a destructive seed control.
 */
export const isSurveySyntheticSeedQaEnabled = (
  mode: string = import.meta.env.MODE,
): boolean => mode === 'development';

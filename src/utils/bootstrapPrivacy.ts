import { purgeLegacyPublicSurveyPersistence } from './publicSurveyPrivacy';

/** Runs one-way browser privacy migrations before the main React tree mounts. */
export const runBootstrapPrivacyMigrations = () =>
  purgeLegacyPublicSurveyPersistence();

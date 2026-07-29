import { Navigate } from 'react-router-dom';

import { FEATURE_ENCUESTAS } from '@/config/featureFlags';

export default function SatisfactionSurveys() {
  return <Navigate to={FEATURE_ENCUESTAS ? '/admin/encuestas' : '/surveys'} replace />;
}

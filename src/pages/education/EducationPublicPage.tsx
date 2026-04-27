import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import EducationShell from '@/components/education/EducationShell';
import { EDUCATION_FEATURE_FLAGS } from '@/config/featureFlags';

export default function EducationPublicPage() {
  return (
    <EducationShell persona="public">
      <Card>
        <CardHeader>
          <CardTitle>Modo institucional público</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Este acceso muestra información institucional y deriva a verificación cuando el backend reporta una consulta sensible.
          </p>
          <p>
            Feature flag <strong>education_enabled</strong>: {String(EDUCATION_FEATURE_FLAGS.education_enabled)}.
          </p>
        </CardContent>
      </Card>
    </EducationShell>
  );
}

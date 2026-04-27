import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import EducationShell from '@/components/education/EducationShell';
import { EDUCATION_FEATURE_FLAGS } from '@/config/featureFlags';
import { useEducationShellData } from '@/hooks/useEducationShellData';

export default function EducationPublicPage() {
  const { data } = useEducationShellData('public');

  return (
    <EducationShell persona="public">
      <div className="space-y-4">
        {data?.subtitle ? (
          <Alert>
            <AlertTitle>Comunicado institucional</AlertTitle>
            <AlertDescription>{data.subtitle}</AlertDescription>
          </Alert>
        ) : null}
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
      </div>
    </EducationShell>
  );
}

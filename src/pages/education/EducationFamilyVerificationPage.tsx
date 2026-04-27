import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import EducationShell from '@/components/education/EducationShell';
import { useEducationShellData } from '@/hooks/useEducationShellData';

export default function EducationFamilyVerificationPage() {
  const { data } = useEducationShellData('family');
  const verificationState = data?.family_context?.verification_state ?? 'anonymous';
  const backendQuickActions = data?.quick_actions ?? [];

  return (
    <EducationShell persona="family">
      <Card>
        <CardHeader>
          <CardTitle>Validación de vínculo familiar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>Estado actual: <strong>{verificationState}</strong>.</p>
          {backendQuickActions.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {backendQuickActions.map((action) => (
                <Button asChild size="sm" variant="outline" key={action.id}>
                  <Link to={action.path}>{action.label}</Link>
                </Button>
              ))}
            </div>
          ) : (
            <p>El backend todavía no publicó pasos de validación para este perfil.</p>
          )}
        </CardContent>
      </Card>
    </EducationShell>
  );
}

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import EducationShell from '@/components/education/EducationShell';

export default function EducationBillingPage() {
  return (
    <EducationShell persona="staff">
      <Card>
        <CardHeader>
          <CardTitle>Cobranzas (staff)</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Placeholder para gestión de cobranzas privadas con datos desde <code>/api/v1/education/billing/*</code>.
        </CardContent>
      </Card>
    </EducationShell>
  );
}

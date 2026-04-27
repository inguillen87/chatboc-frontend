import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import EducationShell from '@/components/education/EducationShell';

export default function EducationAdmissionsPage() {
  return (
    <EducationShell persona="staff">
      <Card>
        <CardHeader>
          <CardTitle>Admisiones (staff)</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Placeholder para funnel de admisiones sobre endpoints <code>/api/v1/education/admissions/*</code>.
        </CardContent>
      </Card>
    </EducationShell>
  );
}

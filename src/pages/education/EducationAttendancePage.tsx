import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import EducationShell from '@/components/education/EducationShell';

export default function EducationAttendancePage() {
  return (
    <EducationShell persona="family">
      <Card>
        <CardHeader>
          <CardTitle>Asistencia e inasistencias</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Pantalla base para historial y justificación de inasistencias, preparada para datos desde <code>/api/v1/education/attendance/*</code>.
        </CardContent>
      </Card>
    </EducationShell>
  );
}

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import EducationShell from '@/components/education/EducationShell';
import EducationFamilyAccessGate from '@/components/education/EducationFamilyAccessGate';

export default function EducationAttendancePage() {
  return (
    <EducationShell persona="family">
      <EducationFamilyAccessGate>
      <Card>
        <CardHeader>
          <CardTitle>Asistencia e inasistencias</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Pantalla base para historial y justificación de inasistencias, preparada para datos desde <code>/api/v1/education/attendance/*</code>.
        </CardContent>
      </Card>
      </EducationFamilyAccessGate>
    </EducationShell>
  );
}

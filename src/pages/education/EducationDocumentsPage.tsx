import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import EducationShell from '@/components/education/EducationShell';
import EducationFamilyAccessGate from '@/components/education/EducationFamilyAccessGate';

export default function EducationDocumentsPage() {
  return (
    <EducationShell persona="family">
      <EducationFamilyAccessGate>
      <Card>
        <CardHeader>
          <CardTitle>Solicitudes de documentos</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Pantalla base para solicitudes y estado documental preparada para consumir <code>/api/v1/education/documents/*</code>.
        </CardContent>
      </Card>
      </EducationFamilyAccessGate>
    </EducationShell>
  );
}

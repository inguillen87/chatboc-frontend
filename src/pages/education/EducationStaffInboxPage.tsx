import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TicketInboxPage } from '@/components/tickets/inbox';
import EducationShell from '@/components/education/EducationShell';

export default function EducationStaffInboxPage() {
  return (
    <EducationShell persona="staff">
      <div className="grid gap-4 xl:grid-cols-[320px,1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Contexto alumno/familia</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>Placeholder para ficha contextual sensible según permisos del staff.</p>
            <p>Preparado para consumir <code>/api/v1/education/cases/*</code> y <code>/api/v1/education/family-context/*</code>.</p>
          </CardContent>
        </Card>
        <div className="min-w-0">
          <TicketInboxPage />
        </div>
      </div>
    </EducationShell>
  );
}

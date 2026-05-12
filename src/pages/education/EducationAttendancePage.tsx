import React from 'react';

import EducationContractPendingCard from '@/components/education/EducationContractPendingCard';
import EducationShell from '@/components/education/EducationShell';
import EducationFamilyAccessGate from '@/components/education/EducationFamilyAccessGate';

export default function EducationAttendancePage() {
  return (
    <EducationShell persona="family">
      <EducationFamilyAccessGate>
        <EducationContractPendingCard
          title="Asistencia e inasistencias"
          description="Historial familiar preparado para asistencia, justificativos y estados de la institucion."
          endpoints={['GET /api/v1/education/attendance/*', 'POST /api/v1/education/attendance/*']}
          blockers={['Historial por alumno vinculado.', 'Estados de justificativo y adjuntos permitidos.']}
        />
      </EducationFamilyAccessGate>
    </EducationShell>
  );
}

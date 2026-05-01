import React from 'react';
import EducationContractPendingCard from '@/components/education/EducationContractPendingCard';
import EducationShell from '@/components/education/EducationShell';

export default function EducationAdmissionsPage() {
  return (
    <EducationShell persona="staff">
      <EducationContractPendingCard
        title="Admisiones"
        description="Funnel de admisiones preparado para datos, estados y acciones entregados por backend."
        endpoints={['GET /api/v1/education/admissions/*', 'POST /api/v1/education/admissions/*']}
        blockers={['Pipeline, etapas y acciones por rol.', 'Permisos staff para contacto y seguimiento.']}
      />
    </EducationShell>
  );
}

import React from 'react';
import EducationContractPendingCard from '@/components/education/EducationContractPendingCard';
import EducationShell from '@/components/education/EducationShell';

export default function EducationAdmissionsPage() {
  return (
    <EducationShell persona="staff">
      <EducationContractPendingCard
        title="Admisiones"
        description="La experiencia de admisiones permanece cerrada hasta conectar el core de entrevistas con una bandeja y un flujo institucional verificables."
        endpoints={[
          'GET /api/v2/interviews/cases/:id',
          'POST /api/v2/interviews/programs',
          'POST /api/v2/interviews/cases',
        ]}
        blockers={[
          'Contrato backend compatible, feature flag y capabilities por tenant.',
          'Adaptadores de WhatsApp, widget y voz sin casos duplicados.',
          'Bandeja real con consentimiento, evidencia y revisión humana.',
        ]}
      />
    </EducationShell>
  );
}

import React from 'react';

import EducationContractPendingCard from '@/components/education/EducationContractPendingCard';
import EducationShell from '@/components/education/EducationShell';
import EducationFamilyAccessGate from '@/components/education/EducationFamilyAccessGate';

export default function EducationDocumentsPage() {
  return (
    <EducationShell persona="family">
      <EducationFamilyAccessGate>
        <EducationContractPendingCard
          title="Solicitudes de documentos"
          description="Solicitudes documentales preparadas para estados, requisitos y acciones de la institucion."
          endpoints={['GET /api/v1/education/documents/*', 'POST /api/v1/education/documents/*']}
          blockers={['Catalogo de documentos disponibles.', 'Estados por solicitud y permisos de descarga/carga.']}
        />
      </EducationFamilyAccessGate>
    </EducationShell>
  );
}

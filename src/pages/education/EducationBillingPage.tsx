import React from 'react';

import EducationContractPendingCard from '@/components/education/EducationContractPendingCard';
import EducationShell from '@/components/education/EducationShell';

export default function EducationBillingPage() {
  return (
    <EducationShell persona="staff">
      <EducationContractPendingCard
        title="Cobranzas"
        description="Gestion de cobranzas privada preparada para hidratar resumen, deuda, vencimientos y acciones permitidas."
        endpoints={['GET /api/v1/education/billing/*', 'POST /api/v1/education/billing/*']}
        blockers={['Resumen financiero por familia/alumno.', 'Acciones permitidas segun permisos y estado de deuda.']}
      />
    </EducationShell>
  );
}

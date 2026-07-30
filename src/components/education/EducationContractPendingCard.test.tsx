import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import EducationContractPendingCard from './EducationContractPendingCard';

describe('EducationContractPendingCard', () => {
  it('describes an unfinished integration without claiming that it is ready', () => {
    render(
      <EducationContractPendingCard
        title="Admisiones"
        description="Superficie protegida"
        endpoints={['GET /api/v2/interviews/cases/:id']}
        blockers={['Permisos y contrato backend']}
      />,
    );

    expect(screen.getByText('Integración pendiente')).toBeInTheDocument();
    expect(screen.getByText('Funcionalidad no habilitada')).toBeInTheDocument();
    expect(screen.getByText(/No mostramos datos simulados/i)).toBeInTheDocument();
    expect(screen.queryByText('Pantalla lista')).not.toBeInTheDocument();
  });
});

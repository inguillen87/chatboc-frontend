import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import TrialUsageIndicator from './TrialUsageIndicator';

describe('TrialUsageIndicator', () => {
  it('renders the remaining consultations as a polite live region', () => {
    render(
      <TrialUsageIndicator
        usage={{ channel: 'chat', limit: 5, used: 1, remaining: 4 }}
      />,
    );

    const indicator = screen.getByText('Te quedan 4 de 5 consultas de prueba');
    expect(indicator).toHaveAttribute('aria-live', 'polite');
    expect(indicator).toHaveAttribute('aria-atomic', 'true');
    expect(indicator).not.toHaveClass('text-amber-800');
  });

  it('uses the attention treatment only for the last consultation', () => {
    const { rerender } = render(
      <TrialUsageIndicator
        usage={{ channel: 'chat', limit: 5, used: 4, remaining: 1 }}
      />,
    );

    expect(screen.getByText('Te queda 1 consulta de prueba')).toHaveClass('text-amber-800');

    rerender(
      <TrialUsageIndicator
        usage={{ channel: 'chat', limit: 5, used: 5, remaining: 0 }}
      />,
    );
    expect(screen.getByText('Usaste tus 5 consultas de prueba')).not.toHaveClass(
      'text-amber-800',
    );
  });

  it('renders nothing when the backend publishes no trial contract', () => {
    const { container } = render(<TrialUsageIndicator usage={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});

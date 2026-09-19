import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import SetupPreparationGuide from './SetupPreparationGuide';

afterEach(cleanup);
describe('guided setup', () => {
  it.each(['choose', 'review', 'prepared'] as const)('exposes one current step for %s', (state) => {
    const { container } = render(<SetupPreparationGuide state={state} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(container.querySelectorAll('[aria-current="step"]')).toHaveLength(1);
    expect(screen.getByText(/no publica el servicio ni conecta WhatsApp/)).toBeVisible();
  });
  it('does not expose actions or a completion percentage', () => {
    const { container } = render(<SetupPreparationGuide state="prepared" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(container.querySelector('a, input')).toBeNull();
  });
});

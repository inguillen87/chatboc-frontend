import { useContext } from 'react';
import { render, screen } from '@testing-library/react';
import { MotionConfigContext } from 'framer-motion';
import { describe, expect, it } from 'vitest';

import { AccessibleMotionProvider } from './AccessibleMotionProvider';

const Probe = () => {
  const { reducedMotion } = useContext(MotionConfigContext);
  return <span data-testid="policy">{String(reducedMotion)}</span>;
};

describe('AccessibleMotionProvider', () => {
  it('defaults to never honouring the system setting without the provider', () => {
    render(<Probe />);
    expect(screen.getByTestId('policy').textContent).toBe('never');
  });

  it('makes descendants follow the system reduce-motion setting', () => {
    render(
      <AccessibleMotionProvider>
        <Probe />
      </AccessibleMotionProvider>,
    );
    expect(screen.getByTestId('policy').textContent).toBe('user');
  });
});

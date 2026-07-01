import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import UserTypingIndicator from './UserTypingIndicator';

describe('UserTypingIndicator', () => {
  it('uses the safe identity fallback instead of a fake profile illustration', () => {
    const { container } = render(<UserTypingIndicator />);

    expect(screen.getByText('US')).toBeInTheDocument();
    expect(container.querySelector('img')).not.toBeInTheDocument();
    expect(container.querySelector('svg')).not.toBeInTheDocument();
    expect(container.querySelector('[title="Usuario - Avatar generativo por identidad"]')).toBeInTheDocument();
  });
});

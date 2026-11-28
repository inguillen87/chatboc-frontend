import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('framer-motion', async () => {
  const actual = await vi.importActual<typeof import('framer-motion')>('framer-motion');
  return { ...actual, useReducedMotion: () => true };
});

import ParticipationStorySection from './ParticipationStorySection';
import { PARTICIPATION_STEPS } from './participationStorySteps';

describe('ParticipationStorySection', () => {
  it('with reduced motion shows every step as plain text and never loads the animation', () => {
    render(<ParticipationStorySection />);
    expect(screen.getByRole('heading', { name: /Participar suma/ })).toBeTruthy();
    for (const step of PARTICIPATION_STEPS) expect(screen.getByText(step.title)).toBeTruthy();
    expect(screen.getAllByRole('listitem')).toHaveLength(PARTICIPATION_STEPS.length);
  });
});

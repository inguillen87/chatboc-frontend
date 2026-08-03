import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import InterviewResumeCard from './InterviewResumeCard';
import { interviewResumeFixture } from './interviewsTestFixture';

describe('InterviewResumeCard', () => {
  it('renders the exact backend checkpoint while keeping private evidence refs hidden', () => {
    render(<InterviewResumeCard resume={interviewResumeFixture.resume} />);

    expect(screen.getByTestId('interview-resume-card')).toBeInTheDocument();
    expect(
      screen.getAllByText('Adjuntá una imagen legible del documento solicitado.'),
    ).toHaveLength(2);
    expect(screen.getByText('capture_step')).toBeInTheDocument();
    expect(screen.getByText('expected_channel_delivery_and_action_verified')).toBeInTheDocument();
    expect(screen.getByLabelText('Progreso 50%')).toBeInTheDocument();
    expect(screen.queryByText('storage:private-audio-object')).not.toBeInTheDocument();
    expect(screen.queryByText('a'.repeat(64))).not.toBeInTheDocument();
  });

  it('offers only a local refresh control', () => {
    const onRefresh = vi.fn();
    render(
      <InterviewResumeCard
        resume={interviewResumeFixture.resume}
        onRefresh={onRefresh}
      />,
    );

    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: /actualizar/i }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});

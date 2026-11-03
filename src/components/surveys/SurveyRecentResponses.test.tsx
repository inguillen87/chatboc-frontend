import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SurveyRecentResponses } from './SurveyRecentResponses';

afterEach(cleanup);

describe('recent survey responses error state', () => {
  it('announces a load error without claiming that no responses exist', () => {
    render(<SurveyRecentResponses responses={[]} totalResponsesHint={0} error="No pudimos cargar las respuestas fixture." />);
    expect(screen.getByRole('alert').textContent).toBe('No pudimos cargar las respuestas fixture.');
    expect(screen.queryByText(/Todavía no registramos respuestas/)).toBeNull();
    expect(screen.queryByText(/Todavía no recibimos respuestas/)).toBeNull();
  });

  it('keeps previously loaded responses visible beside a refresh error', () => {
    render(<SurveyRecentResponses responses={[{ id: 91, created_at: '2026-11-03T12:00:00Z',
      resumen: 'Respuesta previa fixture' }]} error="No pudimos actualizar las respuestas fixture." />);
    expect(screen.getByRole('alert').textContent).toBe('No pudimos actualizar las respuestas fixture.');
    expect(screen.queryByText('Respuesta #91')).not.toBeNull();
    expect(screen.queryAllByText('Respuesta previa fixture').length).toBeGreaterThan(0);
    expect(screen.queryByText(/Todavía no registramos respuestas/)).toBeNull();
  });
});

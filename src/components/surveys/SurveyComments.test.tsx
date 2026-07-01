import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getSurveyComments, postSurveyComment } from '@/api/encuestas';
import { SurveyComments } from './SurveyComments';

vi.mock('@/api/encuestas', () => ({
  getSurveyComments: vi.fn(),
  postSurveyComment: vi.fn(),
}));

class LoadedImageMock {
  private listeners = new Map<string, Array<() => void>>();

  addEventListener(eventName: string, listener: () => void) {
    const current = this.listeners.get(eventName) || [];
    this.listeners.set(eventName, [...current, listener]);
  }

  removeEventListener(eventName: string, listener: () => void) {
    const current = this.listeners.get(eventName) || [];
    this.listeners.set(
      eventName,
      current.filter((item) => item !== listener),
    );
  }

  set src(_value: string) {
    setTimeout(() => {
      this.listeners.get('load')?.forEach((listener) => listener());
    }, 0);
  }
}

describe('SurveyComments identity avatars', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('Image', LoadedImageMock);
    vi.mocked(postSurveyComment).mockResolvedValue({
      id: 99,
      texto: 'Nuevo comentario',
      nombre_autor: 'Participante',
      fecha: new Date().toISOString(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders a consented profile avatar returned by the comments API', async () => {
    vi.mocked(getSurveyComments).mockResolvedValueOnce([
      {
        id: 1,
        texto: 'Me gusta esta encuesta',
        nombre_autor: 'Marcelo Avatar',
        fecha: new Date().toISOString(),
        avatar_url: 'https://cdn.example.com/profile/marcelo.webp',
        avatar_source: 'profile_upload',
        avatar_consent: true,
      },
    ]);

    render(<SurveyComments slug="encuesta-test" realtimeComments={[]} />);

    expect(await screen.findByText('Me gusta esta encuesta')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByAltText('Marcelo Avatar')).toHaveAttribute(
        'src',
        'https://cdn.example.com/profile/marcelo.webp',
      );
    });
  });

  it('keeps the generated fallback when an avatar url has no consent', async () => {
    vi.mocked(getSurveyComments).mockResolvedValueOnce([
      {
        id: 2,
        texto: 'Comentario sin foto consentida',
        nombre_autor: 'Vecino Junin',
        fecha: new Date().toISOString(),
        avatar_url: 'https://cdn.example.com/profile/untrusted.webp',
        avatar_source: 'profile_upload',
        avatar_consent: false,
      },
    ]);

    render(<SurveyComments slug="encuesta-test" realtimeComments={[]} />);

    expect(await screen.findByText('Comentario sin foto consentida')).toBeInTheDocument();
    expect(screen.queryByAltText('Vecino Junin')).not.toBeInTheDocument();
    expect(screen.getByText('VJ')).toBeInTheDocument();
  });
});

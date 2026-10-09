import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getSurveyComments, postSurveyComment } from '@/api/encuestas';
import { SurveyComments } from './SurveyComments';
import { ApiError } from '@/utils/api';

vi.mock('@/api/encuestas', () => ({
  getSurveyComments: vi.fn(),
  postSurveyComment: vi.fn(),
}));
vi.mock('@/utils/surveyAnalytics', () => ({
  trackSurveyCommentModeChanged: vi.fn(),
  trackSurveyCommentSubmitted: vi.fn(),
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
    vi.mocked(getSurveyComments).mockResolvedValue([]);
    vi.stubGlobal('Image', LoadedImageMock);
    vi.mocked(postSurveyComment).mockResolvedValue({
      id: 99,
      texto: 'Nuevo comentario',
      nombre_autor: 'Participante',
      fecha: new Date().toISOString(),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
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

  it('recognizes the backend anonymous mode and hides unavailable social flows', async () => {
    render(<SurveyComments slug="consulta" realtimeComments={[]} commentConfig={{ acceptedModes: ['anon', 'social'], requiresSocialToken: true }} />);
    await waitFor(() => expect(getSurveyComments).toHaveBeenCalled());
    expect(screen.getByRole('radio', { name: 'Anónimo' })).toBeEnabled();
    expect(screen.getByRole('radio', { name: 'Con cuenta verificada' })).toBeDisabled();
    expect(screen.queryByText('Conectar Facebook')).not.toBeInTheDocument();
  });

  it('polls authoritative comments and removes moderated entries without a socket', async () => {
    vi.useFakeTimers();
    vi.mocked(getSurveyComments).mockResolvedValueOnce([{ id: 1, texto: 'A retirar', fecha: '2026-10-02T12:00:00Z' }]).mockResolvedValueOnce([]);
    render(<SurveyComments slug="consulta" realtimeComments={[]} />);
    await act(async () => {});
    expect(screen.getByText('A retirar')).toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(8000); });
    expect(getSurveyComments).toHaveBeenCalledTimes(2);
    expect(screen.queryByText('A retirar')).not.toBeInTheDocument();
  });

  it('preserves the last successful read and shows failure instead of an invented empty state', async () => {
    vi.useFakeTimers();
    vi.mocked(getSurveyComments).mockResolvedValueOnce([{ id: 1, texto: 'Última lectura', fecha: '2026-10-02T12:00:00Z' }]).mockRejectedValueOnce(new Error('offline'));
    render(<SurveyComments slug="consulta" realtimeComments={[]} />);
    await act(async () => {});
    await act(async () => { await vi.advanceTimersByTimeAsync(8000); });
    expect(screen.getByText('Última lectura')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('No pudimos actualizar');
    expect(screen.queryByText(/Todavía no hay comentarios/)).not.toBeInTheDocument();
  });

  it('discards an old scope submission without clearing a new scope draft', async () => {
    let acknowledge!: (comment: { id: number; texto: string; fecha: string }) => void;
    vi.mocked(postSurveyComment).mockReturnValueOnce(new Promise((resolve) => { acknowledge = resolve; }));
    const view = render(<SurveyComments slug="consulta-a" tenantSlug="tenant-a" realtimeComments={[]} />);
    await waitFor(() => expect(getSurveyComments).toHaveBeenCalledWith('consulta-a', 'tenant-a'));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Comentario de A' } });
    fireEvent.click(screen.getByRole('button', { name: 'Publicar comentario' }));
    await waitFor(() => expect(postSurveyComment).toHaveBeenCalledTimes(1));
    view.rerender(<SurveyComments slug="consulta-b" tenantSlug="tenant-b" realtimeComments={[]} />);
    await waitFor(() => expect(getSurveyComments).toHaveBeenCalledWith('consulta-b', 'tenant-b'));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Borrador de B' } });
    await act(async () => { acknowledge({ id: 7, texto: 'Comentario de A', fecha: '2026-10-02T12:00:00Z' }); });
    expect(screen.queryByText('Comentario de A')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveValue('Borrador de B');
    expect(screen.getByRole('button', { name: 'Publicar comentario' })).toBeEnabled();
  });

  it('clears withdrawn comments and stops polling after an authoritative denial', async () => {
    vi.useFakeTimers();
    vi.mocked(getSurveyComments).mockResolvedValueOnce([{ id: 1, texto: 'Lectura retirada', fecha: '2026-10-02T12:00:00Z' }]).mockRejectedValue(new ApiError('No disponible', 404, { reason_code: 'survey_not_found', retryable: false }));
    render(<SurveyComments slug="consulta" realtimeComments={[]} />);
    await act(async () => {});
    expect(screen.getByText('Lectura retirada')).toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(8000); });
    expect(screen.queryByText('Lectura retirada')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('ya no están disponibles');
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Borrador conservado' } });
    expect(screen.getByRole('button', { name: 'Publicar comentario' })).toBeDisabled();
    await act(async () => { await vi.advanceTimersByTimeAsync(32000); });
    expect(getSurveyComments).toHaveBeenCalledTimes(2);
  });

  it('rejects social messages unless they come from the configured popup and exact origin', async () => {
    const popup = {} as Window;
    vi.spyOn(window, 'open').mockReturnValue(popup);
    render(<SurveyComments slug="consulta" realtimeComments={[]} commentConfig={{ acceptedModes: ['anon', 'social'], socialProviders: [{ id: 'google', label: 'Google', connectLabel: 'Conectar cuenta', oauthUrl: 'https://auth.example.test/start', messageOrigin: 'https://auth.example.test' }] }} />);
    await waitFor(() => expect(getSurveyComments).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('radio', { name: 'Con cuenta verificada' }));
    fireEvent.click(screen.getByRole('button', { name: 'Conectar cuenta' }));
    const payload = { type: 'chatboc:survey-social-auth-success', provider: 'google', social_token: 'signed-proof', full_name: 'Perfil verificado' };
    fireEvent(window, new MessageEvent('message', { data: payload, source: popup, origin: 'https://forged.example.test' }));
    expect(screen.queryByText('Conectado como Perfil verificado')).not.toBeInTheDocument();
    fireEvent(window, new MessageEvent('message', { data: payload, source: window, origin: 'https://auth.example.test' }));
    expect(screen.queryByText('Conectado como Perfil verificado')).not.toBeInTheDocument();
    fireEvent(window, new MessageEvent('message', { data: payload, source: popup, origin: 'https://auth.example.test' }));
    expect(screen.getByText('Conectado como Perfil verificado')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('Escribí tu comentario para aportar a esta votación.'), { target: { value: 'Aporte firmado' } });
    fireEvent.click(screen.getByRole('button', { name: 'Publicar comentario' }));
    await waitFor(() => expect(postSurveyComment).toHaveBeenCalledWith('consulta', { texto: 'Aporte firmado', mode: 'social', social_token: 'signed-proof' }, undefined));
  });
});

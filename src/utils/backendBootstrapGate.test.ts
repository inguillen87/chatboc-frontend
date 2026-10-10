import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  BackendBootstrapError,
  ensureBackendRuntimeReady,
  isBackendBootstrapGateEnabled,
  resetBackendBootstrapGateForTests,
  resolveBackendReadinessUrl,
} from './backendBootstrapGate';

const initializingResponse = (retryAfter = '2') =>
  new Response(JSON.stringify({
    contract_version: 'chatboc.bootstrap.v1',
    reason_code: 'application_initializing',
    retryable: true,
  }), {
    status: 503,
    headers: {
      'Content-Type': 'application/json',
      'Retry-After': retryAfter,
    },
  });

afterEach(() => {
  resetBackendBootstrapGateForTests();
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllEnvs();
  window.history.replaceState({}, '', '/');
});

describe('backend bootstrap gate', () => {
  it('coalesces simultaneous callers and releases them after one successful probe', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('{"backend":"sha","frontend":"web"}', { status: 200 }));

    await Promise.all([
      ensureBackendRuntimeReady({ enabled: true, fetcher }),
      ensureBackendRuntimeReady({ enabled: true, fetcher }),
      ensureBackendRuntimeReady({ enabled: true, fetcher }),
    ]);

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith('/api/version', expect.objectContaining({
      method: 'GET',
      credentials: 'omit',
      cache: 'no-store',
    }));
  });

  it('retries only the explicit pre-dispatch bootstrap contract and honors Retry-After', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(initializingResponse('2'))
      .mockResolvedValueOnce(new Response('{"backend":"sha","frontend":"web"}', { status: 200 }));
    const wait = vi.fn().mockResolvedValue(undefined);

    await ensureBackendRuntimeReady({ enabled: true, fetcher, wait });

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(wait).toHaveBeenCalledOnce();
    expect(wait).toHaveBeenCalledWith(2_000);
  });

  it('fails closed on a generic 503 without replaying the readiness request', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('{"error":"upstream"}', {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    }));

    await expect(
      ensureBackendRuntimeReady({ enabled: true, fetcher }),
    ).rejects.toBeInstanceOf(BackendBootstrapError);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('clears a failed shared attempt so an explicit user retry can probe again', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response('{"error":"upstream"}', { status: 502 }))
      .mockResolvedValueOnce(new Response('{"backend":"sha","frontend":"web"}', { status: 200 }));

    await expect(
      ensureBackendRuntimeReady({ enabled: true, fetcher }),
    ).rejects.toBeInstanceOf(BackendBootstrapError);
    await expect(
      ensureBackendRuntimeReady({ enabled: true, fetcher }),
    ).resolves.toBeUndefined();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('normalizes HTTP and WebSocket bases to the version endpoint', () => {
    expect(resolveBackendReadinessUrl('/api')).toBe('/api/version');
    expect(resolveBackendReadinessUrl('wss://api-preview.chatboc.ar')).toBe(
      'https://api-preview.chatboc.ar/api/version',
    );
  });

  it.each(['<html>Sign in</html>', '{"ok":true}', '{"backend":"","frontend":"web"}'])(
    'rejects an unrelated successful response: %s', async (body) => {
      const fetcher = vi.fn().mockResolvedValue(new Response(body, { status: 200 }));
      await expect(ensureBackendRuntimeReady({ enabled: true, fetcher }))
        .rejects.toBeInstanceOf(BackendBootstrapError);
      expect(fetcher).toHaveBeenCalledTimes(1);
    },
  );

  it.each(['connection', 'body'])('bounds a stalled %s and allows a fresh retry', async (stage) => {
    vi.useFakeTimers();
    const never = new Promise<never>(() => {});
    const fetcher = vi.fn().mockImplementation(() => stage === 'connection'
      ? never
      : Promise.resolve({ text: () => never }));
    const pending = ensureBackendRuntimeReady({ enabled: true, fetcher, timeoutMs: 250 });
    const rejected = expect(pending).rejects.toBeInstanceOf(BackendBootstrapError);
    await vi.advanceTimersByTimeAsync(250);
    await rejected;
    expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true);
    fetcher.mockResolvedValue(new Response('{"backend":"sha","frontend":"web"}', { status: 200 }));
    await expect(ensureBackendRuntimeReady({ enabled: true, fetcher })).resolves.toBeUndefined();
  });

  it('keeps the default startup probe alive through a 25 second cold start', async () => {
    vi.useFakeTimers();
    let completeProbe!: (response: Response) => void;
    const fetcher = vi.fn().mockImplementation(() => new Promise<Response>((resolve) => {
      completeProbe = resolve;
    }));
    const pending = ensureBackendRuntimeReady({ enabled: true, fetcher });
    const completed = vi.fn();
    void pending.then(completed);

    await vi.advanceTimersByTimeAsync(25_000);
    expect(completed).not.toHaveBeenCalled();
    expect(fetcher.mock.calls[0][1].signal.aborted).toBe(false);

    completeProbe(new Response('{"backend":"sha","frontend":"web"}', { status: 200 }));
    await expect(pending).resolves.toBeUndefined();
    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher.mock.calls[0][1].signal.aborted).toBe(false);
  });

  it('still aborts a stalled default startup probe at the 30 second limit', async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn().mockImplementation(() => new Promise<Response>(() => {}));
    const pending = ensureBackendRuntimeReady({ enabled: true, fetcher });
    const rejected = expect(pending).rejects.toBeInstanceOf(BackendBootstrapError);

    await vi.advanceTimersByTimeAsync(29_999);
    expect(fetcher.mock.calls[0][1].signal.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await rejected;
    expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true);
  });

  it('keeps the delivered institutional presentation and offline shell independent', () => {
    vi.stubEnv('VITE_BACKEND_BOOTSTRAP_GATE_ENABLED', 'true');
    window.history.replaceState({}, '', '/demo/institucional/tdf-discapacidad');
    expect(isBackendBootstrapGateEnabled()).toBe(false);
    window.history.replaceState({}, '', '/perfil');
    expect(isBackendBootstrapGateEnabled()).toBe(true);
    vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false);
    expect(isBackendBootstrapGateEnabled()).toBe(false);
  });
});

describe('readiness is not a permanent container guarantee', () => {
  it('reprobes an expired success but reuses a recent one', async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn().mockImplementation(async () => new Response('{"backend":"sha","frontend":"web"}'));
    await ensureBackendRuntimeReady({ enabled:true, fetcher });
    await ensureBackendRuntimeReady({ enabled:true, fetcher });
    expect(fetcher).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(30_001);
    await ensureBackendRuntimeReady({ enabled:true, fetcher });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('retires an explicit restarted container success without merging other origins', async () => {
    const { invalidateBackendRuntimeReady } = await import('./backendBootstrapGate');
    const fetcher = vi.fn().mockImplementation(async () => new Response('{"backend":"sha","frontend":"web"}'));
    await ensureBackendRuntimeReady({ baseUrl:'/api', enabled:true, fetcher });
    await ensureBackendRuntimeReady({ baseUrl:'https://other.example.invalid', enabled:true, fetcher });
    invalidateBackendRuntimeReady('/api/organizations');
    await ensureBackendRuntimeReady({ baseUrl:'/api', enabled:true, fetcher });
    await ensureBackendRuntimeReady({ baseUrl:'https://other.example.invalid', enabled:true, fetcher });
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
});

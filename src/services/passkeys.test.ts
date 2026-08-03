import { beforeEach, describe, expect, it, vi } from 'vitest';

const startAuthenticationMock = vi.fn();
const startRegistrationMock = vi.fn();
const getOrCreateAnonIdMock = vi.fn(() => 'anon-browser-existing');
const persistAnonIdMock = vi.fn();

vi.mock('@/services/webauthnClient', () => ({
  startAuthentication: (...args: unknown[]) => startAuthenticationMock(...args),
  startRegistration: (...args: unknown[]) => startRegistrationMock(...args),
}));

vi.mock('@/config', () => ({
  BASE_API_URL: 'https://api.example.test',
}));

vi.mock('@/utils/anonIdGenerator', () => ({
  default: () => getOrCreateAnonIdMock(),
  persistAnonId: (...args: unknown[]) => persistAnonIdMock(...args),
}));

import { loginPasskey, registerPasskey } from '@/services/passkeys';

const jsonResponse = (
  body: unknown,
  options: { ok?: boolean; status?: number; anonId?: string } = {},
) =>
  new Response(JSON.stringify(body), {
    status: options.status ?? (options.ok === false ? 400 : 200),
    headers: {
      'Content-Type': 'application/json',
      ...(options.anonId ? { 'X-Anon-Id': options.anonId } : {}),
    },
  });

describe('passkey browser identity binding', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    startRegistrationMock.mockReset().mockResolvedValue({ id: 'attestation-1' });
    startAuthenticationMock.mockReset().mockResolvedValue({ id: 'assertion-1' });
    getOrCreateAnonIdMock.mockClear();
    persistAnonIdMock.mockReset();
  });

  it('persists the server identity only after successful passkey registration', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        jsonResponse(
          { challenge: 'challenge-registration' },
          { anonId: '11111111111111111111111111111111' },
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          { ok: true, token: 'jwt' },
          { anonId: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
        ),
      );

    await expect(registerPasskey('Marcelo')).resolves.toMatchObject({ ok: true });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(persistAnonIdMock).toHaveBeenCalledTimes(1);
    expect(persistAnonIdMock).toHaveBeenCalledWith('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
  });

  it('does not replace the anonymous identity during passkey login', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        jsonResponse(
          { challenge: 'challenge-authentication' },
          { anonId: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' },
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          { ok: true, token: 'jwt' },
          { anonId: 'cccccccccccccccccccccccccccccccc' },
        ),
      );

    await expect(loginPasskey()).resolves.toMatchObject({ ok: true });

    expect(persistAnonIdMock).not.toHaveBeenCalled();
  });

  it('does not persist an identity from failed or malformed registration responses', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({ challenge: 'challenge-registration' }))
      .mockResolvedValueOnce(
        jsonResponse(
          { error: 'attestation rejected' },
          { ok: false, anonId: 'dddddddddddddddddddddddddddddddd' },
        ),
      );

    await expect(registerPasskey()).rejects.toThrow('attestation rejected');
    expect(persistAnonIdMock).not.toHaveBeenCalled();

    vi.restoreAllMocks();
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({ challenge: 'challenge-registration' }))
      .mockResolvedValueOnce(
        jsonResponse({ ok: true, token: 'jwt' }, { anonId: 'not-a-server-passkey-id' }),
      );

    await expect(registerPasskey()).resolves.toMatchObject({ ok: true });
    expect(persistAnonIdMock).not.toHaveBeenCalled();

    vi.restoreAllMocks();
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({ challenge: 'challenge-registration' }))
      .mockResolvedValueOnce(
        jsonResponse(
          { ok: true },
          { anonId: 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' },
        ),
      );

    await expect(registerPasskey()).resolves.toMatchObject({ ok: true });
    expect(persistAnonIdMock).not.toHaveBeenCalled();
  });
});

import { startAuthentication, startRegistration } from '@simplewebauthn/browser';

import { BASE_API_URL } from '@/config';
import getOrCreateAnonId from '@/utils/anonId';

const normalizeBaseUrl = (value: string): string => value.replace(/\/$/, '');

const PASSKEY_BASE_URL = `${normalizeBaseUrl(BASE_API_URL)}/webauthn`;

const buildUrl = (path: string): string => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${PASSKEY_BASE_URL}${normalizedPath}`;
};

interface FetchOptions extends RequestInit {
  expectsJson?: boolean;
}

const readErrorMessage = async (response: Response): Promise<string> => {
  try {
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await response.json();
      if (typeof data?.error === 'string' && data.error.trim()) {
        return data.error;
      }
      if (typeof data?.message === 'string' && data.message.trim()) {
        return data.message;
      }
    } else {
      const text = await response.text();
      if (text.trim()) return text.trim();
    }
  } catch {
    // ignore parsing errors
  }
  return 'No se pudo completar la operación con Passkey.';
};

async function passkeyFetch<T = unknown>(path: string, init: FetchOptions = {}): Promise<T> {
  const { expectsJson = true, headers, ...rest } = init;
  const url = buildUrl(path);
  const response = await fetch(url, {
    credentials: 'include',
    headers,
    ...rest,
  });

  if (!response.ok) {
    const message = await readErrorMessage(response);
    throw new Error(message);
  }

  if (!expectsJson) {
    return undefined as T;
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export interface PasskeyLoginResult {
  ok: boolean;
  token?: string;
  entityToken?: string;
}

export interface PasskeyRegistrationResult {
  ok?: boolean;
  token?: string;
  entityToken?: string;
}

export const registerPasskey = async (
  displayName?: string,
): Promise<PasskeyRegistrationResult | undefined> => {
  if (typeof window === 'undefined') {
    throw new Error('Los Passkeys solo están disponibles en navegadores.');
  }

  getOrCreateAnonId();

  const query = displayName ? `?display_name=${encodeURIComponent(displayName)}` : '';
  const options = await passkeyFetch<Parameters<typeof startRegistration>[0]>(
    `/register/options${query}`,
  );

  const attestationResponse = await startRegistration(options);

  return passkeyFetch<PasskeyRegistrationResult | undefined>('/register/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ attestationResponse }),
  });
};

export const loginPasskey = async (): Promise<PasskeyLoginResult> => {
  if (typeof window === 'undefined') {
    throw new Error('Los Passkeys solo están disponibles en navegadores.');
  }

  getOrCreateAnonId();

  const options = await passkeyFetch<Parameters<typeof startAuthentication>[0]>(
    '/login/options',
  );
  const authenticationResponse = await startAuthentication(options);

  return passkeyFetch<PasskeyLoginResult>('/login/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ authenticationResponse }),
  });
};

export const detectPasskeySupport = async (): Promise<{
  supported: boolean;
  conditionalMediation: boolean;
}> => {
  if (typeof window === 'undefined' || typeof window.PublicKeyCredential === 'undefined') {
    return { supported: false, conditionalMediation: false };
  }

  const results = await Promise.allSettled([
    window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable?.(),
    window.PublicKeyCredential.isConditionalMediationAvailable?.(),
  ]);

  const [platformResult, conditionalResult] = results;

  const supported =
    platformResult.status === 'fulfilled' ? Boolean(platformResult.value) : false;
  const conditionalMediation =
    conditionalResult?.status === 'fulfilled'
      ? Boolean(conditionalResult.value)
      : false;

  return { supported, conditionalMediation };
};

export const isPasskeySupported = async (): Promise<boolean> => {
  const support = await detectPasskeySupport();
  return support.supported;
};

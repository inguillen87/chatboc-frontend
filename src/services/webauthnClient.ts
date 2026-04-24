const base64urlToArrayBuffer = (value: string): ArrayBuffer => {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const buffer = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    buffer[i] = rawData.charCodeAt(i);
  }
  return buffer.buffer;
};

const arrayBufferToBase64url = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '');
};

const arrayBufferViewToBase64url = (view: ArrayBufferView): string => {
  const { buffer, byteOffset, byteLength } = view;
  const slice = buffer.slice(byteOffset, byteOffset + byteLength);
  return arrayBufferToBase64url(slice);
};

const convertToJSON = (value: unknown): unknown => {
  if (value instanceof ArrayBuffer) {
    return arrayBufferToBase64url(value);
  }
  if (ArrayBuffer.isView(value)) {
    return arrayBufferViewToBase64url(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => convertToJSON(item));
  }
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      if (typeof item === 'function') continue;
      const converted = convertToJSON(item);
      if (converted !== undefined) {
        result[key] = converted;
      }
    }
    return result;
  }
  return value;
};

const transformDescriptorList = (
  list?: CredentialDescriptorJSON[],
): PublicKeyCredentialDescriptor[] | undefined =>
  list?.map((descriptor) => ({
    ...descriptor,
    id: base64urlToArrayBuffer(descriptor.id),
  }));

export interface CredentialDescriptorJSON {
  id: string;
  type: PublicKeyCredentialType;
  transports?: AuthenticatorTransport[];
}

export interface RegistrationOptionsJSON {
  challenge: string;
  rp: PublicKeyCredentialRpEntity;
  user: {
    id: string;
    name: string;
    displayName: string;
  };
  pubKeyCredParams: PublicKeyCredentialParameters[];
  timeout?: number;
  attestation?: AttestationConveyancePreference;
  authenticatorSelection?: AuthenticatorSelectionCriteria;
  excludeCredentials?: CredentialDescriptorJSON[];
  extensions?: AuthenticationExtensionsClientInputs;
  hints?: string[];
  mediation?: CredentialMediationRequirement;
  signal?: AbortSignal;
}

export interface AuthenticationOptionsJSON {
  challenge: string;
  allowCredentials?: CredentialDescriptorJSON[];
  rpId?: string;
  timeout?: number;
  userVerification?: UserVerificationRequirement;
  extensions?: AuthenticationExtensionsClientInputs;
  hints?: string[];
  mediation?: CredentialMediationRequirement;
  signal?: AbortSignal;
}

export interface CredentialJSON {
  id: string;
  rawId: string;
  type: PublicKeyCredentialType;
  authenticatorAttachment?: AuthenticatorAttachment;
  response: Record<string, unknown>;
  clientExtensionResults: Record<string, unknown>;
  transports?: AuthenticatorTransport[];
}

const credentialToJSON = (credential: PublicKeyCredential): CredentialJSON => {
  const response = credential.response as AuthenticatorAttestationResponse | AuthenticatorAssertionResponse;
  const transports = (response as AuthenticatorAttestationResponse).getTransports?.();

  const json: CredentialJSON = {
    id: credential.id,
    rawId: arrayBufferToBase64url(credential.rawId),
    type: credential.type,
    authenticatorAttachment: credential.authenticatorAttachment ?? undefined,
    response: convertToJSON(response) as Record<string, unknown>,
    clientExtensionResults: convertToJSON(
      credential.getClientExtensionResults(),
    ) as Record<string, unknown>,
    transports: Array.isArray(transports) ? [...transports] : undefined,
  };

  return json;
};

export const startRegistration = async (
  options: RegistrationOptionsJSON,
): Promise<CredentialJSON> => {
  if (typeof navigator === 'undefined' || !navigator.credentials) {
    throw new Error('Este navegador no soporta WebAuthn.');
  }

  const { mediation, signal, hints: _hints, ...jsonOptions } = options;

  const publicKey: PublicKeyCredentialCreationOptions = {
    ...jsonOptions,
    challenge: base64urlToArrayBuffer(jsonOptions.challenge),
    user: {
      ...jsonOptions.user,
      id: base64urlToArrayBuffer(jsonOptions.user.id),
    },
    excludeCredentials: transformDescriptorList(jsonOptions.excludeCredentials),
  };

  const credential = (await navigator.credentials.create({
    publicKey,
    signal,
    mediation,
  })) as PublicKeyCredential | null;

  if (!credential) {
    throw new Error('No se pudo completar el registro con Passkey.');
  }

  return credentialToJSON(credential);
};

export const startAuthentication = async (
  options: AuthenticationOptionsJSON,
): Promise<CredentialJSON> => {
  if (typeof navigator === 'undefined' || !navigator.credentials) {
    throw new Error('Este navegador no soporta WebAuthn.');
  }

  const { mediation, signal, hints, ...jsonOptions } = options;

  const publicKey: PublicKeyCredentialRequestOptions = {
    ...jsonOptions,
    challenge: base64urlToArrayBuffer(jsonOptions.challenge),
    allowCredentials: transformDescriptorList(jsonOptions.allowCredentials),
  };

  const credential = (await navigator.credentials.get({
    publicKey,
    mediation,
    signal,
    hints,
  })) as PublicKeyCredential | null;

  if (!credential) {
    throw new Error('No se pudo completar la autenticación con Passkey.');
  }

  return credentialToJSON(credential);
};

import React from 'react';
import { useAuth, useReverification, useUser } from '@clerk/clerk-react';
import { isReverificationCancelledError } from '@clerk/clerk-react/errors';

import { syncClerkSession } from '@/api/clerkAuth';
import { ApiError } from '@/utils/api';
import { buildClerkProfile, persistChatbocSession } from '@/utils/clerkSession';

export interface ClerkReverificationHint {
  clerk_error: {
    type: 'forbidden';
    reason: 'reverification-error';
    metadata: {
      reverification: 'strict_mfa';
    };
  };
}

type ClerkStepUpPhase = 'initial' | 'awaiting_reverification' | 'retry_consumed';

interface ClerkStepUpInvocation<Input> {
  input: Input;
  phase: ClerkStepUpPhase;
  clerkUserId: string;
}

export type ClerkStepUpFlowErrorCode =
  | 'mfa_enrollment_required'
  | 'reverification_failed'
  | 'session_unavailable'
  | 'session_refresh_failed'
  | 'identity_changed'
  | 'retry_exhausted';

export class ClerkStepUpFlowError extends Error {
  public readonly code: ClerkStepUpFlowErrorCode;

  constructor(code: ClerkStepUpFlowErrorCode, message: string) {
    super(message);
    this.name = 'ClerkStepUpFlowError';
    this.code = code;
    Object.setPrototypeOf(this, ClerkStepUpFlowError.prototype);
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const readSafeBackendMessage = (error: ApiError, fallback: string) => {
  const body = isRecord(error.body) ? error.body : null;
  const nestedError = body && isRecord(body.error) ? body.error : null;
  const message = nestedError && typeof nestedError.message === 'string'
    ? nestedError.message.trim()
    : '';
  return message || fallback;
};

// Defensive support for a future backend signal backed by explicit enrollment
// evidence. Clerk's `fva[1] === -1` is not such evidence and must continue
// through the regular `reverification-error` flow.
export const isExplicitMfaEnrollmentRequiredError = (error: unknown) => {
  if (!(error instanceof ApiError) || error.status !== 403 || !isRecord(error.body)) return false;
  const clerkError = isRecord(error.body.clerk_error) ? error.body.clerk_error : null;
  const metadata = clerkError && isRecord(clerkError.metadata) ? clerkError.metadata : null;
  return error.body.contract_version === 'auth.assurance.error.v1'
    && error.body.status_code === 403
    && error.body.reason_code === 'mfa_enrollment_required'
    && error.body.retryable === false
    && error.body.no_retry === true
    && clerkError?.type === 'forbidden'
    && clerkError.reason === 'mfa-enrollment-required'
    && metadata?.reverification === 'strict_mfa'
    && metadata.enrollment_required === true
    && metadata.retry_after_reverification === false;
};

/**
 * Converts only the backend's exact, trusted 403 contract into the hint Clerk
 * understands. Malformed or unrelated forbidden responses remain ordinary API
 * errors and can never open a reverification loop.
 */
export const toClerkReverificationHint = (error: unknown): ClerkReverificationHint | null => {
  if (!(error instanceof ApiError) || error.status !== 403 || !isRecord(error.body)) return null;
  const clerkError = isRecord(error.body.clerk_error) ? error.body.clerk_error : null;
  const metadata = clerkError && isRecord(clerkError.metadata) ? clerkError.metadata : null;
  if (
    error.body.contract_version !== 'auth.assurance.error.v1'
    || error.body.status_code !== 403
    || error.body.reason_code !== 'step_up_required'
    || error.body.retryable !== false
    || clerkError?.type !== 'forbidden'
    || clerkError.reason !== 'reverification-error'
    || metadata?.reverification !== 'strict_mfa'
  ) {
    return null;
  }
  return {
    clerk_error: {
      type: 'forbidden',
      reason: 'reverification-error',
      metadata: { reverification: 'strict_mfa' },
    },
  };
};

export const resolveClerkStepUpErrorMessage = (error: unknown): string | null => {
  if (isReverificationCancelledError(error)) {
    return 'La verificación adicional fue cancelada. No se aplicó ningún cambio.';
  }
  if (error instanceof ClerkStepUpFlowError) return error.message;
  return null;
};

/**
 * Adds one bounded Clerk reverification attempt to a sensitive action.
 * Clerk invokes the same fetcher with the same argument after the user verifies;
 * that identity guarantees the action payload and its Idempotency-Key are reused.
 */
export const useClerkStepUpAction = <Input, Output>(
  action: (input: Input) => Promise<Output>,
) => {
  const {
    getToken,
    isLoaded: authLoaded,
    isSignedIn: authSignedIn,
    userId,
  } = useAuth();
  const {
    isLoaded: userLoaded,
    isSignedIn: userSignedIn,
    user,
  } = useUser();
  const authStateRef = React.useRef({
    authLoaded,
    authSignedIn,
    userLoaded,
    userSignedIn,
    userId,
    user,
  });
  authStateRef.current = {
    authLoaded,
    authSignedIn,
    userLoaded,
    userSignedIn,
    userId,
    user,
  };

  const guardedFetcher = React.useCallback(async (
    invocation: ClerkStepUpInvocation<Input>,
  ): Promise<Output | ClerkReverificationHint> => {
    const currentAuth = authStateRef.current;
    if (
      !currentAuth.authLoaded
      || !currentAuth.userLoaded
      || currentAuth.authSignedIn !== true
      || currentAuth.userSignedIn !== true
      || !currentAuth.userId
      || !currentAuth.user
    ) {
      throw new ClerkStepUpFlowError(
        'session_unavailable',
        'La sesión segura todavía no está disponible. Volvé a intentarlo cuando termine de cargar.',
      );
    }
    if (currentAuth.userId !== invocation.clerkUserId || currentAuth.user.id !== invocation.clerkUserId) {
      throw new ClerkStepUpFlowError(
        'identity_changed',
        'La cuenta activa cambió durante la verificación. Revisá la sesión antes de volver a aplicar cambios.',
      );
    }

    if (invocation.phase === 'awaiting_reverification') {
      invocation.phase = 'retry_consumed';
      try {
        const freshToken = await getToken({ skipCache: true });
        if (!freshToken) {
          throw new ClerkStepUpFlowError(
            'session_refresh_failed',
            'La verificación terminó, pero no pudimos renovar la sesión segura. No se aplicó ningún cambio.',
          );
        }

        const currentUser = authStateRef.current.user;
        const currentUserId = authStateRef.current.userId;
        if (!currentUser || currentUserId !== invocation.clerkUserId || currentUser.id !== invocation.clerkUserId) {
          throw new ClerkStepUpFlowError(
            'identity_changed',
            'La cuenta activa cambió durante la verificación. Revisá la sesión antes de volver a aplicar cambios.',
          );
        }

        const refreshedSession = await syncClerkSession(
          freshToken,
          buildClerkProfile(currentUser),
          { intent: 'tenant_owner' },
        );
        const identityAfterSync = authStateRef.current;
        if (
          identityAfterSync.authSignedIn !== true
          || identityAfterSync.userSignedIn !== true
          || identityAfterSync.userId !== invocation.clerkUserId
          || identityAfterSync.user?.id !== invocation.clerkUserId
        ) {
          throw new ClerkStepUpFlowError(
            'identity_changed',
            'La cuenta activa cambió durante la verificación. Revisá la sesión antes de volver a aplicar cambios.',
          );
        }
        if (refreshedSession.onboarding?.required) {
          throw new ClerkStepUpFlowError(
            'session_refresh_failed',
            'La cuenta requiere completar su configuración antes de ejecutar esta acción sensible.',
          );
        }
        persistChatbocSession(refreshedSession, invocation.clerkUserId, 'tenant_owner');
      } catch (error) {
        if (error instanceof ClerkStepUpFlowError) throw error;
        throw new ClerkStepUpFlowError(
          'session_refresh_failed',
          'La verificación terminó, pero no pudimos renovar la sesión segura. No se reintentó la operación.',
        );
      }
    } else if (invocation.phase === 'retry_consumed') {
      throw new ClerkStepUpFlowError(
        'retry_exhausted',
        'La verificación no pudo confirmarse con la sesión renovada. No se repitió la operación.',
      );
    }

    try {
      return await action(invocation.input);
    } catch (error) {
      if (isExplicitMfaEnrollmentRequiredError(error)) {
        throw new ClerkStepUpFlowError(
          'mfa_enrollment_required',
          readSafeBackendMessage(
            error as ApiError,
            'Esta acción requiere configurar un segundo factor en la cuenta antes de continuar.',
          ),
        );
      }

      const reverificationHint = toClerkReverificationHint(error);
      if (!reverificationHint) throw error;
      if (invocation.phase !== 'initial') {
        throw new ClerkStepUpFlowError(
          'retry_exhausted',
          'La verificación no pudo confirmarse con la sesión renovada. No se repitió la operación.',
        );
      }
      invocation.phase = 'awaiting_reverification';
      return reverificationHint;
    }
  }, [action, getToken]);

  const executeWithReverification = useReverification(guardedFetcher);

  return React.useCallback(async (input: Input): Promise<Output> => {
    const currentAuth = authStateRef.current;
    if (
      !currentAuth.authLoaded
      || !currentAuth.userLoaded
      || currentAuth.authSignedIn !== true
      || currentAuth.userSignedIn !== true
      || !currentAuth.userId
      || !currentAuth.user
    ) {
      throw new ClerkStepUpFlowError(
        'session_unavailable',
        'La sesión segura todavía no está disponible. Volvé a intentarlo cuando termine de cargar.',
      );
    }

    const invocation: ClerkStepUpInvocation<Input> = {
      input,
      phase: 'initial',
      clerkUserId: currentAuth.userId,
    };
    try {
      return await executeWithReverification(invocation);
    } catch (error) {
      // At this phase the protected request already returned the trusted 403,
      // but Clerk never invoked the retry. Surface a deterministic human error
      // instead of classifying the outcome as an ambiguous write.
      if (
        invocation.phase === 'awaiting_reverification'
        && !isReverificationCancelledError(error)
      ) {
        throw new ClerkStepUpFlowError(
          'reverification_failed',
          'No pudimos completar la verificación adicional. No se aplicó ningún cambio; revisá el segundo factor e intentá nuevamente.',
        );
      }
      throw error;
    }
  }, [executeWithReverification]);
};

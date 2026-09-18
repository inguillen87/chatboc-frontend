import React from 'react';
import { useAuth, useUser as useClerkUser } from '@clerk/clerk-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertTriangle, Loader2, LogOut, RefreshCw } from 'lucide-react';

import {
  completeClerkOnboarding,
  syncClerkSession,
  type ClerkOnboardingPayload,
  type ClerkSessionResponse,
  type ClerkUserProfilePayload,
} from '@/api/clerkAuth';
import ClerkTenantOnboardingDialog, {
  type ClerkTenantOnboardingCompletion,
} from '@/components/auth/ClerkTenantOnboardingDialog';
import { useClerkRuntime } from '@/components/auth/ClerkRuntimeContext';
import { Button } from '@/components/ui/button';
import { useUser } from '@/hooks/useUser';
import { safeLocalStorage } from '@/utils/safeLocalStorage';
import {
  clearClerkAuthContext,
  persistClerkAuthContext,
  readClerkAuthContext,
  sanitizeClerkReturnPath,
  type ClerkAuthContext,
  type ClerkAuthIntent,
} from '@/utils/clerkAuthContext';
import {
  buildClerkProfile,
  persistChatbocSession,
} from '@/utils/clerkSession';
import { getSafeAuthNextPath } from '@/utils/authRedirect';
import { buildTenantPath } from '@/utils/tenantPaths';
import { resolveTenantSlug } from '@/utils/api';
import {
  captureChatbocSessionRevision,
  hasPersistedClerkSession,
  isChatbocSessionRevisionCurrent,
  readPersistedClerkUserId,
  registerClerkSignOut,
  resetChatbocSessionForIdentityTransition,
  logoutChatbocSession,
} from '@/utils/sessionLogout';
export { buildClerkProfile, persistChatbocSession } from '@/utils/clerkSession';

const isAuthEntryPath = (pathname: string) =>
  /\/(?:user\/)?(?:login|register)\/?$/i.test(pathname);

const CLERK_ONBOARDING_PANEL_PATH = '/perfil?setup=channels';

export const resolveClerkOnboardingHandoff = (
  session: ClerkSessionResponse,
  authContext?: ClerkAuthContext | null,
) => {
  const requestedDestination = sanitizeClerkReturnPath(authContext?.returnTo);
  const primaryAction = session.channel_activation?.summary?.primary_next_action;
  const actionKind = String(primaryAction?.kind || 'link').trim().toLowerCase();
  const backendDestination = actionKind === 'api'
    ? null
    : sanitizeClerkReturnPath(primaryAction?.href);
  const destination = requestedDestination || backendDestination || CLERK_ONBOARDING_PANEL_PATH;
  const requestedWhatsapp = Boolean(
    requestedDestination &&
      /(?:[?&]channel=whatsapp(?:&|$)|\/whatsapp(?:\/|$)|[?&]action=[^&#]*whatsapp)/i.test(requestedDestination),
  );
  const backendLabel = backendDestination && typeof primaryAction?.label === 'string'
    ? primaryAction.label.trim()
    : '';

  return {
    destination,
    actionLabel: requestedDestination
      ? requestedWhatsapp
        ? 'Continuar con WhatsApp'
        : 'Continuar donde estabas'
      : backendLabel || 'Revisar activacion',
    showPanelAction: destination !== CLERK_ONBOARDING_PANEL_PATH,
  };
};

const resolveBridgeAuthContext = (location: { pathname: string; search: string }): ClerkAuthContext => {
  const stored = readClerkAuthContext();
  if (stored) return stored;

  if (hasPersistedClerkSession()) {
    const persistedIntent: ClerkAuthIntent =
      safeLocalStorage.getItem('clerkAuthIntent') === 'tenant_portal'
        ? 'tenant_portal'
        : 'tenant_owner';
    return {
      intent: persistedIntent,
      tenantSlug:
        persistedIntent === 'tenant_portal'
          ? safeLocalStorage.getItem('tenantSlug')
          : null,
      returnTo: null,
      createdAt: Date.now(),
    };
  }

  const portalEntry = /\/user\/(?:login|register)\/?$/i.test(location.pathname);
  return {
    intent: portalEntry ? 'tenant_portal' : 'tenant_owner',
    tenantSlug: portalEntry ? resolveTenantSlug() : null,
    returnTo: sanitizeClerkReturnPath(getSafeAuthNextPath(location.search)),
    createdAt: Date.now(),
  };
};

interface ClerkAuthBridgeProps {
  onSessionPending?: (identity: string) => void;
  onSessionReady?: (identity: string) => void;
  onSessionReset?: () => void;
}

const ClerkAuthBridge: React.FC<ClerkAuthBridgeProps> = ({
  onSessionPending,
  onSessionReady,
  onSessionReset,
}) => {
  const clerkRuntime = useClerkRuntime();
  const { isLoaded, isSignedIn, getToken, signOut, sessionId } = useAuth();
  const { user: clerkUser } = useClerkUser();
  const { refreshUser } = useUser();
  const location = useLocation();
  const navigate = useNavigate();
  const [onboardingOpen, setOnboardingOpen] = React.useState(false);
  const [onboardingRequired, setOnboardingRequired] = React.useState(false);
  const [onboardingContract, setOnboardingContract] = React.useState<ClerkSessionResponse['onboarding']>();
  const [onboardingLoading, setOnboardingLoading] = React.useState(false);
  const [onboardingError, setOnboardingError] = React.useState<string | null>(null);
  const [onboardingCompletion, setOnboardingCompletion] = React.useState<ClerkTenantOnboardingCompletion | null>(null);
  const [onboardingDestination, setOnboardingDestination] = React.useState(CLERK_ONBOARDING_PANEL_PATH);
  const [onboardingContinuationLabel, setOnboardingContinuationLabel] = React.useState<string | null>(null);
  const [profile, setProfile] = React.useState<ClerkUserProfilePayload | undefined>();
  const [syncError, setSyncError] = React.useState<string | null>(null);
  const [syncRetryNonce, setSyncRetryNonce] = React.useState(0);
  const syncKeyRef = React.useRef<string | null>(null);
  const previousSignedInRef = React.useRef<boolean | undefined>(undefined);
  const activeClerkUserIdRef = React.useRef<string | null | undefined>(undefined);
  const onboardingAuthContextRef = React.useRef<ClerkAuthContext | null>(null);
  const navigateRef = React.useRef(navigate);
  const locationRef = React.useRef(location);
  const pathnameRef = React.useRef(location.pathname);
  navigateRef.current = navigate;
  locationRef.current = location;
  pathnameRef.current = location.pathname;

  const resetBridgeState = React.useCallback(() => {
    syncKeyRef.current = null;
    setProfile(undefined);
    setOnboardingRequired(false);
    setOnboardingOpen(false);
    setOnboardingContract(undefined);
    setOnboardingError(null);
    setOnboardingCompletion(null);
    setOnboardingDestination(CLERK_ONBOARDING_PANEL_PATH);
    setOnboardingContinuationLabel(null);
    onboardingAuthContextRef.current = null;
    setSyncError(null);
  }, []);

  React.useEffect(() => registerClerkSignOut(signOut), [signOut]);

  React.useEffect(() => {
    if (!isLoaded || typeof isSignedIn !== 'boolean') return;

    if (!isSignedIn) {
      onSessionReset?.();
    }

    const wasSignedIn = previousSignedInRef.current;
    previousSignedInRef.current = isSignedIn;
    const signedOutAfterTransition = wasSignedIn === true && isSignedIn === false;
    const hasActiveClerkIdentity = Boolean(activeClerkUserIdRef.current);
    const persistedClerkSession = hasPersistedClerkSession();
    const loadedWithStaleClerkSession =
      wasSignedIn === undefined && isSignedIn === false && persistedClerkSession;
    const signedOutFromChatbocClerkSession =
      signedOutAfterTransition && (hasActiveClerkIdentity || persistedClerkSession);
    if (!signedOutFromChatbocClerkSession && !loadedWithStaleClerkSession) return;

    const transition = resetChatbocSessionForIdentityTransition();
    void transition.completion;
    activeClerkUserIdRef.current = null;
    resetBridgeState();
  }, [isLoaded, isSignedIn, onSessionReset, resetBridgeState]);

  React.useEffect(() => {
    if (!clerkRuntime.enabled || !isLoaded || !isSignedIn || !clerkUser) return;

    const currentClerkUserId = String(clerkUser.id || '').trim();
    if (!currentClerkUserId) return;
    const currentSessionIdentity = `${currentClerkUserId}:${sessionId || ''}`;

    const persistedClerkSession = hasPersistedClerkSession();
    if (activeClerkUserIdRef.current === undefined) {
      activeClerkUserIdRef.current = persistedClerkSession
        ? readPersistedClerkUserId()
        : null;
    }

    const previousClerkUserId = activeClerkUserIdRef.current;
    const isIdentitySwitch = Boolean(
      previousClerkUserId && previousClerkUserId !== currentClerkUserId,
    );
    const isUnattributedPersistedSession =
      persistedClerkSession && !previousClerkUserId;
    let transitionCompletion: Promise<unknown> = Promise.resolve();

    if (isIdentitySwitch || isUnattributedPersistedSession) {
      const transition = resetChatbocSessionForIdentityTransition();
      transitionCompletion = transition.completion;
      resetBridgeState();
    }
    activeClerkUserIdRef.current = currentClerkUserId;

    const authContext = resolveBridgeAuthContext(locationRef.current);
    const syncKey = [
      clerkUser.id,
      (clerkUser as any)?.updatedAt?.getTime?.() ?? '',
      authContext.intent,
      authContext.tenantSlug || '',
      sessionId || '',
      syncRetryNonce,
    ].join(':');
    if (syncKeyRef.current === syncKey) return;
    syncKeyRef.current = syncKey;
    onSessionPending?.(currentSessionIdentity);

    let cancelled = false;
    let sessionRevision: number | null = null;
    const hasCurrentIdentity = () =>
      !cancelled && activeClerkUserIdRef.current === currentClerkUserId;
    const isCurrentSync = () =>
      hasCurrentIdentity() &&
      sessionRevision !== null &&
      isChatbocSessionRevisionCurrent(sessionRevision);
    const run = async () => {
      try {
        await transitionCompletion;
        if (!hasCurrentIdentity()) return;
        sessionRevision = captureChatbocSessionRevision();
        const token = await getToken();
        if (!token) {
          if (isCurrentSync()) {
            syncKeyRef.current = null;
            setSyncError('No se pudo verificar la sesión Clerk. Reintentá el acceso.');
          }
          return;
        }
        if (!isCurrentSync()) {
          return;
        }
        const nextProfile = buildClerkProfile(clerkUser);
        const session = await syncClerkSession(token, nextProfile, {
          intent: authContext.intent,
          tenant_slug: authContext.tenantSlug,
        });
        if (!isCurrentSync()) return;

        if (session.onboarding?.required) {
          if (authContext.intent === 'tenant_portal') {
            throw new Error('El acceso de vecino o cliente no puede crear una organizacion. Volve a intentarlo desde el portal del tenant.');
          }
          const transition = resetChatbocSessionForIdentityTransition();
          await transition.completion;
          if (
            cancelled ||
            activeClerkUserIdRef.current !== currentClerkUserId ||
            !isChatbocSessionRevisionCurrent(transition.revision)
          ) return;
          persistClerkAuthContext(authContext);
          setProfile(nextProfile);
          setOnboardingContract(session.onboarding);
          setOnboardingCompletion(null);
          const pendingHandoff = resolveClerkOnboardingHandoff(session, authContext);
          setOnboardingDestination(pendingHandoff.destination);
          setOnboardingContinuationLabel(authContext.returnTo ? pendingHandoff.actionLabel : null);
          onboardingAuthContextRef.current = authContext;
          setOnboardingRequired(Boolean(session.onboarding?.required));
          setOnboardingOpen(Boolean(session.onboarding?.required));
          return;
        }

        persistChatbocSession(session, currentClerkUserId, authContext.intent);
        setSyncError(null);
        setProfile(nextProfile);
        setOnboardingContract(session.onboarding);
        onboardingAuthContextRef.current = null;
        setOnboardingRequired(false);
        await refreshUser();
        if (!isCurrentSync()) return;
        onSessionReady?.(currentSessionIdentity);

        const tenantSlug = session.user?.tenantSlug || session.user?.tenant_slug || session.tenant?.slug || authContext.tenantSlug;
        const destination = authContext.returnTo || (
          authContext.intent === 'tenant_portal'
            ? buildTenantPath('/portal/dashboard', tenantSlug || undefined)
            : '/perfil'
        );
        clearClerkAuthContext();
        if (isAuthEntryPath(pathnameRef.current) || authContext.returnTo) {
          navigateRef.current(destination, { replace: true });
        }
      } catch (error) {
        if (!isCurrentSync()) return;
        console.error('[ClerkAuthBridge] No se pudo sincronizar Clerk con Chatboc', error);
        setSyncError(error instanceof Error ? error.message : 'No se pudo completar el acceso seguro.');
        syncKeyRef.current = null;
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [clerkRuntime.enabled, clerkUser, getToken, isLoaded, isSignedIn, onSessionPending, onSessionReady, refreshUser, resetBridgeState, sessionId, syncRetryNonce]);

  if (!clerkRuntime.enabled || !isLoaded || !isSignedIn) return null;

  const defaultTenantName = [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(' ').trim();

  const handleOnboardingSubmit = async (payload: ClerkOnboardingPayload) => {
    const submitRevision = captureChatbocSessionRevision();
    const submitClerkUserId = String(clerkUser?.id || '').trim();
    const isCurrentSubmit = () =>
      Boolean(submitClerkUserId) &&
      activeClerkUserIdRef.current === submitClerkUserId &&
      isChatbocSessionRevisionCurrent(submitRevision);
    setOnboardingLoading(true);
    setOnboardingError(null);
    const authContext = onboardingAuthContextRef.current || readClerkAuthContext();
    const termsOnly = onboardingContract?.modal?.mode === 'terms_only';
    try {
      const token = await getToken();
      if (!token || !isCurrentSubmit()) {
        throw new Error('No se pudo obtener la sesion Clerk.');
      }
      const session = await completeClerkOnboarding(token, {
        ...payload,
        user: profile || buildClerkProfile(clerkUser),
      });
      if (!isCurrentSubmit()) return;
      if (session.onboarding?.required) {
        throw new Error(session.message || 'El backend no completo el alta del espacio.');
      }
      persistChatbocSession(session, submitClerkUserId, 'tenant_owner');
      setOnboardingContract(session.onboarding);
      await refreshUser();
      if (!isCurrentSubmit()) return;
      onSessionReady?.(`${submitClerkUserId}:${sessionId || ''}`);
      const handoff = resolveClerkOnboardingHandoff(session, authContext);
      setOnboardingDestination(handoff.destination);
      setOnboardingCompletion({
        title: termsOnly ? 'Consentimiento actualizado' : 'Tu espacio está listo',
        description: termsOnly
          ? 'Tus condiciones de acceso quedaron actualizadas. Podés retomar la tarea pendiente.'
          : 'La organización se creó correctamente. Elegí el siguiente paso sin perder el contexto del registro.',
        statusLabel: termsOnly ? 'Consentimiento confirmado' : 'Alta completada',
        tenantName: session.tenant?.nombre || payload.tenant_name,
        primaryActionLabel: handoff.actionLabel,
        showPanelAction: handoff.showPanelAction,
      });
      setOnboardingOpen(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo completar el onboarding.';
      setOnboardingError(message);
    } finally {
      setOnboardingLoading(false);
    }
  };

  const finishOnboardingHandoff = (destination: string) => {
    clearClerkAuthContext();
    onboardingAuthContextRef.current = null;
    setOnboardingCompletion(null);
    setOnboardingContinuationLabel(null);
    setOnboardingRequired(false);
    setOnboardingOpen(false);
    navigate(destination, { replace: true });
  };

  return (
    <>
      <ClerkTenantOnboardingDialog
        open={onboardingOpen}
        onOpenChange={setOnboardingOpen}
        userProfile={profile}
        defaultTenantName={defaultTenantName}
        onboarding={onboardingContract}
        required={onboardingRequired}
        loading={onboardingLoading}
        error={onboardingError}
        completion={onboardingCompletion}
        continuationLabel={onboardingContinuationLabel}
        onSubmit={handleOnboardingSubmit}
        onCompletionPrimary={() => finishOnboardingHandoff(onboardingDestination)}
        onCompletionPanel={() => finishOnboardingHandoff(CLERK_ONBOARDING_PANEL_PATH)}
      />
      {syncError ? (
        <div
          role="alert"
          aria-live="assertive"
          className="fixed bottom-4 right-4 z-[100] w-[min(92vw,28rem)] rounded-lg border border-amber-300 bg-background p-4 text-foreground shadow-2xl"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">No pudimos completar el acceso</p>
              <p className="mt-1 text-sm text-muted-foreground">{syncError}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="gap-2"
                  onClick={() => {
                    setSyncError(null);
                    syncKeyRef.current = null;
                    setSyncRetryNonce((value) => value + 1);
                  }}
                >
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                  Reintentar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-2"
                  onClick={() => {
                    void logoutChatbocSession({ clerkEnabled: true }).then(() => navigate('/login', { replace: true }));
                  }}
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  Cambiar cuenta
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {onboardingLoading && !onboardingOpen ? (
        <span className="sr-only" role="status"><Loader2 className="h-4 w-4 animate-spin" /> Procesando acceso</span>
      ) : null}
    </>
  );
};

export default ClerkAuthBridge;

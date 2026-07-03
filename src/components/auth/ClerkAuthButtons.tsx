import React from 'react';
import {
  SignedIn,
  SignedOut,
  SignInButton,
  SignUpButton,
  UserButton,
  useSignIn,
  useSignUp,
} from '@clerk/clerk-react';
import { Facebook, Linkedin, Loader2, Mail, ShieldCheck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useClerkRuntime, type ClerkRuntimeValue } from '@/components/auth/ClerkRuntimeContext';
import GoogleIcon from '@/components/auth/GoogleIcon';
import { cn } from '@/lib/utils';

interface ClerkAuthButtonsProps {
  mode?: 'login' | 'register';
  className?: string;
}

const SOCIAL_PROVIDER_LABELS: Record<string, string> = {
  google: 'Google',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
};

const SOCIAL_PROVIDER_ORDER = ['google', 'facebook', 'linkedin'];
const OAUTH_STRATEGY_BY_PROVIDER = {
  google: 'oauth_google',
  facebook: 'oauth_facebook',
  linkedin: 'oauth_linkedin_oidc',
} as const;
type ClerkOAuthProvider = keyof typeof OAUTH_STRATEGY_BY_PROVIDER;

const PROVIDER_ICON: Record<string, React.ReactNode> = {
  google: <GoogleIcon className="h-4 w-4" aria-hidden="true" />,
  facebook: <Facebook className="h-4 w-4" aria-hidden="true" />,
  linkedin: <Linkedin className="h-4 w-4" aria-hidden="true" />,
};

const normalizeSocialProviders = (providers: string[]) => {
  const normalized = Array.from(
    new Set(
      providers
        .map((provider) => provider.trim().toLowerCase().replace(/^oauth_/, '').replace(/_oidc$/, ''))
        .filter(Boolean),
    ),
  );
  return [
    ...SOCIAL_PROVIDER_ORDER.filter((provider) => normalized.includes(provider)),
    ...normalized.filter((provider) => !SOCIAL_PROVIDER_ORDER.includes(provider)),
  ];
};

const isSupportedOAuthProvider = (provider: string): provider is ClerkOAuthProvider =>
  provider in OAUTH_STRATEGY_BY_PROVIDER;

const socialProviderLabel = (providers: string[]) => {
  const sorted = normalizeSocialProviders(providers);
  const labels = sorted.map((provider) => SOCIAL_PROVIDER_LABELS[provider] || provider);

  if (labels.length === 0) return 'Email seguro';
  if (labels.length === 1) return `${labels[0]} o email`;
  return `${labels.join(', ')} o email`;
};

const ClerkAuthButtonsInner: React.FC<ClerkAuthButtonsProps & { clerkRuntime: ClerkRuntimeValue }> = ({
  mode = 'login',
  className,
  clerkRuntime,
}) => {
  const signInApi = useSignIn();
  const signUpApi = useSignUp();
  const [loadingProvider, setLoadingProvider] = React.useState<string | null>(null);
  const [oauthError, setOauthError] = React.useState<string | null>(null);

  const providerLabel = socialProviderLabel(clerkRuntime.socialProviders);
  const emailFallbackLabel = mode === 'register' ? 'Crear con email' : 'Ingresar con email';
  const secondaryLabel = mode === 'register' ? 'Ya tengo cuenta' : 'Crear cuenta nueva';
  const socialProviders = normalizeSocialProviders(clerkRuntime.socialProviders).filter(isSupportedOAuthProvider);

  const runOAuthRedirect = async (provider: ClerkOAuthProvider) => {
    const strategy = OAUTH_STRATEGY_BY_PROVIDER[provider];
    if (!strategy) return;
    const authResource = mode === 'register' ? signUpApi.signUp : signInApi.signIn;
    const isLoaded = mode === 'register' ? signUpApi.isLoaded : signInApi.isLoaded;
    if (!isLoaded || !authResource) return;

    setOauthError(null);
    setLoadingProvider(provider);
    try {
      const origin = window.location.origin;
      const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}` || '/perfil';
      const callbackPath = clerkRuntime.oauthCallbackPath || '/sso-callback';
      await authResource.authenticateWithRedirect({
        strategy,
        redirectUrl: `${origin}${callbackPath.startsWith('/') ? callbackPath : `/${callbackPath}`}`,
        redirectUrlComplete: `${origin}${currentPath}`,
      });
    } catch (error) {
      console.error('[ClerkAuthButtons] No se pudo iniciar OAuth', error);
      const label = SOCIAL_PROVIDER_LABELS[provider] || provider;
      setOauthError(`No se pudo abrir ${label}. Probá con email o intentá nuevamente.`);
      setLoadingProvider(null);
    }
  };

  return (
    <div className={cn('space-y-3', className)}>
      <SignedOut>
        <div className="grid gap-2">
          {socialProviders.length ? (
            <div className="grid gap-2" aria-label={`Acceso social: ${providerLabel}`}>
              {socialProviders.map((provider) => {
                const label = SOCIAL_PROVIDER_LABELS[provider] || provider;
                const isLoading = loadingProvider === provider;
                return (
                  <Button
                    key={provider}
                    type="button"
                    className="h-11 w-full justify-center gap-2"
                    variant={provider === 'google' ? 'default' : 'outline'}
                    disabled={Boolean(loadingProvider)}
                    onClick={() => {
                      void runOAuthRedirect(provider);
                    }}
                  >
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : PROVIDER_ICON[provider] || <ShieldCheck className="h-4 w-4" />}
                    {mode === 'register' ? `Crear con ${label}` : `Ingresar con ${label}`}
                  </Button>
                );
              })}
            </div>
          ) : null}

          {mode === 'register' ? (
            <SignUpButton mode="modal">
              <Button type="button" variant={socialProviders.length ? 'secondary' : 'default'} className="h-11 w-full justify-center gap-2">
                <Mail className="h-4 w-4" />
                {emailFallbackLabel}
              </Button>
            </SignUpButton>
          ) : (
            <SignInButton mode="modal">
              <Button type="button" variant={socialProviders.length ? 'secondary' : 'default'} className="h-11 w-full justify-center gap-2">
                <Mail className="h-4 w-4" />
                {emailFallbackLabel}
              </Button>
            </SignInButton>
          )}

          {mode === 'register' ? (
            <SignInButton mode="modal">
              <Button type="button" variant="ghost" className="h-10 w-full justify-center gap-2 text-muted-foreground">
                <ShieldCheck className="h-4 w-4" />
                {secondaryLabel}
              </Button>
            </SignInButton>
          ) : (
            <SignUpButton mode="modal">
              <Button type="button" variant="ghost" className="h-10 w-full justify-center gap-2 text-muted-foreground">
                <ShieldCheck className="h-4 w-4" />
                {secondaryLabel}
              </Button>
            </SignUpButton>
          )}
          {oauthError ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {oauthError}
            </p>
          ) : null}
        </div>
      </SignedOut>
      <SignedIn>
        <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-3 py-2">
          <span className="text-sm font-medium text-foreground">Cuenta conectada</span>
          <UserButton afterSignOutUrl="/login" />
        </div>
      </SignedIn>
    </div>
  );
};

const ClerkAuthButtons: React.FC<ClerkAuthButtonsProps> = (props) => {
  const clerkRuntime = useClerkRuntime();

  if (!clerkRuntime.enabled) return null;

  return <ClerkAuthButtonsInner {...props} clerkRuntime={clerkRuntime} />;
};

export default ClerkAuthButtons;

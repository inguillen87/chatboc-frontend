import React from 'react';
import { GoogleLogin, CredentialResponse } from '@react-oauth/google';
import { ApiError, resolveTenantSlug } from '@/utils/api';
import { loginWithGoogle } from '@/api/v2/auth';
import { safeLocalStorage } from '@/utils/safeLocalStorage';
import { useUser } from '@/hooks/useUser';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { broadcastAuthTokenToHost } from '@/utils/postMessage';
import { GOOGLE_CLIENT_ID } from '@/env';
import { useClerkRuntime } from '@/components/auth/ClerkRuntimeContext';

interface LoginResponse {
  id: number;
  token: string;
  name: string;
  email: string;
  plan?: string;
  tipo_chat?: 'pyme' | 'municipio';
  widget_icon_url?: string;
  widget_animation?: string;
}

interface Props extends React.HTMLAttributes<HTMLDivElement> {
  onLoggedIn?: (role?: string) => void;
  hideWhenClerkEnabled?: boolean;
  disabled?: boolean;
}

const GoogleLoginButton: React.FC<Props> = ({
  onLoggedIn,
  hideWhenClerkEnabled = true,
  disabled = false,
  className,
  ...props
}) => {
  const { refreshUser } = useUser();
  const navigate = useNavigate();
  const clerkRuntime = useClerkRuntime();
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const clerkOwnsGoogleLogin =
    clerkRuntime.enabled ||
    Boolean(
      clerkRuntime.configurationWarnings?.some(
        (warning) => warning.code === 'production_origin_mismatch',
      ),
    );

  // A live Clerk instance intentionally refuses non-canonical Preview hosts.
  // Do not silently replace it there with an unrelated legacy OAuth client:
  // that produces a broken Google button and can cross authentication realms.
  if (hideWhenClerkEnabled && clerkOwnsGoogleLogin) {
    return null;
  }

  if (!GOOGLE_CLIENT_ID) {
    console.warn('[GoogleLoginButton] VITE_GOOGLE_CLIENT_ID is missing. Google login is disabled.');
    return null;
  }

  const handleSuccess = async (cred: CredentialResponse) => {
    if (disabled || isSubmitting) return;
    if (!cred || !cred.credential) return;
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      const data = await loginWithGoogle({ id_token: cred.credential });
      safeLocalStorage.setItem('authToken', data.token);
      safeLocalStorage.setItem('chatAuthToken', data.token);
      broadcastAuthTokenToHost(data.token, resolveTenantSlug(), 'google-login');
      await refreshUser();
      if (onLoggedIn) onLoggedIn(); else navigate('/perfil');
    } catch (err) {
      if (err instanceof ApiError) {
        console.error('Google login error:', err.body?.error || err.message);
      } else {
        console.error('Google login error');
      }
      setErrorMessage('No pudimos completar el acceso con Google. Probá nuevamente o ingresá con email.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className={cn('grid justify-items-center gap-2', (disabled || isSubmitting) && 'pointer-events-none opacity-50', className)}
      aria-disabled={disabled || isSubmitting || undefined}
      aria-busy={isSubmitting || undefined}
      {...props}
    >
      <GoogleLogin
        onSuccess={handleSuccess}
        onError={() => {
          console.error('Google OAuth error');
          setErrorMessage('Google no pudo iniciar la sesión. Probá nuevamente o ingresá con email.');
        }}
        useOneTap={false}
        locale="es"
        width={300}
        text="continue_with"
      />
      {errorMessage ? (
        <p role="alert" className="max-w-sm text-center text-xs text-destructive">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
};

export default GoogleLoginButton;

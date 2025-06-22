import React from 'react';
import { Button } from '@/components/ui/button';
import GoogleIcon from './GoogleIcon';
import { useGoogleLogin, CredentialResponse } from '@react-oauth/google';
import { apiFetch, ApiError } from '@/utils/api';
import { safeLocalStorage } from '@/utils/safeLocalStorage';
import { useUser } from '@/hooks/useUser';
import { useNavigate } from 'react-router-dom';
import { enforceTipoChatForRubro } from '@/utils/tipoChat';
import { APP_TARGET } from '@/config';

interface LoginResponse {
  id: number;
  token: string;
  name: string;
  email: string;
  plan?: string;
  tipo_chat?: 'pyme' | 'municipio';
}

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label?: string;
  onLoggedIn?: () => void;
}

const GoogleLoginButton: React.FC<Props> = ({
  label = 'Continuar con Google',
  onLoggedIn,
  className,
  ...props
}) => {
  const { setUser } = useUser();
  const navigate = useNavigate();

  const login = useGoogleLogin({
    onSuccess: async (token: CredentialResponse) => {
      if (!token || !token.credential) return;
      try {
        const data = await apiFetch<LoginResponse>('/auth/google-login', {
          method: 'POST',
          body: { id_token: token.credential },
          sendAnonId: true,
          sendEntityToken: true,
        });
        safeLocalStorage.setItem('authToken', data.token);
        let rubro = '';
        let tipoChat = data.tipo_chat as 'pyme' | 'municipio' | undefined;
        try {
          const me = await apiFetch<any>('/me');
          rubro = me?.rubro?.toLowerCase() || '';
          if (!tipoChat && me?.tipo_chat) tipoChat = me.tipo_chat;
        } catch {
          /* ignore */
        }
        const finalTipo = enforceTipoChatForRubro(
          (tipoChat || APP_TARGET) as 'pyme' | 'municipio',
          rubro || null,
        );
        const profile = {
          id: data.id,
          name: data.name,
          email: data.email,
          token: data.token,
          plan: data.plan || 'free',
          rubro,
          tipo_chat: finalTipo,
        };
        safeLocalStorage.setItem('user', JSON.stringify(profile));
        setUser(profile);
        if (onLoggedIn) onLoggedIn(); else navigate('/perfil');
      } catch (err) {
        if (err instanceof ApiError) {
          console.error('Google login error:', err.body?.error || err.message);
        } else {
          console.error('Google login error');
        }
      }
    },
    onError: () => {
      console.error('Google OAuth popup closed');
    },
    flow: 'implicit',
  });

  return (
    <Button
      type="button"
      variant="outline"
      className={`w-full flex items-center justify-center ${className || ''}`}
      onClick={() => login()}
      {...props}
    >
      <GoogleIcon className="w-4 h-4 mr-2" />
      {label}
    </Button>
  );
};

export default GoogleLoginButton;

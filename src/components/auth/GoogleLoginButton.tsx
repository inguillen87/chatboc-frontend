import React from 'react';
import { GoogleLogin, CredentialResponse } from '@react-oauth/google';
import { apiFetch, ApiError } from '@/utils/api';
import { safeLocalStorage } from '@/utils/safeLocalStorage';
import { useUser } from '@/hooks/useUser';
import { useNavigate } from 'react-router-dom';
import { enforceTipoChatForRubro } from '@/utils/tipoChat';
import { APP_TARGET } from '@/config';
import { cn } from '@/lib/utils';

interface LoginResponse {
  id: number;
  token: string;
  name: string;
  email: string;
  plan?: string;
  tipo_chat?: 'pyme' | 'municipio';
}

interface Props extends React.HTMLAttributes<HTMLDivElement> {
  onLoggedIn?: () => void;
}

const GoogleLoginButton: React.FC<Props> = ({
  onLoggedIn,
  className,
  ...props
}) => {
  const { setUser } = useUser();
  const navigate = useNavigate();

  const handleSuccess = async (cred: CredentialResponse) => {
    if (!cred || !cred.credential) return;
    try {
      const data = await apiFetch<LoginResponse>('/google-login', {
        method: 'POST',
        body: { id_token: cred.credential },
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
  };

  return (
    <div className={cn('flex justify-center', className)} {...props}>
      <GoogleLogin
        onSuccess={handleSuccess}
        onError={() => console.error('Google OAuth popup closed')}
        useOneTap={false}
        locale="es"
        width={300}
        text="continue_with"
      />
    </div>
  );
};

export default GoogleLoginButton;

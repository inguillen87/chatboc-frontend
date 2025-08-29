import React from 'react';
import { GoogleLogin, CredentialResponse } from '@react-oauth/google';
import { apiFetch, ApiError } from '@/utils/api';
import { safeLocalStorage } from '@/utils/safeLocalStorage';
import { useUser } from '@/hooks/useUser';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

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
  onLoggedIn?: () => void;
}

const GoogleLoginButton: React.FC<Props> = ({
  onLoggedIn,
  className,
  ...props
}) => {
  const { refreshUser } = useUser();
  const navigate = useNavigate();

  const handleSuccess = async (cred: CredentialResponse) => {
    console.log('Google login success:', cred);
    if (!cred || !cred.credential) return;
    try {
      const data = await apiFetch<LoginResponse>('/google-login', {
        method: 'POST',
        body: { id_token: cred.credential },
        sendAnonId: true,
        sendEntityToken: true,
      });
      safeLocalStorage.setItem('authToken', data.token);
      await refreshUser();
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
        onError={(err) => console.error('Google OAuth error:', err)}
        useOneTap={false}
        locale="es"
        width={300}
        text="continue_with"
      />
    </div>
  );
};

export default GoogleLoginButton;

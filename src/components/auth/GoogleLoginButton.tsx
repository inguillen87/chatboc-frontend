import React from 'react';
import GoogleIcon from './GoogleIcon';
import { Button } from '@/components/ui/button';

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label?: string;
  authUrl?: string;
}

const defaultUrl =
  import.meta.env.VITE_GOOGLE_AUTH_URL ||
  `${import.meta.env.VITE_API_URL || '/api'}/auth/google`;

const GoogleLoginButton: React.FC<Props> = ({
  label = 'Continuar con Google',
  authUrl = defaultUrl,
  className,
  ...props
}) => (
  <Button
    type="button"
    variant="outline"
    className={`w-full flex items-center justify-center ${className || ''}`}
    onClick={() => {
      window.location.href = authUrl;
    }}
    {...props}
  >
    <GoogleIcon className="w-4 h-4" />
    {label}
  </Button>
);

export default GoogleLoginButton;

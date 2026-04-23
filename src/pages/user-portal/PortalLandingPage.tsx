import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useWidgetSessionStore } from '@/stores';
import { useTenant } from '@/context/TenantContext';
import { Loader2 } from 'lucide-react';

export const PortalLandingPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { currentSlug } = useTenant();
  const setOmnichannelIdentity = useWidgetSessionStore(state => state.setOmnichannelIdentity);
  const [status, setStatus] = useState('Verificando acceso...');

  useEffect(() => {
    // FE-09: Entrada al portal desde WhatsApp y widget (contextual session linking)
    const contactKey = searchParams.get('ck') || searchParams.get('contact_key');
    const conversationId = searchParams.get('cid') || searchParams.get('conversation_id');
    const returnTo = searchParams.get('return_to');

    if (contactKey || conversationId) {
       setStatus('Enlazando sesión segura...');
       setOmnichannelIdentity(contactKey, conversationId);
    }

    // Give it a brief delay for UX feel, then redirect to the actual destination or dashboard
    const timer = setTimeout(() => {
       if (returnTo && returnTo.startsWith('/')) {
          navigate(returnTo, { replace: true });
       } else if (currentSlug) {
          navigate(`/${currentSlug}/portal/dashboard`, { replace: true });
       } else {
          navigate('/portal/dashboard', { replace: true });
       }
    }, 800);

    return () => clearTimeout(timer);
  }, [searchParams, navigate, currentSlug, setOmnichannelIdentity]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background">
       <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
       <h1 className="text-lg font-medium text-foreground">{status}</h1>
       <p className="text-sm text-muted-foreground mt-2 max-w-sm text-center">
         Estamos preparando tu portal personalizado.
       </p>
    </div>
  );
};

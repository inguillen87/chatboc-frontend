import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useWidgetSessionStore } from '@/stores';
import { useTenant } from '@/context/TenantContext';
import { Loader2 } from 'lucide-react';
import { buildTenantPath } from '@/utils/tenantPaths';

export const PortalLandingPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { currentSlug } = useTenant();
  const setOmnichannelIdentity = useWidgetSessionStore((state) => state.setOmnichannelIdentity);
  const [status, setStatus] = useState('Verificando tu acceso...');

  useEffect(() => {
    const contactKey = searchParams.get('ck') || searchParams.get('contact_key');
    const conversationId = searchParams.get('cid') || searchParams.get('conversation_id');
    const returnTo = searchParams.get('return_to');

    if (contactKey || conversationId) {
      setStatus('Conectando tu historial de atencion...');
      setOmnichannelIdentity(contactKey, conversationId);
    }

    const timer = setTimeout(() => {
      if (returnTo && returnTo.startsWith('/')) {
        navigate(returnTo, { replace: true });
      } else if (currentSlug) {
        navigate(buildTenantPath('/portal/dashboard', currentSlug), { replace: true });
      } else {
        navigate('/portal/dashboard', { replace: true });
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [searchParams, navigate, currentSlug, setOmnichannelIdentity]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
      <Loader2 className="mb-4 h-8 w-8 animate-spin text-primary" />
      <h1 className="text-lg font-medium text-foreground">{status}</h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        En unos segundos vas a ver tus pedidos, reclamos, mensajes e historial disponible para esta organizacion.
      </p>
    </div>
  );
};

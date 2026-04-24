import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getTenantPublicInfoFlexible } from '@/api/tenant';
import { useTenant } from '@/context/TenantContext';
import { Loader2 } from 'lucide-react';

const TokenRedirectWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentSlug, setTenantSlug } = useTenant();
  const [isResolving, setIsResolving] = useState(false);

  useEffect(() => {
    // Only intervene if we have a widgetToken but no tenant in the path
    const searchParams = new URLSearchParams(location.search);
    const widgetToken = searchParams.get('widgetToken') || searchParams.get('ownerToken');
    const hasSlugInPath = location.pathname.split('/').length > 2 && !['cart', 'productos'].includes(location.pathname.split('/')[1]);

    if (widgetToken && !currentSlug && !hasSlugInPath) {
      setIsResolving(true);
      getTenantPublicInfoFlexible(null, widgetToken)
        .then((info) => {
          if (info.slug) {
            setTenantSlug(info.slug);
            // Construct the new path with the slug
            // e.g. /productos -> /:slug/productos
            // We need to be careful with routes that might already be "correct"
            const currentPath = location.pathname;
            const newPath = `/${info.slug}${currentPath.startsWith('/') ? currentPath : '/' + currentPath}`;

            // Keep existing query params but remove the token if we want to clean up?
            // Better to keep it for consistency or remove it if no longer needed.
            // Let's keep params for now.
            navigate(`${newPath}${location.search}`, { replace: true });
          }
        })
        .catch((err) => {
          console.warn('Could not resolve tenant from token in URL', err);
        })
        .finally(() => {
          setIsResolving(false);
        });
    }
  }, [location, currentSlug, navigate, setTenantSlug]);

  if (isResolving) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Conectando con el portal...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default TokenRedirectWrapper;

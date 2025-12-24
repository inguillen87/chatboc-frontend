import React from 'react';
import { useTenant } from '@/context/TenantContext';
import { useUser } from '@/hooks/useUser';
import IntegracionesPage from '@/pages/pyme/integraciones/IntegracionesPage';
import MunicipalNotificationSettings from '@/pages/municipal/MunicipalNotificationSettings';

const SmartNotificationsWrapper: React.FC = () => {
  const { tenant } = useTenant();
  const { user } = useUser();

  const isPyme =
    tenant?.tipo === 'pyme' ||
    user?.tipo_chat === 'pyme' ||
    tenant?.slug?.startsWith('demo-pyme') ||
    false;

  if (isPyme) {
    return <IntegracionesPage />;
  }

  return <MunicipalNotificationSettings />;
};

export default SmartNotificationsWrapper;

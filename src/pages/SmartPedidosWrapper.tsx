import React from 'react';
import { useTenant } from '@/context/TenantContext';
import { useUser } from '@/hooks/useUser';
import PedidosPage from '@/pages/PedidosPage'; // Classic/Municipal
import PymePedidosPage from '@/pages/pyme/pedidos/PedidosPage'; // New/Pyme

const SmartPedidosWrapper: React.FC = () => {
  const { tenant } = useTenant();
  const { user } = useUser();

  // Determine context.
  // Priority:
  // 1. Tenant info (if accessed via slug)
  // 2. User info (fallback if accessing root /pedidos)

  const isPyme =
    tenant?.tipo === 'pyme' ||
    user?.tipo_chat === 'pyme' ||
    tenant?.slug?.startsWith('demo-pyme') || // Fallback for specific demos if type is missing
    false;

  // Render accordingly
  if (isPyme) {
    return <PymePedidosPage />;
  }

  // Default to Classic/Municipal view
  return <PedidosPage />;
};

export default SmartPedidosWrapper;

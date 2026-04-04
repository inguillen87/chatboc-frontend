import { WifiOff } from 'lucide-react';

import { useNetworkStatus } from '@/hooks/useNetworkStatus';

export const AppShellStatusBar = () => {
  const { isOnline } = useNetworkStatus();

  if (isOnline) {
    return null;
  }

  return (
    <div className="sticky top-0 z-40 flex items-center justify-center gap-2 bg-amber-500 px-3 py-2 text-xs font-medium text-amber-950">
      <WifiOff className="h-4 w-4" />
      <span>Sin conexión. Algunas vistas pueden mostrar datos previos.</span>
    </div>
  );
};

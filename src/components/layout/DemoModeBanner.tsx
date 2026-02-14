import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { safeLocalStorage } from '@/utils/safeLocalStorage';

const DEMO_MODE_KEY = 'demoMode';

const DemoModeBanner = () => {
  const [isDemoMode, setIsDemoMode] = useState(false);

  useEffect(() => {
    setIsDemoMode(safeLocalStorage.getItem(DEMO_MODE_KEY) === 'true');
  }, []);

  if (!isDemoMode) return null;

  const handleReset = () => {
    safeLocalStorage.removeItem(DEMO_MODE_KEY);
    safeLocalStorage.removeItem('authToken');
    safeLocalStorage.removeItem('tenantId');
    safeLocalStorage.removeItem('tenantSlug');
    window.location.href = '/login';
  };

  return (
    <div className="w-full bg-amber-100 text-amber-900 border-b border-amber-200">
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between gap-3 text-sm">
        <span>Estás en demo</span>
        <Button size="sm" variant="outline" onClick={handleReset}>
          Reset demo
        </Button>
      </div>
    </div>
  );
};

export default DemoModeBanner;

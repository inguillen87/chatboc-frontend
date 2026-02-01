import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTenant } from '@/context/TenantContext';
import CustomerHistoryPanel from '@/components/admin/CustomerHistoryPanel';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

const ClientDetailPage = () => {
  const { contactId } = useParams<{ contactId: string }>();
  const { currentSlug } = useTenant();
  const navigate = useNavigate();

  if (!currentSlug || !contactId) return null;

  return (
    <div className="container mx-auto p-6 space-y-6 h-[calc(100vh-80px)] flex flex-col">
      <div className="flex items-center gap-4 flex-none">
        <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Volver
        </Button>
        <h1 className="text-2xl font-bold">Detalle del Cliente</h1>
      </div>

      <div className="flex-1 min-h-0 border rounded-xl overflow-hidden bg-background shadow-sm">
          <CustomerHistoryPanel
            customerId={contactId}
            tenantSlug={currentSlug}
          />
      </div>
    </div>
  );
};

export default ClientDetailPage;

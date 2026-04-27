import React from 'react';
import { Link } from 'react-router-dom';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useEducationShellData } from '@/hooks/useEducationShellData';

interface EducationFamilyAccessGateProps {
  children: React.ReactNode;
}

const VERIFIED_STATES = new Set(['verified', 'staff']);

export default function EducationFamilyAccessGate({ children }: EducationFamilyAccessGateProps) {
  const { data, isLoading } = useEducationShellData('family');
  const verificationState = data?.family_context?.verification_state ?? 'anonymous';
  const gateCopy = data?.family_context?.access_gate;
  const loadingLabel = gateCopy?.loading_label || 'Validando perfil familiar...';
  const title = gateCopy?.title || 'Verificación requerida';
  const description = gateCopy?.description || 'Necesitás validar tu vínculo familiar para acceder a la información protegida.';
  const ctaLabel = gateCopy?.cta_label || 'Continuar verificación';
  const ctaPath = gateCopy?.cta_path || '/educacion/familia/verificacion';

  if (isLoading) {
    return <div className="p-4 text-sm text-muted-foreground">{loadingLabel}</div>;
  }

  if (VERIFIED_STATES.has(verificationState)) {
    return <>{children}</>;
  }

  return (
    <Alert>
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="space-y-3">
        <p>{description}</p>
        <div>
          <Button asChild size="sm">
            <Link to={ctaPath}>{ctaLabel}</Link>
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}

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

  if (isLoading) {
    return <div className="p-4 text-sm text-muted-foreground">Validando perfil familiar...</div>;
  }

  if (VERIFIED_STATES.has(verificationState)) {
    return <>{children}</>;
  }

  return (
    <Alert>
      <AlertTitle>Verificación requerida</AlertTitle>
      <AlertDescription className="space-y-3">
        <p>Para acceder a datos de asistencia y documentos, necesitás validar tu vínculo familiar.</p>
        <div>
          <Button asChild size="sm">
            <Link to="/educacion/familia/verificacion">Continuar verificación</Link>
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}

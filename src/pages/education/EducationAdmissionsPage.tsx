import React from 'react';
import { RefreshCw } from 'lucide-react';
import { useParams } from 'react-router-dom';

import { ViewState } from '@/components/app-shell/ViewState';
import EducationShell from '@/components/education/EducationShell';
import { Button } from '@/components/ui/button';
import { useTenant } from '@/context/TenantContext';
import InterviewInboxPanel from '@/features/interviews/InterviewInboxPanel';
import InterviewResumeCard from '@/features/interviews/InterviewResumeCard';
import { normalizeInterviewSessionId } from '@/features/interviews/interviewsApi';
import { useInterviewInbox } from '@/features/interviews/useInterviewInbox';
import { useInterviewResume } from '@/features/interviews/useInterviewResume';
import { getErrorMessage } from '@/utils/api';

export default function EducationAdmissionsPage() {
  const params = useParams<{ tenant?: string; sessionId?: string }>();
  const { currentSlug, isLoadingTenant, tenantError } = useTenant();
  const tenantSlug = (params.tenant || currentSlug || '').trim();
  const rawSessionId = params.sessionId ?? null;
  const sessionId = normalizeInterviewSessionId(rawSessionId);
  const resumeQuery = useInterviewResume(sessionId, tenantSlug);
  const inboxQuery = useInterviewInbox(tenantSlug, { enabled: rawSessionId === null });

  let content: React.ReactNode;

  if (!tenantSlug) {
    content = isLoadingTenant ? (
      <ViewState
        status="loading"
        description="Resolviendo el espacio institucional de la entrevista."
      />
    ) : (
      <ViewState
        status="error"
        title="Falta el espacio institucional"
        description={tenantError || 'La reanudación requiere un tenant explícito en la ruta.'}
      />
    );
  } else if (rawSessionId === null && inboxQuery.isLoading) {
    content = (
      <ViewState
        status="loading"
        description="Cargando entrevistas, progreso y evidencia verificable."
      />
    );
  } else if (rawSessionId === null && inboxQuery.isError) {
    content = (
      <ViewState
        status="error"
        description={getErrorMessage(
          inboxQuery.error,
          'No se pudo recuperar la bandeja de entrevistas.',
        )}
        action={
          <Button type="button" variant="outline" onClick={() => void inboxQuery.refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Reintentar
          </Button>
        }
      />
    );
  } else if (rawSessionId === null && inboxQuery.data?.inbox.items.length === 0) {
    content = (
      <ViewState
        status="empty"
        title={inboxQuery.data.inbox.presentation.empty_title}
        description={inboxQuery.data.inbox.presentation.empty_description}
        action={
          <Button type="button" variant="outline" onClick={() => void inboxQuery.refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Actualizar
          </Button>
        }
      />
    );
  } else if (rawSessionId === null && inboxQuery.data) {
    content = (
      <InterviewInboxPanel
        inbox={inboxQuery.data.inbox}
        tenantSlug={tenantSlug}
        isRefreshing={inboxQuery.isFetching}
        onRefresh={() => inboxQuery.refetch()}
      />
    );
  } else if (rawSessionId === null) {
    content = (
      <ViewState
        status="error"
        description="El backend no devolvió una bandeja compatible para este espacio."
      />
    );
  } else if (!sessionId) {
    content = (
      <ViewState
        status="error"
        title="Sesión de entrevista inválida"
        description="El identificador de sesión debe ser un entero positivo."
      />
    );
  } else if (resumeQuery.isLoading) {
    content = (
      <ViewState
        status="loading"
        description="Verificando el checkpoint de la entrevista."
      />
    );
  } else if (resumeQuery.isError) {
    content = (
      <ViewState
        status="error"
        description={getErrorMessage(
          resumeQuery.error,
          'No se pudo recuperar el checkpoint de la entrevista.',
        )}
        action={
          <Button
            type="button"
            variant="outline"
            onClick={() => void resumeQuery.refetch()}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Reintentar
          </Button>
        }
      />
    );
  } else if (resumeQuery.data) {
    content = (
      <InterviewResumeCard
        resume={resumeQuery.data.resume}
        isRefreshing={resumeQuery.isFetching}
        onRefresh={() => void resumeQuery.refetch()}
      />
    );
  } else {
    content = (
      <ViewState
        status="error"
        description="El backend no devolvió un checkpoint compatible para esta sesión."
      />
    );
  }

  return <EducationShell persona="staff">{content}</EducationShell>;
}

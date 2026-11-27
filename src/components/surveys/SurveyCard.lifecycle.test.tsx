import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SurveyCard } from '@/components/surveys/SurveyCard';
import type { SurveyAdmin, SurveyAdminLifecycle } from '@/types/encuestas';

const lifecycle = (
  phase: SurveyAdminLifecycle['phase'],
  capabilities: Partial<SurveyAdminLifecycle['capabilities']>,
  instrumentKind: SurveyAdminLifecycle['instrument_kind'] = 'survey',
): SurveyAdminLifecycle => {
  const canPublish = capabilities.can_publish ?? false;
  const canClose = capabilities.can_close ?? false;
  return {
    contract_version: 'surveys.admin_lifecycle.v1',
    instrument_kind: instrumentKind,
    phase,
    persisted_state: phase === 'draft' ? 'borrador' : phase === 'closed' ? 'cerrada' : 'publicada',
    accepts_responses: phase === 'collecting' || phase === 'live_voting',
    schedule: {
      opens_at: '2026-08-01T10:00:00Z',
      closes_at: '2026-08-20T10:00:00Z',
      evaluated_at: '2026-08-02T10:00:00Z',
    },
    participation: {
      responses: 12,
      unique_participants: 10,
      responses_last_24h: 3,
      last_response_at: '2026-08-02T09:30:00Z',
      eligible_population: null,
      participation_rate: null,
      abstentions: null,
      denominator_status: {
        available: false,
        reason_code: 'survey_eligible_population_not_configured',
      },
    },
    capabilities: {
      can_publish: canPublish,
      can_close: canClose,
      can_delete: capabilities.can_delete ?? false,
      can_share: capabilities.can_share ?? false,
      can_view_results: capabilities.can_view_results ?? true,
    },
    actions: {
      publish: {
        method: 'POST',
        endpoint: '/api/v2/surveys/41/publish',
        enabled: canPublish,
        disabled_reason_code: canPublish ? null : 'survey_not_draft',
      },
      close: {
        method: 'POST',
        endpoint: '/api/v2/surveys/41/close',
        enabled: canClose,
        confirmation_required: true,
        irreversible: true,
        disabled_reason_code: canClose ? null : 'survey_not_published',
      },
    },
  };
};

const survey = (adminLifecycle: SurveyAdminLifecycle): SurveyAdmin => ({
  id: 41,
  slug: 'consulta-demo',
  slug_publico: 'consulta-demo',
  url_publica: 'https://chatboc.test/e/consulta-demo',
  titulo: 'Consulta de la organización',
  descripcion: 'Descripción',
  tipo: adminLifecycle.instrument_kind === 'voting' ? 'votacion' : 'opinion',
  estado: adminLifecycle.persisted_state as SurveyAdmin['estado'],
  inicio_at: '2026-08-01T10:00:00Z',
  fin_at: '2026-08-20T10:00:00Z',
  politica_unicidad: 'libre',
  preguntas: [],
  admin_lifecycle: adminLifecycle,
});

const baseProps = {
  onEdit: vi.fn(),
  onAnalytics: vi.fn(),
};

describe('SurveyCard lifecycle actions', () => {
  it('withdraws public links when a persisted published instrument fails public readiness', () => {
    const item = survey(lifecycle('live_voting', { can_share: true }, 'voting'));
    item.public_access = {
      contract_version: 'surveys.public_access.v1', allowed: false,
      reason_code: 'survey_jurisdiction_unverified', next_action: 'review_scope',
    };
    render(<SurveyCard {...baseProps} survey={item} onCopyLink={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Copiar enlace' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Ver en vivo' })).toBeNull();
    expect(screen.getByText('Pendiente de validación')).toBeVisible();
    expect(screen.queryByText('Publicada')).not.toBeInTheDocument();
  });

  it('presents the card as an article with one type and one status', () => {
    render(
      <SurveyCard
        {...baseProps}
        survey={survey(lifecycle('draft', { can_delete: true, can_view_results: false }))}
      />,
    );

    const article = screen.getByRole('article', { name: 'Consulta de la organización' });
    expect(within(article).getAllByText('Encuesta')).toHaveLength(1);
    expect(within(article).getAllByText('Borrador')).toHaveLength(1);
  });

  it('keeps the voting type for legacy rows without a lifecycle contract', () => {
    const item = survey(lifecycle('draft', { can_delete: true, can_view_results: false }));
    delete item.admin_lifecycle;
    item.tipo = 'votacion';
    item.estado = 'borrador';

    render(<SurveyCard {...baseProps} survey={item} />);

    const article = screen.getByRole('article', { name: 'Consulta de la organización' });
    expect(within(article).getAllByText('Votación')).toHaveLength(1);
    expect(within(article).getAllByText('Borrador')).toHaveLength(1);
  });

  it('shows publish only for a publishable draft', () => {
    render(
      <SurveyCard
        {...baseProps}
        survey={survey(lifecycle('draft', { can_publish: true, can_delete: true }))}
        onPublish={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Publicar' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Cerrar participación' })).toBeNull();
  });

  it.each([
    ['closed', lifecycle('closed', { can_publish: false, can_close: false })],
    ['governed draft', lifecycle('draft', { can_publish: false, can_close: false })],
  ])('does not expose invalid mutations for %s', (_label, adminLifecycle) => {
    render(
      <SurveyCard
        {...baseProps}
        survey={survey(adminLifecycle)}
        onPublish={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Publicar' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Cerrar participación' })).toBeNull();
  });

  it('explains why a draft cannot be published without exposing the mutation', () => {
    const adminLifecycle = lifecycle('draft', { can_publish: false });
    adminLifecycle.actions.publish.disabled_reason_code = 'survey_questions_required';

    render(
      <SurveyCard
        {...baseProps}
        survey={survey(adminLifecycle)}
        onPublish={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Publicar' })).toBeNull();
    expect(screen.getByTestId('publish-disabled-reason')).toHaveTextContent(
      'Agregá al menos una pregunta antes de publicar.',
    );
  });

  it('keeps the institutional publication reason with the card actions', () => {
    const publicationNotice = 'Para publicar, primero hay que verificar los datos institucionales de la organización.';

    render(
      <SurveyCard
        {...baseProps}
        survey={survey(lifecycle('draft', { can_publish: false, can_view_results: false }))}
        publicationNotice={publicationNotice}
      />,
    );

    const article = screen.getByRole('article', { name: 'Consulta de la organización' });
    expect(within(article).getByRole('status', { name: /Publicación bloqueada/ })).toHaveTextContent(publicationNotice);
    expect(within(article).getByRole('button', { name: 'Editar' })).toBeVisible();
    expect(within(article).queryByTestId('publish-disabled-reason')).not.toBeInTheDocument();
  });

  it('routes a governed draft to release review without exposing direct publication', () => {
    const adminLifecycle = lifecycle('draft', { can_publish: false, can_view_results: false });
    adminLifecycle.actions.publish.disabled_reason_code = 'survey_governance_release_required';
    adminLifecycle.actions.publish.next_action = 'Revisá la política, creá un release y aprobalo antes de publicar.';
    const item = survey(adminLifecycle);
    item.governance = { mode: 'governed_release', release_required: true };
    const onManageGovernance = vi.fn();
    const onPublish = vi.fn();

    render(
      <SurveyCard
        {...baseProps}
        survey={item}
        onPublish={onPublish}
        onManageGovernance={onManageGovernance}
      />,
    );

    expect(screen.getByTestId('publish-disabled-reason')).toHaveTextContent(
      'Completá la revisión y aprobación antes de publicar.',
    );
    expect(screen.queryByRole('button', { name: 'Publicar' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Revisar y publicar' }));
    expect(onManageGovernance).toHaveBeenCalledTimes(1);
    expect(onPublish).not.toHaveBeenCalled();
  });

  it('never renders a machine next_action as operator copy', () => {
    const adminLifecycle = lifecycle('draft', { can_publish: false });
    adminLifecycle.actions.publish.disabled_reason_code = 'survey_questions_required';
    adminLifecycle.actions.publish.next_action = 'add_required_question_then_retry';

    render(<SurveyCard {...baseProps} survey={survey(adminLifecycle)} />);

    expect(screen.getByTestId('publish-disabled-reason')).toHaveTextContent(
      'Agregá al menos una pregunta antes de publicar.',
    );
    expect(screen.queryByText('add_required_question_then_retry')).toBeNull();
  });

  it('explains jurisdiction conflicts without offering publication', () => {
    const adminLifecycle = lifecycle('draft', { can_publish: false });
    adminLifecycle.actions.publish.disabled_reason_code = 'survey_jurisdiction_binding_conflict';

    render(
      <SurveyCard
        {...baseProps}
        survey={survey(adminLifecycle)}
        onPublish={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Publicar' })).toBeNull();
    expect(screen.getByTestId('publish-disabled-reason')).toHaveTextContent(
      'Los datos institucionales de la encuesta no coinciden con esta organización.',
    );
  });

  it('shows four survey data fields in a responsive definition list without technical details', () => {
    render(
      <SurveyCard
        {...baseProps}
        survey={survey(lifecycle('collecting', { can_close: true, can_view_results: true }))}
      />,
    );

    const data = screen.getByLabelText('Datos de la encuesta');
    expect(data.tagName).toBe('DL');
    expect(data).toHaveClass('grid-cols-2', 'sm:grid-cols-4');
    expect(data.querySelectorAll('dt')).toHaveLength(4);
    expect(data).toHaveTextContent('Respuestas');
    expect(data).toHaveTextContent('Participantes');
    expect(data).toHaveTextContent('Últimas 24 h');
    expect(data).toHaveTextContent('Vigencia');
    expect(screen.getByRole('button', { name: 'Ver detalle' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Resultados' })).not.toBeInTheDocument();
    expect(screen.queryByText('Detalles y configuración')).not.toBeInTheDocument();
  });

  it('keeps card-level results concise without territorial or certification notices', () => {
    const item = survey(lifecycle('collecting', { can_close: true, can_view_results: true }));
    item.metricas = {
      total_respuestas: 12,
      participantes_unicos: 10,
      respuestas_ultimas_24h: 3,
      respuestas_con_coordenadas: 9,
      ultima_respuesta_at: '2026-08-02T09:30:00Z',
    };
    item.governance = { result_certified: false };

    render(<SurveyCard {...baseProps} survey={item} />);

    expect(screen.queryByText('Cobertura territorial')).not.toBeInTheDocument();
    expect(screen.queryByText('Alcance de resultados')).not.toBeInTheDocument();
    expect(screen.queryByText('Resultado no certificado')).not.toBeInTheDocument();
    expect(screen.queryByText('Detalles y configuración')).not.toBeInTheDocument();
    expect(screen.getAllByText(/1\/8\/2026/).length).toBeGreaterThan(0);
  });

  it('does not expose analytics when the lifecycle capability denies it', () => {
    render(
      <SurveyCard
        {...baseProps}
        survey={survey(lifecycle('draft', { can_view_results: false }))}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Ver detalle' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Editar' })).toBeTruthy();
  });

  it('requires an irreversible close confirmation and invokes it once', async () => {
    const onClose = vi.fn().mockResolvedValue(undefined);
    render(
      <SurveyCard
        {...baseProps}
        survey={survey(lifecycle('live_voting', { can_close: true, can_share: true }, 'voting'))}
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar participación' }));
    expect(screen.getByText(/respuestas nuevas serán rechazadas/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar definitivamente' }));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('disables other record actions while close is pending', () => {
    render(
      <SurveyCard
        {...baseProps}
        survey={survey(lifecycle('collecting', { can_close: true, can_share: true }))}
        onClose={vi.fn()}
        onCopyLink={vi.fn()}
        closing
      />,
    );

    expect(screen.getByRole('button', { name: 'Editar' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Ver detalle' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cerrando…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Copiar enlace' })).toBeDisabled();
    expect(screen.queryByRole('link', { name: 'Ver participación' })).toBeNull();
  });

  it('does not derive or add an unavailable abstention value to the compact card', () => {
    render(
      <SurveyCard
        {...baseProps}
        survey={survey(lifecycle('collecting', { can_close: true }))}
      />,
    );

    expect(screen.queryByText('Abstención')).not.toBeInTheDocument();
    expect(screen.queryByText('No disponible')).not.toBeInTheDocument();
  });
});

describe('SurveyCard concurrent operation controls',()=>{
  it('keeps other controls disabled while synthetic response generation is pending',()=>{
    const edit=vi.fn(),analytics=vi.fn(),close=vi.fn(),copy=vi.fn();
    render(<SurveyCard survey={survey(lifecycle('collecting',{can_close:true,can_share:true}))} onEdit={edit} onAnalytics={analytics} onClose={close} onCopyLink={copy} seeding/>);
    for(const name of ['Editar','Ver detalle','Cerrar participación','Copiar enlace']) expect(screen.getByRole('button',{name})).toBeDisabled();
    fireEvent.click(screen.getByRole('button',{name:'Editar'}));expect(edit).not.toHaveBeenCalled();
    expect(screen.queryByRole('link',{name:'Ver participación'})).not.toBeInTheDocument();
  });
  it('keeps the delete confirmation mounted while waiting and calls its handler only once',async()=>{
    let resolve!:()=>void;const pending=new Promise<void>(r=>{resolve=r;});const remove=vi.fn(()=>pending);
    render(<SurveyCard {...baseProps} survey={survey(lifecycle('draft',{can_delete:true}))} onDelete={remove}/>);
    fireEvent.click(screen.getByRole('button',{name:'Borrar borrador'}));
    const button=screen.getByRole('button',{name:'Eliminar'});fireEvent.click(button);fireEvent.click(button);
    expect(remove).toHaveBeenCalledTimes(1);expect(screen.getByRole('alertdialog')).toHaveTextContent('Consulta de la organización · ID 41');
    expect(screen.getByRole('button',{name:'Cancelar'})).toBeDisabled();
    resolve();await waitFor(()=>expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
  });
  it('keeps a failed deletion visible instead of closing its confirmation',async()=>{
    const remove=vi.fn().mockRejectedValue(new Error('Synthetic failure'));
    render(<SurveyCard {...baseProps} survey={survey(lifecycle('draft',{can_delete:true}))} onDelete={remove}/>);
    fireEvent.click(screen.getByRole('button',{name:'Borrar borrador'}));fireEvent.click(screen.getByRole('button',{name:'Eliminar'}));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se confirmó');expect(screen.getByRole('alertdialog')).toBeVisible();
    expect(remove).toHaveBeenCalledTimes(1);
  });
  it('does not offer deletion while another operation is reported as pending',()=>{
    const remove=vi.fn();render(<SurveyCard {...baseProps} survey={survey(lifecycle('draft',{can_delete:true,can_publish:true}))} onDelete={remove} onPublish={vi.fn()} seeding/>);
    expect(screen.getByRole('button',{name:'Borrar borrador'})).toBeDisabled();expect(screen.getByRole('button',{name:'Publicar'})).toBeDisabled();
  });
  it('does not turn an impossible coverage base into an apparently valid percentage',()=>{
    const data=survey(lifecycle('collecting',{}));data.metricas={total_respuestas:12,respuestas_con_coordenadas:20,respuestas_ultimas_24h:3,participantes_unicos:10};
    render(<SurveyCard {...baseProps} survey={data}/>);
    expect(screen.queryByText('Cobertura territorial')).not.toBeInTheDocument();expect(screen.queryByText(/100% · 20/)).not.toBeInTheDocument();
  });
  it('keeps the close confirmation pending and calls the handler only once',async()=>{
    let resolve!:()=>void;const close=vi.fn(()=>new Promise<void>(r=>{resolve=r;}));
    render(<SurveyCard {...baseProps} survey={survey(lifecycle('collecting',{can_close:true}))} onClose={close}/>);
    fireEvent.click(screen.getByRole('button',{name:'Cerrar participación'}));const button=screen.getByRole('button',{name:'Cerrar definitivamente'});
    fireEvent.click(button);fireEvent.click(button);expect(close).toHaveBeenCalledTimes(1);expect(screen.getByRole('button',{name:'Volver'})).toBeDisabled();
    resolve();await waitFor(()=>expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
  });
});

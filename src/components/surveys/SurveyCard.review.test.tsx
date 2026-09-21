import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SurveyCard } from './SurveyCard';
import { surveyCardFixture } from '../../../tests/fixtures/survey-card-actions';
afterEach(cleanup);
const handlers = () => ({ onEdit: vi.fn(), onAnalytics: vi.fn(), onClose: vi.fn(), onDelete: vi.fn() });

describe('survey snapshot and disabled controls review', () => {
  it.each([
    { politica_unicidad: 'dni' },
    { mostrar_resultados_envivo: true },
    { permitir_comentarios: true },
    { slug_publico: 'changed-public-link' },
    { recursos: { seed_ui: { button: 'Changed published label' } } },
  ])('invalidates old confirmation for any received survey field %#', change => {
    const survey = surveyCardFixture(), actions = handlers();
    const view = render(<SurveyCard tenantSlug="tenant-a" survey={survey} {...actions}/>);
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar participación' }));
    expect(screen.getByRole('alertdialog')).toBeVisible();
    view.rerender(<SurveyCard tenantSlug="tenant-a" survey={{ ...survey, ...change }} {...actions}/>);
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(actions.onClose).not.toHaveBeenCalled();
  });
  it('preserves a confirmation if only object key ordering changes', () => {
    const survey = surveyCardFixture(), actions = handlers();
    const view = render(<SurveyCard tenantSlug="tenant-a" survey={survey} {...actions}/>);
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar participación' }));
    const reordered = Object.fromEntries(Object.entries(survey).reverse()) as typeof survey;
    view.rerender(<SurveyCard tenantSlug="tenant-a" survey={reordered} {...actions}/>);
    expect(screen.getByRole('alertdialog')).toBeVisible();
  });
  it.each(['live', 'draft'] as const)('visibly disables unavailable actions during seeding: %s', mode => {
    const actions = handlers();
    render(<SurveyCard tenantSlug="tenant-a" survey={surveyCardFixture(mode)} {...actions} seeding/>);
    const name = mode === 'live' ? 'Cerrar participación' : 'Borrar borrador';
    const button = screen.getByRole('button', { name });
    expect(button).toBeDisabled(); fireEvent.click(button);
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(actions.onClose).not.toHaveBeenCalled(); expect(actions.onDelete).not.toHaveBeenCalled();
    expect(screen.queryByText('Cerrando…')).toBeNull();
    expect(screen.queryByText('Borrando…')).toBeNull();
  });
  it('discards a pending confirmation when another operation starts and does not restore it', () => {
    const survey = surveyCardFixture(), actions = handlers();
    const view = render(<SurveyCard tenantSlug="tenant-a" survey={survey} {...actions}/>);
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar participación' }));
    view.rerender(<SurveyCard tenantSlug="tenant-a" survey={survey} {...actions} seeding/>);
    expect(screen.queryByRole('alertdialog')).toBeNull();
    view.rerender(<SurveyCard tenantSlug="tenant-a" survey={survey} {...actions} seeding={false}/>);
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(actions.onClose).not.toHaveBeenCalled();
  });
});

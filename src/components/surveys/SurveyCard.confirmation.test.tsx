import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SurveyCard } from './SurveyCard';
import { surveyCardFixture } from '../../../tests/fixtures/survey-card-actions';
afterEach(cleanup);
const base = { onEdit: vi.fn(), onAnalytics: vi.fn(), tenantSlug: 'tenant-a' };
const deferred = () => { let resolve!: () => void; const promise = new Promise<void>(r => { resolve = r; }); return { promise, resolve }; };

describe('survey confirmation identity and local operation state', () => {
  it('cancels a confirmation without requesting a close', () => {
    const close = vi.fn(); render(<SurveyCard {...base} survey={surveyCardFixture()} onClose={close}/>);
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar participación' }));
    fireEvent.click(screen.getByRole('button', { name: 'Volver' }));
    expect(screen.queryByRole('alertdialog')).toBeNull(); expect(close).not.toHaveBeenCalled();
  });
  it('does not carry a dialog through a tenant A-B-A change', () => {
    const survey = surveyCardFixture(), close = vi.fn();
    const view = render(<SurveyCard {...base} survey={survey} onClose={close}/>);
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar participación' }));
    view.rerender(<SurveyCard {...base} tenantSlug="tenant-b" survey={survey} onClose={close}/>);
    expect(screen.queryByRole('alertdialog')).toBeNull();
    view.rerender(<SurveyCard {...base} survey={survey} onClose={close}/>);
    expect(screen.queryByRole('alertdialog')).toBeNull(); expect(close).not.toHaveBeenCalled();
  });
  it('requires a new confirmation after the instrument changes', () => {
    const survey = surveyCardFixture(), close = vi.fn();
    const view = render(<SurveyCard {...base} survey={survey} onClose={close}/>);
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar participación' }));
    view.rerender(<SurveyCard {...base} survey={{ ...survey, id: 302 }} onClose={close}/>);
    expect(screen.queryByRole('alertdialog')).toBeNull(); expect(close).not.toHaveBeenCalled();
  });
  it('invalidates a delete dialog after its displayed content changes', () => {
    const survey = surveyCardFixture('draft'), remove = vi.fn();
    const view = render(<SurveyCard {...base} survey={survey} onDelete={remove}/>);
    fireEvent.click(screen.getByRole('button', { name: 'Borrar borrador' }));
    view.rerender(<SurveyCard {...base} survey={{ ...survey, titulo: 'Contenido actualizado' }} onDelete={remove}/>);
    expect(screen.queryByRole('alertdialog')).toBeNull(); expect(remove).not.toHaveBeenCalled();
  });
  it('does not resurrect a confirmation when capability is removed and later restored', () => {
    const survey = surveyCardFixture(), close = vi.fn();
    const view = render(<SurveyCard {...base} survey={survey} onClose={close}/>);
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar participación' }));
    const denied = { ...survey, admin_lifecycle: { ...survey.admin_lifecycle!, capabilities: { ...survey.admin_lifecycle!.capabilities, can_close: false } } };
    view.rerender(<SurveyCard {...base} survey={denied} onClose={close}/>);
    expect(screen.queryByRole('alertdialog')).toBeNull();
    view.rerender(<SurveyCard {...base} survey={survey} onClose={close}/>);
    expect(screen.queryByRole('alertdialog')).toBeNull(); expect(close).not.toHaveBeenCalled();
  });
  it('keeps an identical refreshed snapshot from needlessly closing the dialog', () => {
    const survey = surveyCardFixture(), close = vi.fn();
    const view = render(<SurveyCard {...base} survey={survey} onClose={close}/>);
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar participación' }));
    view.rerender(<SurveyCard {...base} survey={structuredClone(survey)} onClose={close}/>);
    expect(screen.getByRole('alertdialog')).toBeVisible(); expect(close).not.toHaveBeenCalled();
  });
  it('exposes local close progress before the parent updates its flags', async () => {
    const work = deferred(), close = vi.fn(() => work.promise);
    render(<SurveyCard {...base} survey={surveyCardFixture()} onClose={close}/>);
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar participación' }));
    const confirm = screen.getByRole('button', { name: 'Cerrar definitivamente' });
    fireEvent.click(confirm); fireEvent.click(confirm);
    await waitFor(() => expect(close).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('button', { name: 'Cerrando…' })).toBeDisabled();
    await act(async () => { work.resolve(); await work.promise; });
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
  });
  it('exposes local deletion progress and coalesces a double click', async () => {
    const work = deferred(), remove = vi.fn(() => work.promise);
    render(<SurveyCard {...base} survey={surveyCardFixture('draft')} onDelete={remove}/>);
    fireEvent.click(screen.getByRole('button', { name: 'Borrar borrador' }));
    const confirm = screen.getByRole('button', { name: 'Eliminar', exact: true });
    fireEvent.click(confirm); fireEvent.click(confirm);
    await waitFor(() => expect(remove).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('button', { name: 'Borrando…' })).toBeDisabled();
    await act(async () => { work.resolve(); await work.promise; });
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
  });
});

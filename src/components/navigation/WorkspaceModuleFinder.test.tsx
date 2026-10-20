import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import WorkspaceModuleFinder, { type WorkspaceModuleFinderItem } from './WorkspaceModuleFinder';
import { advanceChatbocSessionRevision } from '@/utils/chatbocSessionRevision';

afterEach(cleanup);

const makeItems = (): WorkspaceModuleFinderItem[] => [
  { id: 'tickets', label: 'Reclamos', description: 'Resolución y atención', group: 'Operación', onSelect: vi.fn() },
  { id: 'reports', label: 'Estadísticas', description: 'Indicadores de gestión', group: 'Inteligencia', active: true, onSelect: vi.fn() },
  { id: 'team', label: 'Equipo', description: 'Personas y permisos', group: 'Administración', onSelect: vi.fn() },
];
const searchInput = () => screen.getByRole('searchbox', { name: 'Nombre, grupo o descripción del módulo' });
const openFinder = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: 'Buscar módulo' }));
  return searchInput();
};

describe('WorkspaceModuleFinder', () => {
  it('matches accents, descriptions and groups, retaining the draft during ordinary renders', async () => {
    const user = userEvent.setup();
    const items = makeItems();
    const view = render(<WorkspaceModuleFinder items={items} contextKey="org-a:actor-1" />);
    const input = await openFinder(user);
    await user.type(input, 'GESTION estadisticas');
    expect(screen.getByRole('button', { name: /Estadísticas/ })).toHaveAttribute('aria-current', 'page');
    expect(screen.queryByRole('button', { name: /Reclamos/ })).not.toBeInTheDocument();
    view.rerender(<WorkspaceModuleFinder items={items.map((item) => ({ ...item }))} contextKey="org-a:actor-1" />);
    expect(searchInput()).toHaveValue('GESTION estadisticas');
    await user.clear(searchInput());
    await user.type(searchInput(), 'operacion atencion');
    expect(screen.getByRole('button', { name: /Reclamos/ })).toBeVisible();
  });

  it('announces no results and does not invent an action', async () => {
    const user = userEvent.setup();
    const items = makeItems();
    render(<WorkspaceModuleFinder items={items} contextKey="org-a" />);
    await user.type(await openFinder(user), 'inexistente');
    expect(screen.getByRole('status')).toHaveTextContent('No encontramos módulos');
    await user.keyboard('{Enter}');
    items.forEach((item) => expect(item.onSelect).not.toHaveBeenCalled());
    expect(screen.getByRole('dialog')).toBeVisible();
  });

  it('uses native result buttons with arrows, Home, End and Enter exactly once', async () => {
    const user = userEvent.setup();
    const items = makeItems();
    render(<WorkspaceModuleFinder items={items} contextKey="org-a" />);
    expect(await openFinder(user)).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('button', { name: /Reclamos/ })).toHaveFocus();
    await user.keyboard('{End}');
    expect(screen.getByRole('button', { name: /Equipo/ })).toHaveFocus();
    await user.keyboard('{Home}{ArrowDown}{Enter}');
    expect(items[1].onSelect).toHaveBeenCalledOnce();
    expect(items[0].onSelect).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('allows native Tab navigation and selects a unique input match once', async () => {
    const user = userEvent.setup();
    const items = makeItems();
    render(<WorkspaceModuleFinder items={items} contextKey="org-a" />);
    const input = await openFinder(user);
    await user.tab();
    expect(screen.getByRole('button', { name: /Reclamos/ })).toHaveFocus();
    await user.tab({ shift: true });
    expect(input).toHaveFocus();
    await user.type(input, 'equipo');
    await user.keyboard('{Enter}');
    expect(items[2].onSelect).toHaveBeenCalledOnce();
  });

  it('restores the connected trigger after Escape within the same owner', async () => {
    const user = userEvent.setup();
    render(<WorkspaceModuleFinder items={makeItems()} contextKey="org-a" />);
    const trigger = screen.getByRole('button', { name: 'Buscar módulo' });
    await openFinder(user);
    await user.keyboard('{Escape}');
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('closes the first local Escape on reopening before the layer capture listener is ready', async () => {
    const addEventListener = document.addEventListener.bind(document);
    const layerRegistration = vi.spyOn(document, 'addEventListener').mockImplementation((type, listener, options) => {
      if (type === 'keydown' && typeof options === 'object' && options.capture) return;
      addEventListener(type, listener, options);
    });
    try {
      const user = userEvent.setup();
      const items = makeItems();
      render(<WorkspaceModuleFinder items={items} contextKey="org-a" />);
      const trigger = screen.getByRole('button', { name: 'Buscar módulo' });
      await user.type(await openFinder(user), 'equipo');
      const selectedInput = searchInput();
      fireEvent.keyDown(selectedInput, { key: 'Enter' });
      fireEvent.keyDown(selectedInput, { key: 'Enter' });
      expect(items[2].onSelect).toHaveBeenCalledOnce();
      await openFinder(user);
      expect(searchInput()).toHaveFocus();
      const consumedEscape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
      consumedEscape.preventDefault();
      fireEvent(searchInput(), consumedEscape);
      expect(screen.getByRole('dialog')).toBeVisible();
      const nestedDialog = document.createElement('div');
      nestedDialog.setAttribute('role', 'dialog');
      const nestedControl = document.createElement('button');
      nestedDialog.append(nestedControl);
      screen.getByRole('dialog').append(nestedDialog);
      fireEvent.keyDown(nestedControl, { key: 'Escape' });
      expect(screen.getByRole('dialog', { name: 'Buscar módulo' })).toBeVisible();
      nestedDialog.remove();
      fireEvent.keyDown(searchInput(), { key: 'Escape' });
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      await waitFor(() => expect(trigger).toHaveFocus());
      await openFinder(user);
      await user.click(screen.getByRole('button', { name: 'Cerrar buscador' }));
      await openFinder(user);
      expect(searchInput()).toHaveFocus();
      fireEvent.keyDown(screen.getByRole('button', { name: /Reclamos/ }), { key: 'Escape' });
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      await waitFor(() => expect(trigger).toHaveFocus());
      expect(items[2].onSelect).toHaveBeenCalledOnce();
    } finally {
      cleanup();
      layerRegistration.mockRestore();
    }
  });

  it('retires the open owner on a context change and never reopens after A to B to A', async () => {
    const user = userEvent.setup();
    const items = makeItems();
    const view = render(<WorkspaceModuleFinder items={items} contextKey="org-a" />);
    const oldTrigger = screen.getByRole('button', { name: 'Buscar módulo' });
    await openFinder(user);
    const retired = screen.getByRole('button', { name: /Reclamos/ });
    view.rerender(<WorkspaceModuleFinder items={items} contextKey="org-b" />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    view.rerender(<WorkspaceModuleFinder items={items} contextKey="org-a" />);
    fireEvent.click(retired);
    expect(items[0].onSelect).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Buscar módulo' })).toHaveAttribute('aria-expanded', 'false');
    expect(oldTrigger.isConnected).toBe(false);
    expect(screen.getByRole('button', { name: 'Buscar módulo' })).not.toHaveFocus();
  });

  it('withdraws old results immediately when an item permission is removed', async () => {
    const user = userEvent.setup();
    const items = makeItems();
    const view = render(<WorkspaceModuleFinder items={items} contextKey="org-a" />);
    await openFinder(user);
    const retired = screen.getByRole('button', { name: /Equipo/ });
    view.rerender(<WorkspaceModuleFinder items={items.slice(0, 2)} contextKey="org-a" />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(retired);
    expect(items[2].onSelect).not.toHaveBeenCalled();
    await openFinder(user);
    expect(screen.queryByRole('button', { name: /Equipo/ })).not.toBeInTheDocument();
  });

  it('retires on a real session revision without a parent render, including same-actor relogin', async () => {
    const user = userEvent.setup();
    const items = makeItems();
    render(<WorkspaceModuleFinder items={items} contextKey="org-a:actor-1" />);
    const oldTrigger = screen.getByRole('button', { name: 'Buscar módulo' });
    await openFinder(user);
    const retired = screen.getByRole('button', { name: /Reclamos/ });
    act(() => { advanceChatbocSessionRevision(); advanceChatbocSessionRevision(); });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(retired);
    expect(items[0].onSelect).not.toHaveBeenCalled();
    expect(oldTrigger.isConnected).toBe(false);
    expect(screen.getByRole('button', { name: 'Buscar módulo' })).not.toHaveFocus();
  });

  it('uses the latest permitted callback without resetting ordinary search state', async () => {
    const user = userEvent.setup();
    const items = makeItems();
    const latest = vi.fn();
    const view = render(<WorkspaceModuleFinder items={items} contextKey="org-a" />);
    await user.type(await openFinder(user), 'equipo');
    view.rerender(<WorkspaceModuleFinder items={items.map((item) => item.id === 'team' ? { ...item, onSelect: latest } : item)} contextKey="org-a" />);
    await user.keyboard('{Enter}');
    expect(latest).toHaveBeenCalledOnce();
    expect(items[2].onSelect).not.toHaveBeenCalled();
  });

  it('does not steal external focus while Escape restoration is pending', async () => {
    const user = userEvent.setup();
    render(<><WorkspaceModuleFinder items={makeItems()} contextKey="org-a" /><button>Destino externo</button></>);
    const input = await openFinder(user);
    const outside = screen.getByRole('button', { name: 'Destino externo', hidden: true });
    fireEvent.keyDown(input, { key: 'Escape' });
    outside.focus();
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 10)); });
    expect(outside).toHaveFocus();
  });

  it('does not restore focus after the owner unmounts', async () => {
    const user = userEvent.setup();
    const view = render(<WorkspaceModuleFinder items={makeItems()} contextKey="org-a" />);
    const input = await openFinder(user);
    const outside = document.createElement('button');
    document.body.append(outside);
    fireEvent.keyDown(input, { key: 'Escape' });
    view.unmount();
    outside.focus();
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 10)); });
    expect(outside).toHaveFocus();
    outside.remove();
  });

  it('gives each instance an independent input label and opens only explicitly', async () => {
    const user = userEvent.setup();
    render(<><WorkspaceModuleFinder items={makeItems()} contextKey="org-a" triggerLabel="Buscar A" /><WorkspaceModuleFinder items={makeItems()} contextKey="org-b" triggerLabel="Buscar B" /></>);
    fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Buscar A' }));
    const firstId = searchInput().id;
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'Buscar B' }));
    expect(searchInput().id).not.toBe(firstId);
    expect(within(screen.getByRole('dialog')).getByLabelText('Nombre, grupo o descripción del módulo')).toBe(searchInput());
  });
});

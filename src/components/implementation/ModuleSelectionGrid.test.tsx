import React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import fixtures from '../../../tests/fixtures/organization-modules.json';
import assistance from '../../../tests/fixtures/module-selection-assistance.json';
import { readModuleSelection } from '@/utils/organizationModules';
import ModuleSelectionGrid from './ModuleSelectionGrid';
afterEach(cleanup);
const snapshot = () => readModuleSelection({...fixtures.full,selection_assistance:assistance},'tenant-a')!;
const show = (options: Record<string,unknown> = {}) => {
  const onChange=vi.fn(); const value=snapshot();
  const props={snapshot:value,draft:value.selected,disabled:false,onChange,...options};
  return {...render(<ModuleSelectionGrid {...props}/>), onChange, props};
};
const payments = () => screen.getByLabelText('Cobros y pedidos');
describe('explicit dependency review', () => {
  it('shows dependent additions before making any draft change', () => {
    const view=show(); fireEvent.click(payments());
    const modal=screen.getByRole('alertdialog');
    expect(modal).toHaveTextContent(assistance.select_title);
    expect(within(modal).getByTestId('module-dependency-impact')).toHaveTextContent('Catálogo de productos o servicios');
    expect(view.onChange).not.toHaveBeenCalled(); expect(payments()).not.toBeChecked();
    fireEvent.click(within(modal).getByRole('button',{name:assistance.apply_draft}));
    expect(view.onChange).toHaveBeenCalledWith(['whatsapp','catalog','payments','surveys','territory']);
    expect(view.onChange).toHaveBeenCalledTimes(1);
  });
  it('cancels without changing a checkbox or the draft', () => {
    const view=show(); fireEvent.click(payments());
    fireEvent.click(screen.getByRole('button',{name:assistance.cancel}));
    expect(view.onChange).not.toHaveBeenCalled(); expect(payments()).not.toBeChecked();
  });
  it('previews dependent removals without silently removing prerequisites', () => {
    const view=show({draft:['catalog','payments','surveys']});
    fireEvent.click(screen.getByRole('checkbox',{name:'Catálogo de productos o servicios'}));
    const modal=screen.getByRole('alertdialog');
    expect(modal).toHaveTextContent(assistance.remove_title);
    expect(modal).toHaveTextContent('Cobros y pedidos');
    expect(view.onChange).not.toHaveBeenCalled();
    fireEvent.click(within(modal).getByRole('button',{name:assistance.apply_draft}));
    expect(view.onChange).toHaveBeenCalledWith(['surveys']);
  });
  it('edits an independent choice without adding a needless dialog', () => {
    const view=show(); fireEvent.click(screen.getByRole('checkbox',{name:'Encuestas y participación'}));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(view.onChange).toHaveBeenCalledWith(['whatsapp','territory']);
  });
  it('uses legacy disabled dependencies when server assistance is absent', () => {
    show({snapshot:readModuleSelection(fixtures.full,'tenant-a')!});
    expect(payments()).toBeDisabled();
    expect(screen.queryByText(assistance.hint)).toBeNull();
  });
  it('uses legacy behavior when the assistance contract is malformed', () => {
    show({snapshot:{...snapshot(),selection_assistance:{...assistance,detail:''}}});
    expect(payments()).toBeDisabled();
  });
  it('never enables changes for a readonly actor', () => {
    const view=show({snapshot:{...snapshot(),can_edit:false}});
    expect(payments()).toBeDisabled(); fireEvent.click(payments());
    expect(view.onChange).not.toHaveBeenCalled();
  });
  it.each(['revision','draft','catalog','permission','pending','tenant'])('invalidates the pending plan when %s changes', change => {
    const view=show(); fireEvent.click(payments());
    expect(screen.getByRole('alertdialog')).toBeVisible();
    const props={...view.props};
    if(change==='draft') props.draft=['whatsapp'];
    else if(change==='pending') props.disabled=true;
    else if(change==='permission') props.snapshot={...props.snapshot,can_edit:false};
    else if(change==='revision') props.snapshot={...props.snapshot,revision:'b'.repeat(64)};
    else if(change==='tenant') props.snapshot={...props.snapshot,tenant:{id:2,slug:'other'}};
    else props.snapshot={...props.snapshot,catalog:[...props.snapshot.catalog].reverse()};
    view.rerender(<ModuleSelectionGrid {...props}/>);
    expect(screen.queryByRole('alertdialog')).toBeNull(); expect(view.onChange).not.toHaveBeenCalled();
  });
});

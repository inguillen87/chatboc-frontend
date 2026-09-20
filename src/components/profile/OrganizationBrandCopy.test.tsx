import React from 'react';
import {cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import OrganizationBrandStudio from './OrganizationBrandStudio';
import {BrandComparison} from './BrandComparison';
import {BRAND_UI_KEYS,formatBrandText,readBrandWorkflowUI} from '@/utils/brandWorkflowUI';
import {readBrandSnapshot} from '@/utils/workspaceBranding';
import fixtures from '../../../tests/fixtures/workspace-branding.json';
import {apiFetch} from '@/utils/api';
vi.mock('@/utils/api',()=>({apiFetch:vi.fn()}));
const api=vi.mocked(apiFetch);const vocabulary=fixtures.initial.workflow_ui.texts;
const load=(brand:any=fixtures.initial)=>({organization_branding:brand});
beforeEach(()=>api.mockReset().mockResolvedValue(load()));afterEach(cleanup);
describe('backend-owned branding vocabulary',()=>{
  it('validates every label and preserves the wire shape through a parsed round trip',()=>{
    expect(BRAND_UI_KEYS).toHaveLength(70);expect(readBrandWorkflowUI(fixtures.initial.workflow_ui)).toEqual(vocabulary);
    const brand=readBrandSnapshot(fixtures.initial,'tenant-a');expect(brand).not.toBeNull();
    expect(readBrandSnapshot(brand,'tenant-a')).toEqual(brand);
  });
  it('rejects missing, malformed, oversized and markup-bearing UI contracts',()=>{
    const invalid=[null,{}, {...fixtures.initial.workflow_ui,contract_version:'unknown'},
      {contract_version:'organization.branding_workflow_ui.v1',texts:{...vocabulary,discard_action:''}},
      {contract_version:'organization.branding_workflow_ui.v1',texts:{...vocabulary,discard_action:'x'.repeat(601)}},
      {contract_version:'organization.branding_workflow_ui.v1',texts:{...vocabulary,discard_action:'<b>Discard</b>'}}];
    for(const value of invalid)expect(readBrandWorkflowUI(value)).toBeNull();
  });
  it('detaches presentation values and ignores fields that cannot grant permissions',()=>{
    const value=readBrandWorkflowUI({...fixtures.initial.workflow_ui,texts:{...vocabulary,can_edit:true}})!;
    expect(value).not.toHaveProperty('can_edit');value.discard_action='Changed';expect(vocabulary.discard_action).toBe('Descartar borrador');
  });
  it('substitutes plain text without interpreting organization names as markup',()=>{
    const result=formatBrandText('{organization} / {version}',{organization:'<img src=x>',version:2});
    const {container}=render(<p>{result}</p>);expect(container.querySelector('img')).toBeNull();
    expect(container).toHaveTextContent('<img src=x> / 2');
  });
  it('renders tenant-specific workflow copy without client-side Spanish defaults',async()=>{
    const texts={...vocabulary,draft_pending:'Local changes pending',discard_action:'Discard this draft',
      discard_title:'Discard local changes?',confirm_discard:'Discard now',comparison_label:'Organization changes',version_label:'Revision {version}'};
    api.mockResolvedValueOnce(load({...fixtures.initial,workflow_ui:{...fixtures.initial.workflow_ui,texts}}));
    render(<OrganizationBrandStudio tenantSlug="tenant-a" name="Example"/>);await screen.findByTestId('brand-studio');
    expect(screen.getByText('Revision 0')).toBeVisible();fireEvent.click(screen.getByRole('checkbox'));
    expect(screen.getByText(texts.draft_pending)).toBeVisible();expect(screen.queryByText(vocabulary.draft_pending)).toBeNull();
    expect(screen.getByRole('group',{name:texts.comparison_label})).toBeVisible();
    fireEvent.click(screen.getByRole('button',{name:texts.discard_action}));
    expect(await screen.findByRole('heading',{name:texts.discard_title})).toBeVisible();
    fireEvent.click(screen.getByRole('button',{name:texts.confirm_discard}));expect(api).toHaveBeenCalledTimes(1);
  });
  it('compares actual activation even when the server labels both states identically',()=>{
    render(<BrandComparison saved={fixtures.initial.values} proposed={{...fixtures.initial.values,enabled:true}}
      copy={{...vocabulary,enabled_label:'Status',disabled_label:'Status'}}/>);
    const row=screen.getByText(vocabulary.application_label).closest('[data-changed]')!;
    expect(row).toHaveAttribute('data-changed','true');expect(within(row as HTMLElement).getByText(vocabulary.changed_label)).toBeVisible();
  });
  it('fails closed on missing server copy instead of manufacturing a publishable editor',async()=>{
    api.mockResolvedValueOnce(load({...fixtures.initial,workflow_ui:undefined}));
    render(<OrganizationBrandStudio tenantSlug="tenant-a" name="Example"/>);
    await screen.findByRole('button',{name:'Volver a consultar'});expect(screen.queryByTestId('brand-studio')).toBeNull();
    expect(api).toHaveBeenCalledTimes(1);
  });
  it('keeps an incomplete publication receipt uncertain rather than synthesizing its wording',async()=>{
    const published=vi.fn();render(<OrganizationBrandStudio tenantSlug="tenant-a" name="Example" onPublished={published}/>);
    await screen.findByTestId('brand-studio');fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button',{name:'Violeta y coral'}));
    api.mockResolvedValueOnce({contract_version:'organization.branding_save.v1',saved:true,tenant:fixtures.published.tenant,
      brand:{...fixtures.published,workflow_ui:undefined},provider_calls_performed:false});
    fireEvent.click(screen.getByRole('button',{name:vocabulary.publish_action}));
    fireEvent.click(await screen.findByRole('button',{name:vocabulary.confirm_publish}));
    expect(await screen.findByRole('alert')).toHaveTextContent(vocabulary.publish_unconfirmed);
    expect(published).not.toHaveBeenCalled();expect(screen.getByRole('button',{name:vocabulary.publish_action})).toBeDisabled();
  });
});

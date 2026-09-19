import { describe, it, expect } from 'vitest';
import fixtures from '../../tests/fixtures/organization-workspaces.json';
import { readOrganizationWorkspace } from './organizationWorkspace';

describe('organization profile contract', () => {
  it.each(Object.entries(fixtures))('accepts the backend fixture for %s', (_, data) => {
    const context = readOrganizationWorkspace(data,data.tenant.slug);
    expect(context?.organization_label).toBe(data.organization_label);
    expect(context?.sections).toHaveLength(6);
    expect(context).not.toHaveProperty('permissions');
  });
  it.each([null,undefined,'other-space','municipio'])('requires explicit matching organization %s', slug => {
    expect(readOrganizationWorkspace(fixtures.municipio,slug)).toBeNull();
  });
  it('rejects stale contracts, injected URLs, missing sections and contradictory side effects', () => {
    for (const patch of [
      {contract_version:'v0'}, {writes_performed:true}, {provider_calls_performed:true},
      {sections:[]}, {sections:[...fixtures.municipio.sections.slice(1),fixtures.municipio.sections[1]]},
      {tenant:{id:true,slug:'sample-municipio'}}, {organization_type:'invented'},
      {heading:''}, {continuity:{preserve_existing_account:false}},
    ]) expect(readOrganizationWorkspace({...fixtures.municipio,...patch},'sample-municipio')).toBeNull();
  });
  it('projects only presentation, never privileges or extra links', () => {
    const source = {...fixtures.colegio, permissions:['*'], plan:'full',
      sections:fixtures.colegio.sections.map(s => ({...s,href:'https://outside.invalid'}))};
    const context=readOrganizationWorkspace(source,'sample-colegio');
    expect(context).not.toHaveProperty('plan');
    expect(context).not.toHaveProperty('permissions');
    expect(context?.sections[0]).not.toHaveProperty('href');
  });
  it('does not infer company for an unknown organization', () => {
    expect(readOrganizationWorkspace(fixtures.unknown,'sample-unknown')?.organization_label).toBe('Organización');
  });
  it('returns an independent projection and keeps the old account', () => {
    const result=readOrganizationWorkspace(fixtures.municipio,'sample-municipio')!;
    result.sections[0].label='changed';
    expect(fixtures.municipio.sections[0].label).not.toBe('changed');
    expect(result.continuity.preserve_existing_account).toBe(true);
    expect(result.continuity.whatsapp_registration_present).toBe(true);
  });
});

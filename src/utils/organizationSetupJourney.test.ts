import {buildTenantJourneyHref} from '@/components/implementation/TenantLaunchJourney';
import {describe,it,expect} from 'vitest';
import fixtures from '../../tests/fixtures/organization-setup-journeys.json';
import {parseOrganizationSetupJourney} from './organizationSetupJourney';
const fixture=()=>JSON.parse(JSON.stringify(fixtures.empresa));
describe('organization setup contract',()=>{
  it.each(Object.entries(fixtures))('accepts backend fixture %s without inventing stages',(_kind,value)=>{
    expect(parseOrganizationSetupJourney(value,'tenant-a',1)?.heading).toBe(value.heading);
  });
  it.each(['other','',null])('rejects another or missing scope %s',slug=>{
    expect(parseOrganizationSetupJourney(fixture(),slug as string)).toBeNull();
  });
  it('rejects a mismatched organization identifier',()=>{
    expect(parseOrganizationSetupJourney(fixture(),'tenant-a',2)).toBeNull();
  });
  it.each(['progress','ready','total','blocked','published'])('rejects inconsistent %s',field=>{
    const value=fixture();value.summary[field]+=1;
    expect(parseOrganizationSetupJourney(value,'tenant-a')).toBeNull();
  });
  it('rejects duplicated or missing stages',()=>{
    const value=fixture();value.stages[1]=value.stages[0];
    expect(parseOrganizationSetupJourney(value,'tenant-a')).toBeNull();
  });
  it('rejects a fictitious completion or changed next action',()=>{
    const value=fixture();value.stages[1].ready=true;
    expect(parseOrganizationSetupJourney(value,'tenant-a')).toBeNull();
    const second=fixture();second.summary.next_action={...second.summary.next_action,href:'/other'};
    expect(parseOrganizationSetupJourney(second,'tenant-a')).toBeNull();
  });
  it('rejects unknown evidence sources and contradictory vertical metadata',()=>{
    const value=fixture();value.stages[0].source_ids=['private_data'];
    expect(parseOrganizationSetupJourney(value,'tenant-a')).toBeNull();
    const second=fixture();second.government_setup=true;
    expect(parseOrganizationSetupJourney(second,'tenant-a')).toBeNull();
  });
  it('rejects mutated security and provider claims',()=>{
    for(const field of ['writes_performed','provider_calls_performed']) {
      const value=fixture();value[field]=true;
      expect(parseOrganizationSetupJourney(value,'tenant-a')).toBeNull();
    }
  });
  it.each(['/implementacion?tenant_slug=other','/t/other/perfil','/e/other/cart'])('rejects foreign return destination %s',returnTo=>{
    expect(buildTenantJourneyHref('/perfil','tenant-a',returnTo)).toBeNull();
  });
});

import {describe,it,expect} from 'vitest';
import fixtures from '../../tests/fixtures/workspace-branding.json';
import {readBrandSnapshot,readWorkspaceAppearance,brandColorPair,brandCss} from './workspaceBranding';
const fresh=()=>JSON.parse(JSON.stringify(fixtures.initial));
describe('versioned workspace brand contract',()=>{
  it.each(Object.entries(fixtures))('accepts the backend %s fixture',(_name,value)=>{
    expect(readBrandSnapshot(value,'tenant-a')?.revision).toBe(value.revision);
  });
  it('rejects another tenant and a forged configuration endpoint',()=>{
    expect(readBrandSnapshot(fresh(),'tenant-b')).toBeNull();
    expect(readBrandSnapshot({...fresh(),save_endpoint:'/api/admin/tenants/other/config'},'tenant-a')).toBeNull();
  });
  it('rejects inconsistent permissions, colors and provider claims',()=>{
    for(const change of [{can_edit:false},{provider_calls_performed:true},{reason_code:'billing_disabled'},{version:-1}])
      expect(readBrandSnapshot({...fresh(),...change},'tenant-a')).toBeNull();
    const invalid=fresh();invalid.values.primary_color='url(https://outside.example)';
    expect(readBrandSnapshot(invalid,'tenant-a')).toBeNull();
  });
  it('does not trust a forged readable foreground',()=>{
    const value=fresh();value.appearance.primary.foreground='#AABBCC';
    expect(readBrandSnapshot(value,'tenant-a')).toBeNull();
  });
  it('rejects duplicated or future history versions',()=>{
    const value=JSON.parse(JSON.stringify(fixtures.published));value.history.push(value.history[0]);
    expect(readBrandSnapshot(value,'tenant-a')).toBeNull();value.history=[{version:2,values:value.values}];
    expect(readBrandSnapshot(value,'tenant-a')).toBeNull();
  });
  it('does not publish a palette when it is inactive or its tenant differs',()=>{
    expect(brandCss(fixtures.initial.appearance)).toBeUndefined();
    const raw={contract_version:'organization.workspace_appearance.v1',tenant:{id:1,slug:'tenant-a'},appearance:fixtures.published.appearance};
    expect(readWorkspaceAppearance(raw,'other')).toBeNull();
    expect(brandCss(readWorkspaceAppearance(raw,'tenant-a'))?.['--org-brand']).toBe('#6D28D9');
  });
  it('chooses readable text for many sample colors without changing the chosen background',()=>{
    for(let i=0;i<=255;i+=17)for(let j=0;j<=255;j+=17){
      const color=`#${i.toString(16).padStart(2,'0')}${j.toString(16).padStart(2,'0')}88`;
      expect(brandColorPair(color).contrast).toBeGreaterThanOrEqual(4.5);
      expect(brandColorPair(color).background).toBe(color.toUpperCase());
    }
  });
});

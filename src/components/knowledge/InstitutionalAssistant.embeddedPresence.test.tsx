import React from 'react';
import {cleanup,render,screen,waitFor} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {workspace} from '../../../tests/fixtures/institutional-assistant.synthetic';
const transport=vi.hoisted(()=>({fetch:vi.fn()}));
vi.mock('@/utils/api',()=>({apiFetch:(...args:unknown[])=>transport.fetch(...args)}));
import InstitutionalAssistant from '@/components/knowledge/InstitutionalAssistant';
import {InstitutionalAccessBrand} from '@/components/brand/InstitutionalAccessBrand';
// The page-level signal the floating widget reads (ChatWidgetInner).
const hasEmbeddedInstitutionalReader=()=>document.documentElement.hasAttribute('data-embedded-institutional-reader');

beforeEach(()=>{transport.fetch.mockReset();});
afterEach(cleanup);

describe('embedded published reader presence',()=>{
  it('is announced only by a published public reader and withdrawn when it leaves',async()=>{
    const value=workspace({visibility:'public',can_edit:false});transport.fetch.mockResolvedValueOnce(value);
    const view=render(<InstitutionalAssistant tenantSlug={value.tenant.slug} mode="public"/>);
    // Announced while it arrives, so the launcher does not flash over the page.
    expect(hasEmbeddedInstitutionalReader()).toBe(true);
    await screen.findByTestId('institutional-assistant');
    await waitFor(()=>expect(hasEmbeddedInstitutionalReader()).toBe(true));
    view.unmount();
    expect(hasEmbeddedInstitutionalReader()).toBe(false);
  });
  it('is not announced by the private workspace or by an unavailable public reader',async()=>{
    transport.fetch.mockResolvedValueOnce(workspace());
    const admin=render(<InstitutionalAssistant tenantSlug="qa-knowledge" sessionKey="actor-a"/>);
    await screen.findByTestId('institutional-assistant');
    expect(hasEmbeddedInstitutionalReader()).toBe(false);
    admin.unmount();
    transport.fetch.mockRejectedValueOnce(Object.assign(new Error('not available'),{status:404}));
    render(<InstitutionalAssistant tenantSlug="qa-knowledge" mode="public"/>);
    await screen.findByRole('alert');
    expect(hasEmbeddedInstitutionalReader()).toBe(false);
  });
  it('counts independent readers and tells the widget about every change',async()=>{
    const changes=vi.fn();window.addEventListener('chatboc:embedded-institutional-reader',changes);
    try{
      const value=workspace({visibility:'public',can_edit:false});transport.fetch.mockResolvedValue(value);
      const first=render(<InstitutionalAssistant tenantSlug={value.tenant.slug} mode="public"/>);
      const second=render(<InstitutionalAssistant tenantSlug={value.tenant.slug} mode="public"/>);
      await waitFor(()=>expect(document.documentElement.dataset.embeddedInstitutionalReader).toBe('2'));
      first.unmount();
      expect(document.documentElement.dataset.embeddedInstitutionalReader).toBe('1');
      second.unmount();
      expect(hasEmbeddedInstitutionalReader()).toBe(false);
      expect(changes).toHaveBeenCalledTimes(4);
    }finally{window.removeEventListener('chatboc:embedded-institutional-reader',changes);}
  });
});

describe('institution brand in the public space',()=>{
  const identity={tenantId:701,tenantSlug:'qa-knowledge',name:'Institución de prueba',logoUrl:null};
  it('shows the institution name without a technical identifier unless a subtitle is given',()=>{
    const view=render(<MemoryRouter><InstitutionalAccessBrand identity={identity as never}/></MemoryRouter>);
    expect(screen.getByRole('link',{name:'Institución de prueba'})).toHaveTextContent(/^Institución de prueba$/);
    expect(screen.queryByText('qa-knowledge')).not.toBeInTheDocument();
    view.unmount();
    render(<MemoryRouter><InstitutionalAccessBrand identity={identity as never} subtitle="portal.example.invalid"/></MemoryRouter>);
    expect(screen.getByText('portal.example.invalid')).toBeInTheDocument();
  });
});

import React from 'react';
import {act,cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {workspace,source,node,reply} from '../../../tests/fixtures/institutional-assistant.synthetic';
const transport=vi.hoisted(()=>({fetch:vi.fn()}));
// Actual components and contract. HTTP responses are synthetic in jsdom.
vi.mock('@/utils/api',()=>({apiFetch:(...args:unknown[])=>transport.fetch(...args)}));
import InstitutionalAssistant from './InstitutionalAssistant';
import InstitutionalChatMessage from '@/components/chat/InstitutionalChatMessage';
import ScrollToTopButton from '@/components/ui/ScrollToTopButton';
import {institutionalChatBootstrapPayload,institutionalChoiceLabel,parseInstitutionalChatMessage} from '@/features/chat/institutionalChatMessage';

const firstSource={...source,id:'source-first',title:'Primera fuente del catálogo',sha256:'c'.repeat(64)};
const twoSources=()=>{
  const value=workspace();
  value.knowledge!.sources=[firstSource,source];
  return value;
};
beforeEach(()=>{transport.fetch.mockReset();});
afterEach(()=>{cleanup();vi.restoreAllMocks();});

describe('decorative symbols in canonical choice labels',()=>{
  it('hides a leading symbol such as ⌂ from assistive technology and keeps words and codes intact',()=>{
    expect(institutionalChoiceLabel('⌂ Volver al menú')).toEqual({emoji:'⌂',words:'Volver al menú'});
    expect(institutionalChoiceLabel('🪪 Certificados')).toEqual({emoji:'🪪',words:'Certificados'});
    for(const label of ['Río Grande','N° de trámite','→ Siguiente','$ Pagos','1️⃣ Primera'])
      expect(institutionalChoiceLabel(label)).toEqual({emoji:null,words:label});
  });
  it('separates the option code from its words in both readers',()=>{
    const value=workspace({visibility:'public',can_edit:false});
    value.knowledge!.initial.actions=[{code:'9',label:'⌂ Volver al menú',target:'requirements'}];
    const answer=parseInstitutionalChatMessage(institutionalChatBootstrapPayload(value,value.tenant.slug),value.tenant.slug)!;
    render(<InstitutionalChatMessage answer={answer} onButtonClick={()=>{}}/>);
    const button=screen.getByRole('button',{name:'9 Volver al menú'});
    expect(button.textContent).toBe('9 ⌂ Volver al menú');
    expect(within(button).getByText('⌂')).toHaveAttribute('aria-hidden','true');
  });
});

describe('public reader semantics',()=>{
  it('names choices with a word boundary and hides decorative icons',async()=>{
    const value=workspace({visibility:'public',can_edit:false});transport.fetch.mockResolvedValueOnce(value);
    render(<InstitutionalAssistant tenantSlug={value.tenant.slug} mode="public"/>);
    const assistant=await screen.findByTestId('institutional-assistant');
    const choice=assistant.querySelector('.institutional-assistant__choices button')!;
    const action=value.knowledge!.initial.actions[0];
    expect(choice.textContent).toBe(`${action.code} ${action.label}`);
    for(const icon of assistant.querySelectorAll('svg'))expect(icon).toHaveAttribute('aria-hidden','true');
  });
});

describe('cited source in the source dialog',()=>{
  it('opens a modal dialog at the cited source and returns focus to the citation',async()=>{
    const user=userEvent.setup(),value=twoSources();transport.fetch.mockResolvedValueOnce(value);
    render(<InstitutionalAssistant tenantSlug={value.tenant.slug} sessionKey="actor-a"/>);
    const input=await screen.findByLabelText(value.ui.question);
    transport.fetch.mockResolvedValueOnce({...reply('requirements',value),selection_performed:true});
    await user.type(input,'Qué requisitos hay');await user.keyboard('{Enter}');
    await screen.findByRole('heading',{name:node('requirements').title});
    await user.click(screen.getByText(value.ui.source_details));
    const citation=screen.getByRole('button',{name:new RegExp(`^Ver fuente\\s*: ${source.title}$`)});
    await user.click(citation);
    const dialog=await screen.findByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal','true');
    const cited=within(dialog).getByRole('heading',{name:source.title});
    await waitFor(()=>expect(cited).toHaveFocus());
    expect(cited.closest('article')).toHaveAttribute('data-cited-source');
    expect(within(dialog).getByRole('heading',{name:firstSource.title}).closest('article')).not.toHaveAttribute('data-cited-source');
    await user.keyboard('{Escape}');
    await waitFor(()=>expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(citation).toHaveFocus();
  });
  it('opens the full catalog at its title when no source is cited',async()=>{
    const user=userEvent.setup(),value=twoSources();transport.fetch.mockResolvedValueOnce(value);
    render(<InstitutionalAssistant tenantSlug={value.tenant.slug} sessionKey="actor-a"/>);
    await user.click(await screen.findByRole('button',{name:value.ui.sources}));
    const dialog=await screen.findByRole('dialog');
    await waitFor(()=>expect(within(dialog).getByRole('heading',{name:value.ui.sources})).toHaveFocus());
    expect(dialog.querySelector('[data-cited-source]')).toBeNull();
  });
});

describe('scroll to top control',()=>{
  it('is out of the tab order while hidden and named when visible',()=>{
    render(<ScrollToTopButton/>);
    const hidden=document.querySelector('button')!;
    expect(hidden).toHaveAttribute('tabindex','-1');expect(hidden).toHaveAttribute('aria-hidden','true');
    act(()=>{Object.defineProperty(window,'scrollY',{configurable:true,value:900});window.dispatchEvent(new Event('scroll'));});
    const visible=screen.getByRole('button',{name:'Volver arriba'});
    expect(visible).not.toHaveAttribute('tabindex');expect(visible).not.toHaveAttribute('aria-hidden');
    const scroll=vi.spyOn(window,'scrollTo').mockImplementation(()=>{});
    Object.defineProperty(window,'matchMedia',{configurable:true,value:(query:string)=>({matches:query.includes('reduce'),media:query,addEventListener(){},removeEventListener(){}})});
    fireEvent.click(visible);
    expect(scroll).toHaveBeenCalledWith({top:0,behavior:'auto'});
    act(()=>{Object.defineProperty(window,'scrollY',{configurable:true,value:0});});
  });
});

import React from 'react';
import {cleanup,render,screen,waitFor,within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {assistantUi,workspace} from '../../../tests/fixtures/institutional-assistant.synthetic';
const transport=vi.hoisted(()=>({fetch:vi.fn()}));
// Actual component and contract. HTTP responses are synthetic in jsdom.
vi.mock('@/utils/api',()=>({apiFetch:(...args:unknown[])=>transport.fetch(...args)}));
import InstitutionalAssistant from './InstitutionalAssistant';
import {parseQuestionMetrics} from './institutionalAssistantMetrics';

const LABEL='Rótulo sintético del panel';
const copy={title:'Título sintético',description:'Descripción sintética.',period:'Período sintético de {days} días',
  answered:'Etiqueta respondidas',uncovered:'Etiqueta sin respuesta',typed_navigation:'Etiqueta navegación',sources:'Etiqueta fuentes',
  unavailable:'Etiqueta no disponibles',uncovered_rate:'Etiqueta proporción',uncovered_by_node:'Ranking sin respuesta',
  answered_by_node:'Ranking consultados',node:'Columna tema',count:'Columna cantidad',retired_node:'Tema retirado sintético',
  empty:'Sin consultas sintéticas.',privacy:'Nota de privacidad sintética.',truncated:'Aviso de recorte sintético.'};
const admin=(labelled=true)=>workspace(labelled?{ui:{...assistantUi,question_metrics:LABEL}}:{});
const metrics=(overrides:Record<string,unknown>={})=>({contract_version:'chatboc.institutional_assistant_metrics.v1',
  tenant:{id:701,slug:'qa-knowledge'},revision:'b'.repeat(64),days:30,utc_offset_minutes:0,from:'2026-10-21',to:'2026-11-19',truncated:false,
  totals:{answered:1,uncovered:4,typed_navigation:2,sources:0,unavailable:0},uncovered_rate:0.8,by_channel:{},by_day:[],
  uncovered_by_node:[{node_id:'requirements',count:3,title:'Requisitos de la consulta',is_start:false},{node_id:'retired',count:1,title:null,is_start:false}],
  answered_by_node:[{node_id:'requirements',count:1,title:'Requisitos de la consulta',is_start:false}],ui:copy,...overrides});
const view=()=><InstitutionalAssistant tenantSlug="qa-knowledge" sessionKey="actor-a"/>;
beforeEach(()=>{transport.fetch.mockReset();});
afterEach(cleanup);

describe('written-question metrics in the administration workspace',()=>{
  it('requests nothing until opened, then shows the server wording, totals and rankings',async()=>{
    const user=userEvent.setup();transport.fetch.mockResolvedValueOnce(admin());render(view());
    const toggle=await screen.findByRole('button',{name:LABEL});
    expect(toggle).toHaveAttribute('aria-expanded','false');expect(transport.fetch).toHaveBeenCalledTimes(1);
    transport.fetch.mockResolvedValueOnce(metrics());await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded','true');
    await screen.findByRole('heading',{name:copy.title});
    const [path,options]=transport.fetch.mock.calls[1];
    expect(path).toMatch(/^\/api\/admin\/tenants\/qa-knowledge\/institutional-assistant\/metrics\?days=30&utc_offset_minutes=-?\d+$/);
    expect(options).toMatchObject({method:'GET',tenantSlug:'qa-knowledge',omitEntityToken:true,omitChatSessionId:true});
    expect(options.body).toBeUndefined();
    expect(screen.getByText('Período sintético de 30 días')).toBeInTheDocument();
    for(const [label,value] of [[copy.answered,'1'],[copy.uncovered,'4'],[copy.typed_navigation,'2'],[copy.sources,'0'],[copy.unavailable,'0'],[copy.uncovered_rate,'80 %']])
      expect(screen.getByText(label).nextElementSibling).toHaveTextContent(new RegExp(`^${value}$`));
    const uncovered=within(screen.getByRole('region',{name:copy.uncovered_by_node}));
    expect(uncovered.getByRole('columnheader',{name:copy.node})).toBeInTheDocument();
    expect(uncovered.getByRole('row',{name:'Requisitos de la consulta 3'})).toBeInTheDocument();
    expect(uncovered.getByRole('row',{name:`${copy.retired_node} 1`})).toBeInTheDocument();
    expect(within(screen.getByRole('region',{name:copy.answered_by_node})).getByRole('row',{name:'Requisitos de la consulta 1'})).toBeInTheDocument();
    expect(screen.getByText(copy.privacy)).toBeInTheDocument();expect(screen.queryByText(copy.truncated)).not.toBeInTheDocument();
    // Closing and reopening keeps what was read; it does not ask again.
    await user.click(toggle);expect(screen.queryByRole('heading',{name:copy.title})).not.toBeInTheDocument();
    await user.click(toggle);expect(screen.getByRole('heading',{name:copy.title})).toBeInTheDocument();
    expect(transport.fetch).toHaveBeenCalledTimes(2);
  });
  it('says so when the period has no written questions or was cut short',async()=>{
    const user=userEvent.setup();transport.fetch.mockResolvedValueOnce(admin());render(view());
    transport.fetch.mockResolvedValueOnce(metrics({totals:{answered:0,uncovered:0,typed_navigation:0,sources:0,unavailable:0},
      uncovered_rate:null,uncovered_by_node:[],answered_by_node:[],truncated:true}));
    await user.click(await screen.findByRole('button',{name:LABEL}));
    expect(await screen.findByText(copy.empty)).toBeInTheDocument();expect(screen.getByText(copy.truncated)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();expect(screen.queryByText(copy.answered)).not.toBeInTheDocument();
  });
  it('is absent from the public reader and when the server does not name it',async()=>{
    transport.fetch.mockResolvedValueOnce(admin(false));const first=render(view());
    await screen.findByTestId('institutional-assistant');expect(screen.queryByRole('button',{name:LABEL})).not.toBeInTheDocument();
    first.unmount();
    transport.fetch.mockResolvedValueOnce(workspace({visibility:'public',can_edit:false,ui:{...assistantUi,question_metrics:LABEL}}));
    render(<InstitutionalAssistant tenantSlug="qa-knowledge" mode="public"/>);
    await screen.findByTestId('institutional-assistant');expect(screen.queryByRole('button',{name:LABEL})).not.toBeInTheDocument();
    expect(transport.fetch).toHaveBeenCalledTimes(2);
  });
  it('shows the server error text for a failed or foreign response and retries on the next opening',async()=>{
    const user=userEvent.setup();transport.fetch.mockResolvedValueOnce(admin());render(view());
    const toggle=await screen.findByRole('button',{name:LABEL});
    transport.fetch.mockResolvedValueOnce(metrics({tenant:{id:999,slug:'another-institution'}}));await user.click(toggle);
    expect(await screen.findByRole('alert')).toHaveTextContent(assistantUi.error);
    expect(screen.queryByText(copy.title)).not.toBeInTheDocument();
    transport.fetch.mockRejectedValueOnce(Object.assign(new Error('forbidden'),{status:403}));
    await user.click(toggle);await user.click(toggle);
    await waitFor(()=>expect(transport.fetch).toHaveBeenCalledTimes(3));
    expect(await screen.findByRole('alert')).toHaveTextContent(assistantUi.error);
    transport.fetch.mockResolvedValueOnce(metrics());await user.click(toggle);await user.click(toggle);
    expect(await screen.findByRole('heading',{name:copy.title})).toBeInTheDocument();
  });
});

describe('metrics contract',()=>{
  it.each([
    ['contract',{contract_version:'other'}],['tenant id',{tenant:{id:702,slug:'qa-knowledge'}}],['tenant slug',{tenant:{id:701,slug:'other'}}],
    ['days',{days:0}],['negative total',{totals:{answered:-1,uncovered:0,typed_navigation:0,sources:0,unavailable:0}}],
    ['missing total',{totals:{answered:1}}],['rate',{uncovered_rate:1.5}],['ranking count',{uncovered_by_node:[{node_id:'a',count:0,title:null,is_start:false}]}],
    ['ranking title',{answered_by_node:[{node_id:'a',count:1,title:'',is_start:false}]}],['missing label',{ui:{...copy,privacy:''}}],['truncated',{truncated:'no'}],
  ])('rejects an invalid %s',(_name,overrides)=>{
    expect(()=>parseQuestionMetrics(metrics(overrides as Record<string,unknown>),admin())).toThrow('knowledge_metrics_invalid');
  });
  it('accepts the documented response',()=>{expect(parseQuestionMetrics(metrics(),admin()).totals.uncovered).toBe(4);});
});

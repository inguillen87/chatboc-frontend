import React from 'react';
import {cleanup,render,screen,within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {assistantUi,reply,workspace} from '../../../tests/fixtures/institutional-assistant.synthetic';
const transport=vi.hoisted(()=>({fetch:vi.fn()}));
vi.mock('@/utils/api',()=>({apiFetch:(...args:unknown[])=>transport.fetch(...args)}));
import {BATTERY_MAX_QUESTIONS,KnowledgeTestBatteryPanel,readBatteryQuestions} from './InstitutionalAssistantBattery';

const copy={test_battery:'Rótulo tanda',test_battery_description:'Descripción sintética de la tanda.',test_battery_input:'Campo sintético',
  test_battery_limit:'Tope sintético {max}',test_battery_run:'Correr sintético',test_battery_stop:'Frenar sintético',
  test_battery_summary:'{answered} sobre {total} sintéticas',test_battery_question:'Col pregunta',test_battery_result:'Col resultado',
  test_battery_topic:'Col tema',test_battery_answered:'Rta sí',test_battery_uncovered:'Rta no',test_battery_sources:'Rta fuentes',
  test_battery_failed:'Rta falló',test_battery_pending:'Rta pendiente'};
const space=()=>workspace({ui:{...assistantUi,...copy}});
const empty=()=>({...reply(),nodes:[],text:'Sin cobertura sintética.',selection_performed:true});
beforeEach(()=>{transport.fetch.mockReset();});
afterEach(cleanup);

describe('batch of test questions in the administration workspace',()=>{
  it('reads one question per line without repeats and within the cap',()=>{
    expect(readBatteryQuestions('  uno \n\nUNO\ndos\r\n tres ')).toEqual(['uno','dos','tres']);
    expect(readBatteryQuestions(Array.from({length:40},(_,index)=>`pregunta ${index}`).join('\n'))).toHaveLength(BATTERY_MAX_QUESTIONS);
    expect(readBatteryQuestions('x'.repeat(900))[0]).toHaveLength(300);
  });
  it('asks through the private route only, one at a time, and reports each outcome',async()=>{
    const user=userEvent.setup();render(<KnowledgeTestBatteryPanel workspace={space()} gapMs={0}/>);
    const toggle=screen.getByRole('button',{name:copy.test_battery});
    expect(toggle).toHaveAttribute('aria-expanded','false');await user.click(toggle);
    expect(screen.getByText('Tope sintético 25')).toBeInTheDocument();
    const run=screen.getByRole('button',{name:copy.test_battery_run});expect(run).toBeDisabled();
    await user.type(screen.getByLabelText(copy.test_battery_input),'primera sintética\nsegunda sintética\ntercera sintética');
    transport.fetch.mockResolvedValueOnce(reply()).mockResolvedValueOnce(empty()).mockRejectedValueOnce(new Error('offline'));
    await user.click(run);
    expect(await screen.findByText('1 sobre 3 sintéticas')).toBeInTheDocument();
    expect(transport.fetch).toHaveBeenCalledTimes(3);
    for(const [path,options] of transport.fetch.mock.calls){
      expect(path).toBe('/api/admin/tenants/qa-knowledge/institutional-assistant/answer');
      expect(options).toMatchObject({method:'POST',tenantSlug:'qa-knowledge',omitEntityToken:true,omitChatSessionId:true});
      expect(options.body).toMatchObject({node_id:'start',revision:'b'.repeat(64)});
    }
    expect(transport.fetch.mock.calls.map(call=>call[1].body.question)).toEqual(['primera sintética','segunda sintética','tercera sintética']);
    const rows=screen.getAllByRole('row').slice(1);
    expect(within(rows[0]).getByRole('rowheader')).toHaveTextContent('primera sintética');
    expect(rows[0]).toHaveTextContent('Rta sí');expect(rows[0]).toHaveTextContent('Requisitos de la consulta');
    expect(rows[1]).toHaveTextContent('Rta no');expect(rows[2]).toHaveTextContent('Rta falló');
    expect(screen.getByRole('button',{name:copy.test_battery_run})).toBeEnabled();
  });
  it('stops on request and forgets what was typed when the version changes',async()=>{
    const user=userEvent.setup();let release:(value:unknown)=>void=()=>{};
    const view=render(<KnowledgeTestBatteryPanel workspace={space()} gapMs={0}/>);
    await user.click(screen.getByRole('button',{name:copy.test_battery}));
    await user.type(screen.getByLabelText(copy.test_battery_input),'uno sintético\ndos sintético');
    transport.fetch.mockReturnValueOnce(new Promise(resolve=>{release=resolve;}));
    await user.click(screen.getByRole('button',{name:copy.test_battery_run}));
    await user.click(await screen.findByRole('button',{name:copy.test_battery_stop}));
    release(reply());await Promise.resolve();
    expect(transport.fetch).toHaveBeenCalledTimes(1);
    expect(screen.getAllByText('Rta pendiente')).toHaveLength(2);
    view.rerender(<KnowledgeTestBatteryPanel workspace={{...space(),revision:'c'.repeat(64)}} gapMs={0}/>);
    expect(screen.getByRole('button',{name:copy.test_battery})).toHaveAttribute('aria-expanded','false');
    await user.click(screen.getByRole('button',{name:copy.test_battery}));
    expect(screen.getByLabelText(copy.test_battery_input)).toHaveValue('');expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
  it('is not offered without an incorporated version',()=>{
    render(<KnowledgeTestBatteryPanel workspace={workspace({ui:{...assistantUi,...copy},knowledge:null,revision:null,visibility:'empty'})}/>);
    expect(screen.queryByRole('button',{name:copy.test_battery})).not.toBeInTheDocument();
  });
});

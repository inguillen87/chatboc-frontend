import React from 'react';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {InstitutionalChoices,institutionalChoicePages,readInstitutionalChoiceNavigation,type InstitutionalChoiceNavigation} from './InstitutionalChoices';
const navigation:InstitutionalChoiceNavigation={more_options:'Otras opciones',previous_options:'Opciones previas',options_page:'Grupo {current} de {total}'};
const choices=(count:number)=>Array.from({length:count},(_,i)=>({code:String(i),label:`Opción ${i+1}`,target:`topic-${i}`}));
afterEach(cleanup);
describe('progressive institutional options',()=>{
 it('preserves every option and order while reserving room for navigation, up to the three-node contract limit',()=>{
  for(let count=0;count<=90;count++){
   const actions=choices(count),pages=institutionalChoicePages(actions,navigation);
   expect(pages.flat()).toEqual(actions);
   pages.forEach((page,i)=>expect(page.length+Number(i>0)+Number(i<pages.length-1)).toBeLessThanOrEqual(6));
   if(count<=6)expect(pages).toEqual([actions]);
  }
 });
 it('keeps every legacy option visible without fabricating missing navigation copy',()=>{
  const actions=choices(11);expect(institutionalChoicePages(actions,null)).toEqual([actions]);
  for(const value of [null,{}, {...navigation,more_options:' '},{...navigation,options_page:'Grupo {current}'},{...navigation,previous_options:'x'.repeat(201)}])expect(readInstitutionalChoiceNavigation(value)).toBeNull();
  expect(readInstitutionalChoiceNavigation({...navigation,other:'copy'})).toEqual(navigation);
 });
 it('walks all pages locally, announces position and places keyboard focus on the next choice',()=>{
  const actions=choices(11),onChoose=vi.fn();render(<InstitutionalChoices actions={actions} navigation={navigation} responseIdentity={actions} className="choices" renderChoice={a=><button key={a.target} onClick={()=>onChoose(a.target)}>{a.label}</button>}/>);
  expect(screen.getByRole('status')).toHaveTextContent('Grupo 1 de 3');expect(screen.queryByRole('button',{name:'Opción 5'})).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Otras opciones'}));expect(screen.getByRole('button',{name:'Opción 5'})).toHaveFocus();expect(screen.getAllByRole('button')).toHaveLength(6);
  fireEvent.click(screen.getByRole('button',{name:'Otras opciones'}));expect(screen.getByRole('status')).toHaveTextContent('Grupo 3 de 3');expect(screen.getByRole('button',{name:'Opción 9'})).toHaveFocus();
  expect(screen.queryByRole('button',{name:'Otras opciones'})).not.toBeInTheDocument();expect(onChoose).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'Opción 11'}));expect(onChoose).toHaveBeenCalledWith('topic-10');
  fireEvent.click(screen.getByRole('button',{name:'Opciones previas'}));expect(screen.getByRole('button',{name:'Opción 5'})).toHaveFocus();
 });
 it('resets a new tenant/revision/answer immediately and disables both paging directions during a pending operation',()=>{
  const actions=choices(11),identity={},view=(id:unknown,disabled=false)=><InstitutionalChoices actions={actions} navigation={navigation} responseIdentity={id} disabled={disabled} className="choices" renderChoice={a=><button key={a.target} disabled={disabled}>{a.label}</button>}/>;
  const mounted=render(view(identity));fireEvent.click(screen.getByRole('button',{name:'Otras opciones'}));mounted.rerender(view(identity,true));
  expect(screen.getByRole('button',{name:'Otras opciones'})).toBeDisabled();expect(screen.getByRole('button',{name:'Opciones previas'})).toBeDisabled();
  fireEvent.click(screen.getByRole('button',{name:'Otras opciones'}));expect(screen.getByRole('status')).toHaveTextContent('Grupo 2 de 3');
  mounted.rerender(view({}));expect(screen.getByRole('status')).toHaveTextContent('Grupo 1 de 3');expect(screen.getByRole('button',{name:'Opción 1'})).toBeVisible();expect(screen.queryByRole('button',{name:'Opciones previas'})).not.toBeInTheDocument();
  mounted.rerender(view(identity));expect(screen.getByRole('status')).toHaveTextContent('Grupo 1 de 3');
 });
});

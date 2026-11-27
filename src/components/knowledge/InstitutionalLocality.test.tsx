import React from 'react';
import {fireEvent,render,screen} from '@testing-library/react';
import {beforeEach,describe,expect,it,vi} from 'vitest';
import {InstitutionalLocality,mentionsLocality,readInstitutionalLocality,rememberInstitutionalLocality} from './InstitutionalLocality';

const places=[{label:'Ushuaia',target:'a'},{label:'Río Grande',target:'b'},{label:'Tolhuin',target:'c'}];

describe('InstitutionalLocality',()=>{
  beforeEach(()=>window.localStorage.clear());
  it('offers every published place as a button and reports the choice',()=>{
    const onChange=vi.fn();
    render(<InstitutionalLocality localities={places} value={null} onChange={onChange}/>);
    expect(screen.getByRole('heading',{name:'¿Desde qué ciudad consultás?'})).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'Río Grande'}));
    expect(onChange).toHaveBeenCalledWith('Río Grande');
  });
  it('shows the chosen place and lets the reader change it',()=>{
    const onChange=vi.fn();
    render(<InstitutionalLocality localities={places} value="Tolhuin" onChange={onChange}/>);
    expect(screen.getByText('Tolhuin')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'Cambiar ciudad'}));
    expect(onChange).toHaveBeenCalledWith(null);
  });
  it('renders nothing when the organization published no places',()=>{
    const {container}=render(<InstitutionalLocality localities={[]} value={null} onChange={()=>{}}/>);
    expect(container).toBeEmptyDOMElement();
  });
  it('remembers only a place that is still published',()=>{
    rememberInstitutionalLocality('demo','Ushuaia');
    expect(readInstitutionalLocality('demo',places)).toBe('Ushuaia');
    expect(readInstitutionalLocality('demo',[{label:'Otra',target:'x'}])).toBeNull();
    expect(readInstitutionalLocality('otra-org',places)).toBeNull();
    rememberInstitutionalLocality('demo',null);
    expect(readInstitutionalLocality('demo',places)).toBeNull();
  });
  it('recognises an option of the chosen place',()=>{
    expect(mentionsLocality('CUD en Río Grande','Río Grande')).toBe(true);
    expect(mentionsLocality('CUD en Ushuaia','Río Grande')).toBe(false);
    expect(mentionsLocality('CUD en Ushuaia',null)).toBe(false);
  });
});

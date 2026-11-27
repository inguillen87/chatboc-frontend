import React from 'react';
import {fireEvent,render,screen} from '@testing-library/react';
import {beforeEach,describe,expect,it,vi} from 'vitest';
import {InstitutionalLocality,mentionsLocality,nearestInstitutionalLocality,readInstitutionalLocality,rememberInstitutionalLocality} from './InstitutionalLocality';

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
  const located=[{label:'Ushuaia',target:'a',lat:-54.8019,lng:-68.303},{label:'Río Grande',target:'b',lat:-53.7877,lng:-67.7095},{label:'Tolhuin',target:'c',lat:-54.5108,lng:-67.1955}];
  it('finds the closest published place and ignores positions far from all of them',()=>{
    expect(nearestInstitutionalLocality(located,-54.79,-68.31)).toBe('Ushuaia');
    expect(nearestInstitutionalLocality(located,-53.80,-67.70)).toBe('Río Grande');
    expect(nearestInstitutionalLocality(located,-34.60,-58.38)).toBeNull();
    expect(nearestInstitutionalLocality(places,-54.79,-68.31)).toBeNull();
  });
  it('offers the device location only when every place published its centre',()=>{
    const geolocation={getCurrentPosition:vi.fn((ok:(p:unknown)=>void)=>ok({coords:{latitude:-54.51,longitude:-67.2}}))};
    Object.defineProperty(navigator,'geolocation',{configurable:true,value:geolocation});
    const onChange=vi.fn();
    const {unmount}=render(<InstitutionalLocality localities={located} value={null} onChange={onChange}/>);
    fireEvent.click(screen.getByRole('button',{name:'Usar mi ubicación'}));
    expect(onChange).toHaveBeenCalledWith('Tolhuin');
    unmount();
    render(<InstitutionalLocality localities={places} value={null} onChange={onChange}/>);
    expect(screen.queryByRole('button',{name:'Usar mi ubicación'})).toBeNull();
  });
  it('explains what to do when the location cannot be used',()=>{
    Object.defineProperty(navigator,'geolocation',{configurable:true,value:{getCurrentPosition:(_:unknown,fail:()=>void)=>fail()}});
    const onChange=vi.fn();
    render(<InstitutionalLocality localities={located} value={null} onChange={onChange}/>);
    fireEvent.click(screen.getByRole('button',{name:'Usar mi ubicación'}));
    expect(screen.getByRole('status')).toHaveTextContent('No pudimos usar tu ubicación. Elegí tu ciudad de la lista.');
    expect(onChange).not.toHaveBeenCalled();
  });
});

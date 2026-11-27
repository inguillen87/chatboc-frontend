import React from 'react';
import {render,screen} from '@testing-library/react';
import {describe,expect,it} from 'vitest';
import {InstitutionalTextBlocks} from './InstitutionalTextBlocks';

const links=()=>screen.queryAllByRole('link').map(link=>[link.textContent,link.getAttribute('href')]);

describe('contact links in an institutional answer',()=>{
  it('turns phone numbers and e-mail addresses into links without changing the text',()=>{
    const text='• Teléfono: 2901-616013.\n• WhatsApp de la Secretaría: (02901) 402508.\n• Correo: oficina@ejemplo.gob.ar.\n\nLínea gratuita 0800 222 1002, opción 5, o 0800-222-0676.';
    const {container}=render(<InstitutionalTextBlocks text={text}/>);
    expect(links()).toEqual([
      ['2901-616013','tel:2901616013'],
      ['(02901) 402508','tel:02901402508'],
      ['oficina@ejemplo.gob.ar','mailto:oficina@ejemplo.gob.ar'],
      ['0800 222 1002','tel:08002221002'],
      ['0800-222-0676','tel:08002220676'],
    ]);
    expect(container.textContent).toContain('Correo: oficina@ejemplo.gob.ar.');
    expect(container.textContent).toContain('Teléfono: 2901-616013.');
  });
  it('leaves addresses, laws, hours, years and bare short numbers alone',()=>{
    render(<InstitutionalTextBlocks text={'Piedrabuena 757, CP 9420. Ley 27.351 de 2017. De 08:00 a 14:30. Edición 2025. Interno 616269. Planilla RECS 01 versión 2.0.'}/>);
    expect(links()).toEqual([]);
  });
});

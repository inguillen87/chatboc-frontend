import React from 'react';
import {cleanup,render,screen,within} from '@testing-library/react';
import {afterEach,describe,expect,it} from 'vitest';
import {InstitutionalTextBlocks} from './InstitutionalTextBlocks';

afterEach(cleanup);
describe('institutional plain text reading blocks',()=>{
 it('preserves paragraph and list reading order, including supplied numbering',()=>{
  const {container}=render(<InstitutionalTextBlocks text={'Antes de presentar.\n\n• Documento original\n• Copia legible\n\nDespués de reunirlos.\n3. Primera consulta\n5) Consulta posterior\n\nConfirmá con el equipo.'}/>);
  expect(Array.from(container.children,element=>element.tagName)).toEqual(['P','UL','P','OL','P']);
  const lists=screen.getAllByRole('list');
  expect(within(lists[0]).getAllByRole('listitem').map(item=>item.textContent)).toEqual(['Documento original','Copia legible']);
  expect(lists[1]).toHaveAttribute('start','3');
  const steps=within(lists[1]).getAllByRole('listitem');
  expect(steps.map(item=>item.textContent)).toEqual(['Primera consulta','Consulta posterior']);
  expect(steps[0]).toHaveAttribute('value','3');expect(steps[1]).toHaveAttribute('value','5');
  expect(container.firstElementChild).toHaveTextContent('Antes de presentar.');
  expect(container.lastElementChild).toHaveTextContent('Confirmá con el equipo.');
 });
 it('retains line breaks and a visibly indented continuation in its list item',()=>{
  const {container}=render(<InstitutionalTextBlocks text={'Primera línea.\r\nSegunda línea.\r\n\r\n- Copia del documento\r\n  Ambos lados legibles.\r\n* Comprobante vigente\r\nObservación final.'}/>);
  expect(container.querySelector('p')?.textContent).toBe('Primera línea.\nSegunda línea.');
  expect(screen.getAllByRole('listitem').map(item=>item.textContent)).toEqual(['Copia del documento\n  Ambos lados legibles.','Comprobante vigente']);
  expect(container.lastElementChild?.textContent).toBe('Observación final.');
 });
 it('renders supplied HTML and Markdown literally without creating links or active markup',()=>{
  const literal='<script>literal()</script> [Referencia](https://example.test/nota)';
  const {container}=render(<InstitutionalTextBlocks text={`${literal}\n\n• <img src=x onerror=literal()>\n1. **Texto literal**`}/>);
  expect(screen.getByText(literal)).toBeVisible();
  expect(screen.getAllByRole('listitem').map(item=>item.textContent)).toEqual(['<img src=x onerror=literal()>','**Texto literal**']);
  expect(container.querySelector('script,img,a')).toBeNull();
 });
 it('keeps incidental symbols and numbers as paragraphs unless a list marker is explicit',()=>{
  const {container}=render(<InstitutionalTextBlocks text={'-Documento sin marcador\n3.14 es un número\n1.Documento\n\n   \n•Sin espacio'}/>);
  expect(screen.queryByRole('list')).not.toBeInTheDocument();
  expect(container.querySelectorAll('p')).toHaveLength(2);
  expect(container.firstElementChild?.textContent).toBe('-Documento sin marcador\n3.14 es un número\n1.Documento');
  expect(container.lastElementChild?.textContent).toBe('•Sin espacio');
 });
});

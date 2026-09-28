import React from 'react';
import {render,screen} from '@testing-library/react';
import {describe,expect,it} from 'vitest';
import type {Order} from '@/types/unified';
import {OrderAmountCoverage} from './OrderAmountCoverage';
describe('reported totals by currency',()=>{
 it('shows the loaded population, separate currencies and excluded rows',()=>{
  const rows=[{total:100,currency:'ARS'},{total:25,currency:'USD'},{total:null},{total:100,currency:'USD',totals:{monetary:999}}] as Order[];
  render(<OrderAmountCoverage orders={rows}/>);
  expect(screen.getByText('ARS 100,00')).toBeInTheDocument();expect(screen.getByText('USD 25,00')).toBeInTheDocument();
  expect(screen.getByText(/Se agrupan 2 de 4 pedidos cargados/)).toBeInTheDocument();
  expect(screen.getByText(/1 sin importe o moneda/)).toBeInTheDocument();expect(screen.getByText(/1 con datos a revisar/)).toBeInTheDocument();
  expect(screen.queryByText(/125,00/)).not.toBeInTheDocument();
 });
 it('does not present an empty list as zero sales',()=>{
  render(<OrderAmountCoverage orders={[]}/>);
  expect(screen.getByText('No hay totales con importe y moneda informados.')).toBeInTheDocument();
  expect(screen.queryByText(/ARS|USD|0,00/)).not.toBeInTheDocument();
 });
});

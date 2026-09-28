import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Order } from '@/types/unified';
import { OrderAmountBreakdown } from './OrderAmountBreakdown';
const order = (patch:Record<string,unknown>={})=>({id:'market:42',items:[],status:'confirmed',created_at:'',total:null,...patch}) as Order;
describe('published amount breakdown',()=>{
  it('shows a discounted subtotal instead of unit price times quantity',()=>{
    render(<OrderAmountBreakdown order={order({total:175,currency:'USD',items:[{name:'Artículo',quantity:2,price:100,subtotal:170}]})} />);
    expect(screen.getByTestId('order-published-total')).toHaveTextContent(/USD.*175/);
    expect(screen.getByText(/USD.*170/)).toBeInTheDocument();
    expect(screen.queryByText(/USD.*200/)).not.toBeInTheDocument();
  });
  it('never renders missing prices or quantities as zero or one',()=>{
    render(<OrderAmountBreakdown order={order({items:[{name:'Sin precio'}]})} />);
    expect(screen.getByText('Cantidad no informada')).toBeInTheDocument();
    expect(screen.getByTestId('order-published-total')).toHaveTextContent('Importe no informado');
    expect(screen.queryByText(/ARS|USD|\$|1 x|0,00/)).not.toBeInTheDocument();
  });
  it('keeps explicit zero visible, including a free line',()=>{
    render(<OrderAmountBreakdown order={order({total:0,currency:'ARS',items:[{name:'Bonificado',quantity:0,price:100,subtotal:0}]})} />);
    expect(screen.getByTestId('order-published-total')).toHaveAttribute('data-amount-state','reported');
    expect(screen.getByTestId('order-published-total')).toHaveTextContent(/ARS.*0,00/);
    expect(screen.getByText('0')).toBeInTheDocument();
  });
  it('does not display a contradictory total as authoritative',()=>{
    render(<OrderAmountBreakdown order={order({total:100,totals:{monetary:200,currency:'ARS'}})} />);
    expect(screen.getByTestId('order-published-total')).toHaveTextContent('Importe a revisar');
    expect(screen.getByRole('status')).toHaveTextContent('requieren revisión');
  });
  it('does not imply pesos when the amount is known but currency is missing',()=>{
    render(<OrderAmountBreakdown order={order({total:100})} />);
    expect(screen.getByTestId('order-published-total')).toHaveTextContent('100 · Moneda no informada');
  });
});

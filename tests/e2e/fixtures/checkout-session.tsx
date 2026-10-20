import React from 'react';
import {createRoot} from 'react-dom/client';
import {MemoryRouter,Routes,Route,useNavigate} from 'react-router-dom';
import MarketCheckoutPage from '@/pages/tenant/market/MarketCheckoutPage';
import '@/index.css';
function Fixture(){
 const navigate=useNavigate();
 (window as any).__gotoCheckout=(tenant:string)=>navigate(`/${tenant}/checkout`);
 return <main><MarketCheckoutPage/></main>;
}
createRoot(document.getElementById('root')!).render(<MemoryRouter initialEntries={['/qa-a/checkout']}><Routes><Route path="/:tenant/checkout" element={<Fixture/>}/></Routes></MemoryRouter>);

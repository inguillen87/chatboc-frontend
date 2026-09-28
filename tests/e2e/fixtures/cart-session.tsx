import React from 'react';
import {createRoot} from 'react-dom/client';
import {MemoryRouter,Routes,Route,useNavigate} from 'react-router-dom';
import MarketProductPage from '@/pages/tenant/market/MarketProductPage';
import '@/index.css';
function Fixture(){
 const navigate=useNavigate();
 (window as any).__gotoCartProduct=(tenant:string)=>navigate(`/t/${encodeURIComponent(tenant)}/product/product-1`);
 return <Routes><Route path="/t/:tenant/product/:slug" element={<MarketProductPage/>}/></Routes>;
}
createRoot(document.getElementById('root')!).render(<MemoryRouter initialEntries={['/t/qa-a/product/product-1']}><Fixture/></MemoryRouter>);

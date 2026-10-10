import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'sonner';
import AdminOrderDetailPage from '@/pages/admin/AdminOrderDetailPage';
import OrderTrackingPage from '@/pages/pyme/pedidos/OrderTrackingPage';
import '@/index.css';
const admin = new URLSearchParams(location.search).get('view') === 'admin';
createRoot(document.getElementById('root')!).render(<MemoryRouter initialEntries={[admin ? '/admin/market:42' : '/tracking/PED-QA-9001']}>
  <Routes><Route path="/admin/:id" element={<AdminOrderDetailPage />} /><Route path="/tracking/:nro_pedido" element={<OrderTrackingPage />} /></Routes><Toaster />
</MemoryRouter>);

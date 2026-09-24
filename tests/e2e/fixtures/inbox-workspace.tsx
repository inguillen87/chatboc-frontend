import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TicketInboxPage } from '@/components/tickets/inbox/TicketInboxPage';
import '@/index.css';
const client = new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});
(window as any).__qaRefreshInboxDetail = () => client.invalidateQueries({queryKey:['inbox-omnichannel-v2-detail']});
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={client}><main><TicketInboxPage /></main></QueryClientProvider>);

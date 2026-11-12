import React from 'react';
import {createRoot} from 'react-dom/client';
import {MemoryRouter} from 'react-router-dom';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import UsuariosPage from '@/pages/UsuariosPage';
import '@/index.css';
const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
const qa=window as any;
qa.__directoryCache=()=>client.getQueriesData({queryKey:['crm-people-directory-v2']});
qa.__refreshDirectory=()=>client.invalidateQueries({queryKey:['crm-people-directory-v2']});
function Fixture(){
 const [tenant,setTenant]=React.useState('qa-a');
 qa.__setDirectoryTenant=setTenant;
 return <main><UsuariosPage tenantSlugOverride={tenant} /></main>;
}
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/admin/usuarios']}><Fixture/></MemoryRouter></QueryClientProvider>);

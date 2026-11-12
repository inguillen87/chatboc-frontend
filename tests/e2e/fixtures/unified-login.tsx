import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter,Routes,Route} from 'react-router-dom';
import Login from '@/pages/Login';
import {apiFetch} from '@/utils/api';
import '@/index.css';
function AccountPanel(){
  const [data,setData]=useState<any>(null),[error,setError]=useState(false);
  useEffect(()=>{let active=true;void apiFetch('/api/me',{omitTenant:true}).then(value=>{if(active)setData(value);}).catch(()=>{if(active)setError(true);});return()=>{active=false;};},[]);
  return <main style={{padding:24}}><h1>Cuenta institucional de prueba</h1>
    {error?<p role="alert">No se pudo comprobar la cuenta</p>:data?<dl data-testid="verified-account">
      <dt>Usuario</dt><dd data-testid="account-id">{data.id}</dd><dt>Organización</dt><dd data-testid="account-tenant">{data.tenant_slug||data.tenantSlug}</dd>
    </dl>:<p role="status">Verificando cuenta…</p>}
  </main>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><BrowserRouter><Routes>
  <Route path="/login" element={<Login/>}/><Route path="/t/:tenant/login" element={<Login/>}/>
  <Route path="/perfil" element={<AccountPanel/>}/><Route path="*" element={<p>Ruta no esperada en el ensayo</p>}/>
</Routes></BrowserRouter></React.StrictMode>);

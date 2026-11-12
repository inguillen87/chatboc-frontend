import React from 'react';
import {createRoot} from 'react-dom/client';
import {MemoryRouter,useLocation,useNavigate} from 'react-router-dom';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import {setFixtureState} from './private-navigation.providers';
import '@/index.css';
function Fixture(){
  const location=useLocation(),navigate=useNavigate();
  return <div style={{minHeight:'100vh',display:'flex',flexDirection:'column'}}><Navbar/>
    <main style={{flex:1,padding:'8rem 1rem 3rem',maxWidth:1120,width:'100%',margin:'0 auto'}}>
      <h1 className="text-2xl font-semibold">Panel privado · prueba aislada</h1><p className="my-3">Identidad y cuenta sintéticas, sin llamadas a datos de clientes.</p>
      <output data-testid="current-route">{location.pathname+location.search}</output>
      <div className="flex flex-wrap gap-3 mt-6">{(['ready','refreshing','other','revoked','mismatch'] as const).map(mode=><button className="border rounded-md p-3" key={mode} onClick={()=>setFixtureState(mode)}>{mode}</button>)}</div>
      <div className="flex flex-wrap gap-3 mt-5"><button className="border rounded-md p-3" onClick={()=>navigate('/perfil?tab=crm')}>Cambiar sección</button>
        <button className="border rounded-md p-3" onClick={()=>navigate('/login')}>Acceso central</button></div>
    </main><Footer/></div>;
}
createRoot(document.getElementById('root')!).render(<MemoryRouter initialEntries={['/perfil?tab=tickets']}><Fixture/></MemoryRouter>);

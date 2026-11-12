import React from 'react';
import {createRoot} from 'react-dom/client';
import {MemoryRouter,Route,Routes,useNavigate} from 'react-router-dom';
import routeConfig from '@/routesConfig';
import '@/index.css';

// Route elements come from the real registry. The fixture provides a verified
// session boundary; this does not certify an external login provider.
const testedRoutes=['/implementacion','/admin/knowledge'].map(path=>{
  const route=routeConfig.find(item=>item.path===path);
  if(!route)throw new Error('Missing registered application route: '+path);
  return route;
});
function Fixture(){
  const navigate=useNavigate();
  (window as any).__openKnowledgeConsole=()=>navigate('/admin/knowledge?tenant_slug=qa-knowledge');
  return <main className="px-4 sm:px-6"><React.Suspense fallback={null}>
    <Routes>{testedRoutes.map(route=><Route key={route.path} path={route.path} element={route.element}/>)}</Routes>
  </React.Suspense></main>;
}
createRoot(document.getElementById('root')!).render(<MemoryRouter initialEntries={['/implementacion?tenant_slug=qa-knowledge']}><Fixture/></MemoryRouter>);

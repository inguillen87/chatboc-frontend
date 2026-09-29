import React from 'react';
import {createRoot} from 'react-dom/client';
import ChannelActivationChecklist from '@/components/profile/ChannelActivationChecklist';
import '@/index.css';
function Fixture(){const [actor,setActor]=React.useState('actor-a');(window as any).__setGuideActor=setActor;
 return <main style={{maxWidth:1000,margin:'auto',padding:16}}><h1>Preparación QA</h1>
  <ChannelActivationChecklist tenantSlug="qa-guide" privateGuideSessionKey={actor} presentation="launch-journey"/>
 </main>;}
createRoot(document.getElementById('root')!).render(<Fixture/>);

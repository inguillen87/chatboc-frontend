import React from 'react';
import {createRoot} from 'react-dom/client';
import ChannelActivationChecklist from '@/components/profile/ChannelActivationChecklist';
import '@/index.css';
function Fixture(){
 const [verified,setVerified]=React.useState(true);
 (window as any).__retireGuideControl=()=>setVerified(false);
 return <main style={{maxWidth:900,margin:'auto',padding:16}}><h1>Administración QA</h1><ChannelActivationChecklist tenantSlug="guide-control-qa" privateGuideSessionKey={verified?'verified-qa':''} presentation="launch-journey"/></main>;
}
createRoot(document.getElementById('root')!).render(<Fixture/>);

import React from 'react';
import {createRoot} from 'react-dom/client';
import ChannelActivationChecklist from '@/components/profile/ChannelActivationChecklist';
import {SessionAuthorityProvider} from '@/components/access/SessionAuthorityContext';
import {UserProvider,useUser} from '@/hooks/useUser';
import {usePanelSessionStore} from '@/stores';
import {advanceChatbocSessionRevision} from '@/utils/chatbocSessionRevision';
import {registerActiveClerkIdentity} from '@/utils/sessionRetirement';
import '@/index.css';
// This simulated Clerk authority never contacts Clerk or creates a JWT. The
// real UserProvider must still receive its controlled loopback /api/me result.
function establishActor(actor:string){
 localStorage.setItem('authProvider','clerk');localStorage.setItem('clerkUserId',actor);
 localStorage.setItem('clerkSessionTransport','cookie');
 registerActiveClerkIdentity(actor,`synthetic-session-${actor}`);
 usePanelSessionStore.getState().setUser({id:(actor==='actor-a'?941:942) as unknown as string,
  email:`${actor}@example.invalid`,rol:'admin',name:actor,tenant_slug:'guide-control-qa'});
}
establishActor('actor-a');
function Workspace(){
 const {refreshUser,organizationProfileVerified,loading}=useUser();
 React.useEffect(()=>{void refreshUser();},[refreshUser]);
 return <main style={{maxWidth:900,margin:'auto',padding:16}}><h1>Administración QA</h1>
  <span data-testid="profile-authority">{loading?'pending':organizationProfileVerified?'verified':'unverified'}</span>
  <ChannelActivationChecklist tenantSlug="guide-control-qa" privateGuideSessionKey="synthetic-verified-control" presentation="launch-journey"/>
 </main>;
}
function Fixture(){
 const [verified,setVerified]=React.useState(false);
 (window as any).__setControlSessionVerified=setVerified;
 (window as any).__controlActorABA=()=>{establishActor('actor-b');establishActor('actor-a');};
 (window as any).__retireGuideControl=()=>{advanceChatbocSessionRevision();setVerified(false);};
 return <SessionAuthorityProvider value={{clerkStatus:verified?'ready':'syncing',hasBearerSession:false,hasVerifiedSession:verified}}>
  <UserProvider><Workspace/></UserProvider>
 </SessionAuthorityProvider>;
}
createRoot(document.getElementById('root')!).render(<Fixture/>);

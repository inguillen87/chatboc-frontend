import React from 'react';
import {createRoot} from 'react-dom/client';
import ChannelActivationChecklist from '@/components/profile/ChannelActivationChecklist';
import {SessionAuthorityProvider} from '@/components/access/SessionAuthorityContext';
import {UserProvider,useUser} from '@/hooks/useUser';
import {usePanelSessionStore} from '@/stores';
import {advanceChatbocSessionRevision} from '@/utils/chatbocSessionRevision';
import {registerActiveClerkIdentity} from '@/utils/sessionRetirement';
import '@/index.css';
// Synthetic Clerk authority is explicit. No token/JWT/provider is created or
// verified here; /api/me is controlled by the loopback browser test below.
const actorUser=(actor:string)=>({id:(actor==='actor-a'?741:742) as unknown as string,
 email:`${actor}@example.invalid`,rol:'admin',name:actor,tenant_slug:'qa-guide'});
function establishActor(actor:string){
 localStorage.setItem('authProvider','clerk');localStorage.setItem('clerkUserId',actor);
 localStorage.setItem('clerkSessionTransport','cookie');
 registerActiveClerkIdentity(actor,`synthetic-session-${actor}`);
 usePanelSessionStore.getState().setUser(actorUser(actor));
}
establishActor('actor-a');
function Workspace({actor,profileAttempt}:{actor:string;profileAttempt:number}){
 const {refreshUser,organizationProfileVerified,loading}=useUser();
 React.useEffect(()=>{void refreshUser();},[actor,profileAttempt,refreshUser]);
 return <main style={{maxWidth:1000,margin:'auto',padding:16}}><h1>Preparación QA</h1>
  <span data-testid="profile-authority">{loading?'pending':organizationProfileVerified?'verified':'unverified'}</span>
  <ChannelActivationChecklist tenantSlug="qa-guide" privateGuideSessionKey={actor} presentation="launch-journey"/>
 </main>;}
function Fixture(){
 const [actor,setActor]=React.useState('actor-a');const [verified,setVerified]=React.useState(false);
 const [profileAttempt,setProfileAttempt]=React.useState(0);
 (window as any).__setGuideActor=(next:string)=>{establishActor(next);setActor(next);};
 (window as any).__setGuideSessionVerified=setVerified;
 (window as any).__refreshGuideProfile=()=>setProfileAttempt(value=>value+1);
 (window as any).__retireGuideSession=()=>{advanceChatbocSessionRevision();setVerified(false);};
 return <SessionAuthorityProvider value={{clerkStatus:verified?'ready':'syncing',hasBearerSession:false,hasVerifiedSession:verified}}>
  <UserProvider><Workspace actor={actor} profileAttempt={profileAttempt}/></UserProvider>
 </SessionAuthorityProvider>;
}
createRoot(document.getElementById('root')!).render(<Fixture/>);

import React from 'react';
import {createRoot} from 'react-dom/client';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import CrmPeopleWorkspace,{type CrmPeopleRecord} from '@/features/crm/people/CrmPeopleWorkspace';
import '@/index.css';
const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
const qa=window as any;
qa.__historyOpened=[];
qa.__refreshHistory=()=>client.invalidateQueries({queryKey:['crm','contact-history']});
qa.__cachedHistory=()=>client.getQueriesData({queryKey:['crm','contact-history']});
const people:CrmPeopleRecord[]=[
 {id:'42',contactId:'42',nombre:'Contacto Alfa',email:'alfa@example.test',telefono:'',etiquetas:[],canal:'web'},
 {id:'84',contactId:'84',nombre:'Contacto Beta',email:'beta@example.test',telefono:'',etiquetas:[],canal:'web'},
];
function Fixture(){
 const [selected,onSelect]=React.useState('42');
 const [tenant,setTenant]=React.useState('qa-a');
 const [queue,setQueue]=React.useState<'all'|'review'|'whatsapp'|'complete'>('all');
 const [sort,setSort]=React.useState<'recent'|'name'|'score-desc'|'score-asc'>('recent');
 qa.__setHistoryTenant=setTenant;qa.__selectHistoryContact=onSelect;
 const noop=()=>{};
 return <main><CrmPeopleWorkspace tenantSlug={tenant} activeView="personas" onViewChange={noop}
  people={people} selectedContactId={selected} onSelectContact={onSelect} selectedIds={new Set()} onToggleSelected={noop} onSetSelected={noop} onClearSelected={noop}
  queueView={queue} onQueueViewChange={setQueue} peopleSort={sort} onPeopleSortChange={setSort} search="" onSearchChange={noop} marketingOnly={false} onMarketingOnlyChange={noop}
  peopleTotal={2} hasMore={false} onLoadMore={noop} onRefresh={noop} onBack={noop} onOpenTicketDesk={href=>qa.__historyOpened.push(href)} isConnected
  metrics={[]} getPersonKey={person=>person.contactId||String(person.id)} hasRealEmail={()=>true} hasExplicitWhatsApp={()=>false} whatsappUrl={()=>null} dataQualityScore={()=>65}
  formatDate={value=>value||'Sin fecha'} copyToClipboard={noop} segmentsPanel={null} campaignsPanel={null} activityPanel={null}/></main>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><QueryClientProvider client={client}><Fixture/></QueryClientProvider></React.StrictMode>);

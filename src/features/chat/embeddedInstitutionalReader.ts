import {useSyncExternalStore} from 'react';

// A page that already shows the published institutional reader as its main
// content must not also float an unsolicited greeting over it. The launcher
// itself stays: this only reports presence, for any tenant, to the widget.
const listeners=new Set<()=>void>();
let mounted=0;
const emit=()=>{for(const listener of [...listeners])listener();};

/** Announce one mounted, published reader. Returns its (idempotent) release. */
export function registerEmbeddedInstitutionalReader():()=>void {
  mounted++;emit();
  let released=false;
  return()=>{if(released)return;released=true;mounted--;emit();};
}
const subscribe=(listener:()=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener);};};
export const hasEmbeddedInstitutionalReader=()=>mounted>0;
export function useEmbeddedInstitutionalReader():boolean {
  return useSyncExternalStore(subscribe,hasEmbeddedInstitutionalReader,()=>false);
}

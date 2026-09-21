import React from 'react';
import { createRoot } from 'react-dom/client';
import ModuleSelectionGrid from '@/components/implementation/ModuleSelectionGrid';
import { readModuleSelection } from '@/utils/organizationModules';
import snapshotFixture from '../../fixtures/organization-modules.json';
import assistance from '../../fixtures/module-selection-assistance.json';
import styles from '@/components/implementation/OrganizationModuleSelector.module.css';
import '@/index.css';

const snapshot=readModuleSelection({...snapshotFixture.full,selection_assistance:assistance},'tenant-a')!;
function Fixture(){
  const [draft,setDraft]=React.useState(snapshot.selected);
  const [changes,setChanges]=React.useState(0);
  return <main className="mx-auto max-w-5xl p-4" data-testid="assisted-workspace" data-selected={JSON.stringify(draft)} data-changes={changes}>
    <section className={styles.panel}><h1 className="text-xl font-semibold">{snapshot.ui.heading}</h1>
      <ModuleSelectionGrid snapshot={snapshot} draft={draft} disabled={false} onChange={value=>{setDraft(value);setChanges(c=>c+1);}}/>
    </section>
  </main>;
}
createRoot(document.getElementById('root')!).render(<Fixture/>);

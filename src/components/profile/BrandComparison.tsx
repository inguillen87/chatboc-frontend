import React from 'react';
import type {BrandValues} from '@/utils/workspaceBranding';
import type {BrandWorkflowCopy} from '@/utils/brandWorkflowUI';
import {isBrandColor} from '@/utils/workspaceBranding';
import styles from './OrganizationBrandStudio.module.css';
interface Props {saved:BrandValues;proposed:BrandValues;copy:BrandWorkflowCopy;label?:string}
/** All field labels, states and actions are backend-controlled plain text. */
export function BrandComparison({saved,proposed,copy:ui,label}:Props){
  const rows=[
    {key:'enabled',changed:saved.enabled!==proposed.enabled,label:ui.application_label,before:saved.enabled?ui.enabled_label:ui.disabled_label,after:proposed.enabled?ui.enabled_label:ui.disabled_label},
    {key:'primary_color',changed:saved.primary_color.toUpperCase()!==proposed.primary_color.toUpperCase(),label:ui.primary_label,before:saved.primary_color.toUpperCase(),after:proposed.primary_color.toUpperCase()},
    {key:'accent_color',changed:saved.accent_color.toUpperCase()!==proposed.accent_color.toUpperCase(),label:ui.accent_label,before:saved.accent_color.toUpperCase(),after:proposed.accent_color.toUpperCase()},
  ];
  return <div className={styles.comparison} role="group" aria-label={label??ui.comparison_label}>
    {rows.map(row=><div key={row.key} className={styles.comparisonRow} data-changed={row.changed}>
      <strong>{row.label}<small>{row.changed?ui.changed_label:ui.unchanged_label}</small></strong>
      <div><small>{ui.saved_label}</small><span>{isBrandColor(row.before)?<i aria-hidden="true" style={{background:row.before}}/>:null}{row.before}</span></div>
      <div><small>{ui.proposed_label}</small><span>{isBrandColor(row.after)?<i aria-hidden="true" style={{background:row.after}}/>:null}{row.after}</span></div>
    </div>)}
  </div>;
}

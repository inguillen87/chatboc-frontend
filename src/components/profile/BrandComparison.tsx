import React from 'react';
import type {BrandValues} from '@/utils/workspaceBranding';
import {isBrandColor} from '@/utils/workspaceBranding';
import styles from './OrganizationBrandStudio.module.css';
interface Props {saved:BrandValues;proposed:BrandValues;label?:string}
/** Compare activation and both persisted colours without relying on colour alone. */
export function BrandComparison({saved,proposed,label='Cambios de paleta'}:Props){
  const rows=[
    {key:'enabled',label:'Aplicación',before:saved.enabled?'Activada':'Desactivada',after:proposed.enabled?'Activada':'Desactivada'},
    {key:'primary_color',label:'Color principal',before:saved.primary_color.toUpperCase(),after:proposed.primary_color.toUpperCase()},
    {key:'accent_color',label:'Color de acento',before:saved.accent_color.toUpperCase(),after:proposed.accent_color.toUpperCase()},
  ];
  return <div className={styles.comparison} role="group" aria-label={label}>
    {rows.map(row=><div key={row.key} className={styles.comparisonRow} data-changed={row.before!==row.after}>
      <strong>{row.label}<small>{row.before===row.after?'Sin cambios':'Cambiará'}</small></strong>
      <div><small>Guardado</small><span>{isBrandColor(row.before)?<i aria-hidden="true" style={{background:row.before}}/>:null}{row.before}</span></div>
      <div><small>Propuesto</small><span>{isBrandColor(row.after)?<i aria-hidden="true" style={{background:row.after}}/>:null}{row.after}</span></div>
    </div>)}
  </div>;
}

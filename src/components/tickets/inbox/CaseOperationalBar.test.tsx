import React from 'react';
import {render,screen,within} from '@testing-library/react';
import {describe,expect,it} from 'vitest';
import {CaseOperationalBar} from './CaseOperationalBar';

describe('case operational bar',()=>{
  it('keeps owner, SLA and next step visible in one region',()=>{
    render(<CaseOperationalBar assigneeLabel="Ana Operadora" sla={{status:'active'}} nextSteps={['Llamar al vecino','Cerrar caso']}/>);
    const region=screen.getByRole('region',{name:'Control operativo del caso'});
    expect(within(region).getByText('Ana Operadora')).toBeVisible();
    expect(within(region).getByText('Llamar al vecino')).toBeVisible();
    expect(within(region).getByRole('group',{name:/SLA:/})).toBeVisible();
  });
  it('does not invent owner or next step when the contract does not publish them',()=>{
    render(<CaseOperationalBar assigneeLabel={null} sla={undefined} nextSteps={[]}/>);
    const region=screen.getByRole('region',{name:'Control operativo del caso'});
    expect(within(region).getByText('Sin asignar')).toBeVisible();
    expect(within(region).getByText('Sin próximo paso publicado')).toBeVisible();
    expect(within(region).getByText('Revisá el contexto antes de responder.')).toBeInTheDocument();
  });
});

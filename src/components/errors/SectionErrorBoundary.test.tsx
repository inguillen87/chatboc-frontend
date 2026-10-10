import React from 'react';
import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import SectionErrorBoundary from './SectionErrorBoundary';
const deferred=()=>{let resolve!:()=>void;let reject!:(reason:unknown)=>void;
  const promise=new Promise<void>((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};};
function Broken({failed}:{failed:boolean}){if(failed)throw new Error('synthetic-section-failure');return <p>Contenido recuperado</p>;}
beforeEach(()=>{vi.spyOn(console,'error').mockImplementation(()=>{});});
afterEach(()=>{cleanup();vi.restoreAllMocks();});
describe('local section recovery',()=>{
  it('waits for asynchronous recovery before remounting children',async()=>{
    const gate=deferred();let failed=true;
    const retry=vi.fn(async()=>{await gate.promise;failed=false;});
    function Content(){return <Broken failed={failed}/>;}
    render(<SectionErrorBoundary onRetry={retry}><Content/></SectionErrorBoundary>);
    fireEvent.click(screen.getByRole('button',{name:'Reintentar'}));
    expect(screen.getByRole('button',{name:'Reintentando…'})).toBeDisabled();
    expect(screen.queryByText('Contenido recuperado')).not.toBeInTheDocument();
    await act(async()=>gate.resolve());
    expect(await screen.findByText('Contenido recuperado')).toBeVisible();
    expect(retry).toHaveBeenCalledOnce();
  });
  it('recovers the failed section without resetting a sibling draft',async()=>{
    let failed=true;function Content(){return <Broken failed={failed}/>;}
    render(<><input aria-label="Borrador externo" defaultValue=""/><SectionErrorBoundary onRetry={()=>{failed=false;}}><Content/></SectionErrorBoundary></>);
    fireEvent.change(screen.getByLabelText('Borrador externo'),{target:{value:'No perder este texto'}});
    fireEvent.click(screen.getByRole('button',{name:'Reintentar'}));
    await screen.findByText('Contenido recuperado');expect(screen.getByLabelText('Borrador externo')).toHaveValue('No perder este texto');
  });
});
describe('section recovery isolation and failures',()=>{
  it('runs at most one recovery callback for repeated clicks',async()=>{
    const gate=deferred(),retry=vi.fn(()=>gate.promise);
    render(<SectionErrorBoundary onRetry={retry}><Broken failed/></SectionErrorBoundary>);
    const button=screen.getByRole('button',{name:'Reintentar'});fireEvent.click(button);fireEvent.click(button);
    expect(retry).toHaveBeenCalledOnce();await act(async()=>gate.resolve());
    expect(screen.getByRole('button',{name:'Reintentar'})).toBeEnabled();
  });
  it('catches retry rejection without exposing its details or auto-repeating',async()=>{
    const gate=deferred(),retry=vi.fn(()=>gate.promise);
    render(<SectionErrorBoundary onRetry={retry}><Broken failed/></SectionErrorBoundary>);
    fireEvent.click(screen.getByRole('button',{name:'Reintentar'}));
    await act(async()=>gate.reject(new Error('private backend detail')));
    expect(screen.getByRole('status')).toHaveTextContent('No se pudo recuperar');
    expect(screen.queryByText('private backend detail')).not.toBeInTheDocument();expect(retry).toHaveBeenCalledOnce();
    expect(screen.getByRole('button',{name:'Reintentar'})).toBeEnabled();
  });
  it('also catches a synchronous retry error',async()=>{
    render(<SectionErrorBoundary onRetry={()=>{throw new Error('private sync detail');}}><Broken failed/></SectionErrorBoundary>);
    fireEvent.click(screen.getByRole('button',{name:'Reintentar'}));
    await waitFor(()=>expect(screen.getByRole('status')).toHaveTextContent('No se pudo recuperar'));
  });
  it('does not repeatedly retry a permanent rendering fault',async()=>{
    const retry=vi.fn();render(<SectionErrorBoundary onRetry={retry}><Broken failed/></SectionErrorBoundary>);
    fireEvent.click(screen.getByRole('button',{name:'Reintentar'}));
    await waitFor(()=>expect(screen.getByRole('button',{name:'Reintentar'})).toBeEnabled());expect(retry).toHaveBeenCalledOnce();
  });
  it('clears the old section error on an explicit scope change',()=>{
    const view=render(<SectionErrorBoundary resetKeys={['org-a']}><Broken failed/></SectionErrorBoundary>);
    view.rerender(<SectionErrorBoundary resetKeys={['org-b']}><Broken failed={false}/></SectionErrorBoundary>);
    expect(screen.getByText('Contenido recuperado')).toBeVisible();expect(screen.queryByRole('button',{name:'Reintentar'})).not.toBeInTheDocument();
  });
  it('does not reset because an equivalent key array was recreated',()=>{
    const view=render(<SectionErrorBoundary resetKeys={['org-a',7]}><Broken failed/></SectionErrorBoundary>);
    view.rerender(<SectionErrorBoundary resetKeys={['org-a',7]}><Broken failed={false}/></SectionErrorBoundary>);
    expect(screen.getByRole('button',{name:'Reintentar'})).toBeVisible();
  });
  it.each(['resolve','reject'] as const)('ignores old completion after an A to B to A scope change: %s',async outcome=>{
    const gate=deferred();const view=render(<SectionErrorBoundary resetKeys={['a']} onRetry={()=>gate.promise}><Broken failed/></SectionErrorBoundary>);
    fireEvent.click(screen.getByRole('button',{name:'Reintentar'}));
    view.rerender(<SectionErrorBoundary resetKeys={['b']}><Broken failed={false}/></SectionErrorBoundary>);
    view.rerender(<SectionErrorBoundary resetKeys={['a']}><Broken failed/></SectionErrorBoundary>);
    await act(async()=>{outcome==='resolve'?gate.resolve():gate.reject(new Error('Old failed callback'));});
    expect(screen.getByRole('button',{name:'Reintentar'})).toBeEnabled();
    expect(screen.getByRole('status')).not.toHaveTextContent('No se pudo recuperar');
  });
  it('does not update an unmounted section when recovery finishes',async()=>{
    const gate=deferred(),retry=vi.fn(()=>gate.promise);
    const view=render(<SectionErrorBoundary onRetry={retry}><Broken failed/></SectionErrorBoundary>);
    fireEvent.click(screen.getByRole('button',{name:'Reintentar'}));view.unmount();
    await act(async()=>gate.reject(new Error('Late rejection')));expect(retry).toHaveBeenCalledOnce();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
  it('allows the new scope to recover while a former retry is pending',async()=>{
    const old=deferred(),latest=deferred();let failed=true;
    const view=render(<SectionErrorBoundary resetKeys={['a']} onRetry={()=>old.promise}><Broken failed/></SectionErrorBoundary>);
    fireEvent.click(screen.getByRole('button',{name:'Reintentar'}));
    function Current(){return <Broken failed={failed}/>;}
    const retry=vi.fn(async()=>{await latest.promise;failed=false;});
    view.rerender(<SectionErrorBoundary resetKeys={['b']} onRetry={retry}><Current/></SectionErrorBoundary>);
    fireEvent.click(screen.getByRole('button',{name:'Reintentar'}));
    await act(async()=>old.resolve());expect(screen.getByRole('button',{name:'Reintentando…'})).toBeDisabled();
    await act(async()=>latest.resolve());expect(screen.getByText('Contenido recuperado')).toBeVisible();expect(retry).toHaveBeenCalledOnce();
  });
  it('keeps a secondary panel action available during recovery',async()=>{
    const gate=deferred();render(<SectionErrorBoundary onRetry={()=>gate.promise} fallbackAction={<a href="/perfil">Volver al panel</a>}><Broken failed/></SectionErrorBoundary>);
    fireEvent.click(screen.getByRole('button',{name:'Reintentar'}));expect(screen.getByRole('link',{name:'Volver al panel'})).toHaveAttribute('href','/perfil');
    await act(async()=>gate.resolve());
  });
  it('does not invoke a read or mutation callback while rendering healthy children',()=>{
    const retry=vi.fn();render(<SectionErrorBoundary onRetry={retry}><Broken failed={false}/></SectionErrorBoundary>);
    expect(screen.getByText('Contenido recuperado')).toBeVisible();expect(retry).not.toHaveBeenCalled();
  });
});

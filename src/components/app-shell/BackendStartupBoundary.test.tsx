import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useEffect } from 'react';
import { BackendStartupBoundary } from './BackendStartupBoundary';
import { StartupRecovery } from './StartupRecovery';
import { BackendBootstrapError } from '@/utils/backendBootstrapGate';
const mocks = vi.hoisted(() => ({ready:vi.fn(),enabled:vi.fn()}));
vi.mock('@/utils/backendBootstrapGate',async(importOriginal)=>({
  ...await importOriginal<typeof import('@/utils/backendBootstrapGate')>(),
  ensureBackendRuntimeReady:mocks.ready,isBackendBootstrapGateEnabled:mocks.enabled,
}));
const deferred=()=>{let resolve!:()=>void;let reject!:(e:unknown)=>void;
  const promise=new Promise<void>((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
beforeEach(()=>{mocks.enabled.mockReturnValue(true);mocks.ready.mockReset();vi.spyOn(navigator,'onLine','get').mockReturnValue(true);});
afterEach(()=>{cleanup();vi.useRealTimers();vi.restoreAllMocks();});
describe('initial runtime recovery',()=>{
  it('mounts no private content until the existing readiness gate confirms',async()=>{
    const request=deferred();mocks.ready.mockReturnValue(request.promise);
    render(<BackendStartupBoundary><p>Private area</p></BackendStartupBoundary>);
    expect(screen.queryByText('Private area')).toBeNull();
    expect(screen.getByRole('heading',{name:'Preparando tu espacio'})).toBeVisible();
    await act(async()=>request.resolve());
    expect(screen.getByText('Private area')).toBeVisible();
  });
  it('shows bounded waiting without a percentage or another request',async()=>{
    vi.useFakeTimers();mocks.ready.mockReturnValue(new Promise(()=>{}));
    const view=render(<BackendStartupBoundary><p>Private area</p></BackendStartupBoundary>);
    await act(async()=>vi.advanceTimersByTime(1600));
    expect(screen.getByRole('heading',{name:'Tu espacio sigue preparándose'})).toBeVisible();
    expect(screen.queryByRole('progressbar')).toBeNull();expect(mocks.ready).toHaveBeenCalledTimes(1);
    view.unmount();expect(vi.getTimerCount()).toBe(0);
  });
  it('recovers explicitly without reloading or allowing repeated pending clicks',async()=>{
    const next=deferred();mocks.ready.mockRejectedValueOnce(new Error('private token payload')).mockReturnValue(next.promise);
    render(<BackendStartupBoundary><p>Private area</p></BackendStartupBoundary>);
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos iniciar tu espacio');
    expect(document.body).not.toHaveTextContent('private token');
    fireEvent.click(screen.getByRole('button',{name:'Reintentar inicio'}));
    expect(screen.queryByRole('button',{name:'Reintentar inicio'})).toBeNull();
    expect(mocks.ready).toHaveBeenCalledTimes(2);await act(async()=>next.resolve());
    expect(screen.getByText('Private area')).toBeVisible();
  });
  it('distinguishes an incompatible publication without rendering raw errors',async()=>{
    mocks.ready.mockRejectedValue(new BackendBootstrapError('secret stack',409,{reason_code:'backend_revision_mismatch',token:'private'}));
    render(<BackendStartupBoundary><p>Private area</p></BackendStartupBoundary>);
    expect(await screen.findByRole('alert')).toHaveTextContent('Las versiones todavía no coinciden');
    expect(document.body).not.toHaveTextContent('secret stack');expect(document.body).not.toHaveTextContent('token');
    expect(screen.getByText('START_VERSION_MISMATCH')).toBeInTheDocument();
  });
  it('waits offline and rechecks only after the network event, not on a timer',async()=>{
    const pending=deferred();mocks.ready.mockReturnValue(pending.promise);
    const online=vi.spyOn(navigator,'onLine','get');
    render(<BackendStartupBoundary><p>Private area</p></BackendStartupBoundary>);
    online.mockReturnValue(false);fireEvent(window,new Event('offline'));
    expect(screen.getByRole('heading',{name:'Parece que estás sin conexión'})).toBeVisible();
    await act(async()=>pending.resolve());expect(screen.queryByText('Private area')).toBeNull();
    mocks.ready.mockResolvedValue(undefined);online.mockReturnValue(true);fireEvent(window,new Event('online'));
    expect(await screen.findByText('Private area')).toBeVisible();expect(mocks.ready).toHaveBeenCalledTimes(2);
  });
  it('does not unmount an active page or draft when the network changes',async()=>{
    const unmounted=vi.fn();function Private(){useEffect(()=>unmounted,[]);return <input aria-label="Draft"/>;}
    mocks.ready.mockResolvedValue(undefined);
    render(<BackendStartupBoundary><Private/></BackendStartupBoundary>);
    fireEvent.change(await screen.findByRole('textbox'),{target:{value:'Work in progress'}});
    fireEvent(window,new Event('offline'));fireEvent(window,new Event('online'));
    expect(screen.getByRole('textbox')).toHaveValue('Work in progress');expect(unmounted).not.toHaveBeenCalled();
    expect(mocks.ready).toHaveBeenCalledTimes(1);
  });
  it('preserves the existing bypass for presentations and the offline shell',()=>{
    mocks.enabled.mockReturnValue(false);
    render(<BackendStartupBoundary><p>Shell</p></BackendStartupBoundary>);
    expect(screen.getByText('Shell')).toBeVisible();expect(mocks.ready).not.toHaveBeenCalled();
  });
  it.each(['checking','waiting','session','offline'] as const)('shows no retry button or fake success for %s',(phase)=>{
    render(<StartupRecovery phase={phase} onRetry={vi.fn()}/>);
    expect(screen.queryByRole('button')).toBeNull();expect(screen.queryByRole('progressbar')).toBeNull();
    expect(screen.getByRole('main')).toHaveAccessibleName();expect(screen.getByRole('status')).toBeVisible();
  });
});

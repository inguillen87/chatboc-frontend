import { cleanup,fireEvent,render,screen,within } from '@testing-library/react';
import { afterEach,describe,expect,it,vi } from 'vitest';
import source from '../../../tests/fixtures/organization-profile-settings.json';
import { readOrganizationProfile } from '@/utils/organizationProfileSettings';
import ProfileVersionReview from './ProfileVersionReview';
afterEach(cleanup);
const baseline=()=>readOrganizationProfile(source,'tenant-a')!.values;
describe('profile conflict review',()=>{
  it('preserves my edits and defaults untouched fields to latest server values',()=>{
    const base=baseline(),onAccept=vi.fn();
    render(<ProfileVersionReview baseline={base} draft={{...base,nombre_empresa:'My name'}}
      latest={{...base,nombre_empresa:'Other name',ciudad:'Other city'}} onAccept={onAccept}/>);
    expect(onAccept).not.toHaveBeenCalled();
    expect(screen.getByRole('button')).toBeDisabled();
    fireEvent.click(within(screen.getByRole('group',{name:'Nombre de la organización'})).getByRole('radio',{name:/Tu edición/}));
    fireEvent.click(screen.getByRole('button',{name:'Usar selección y seguir editando'}));
    expect(onAccept).toHaveBeenCalledWith(expect.objectContaining({nombre_empresa:'My name',ciudad:'Other city'}));
  });
  it('allows an explicit selection without saving or making requests',()=>{
    const base=baseline(),onAccept=vi.fn();
    render(<ProfileVersionReview baseline={base} draft={{...base,nombre_empresa:'Mine'}} latest={{...base,nombre_empresa:'Theirs'}} onAccept={onAccept}/>);
    const group=screen.getByRole('group',{name:'Nombre de la organización'});
    fireEvent.click(within(group).getByRole('radio',{name:/Versión guardada/}));
    expect(onAccept).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button'));
    expect(onAccept).toHaveBeenCalledWith(expect.objectContaining({nombre_empresa:'Theirs'}));
  });
  it('can confirm identical content after an uncertain write',()=>{
    const base=baseline();render(<ProfileVersionReview baseline={base} draft={base} latest={base} onAccept={vi.fn()}/>);
    expect(screen.getByText('Tu edición coincide con la versión guardada.')).toBeVisible();
  });
  it('does not preselect a conflicting change or call acceptance on a disabled control',()=>{
    const base=baseline(),accept=vi.fn();
    render(<ProfileVersionReview baseline={base} draft={{...base,telefono:'111'}} latest={{...base,telefono:'222'}} onAccept={accept}/>);
    expect(screen.getByRole('button')).toBeDisabled();
    expect(screen.getAllByRole('radio').every(r=>!(r as HTMLInputElement).checked)).toBe(true);
    fireEvent.click(screen.getByRole('button'));expect(accept).not.toHaveBeenCalled();
  });
  it('treats latitude and longitude as a single conflict selection',()=>{
    const base={...baseline(),latitud:-33,longitud:-68},accept=vi.fn();
    render(<ProfileVersionReview baseline={base} draft={{...base,latitud:-34}} latest={{...base,longitud:-69}} onAccept={accept}/>);
    expect(screen.getByRole('button')).toBeDisabled();
    fireEvent.click(within(screen.getByRole('group',{name:'Latitud'})).getByRole('radio',{name:/Versión guardada/}));
    fireEvent.click(screen.getByRole('button'));
    expect(accept).toHaveBeenCalledWith(expect.objectContaining({latitud:-33,longitud:-69}));
  });
  it('invalidates an old choice when the draft changes during review',()=>{
    const base=baseline(),accept=vi.fn();
    const {rerender}=render(<ProfileVersionReview baseline={base} draft={{...base,ciudad:'One'}} latest={{...base,ciudad:'Two'}} onAccept={accept}/>);
    fireEvent.click(screen.getByRole('radio',{name:/Tu edición/}));expect(screen.getByRole('button')).toBeEnabled();
    rerender(<ProfileVersionReview baseline={base} draft={{...base,ciudad:'Three'}} latest={{...base,ciudad:'Two'}} onAccept={accept}/>);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});

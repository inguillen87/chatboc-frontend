import React from 'react';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,describe,expect,it} from 'vitest';
import {InstitutionalLoginLogo} from './InstitutionalLoginLogo';
const identity={tenantId:7,tenantSlug:'org-a',name:'Organización de prueba',logoUrl:'/logo-a.svg'};
afterEach(cleanup);
describe('institutional login mark',()=>{
  it('renders the published image decoratively without transmitting a referrer',()=>{
    const {container}=render(<InstitutionalLoginLogo identity={identity}/>);const image=container.querySelector('img');
    expect(image).toHaveAttribute('src','/logo-a.svg');expect(image).toHaveAttribute('alt','');expect(image).toHaveAttribute('referrerpolicy','no-referrer');
  });
  it('falls back on a broken image and resets for a different institution',()=>{
    const view=render(<InstitutionalLoginLogo identity={identity}/>);fireEvent.error(view.container.querySelector('img')!);
    expect(view.container.querySelector('img')).toBeNull();
    view.rerender(<InstitutionalLoginLogo identity={{...identity,tenantId:8,tenantSlug:'org-b',logoUrl:'/logo-b.svg'}}/>);
    expect(view.container.querySelector('img')).toHaveAttribute('src','/logo-b.svg');expect(screen.getByTestId('institutional-login-mark')).toHaveAttribute('data-tenant-id','8');
  });
  it('does not fetch a logo when none is available',()=>{
    const view=render(<InstitutionalLoginLogo identity={{...identity,logoUrl:null}}/>);
    expect(view.container.querySelector('img')).toBeNull();expect(screen.getByTestId('institutional-login-mark')).toBeVisible();
  });
});

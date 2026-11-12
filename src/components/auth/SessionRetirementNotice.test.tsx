import React from 'react';
import {cleanup,render,screen} from '@testing-library/react';
import {afterEach,describe,expect,it} from 'vitest';
import {setLogoutNotice} from '@/utils/sessionRetirement';
import {SessionRetirementNotice} from './SessionRetirementNotice';
afterEach(cleanup);
describe('truthful session retirement notice',()=>{
 it.each(['unavailable','uncertain'] as const)('does not claim server retirement after %s',status=>{
  setLogoutNotice({status,providerStatus:'unknown'});render(<SessionRetirementNotice/>);
  expect(screen.getByRole('status')).toHaveTextContent('No pudimos confirmar');
 });
 it('keeps confirmed local revocation distinct from pending provider revocation',()=>{
  setLogoutNotice({status:'retired',providerStatus:'pending'});render(<SessionRetirementNotice/>);
  expect(screen.getByRole('status')).toHaveTextContent('proveedor de acceso todavía no está confirmado');
 });
});

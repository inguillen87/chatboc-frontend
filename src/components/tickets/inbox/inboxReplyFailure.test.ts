import {describe,expect,it} from 'vitest';
import {ApiError} from '@/utils/api';
import {inboxReplyFailure} from './inboxReplyFailure';

describe('inbox reply failure guidance',()=>{
  it.each([408,425,429,500,503])('treats HTTP %s as ambiguous delivery',status=>{
    const value=inboxReplyFailure(new ApiError('private technical detail',status));
    expect(value.kind).toBe('ambiguous');
    expect(value.message).not.toContain('private technical detail');
    expect(value.action).toContain('evitar duplicados');
  });
  it('treats an unknown network failure as ambiguous',()=>{
    expect(inboxReplyFailure(new Error('ECONNRESET private-host')).kind).toBe('ambiguous');
  });
  it('distinguishes a definitive permission rejection',()=>{
    const value=inboxReplyFailure(new ApiError('private permission detail',403));
    expect(value).toMatchObject({kind:'rejected',title:'Respuesta no enviada'});
    expect(JSON.stringify(value)).not.toContain('private permission detail');
  });
});

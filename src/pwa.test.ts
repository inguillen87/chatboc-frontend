import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('virtual:pwa-register', () => ({
  registerSW: vi.fn(() => vi.fn()),
}));

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { dismiss: vi.fn() }),
}));

import { shouldAutoApplyPublicRefresh, shouldDisablePwaForHost } from './pwa';

const setPath = (path: string) => {
  window.history.replaceState({}, '', path);
};

describe('public PWA refresh policy', () => {
  afterEach(() => {document.body.replaceChildren();setPath('/');});

  it.each(['/t/example-city','/t/example-city/'])('auto-applies on an idle exact public organization entry %s', path => {
    setPath(path);expect(shouldAutoApplyPublicRefresh()).toBe(true);
  });

  it.each([
    '<div class="chat-root"></div>', '<div role="dialog"></div>', '<div aria-busy="true"></div>',
    '<textarea>Consulta sin enviar</textarea>', '<input value="Dato sin enviar">',
    '<input type="file">', '<div contenteditable="true">Borrador</div>', '<audio src="blob:local-reading"></audio>',
  ])('retains the explicit update action while work is present: %s', markup => {
    setPath('/t/example-city');document.body.innerHTML=markup;
    if(markup.includes('type="file"'))Object.defineProperty(document.querySelector('input')!,'value',{value:'selected-file.pdf'});
    expect(shouldAutoApplyPublicRefresh()).toBe(false);
  });

  it.each(['/t/example-city/integracion','/t/example-city/reclamos/nuevo','/t/example-city/market/checkout'])(
    'never auto-applies on a nested tenant operation %s', path => {setPath(path);expect(shouldAutoApplyPublicRefresh()).toBe(false);},
  );

  it.each(['checkbox','radio'])('protects changed %s selections while permitting an unchanged default', type => {
    setPath('/t/example-city');document.body.innerHTML=`<input type="${type}" checked>`;
    const field=document.querySelector('input')!;
    expect(shouldAutoApplyPublicRefresh()).toBe(true);
    field.checked=false;expect(shouldAutoApplyPublicRefresh()).toBe(false);
  });

  it.each([
    '/e/demo-gobierno-junin-prioridades-barriales?tenant_slug=junin',
    '/encuestas',
    '/encuestas/demo/qr',
  ])('auto-applies updates on public survey route %s', (path) => {
    setPath(path);
    expect(shouldAutoApplyPublicRefresh()).toBe(true);
  });

  it.each(['/admin/encuestas', '/t/junin/encuestas', '/portal/encuestas'])(
    'keeps the explicit update prompt on authenticated route %s',
    (path) => {
      setPath(path);
      expect(shouldAutoApplyPublicRefresh()).toBe(false);
    },
  );

  it('auto-applies a waiting release on the profile shell without losing its deep link', () => {
    setPath('/perfil?tab=perfil&section=channels&setup=channels');
    expect(shouldAutoApplyPublicRefresh()).toBe(true);
    expect(window.location.search).toContain('section=channels');
  });

  it('still protects admin workspaces from an automatic refresh', () => {
    setPath('/admin/encuestas/632/editar');
    expect(shouldAutoApplyPublicRefresh()).toBe(false);
  });
});

describe('ephemeral deployment PWA policy', () => {
  it.each([
    'chatboc-r2-preview.vercel.app',
    'chatboc-frontend-b24v67fai-marcelos-projects-c26aa499.vercel.app',
    'preview.chatboc.ar',
    ' PREVIEW.CHATBOC.AR ',
    'localhost',
  ])('disables persistent workers on %s', (hostname) => {
    expect(shouldDisablePwaForHost(hostname)).toBe(true);
  });

  it.each(['chatboc.ar', 'www.chatboc.ar', 'gobierno.example.ar', 'other-preview.chatboc.ar'])(
    'keeps PWA support on durable custom host %s',
    (hostname) => {
      expect(shouldDisablePwaForHost(hostname)).toBe(false);
    },
  );
});

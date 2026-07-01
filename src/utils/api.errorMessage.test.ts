import { beforeAll, describe, expect, it, vi } from 'vitest';

let ApiError: typeof import('./api').ApiError;
let getErrorMessage: typeof import('./api').getErrorMessage;
let isLikelyHtmlErrorBody: typeof import('./api').isLikelyHtmlErrorBody;

beforeAll(async () => {
  const api = await vi.importActual<typeof import('./api')>('./api');
  ApiError = api.ApiError;
  getErrorMessage = api.getErrorMessage;
  isLikelyHtmlErrorBody = api.isLikelyHtmlErrorBody;
});

describe('getErrorMessage', () => {
  it('reads legacy codigo/mensaje envelopes from catalog import errors', () => {
    const error = new ApiError(
      'Error en la respuesta de la API',
      400,
      {
        codigo: 'formato_no_soportado',
        mensaje: 'No se pudo interpretar el formato del archivo. Proba con PDF, Excel o CSV.',
      },
      'req_catalog_1',
    );

    expect(getErrorMessage(error)).toBe(
      'No se pudo interpretar el formato del archivo. Proba con PDF, Excel o CSV. (Req ID: req_catalog_1)',
    );
  });

  it('does not expose raw html gateway responses in the UI message', () => {
    const error = new ApiError(
      '<!DOCTYPE html><html><body><h1>502 Bad Gateway</h1><pre>nginx</pre></body></html>',
      502,
      '<!DOCTYPE html><html><body><h1>502 Bad Gateway</h1><pre>nginx</pre></body></html>',
      'req_gateway_1',
    );

    const message = getErrorMessage(error, 'No pudimos cargar el reclamo.');

    expect(message).toContain('El servidor no pudo responder correctamente');
    expect(message).toContain('(Req ID: req_gateway_1)');
    expect(message.toLowerCase()).not.toContain('<html');
    expect(message.toLowerCase()).not.toContain('bad gateway');
    expect(message.toLowerCase()).not.toContain('nginx');
  });

  it('detects html error bodies inside raw response objects', () => {
    expect(
      isLikelyHtmlErrorBody({
        raw: '<html><body>503 Service Unavailable</body></html>',
        contentType: 'text/html',
      }),
    ).toBe(true);
  });
});

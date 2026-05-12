import { beforeAll, describe, expect, it, vi } from 'vitest';

let ApiError: typeof import('./api').ApiError;
let getErrorMessage: typeof import('./api').getErrorMessage;

beforeAll(async () => {
  const api = await vi.importActual<typeof import('./api')>('./api');
  ApiError = api.ApiError;
  getErrorMessage = api.getErrorMessage;
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
});

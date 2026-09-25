import {describe,expect,it} from 'vitest';
import {catalogImportUserError,safeCatalogImportDetail} from './catalogImportError';
describe('catalog import user-facing failures',()=>{
  it.each([
    [{status:401},'Sesión no válida',false],
    [{status:403},'Acceso no habilitado',false],
    [{status:413},'Archivo demasiado grande',true],
    [{status:415},'Formato no compatible',true],
    [{status:422},'El archivo necesita correcciones',true],
    [{status:429},'Demasiadas solicitudes',true],
    [{status:503},'Importación temporalmente no disponible',true],
  ] as const)('maps %o to a bounded message', (error,title,retryable)=>{
    expect(catalogImportUserError(error,'upload')).toMatchObject({title,retryable});
  });
  it('treats an ambiguous commit as not safe to repeat blindly',()=>{
    expect(catalogImportUserError(new Error('network'),'commit')).toMatchObject({retryable:false});
    expect(catalogImportUserError(new Error('network'),'commit').action).toContain('evitar una importación duplicada');
  });
  it.each([
    'https://internal.example/path?token=secret',
    'Traceback: private stack',
    'SELECT * FROM customer',
    'ECONNREFUSED 127.0.0.1',
    'Error\u0000private',
  ])('does not expose technical details: %s',detail=>{
    expect(safeCatalogImportDetail(detail,'Mensaje seguro')).toBe('Mensaje seguro');
  });
  it('keeps a short actionable validation message',()=>{
    expect(safeCatalogImportDetail('Falta el precio en la fila 3.','fallback')).toBe('Falta el precio en la fila 3.');
  });
});

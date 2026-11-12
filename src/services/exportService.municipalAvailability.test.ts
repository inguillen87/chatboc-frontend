import { beforeEach, describe, expect, it, vi } from 'vitest';
import { exportMunicipalAnalyticsExcel, exportMunicipalAnalyticsPdf, type MunicipalAnalyticsExportOptions } from './exportService';
const mocks = vi.hoisted(() => ({ table: vi.fn(), sheet: vi.fn((rows: unknown) => rows), save: vi.fn(), write: vi.fn() }));
vi.mock('jspdf', () => ({ jsPDF: class {
  internal = { pageSize: { width: 210, height: 297 }, getNumberOfPages: () => 1 };
  setFontSize() {} setFont() {} setTextColor() {} text() {} setLineWidth() {} line() {} setPage() {} addPage() {}
  save = mocks.save;
} }));
vi.mock('jspdf-autotable', () => ({ default: mocks.table }));
vi.mock('xlsx', () => ({ utils: { book_new: () => ({}), json_to_sheet: mocks.sheet, book_append_sheet: vi.fn() }, writeFile: mocks.write }));
const options = (averageResponseHours: number | null): MunicipalAnalyticsExportOptions => ({
  municipalities: [{ name: 'Organización', totalTickets: 1, averageResponseHours }],
  statusKeys: [], categoryTotals: [], heatmap: [], categoryKey: 'all',
  totals: { totalTickets: 1, averageResponseHours, ticketsLabel: 'Tickets' },
  filters: { category: 'Todas', gender: 'Todos', ageMin: '', ageMax: '', statuses: [] },
});
beforeEach(() => vi.clearAllMocks());
describe('municipal exports preserve unavailable SLA', () => {
  it.each([null, Number.NaN, Number.POSITIVE_INFINITY, -1])('exports unavailable %s without converting it to zero', async value => {
    await exportMunicipalAnalyticsPdf(options(value));
    const pdfRows = mocks.table.mock.calls.flatMap(call => call[1].body);
    expect(pdfRows).toContainEqual(['Promedio de respuesta (h)', 'No disponible']);
    await exportMunicipalAnalyticsExcel(options(value));
    const excelRows = mocks.sheet.mock.calls.flatMap(call => call[0] as Array<Record<string, unknown>>);
    expect(excelRows).toContainEqual({ Indicador: 'Promedio de respuesta (h)', Valor: 'No disponible' });
    expect(excelRows.find(row => row.Municipio === 'Organización')?.['Promedio respuesta (h)']).toBe('No disponible');
  });
  it('preserves a measured zero in both export formats', async () => {
    await exportMunicipalAnalyticsPdf(options(0));
    expect(mocks.table.mock.calls.flatMap(call => call[1].body)).toContainEqual(['Promedio de respuesta (h)', '0']);
    await exportMunicipalAnalyticsExcel(options(0));
    expect(mocks.sheet.mock.calls.flatMap(call => call[0] as unknown[])).toContainEqual({ Indicador: 'Promedio de respuesta (h)', Valor: 0 });
  });
});

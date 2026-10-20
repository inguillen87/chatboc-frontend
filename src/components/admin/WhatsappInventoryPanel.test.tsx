import React from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { WhatsappInventoryPanel } from './WhatsappInventoryPanel';
import type { Tenant } from '@/types/superAdmin';
import type { WhatsappNumberInventoryItem } from '@/types/whatsapp';

afterEach(cleanup);
const pointerMethods = ['hasPointerCapture', 'setPointerCapture', 'releasePointerCapture', 'scrollIntoView'] as const;
const originalMethods = pointerMethods.map((name) => [name, Object.getOwnPropertyDescriptor(HTMLElement.prototype, name)] as const);
beforeAll(() => {
  for (const name of pointerMethods) Object.defineProperty(HTMLElement.prototype, name, {
    configurable: true, value: name === 'hasPointerCapture' ? () => false : () => undefined,
  });
});
afterAll(() => {
  for (const [name, descriptor] of originalMethods) {
    if (descriptor) Object.defineProperty(HTMLElement.prototype, name, descriptor);
    else delete HTMLElement.prototype[name];
  }
});

const props = () => ({
  numbers: [] as WhatsappNumberInventoryItem[],
  tenants: [{ slug: 'demo', nombre: 'Organización de prueba', status: 'active', is_active: true }] as Tenant[],
  loading: false,
  error: null,
  onRefresh: vi.fn(),
  onReserve: vi.fn(),
  onRelease: vi.fn(),
  onAssign: vi.fn(),
  onCreateNumber: vi.fn(),
  onRegisterExternal: vi.fn(),
});

describe('WhatsApp inventory registration', () => {
  it.each(['unexpected', '__proto__', 'constructor'])('keeps inventory readable without actions for unknown runtime status %s', (status) => {
    const callbacks = props();
    render(<WhatsappInventoryPanel {...callbacks} numbers={[
      { id: 1, phone_number: '+15550000001', status: status as WhatsappNumberInventoryItem['status'] },
      { id: 2, phone_number: '+15550000002', status: 'available' },
    ]} />);
    const unknownRow = screen.getByText('+15550000001').closest('tr')!;
    expect(within(unknownRow).getByText('Estado no informado')).toBeVisible();
    expect(within(unknownRow).queryByRole('button')).not.toBeInTheDocument();
    expect(within(screen.getByText('+15550000002').closest('tr')!).getByRole('button', { name: 'Reservar' })).toBeVisible();
    [callbacks.onReserve, callbacks.onRelease, callbacks.onAssign].forEach((callback) => expect(callback).not.toHaveBeenCalled());
  });

  it('opens the native optional organization selector and stores no assignment without an empty SelectItem', async () => {
    const user = userEvent.setup();
    const callbacks = props();
    render(<WhatsappInventoryPanel {...callbacks} />);
    await user.type(screen.getByLabelText('Número', { exact: true }), '+15550000001');
    await user.type(screen.getByLabelText('Identificador de remitente', { exact: true }), 'whatsapp:+15550000001');
    await user.click(screen.getByRole('combobox', { name: 'Organización (opcional)' }));
    expect(screen.getByRole('option', { name: 'Sin asignar' })).toBeVisible();
    await user.click(screen.getByRole('option', { name: 'Organización de prueba' }));
    await user.click(screen.getByRole('combobox', { name: 'Organización (opcional)' }));
    await user.click(screen.getByRole('option', { name: 'Sin asignar' }));
    await user.click(screen.getByRole('button', { name: 'Guardar en inventario' }));
    expect(callbacks.onCreateNumber).toHaveBeenCalledExactlyOnceWith({
      phone_number: '+15550000001', sender_id: 'whatsapp:+15550000001', status: 'available', tenant_slug: null,
    });
  });

  it('requires an organization for external registration and describes a local record rather than provider validation', async () => {
    const user = userEvent.setup();
    const callbacks = props();
    render(<WhatsappInventoryPanel {...callbacks} />);
    expect(screen.getByText(/Este registro no verifica el número con Meta/)).toBeVisible();
    await user.type(screen.getByLabelText('Número externo'), '+15550000003');
    await user.type(screen.getByLabelText('Identificador de remitente externo'), 'whatsapp:+15550000003');
    const save = screen.getByRole('button', { name: 'Guardar registro externo' });
    expect(save).toBeDisabled();
    await user.click(screen.getByRole('combobox', { name: 'Organización del número externo' }));
    expect(screen.queryByRole('option', { name: 'Sin asignar' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('option', { name: 'Organización de prueba' }));
    await user.click(save);
    expect(callbacks.onRegisterExternal).toHaveBeenCalledExactlyOnceWith({
      number: '+15550000003', sender_id: 'whatsapp:+15550000003', status: 'verified', tenant_slug: 'demo',
    });
  });

  it('uses distinct form labels when two inventory panels are mounted', () => {
    render(<><WhatsappInventoryPanel {...props()} /><WhatsappInventoryPanel {...props()} /></>);
    const numberInputs = screen.getAllByLabelText('Número', { exact: true });
    expect(numberInputs[0].id).not.toBe(numberInputs[1].id);
  });
});

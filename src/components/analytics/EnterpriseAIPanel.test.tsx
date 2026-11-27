import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import EnterpriseAIPanel from './EnterpriseAIPanel';
import { enterpriseService } from '@/services/enterpriseService';
import { toast } from 'sonner';

vi.mock('@/services/enterpriseService', () => ({
  enterpriseService: {
    getProductRecommendations: vi.fn(),
    uploadOrderDraftFromDocument: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

const manualReviewMessage = 'Revision manual requerida: no hay borrador editable para descargar.';
const mockedUploadOrderDraft = vi.mocked(enterpriseService.uploadOrderDraftFromDocument);
const mockedToastSuccess = vi.mocked(toast.success);

const renderPanel = () => render(<EnterpriseAIPanel tenantId={7} tenantSlug="demo" scope="pyme" />);

const uploadDraftFile = async (response: any) => {
  mockedUploadOrderDraft.mockResolvedValueOnce(response);
  const view = renderPanel();
  const fileInput = view.container.querySelector('input[type="file"]');
  if (!fileInput) throw new Error('Expected file input to render.');

  const file = new File(['pedido'], 'pedido.pdf', { type: 'application/pdf' });
  fireEvent.change(fileInput, { target: { files: [file] } });

  const uploadButton = screen.getByRole('button', { name: /Generar borrador IA/i });
  await waitFor(() => expect(uploadButton).not.toBeDisabled());
  fireEvent.click(uploadButton);

  await waitFor(() => {
    expect(mockedUploadOrderDraft).toHaveBeenCalledWith(7, file, 'demo');
  });

  return view;
};

describe('EnterpriseAIPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    ['legacy empty response', { draft_items: [], crm_state: 'legacy' }],
    [
      'manual review response with rows',
      { draft_items: [{ name: 'Clavos punta paris', quantity: 1, match_status: 'matched' }], crm_state: 'manual_review' },
    ],
  ])('shows manual review without optimistic success for %s', async (_label, response) => {
    await uploadDraftFile(response);

    expect(await screen.findByText(manualReviewMessage)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Descargar JSON editado/i })).not.toBeInTheDocument();
    expect(mockedToastSuccess).not.toHaveBeenCalled();
  });

  it('keeps the success path when the response has usable rows and no failure state', async () => {
    await uploadDraftFile({
      draft_items: [{ name: 'Chapa galvanizada', quantity: 2, match_status: 'matched' }],
      crm_state: 'ready',
    });

    expect(await screen.findByDisplayValue('Chapa galvanizada')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Descargar JSON editado/i })).toBeInTheDocument();
    expect(screen.queryByText(manualReviewMessage)).not.toBeInTheDocument();
    expect(mockedToastSuccess).toHaveBeenCalledWith('Borrador generado correctamente.');
  });
});

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import PDFsPage from './PDFsPage';
import { useIncident } from '../context/IncidentContext';
import { useToast } from '../context/ToastContext';
import { PDFDocument } from 'pdf-lib';

// Mock dependencies
vi.mock('../context/IncidentContext');
vi.mock('../context/ToastContext');
vi.mock('pdf-lib', () => ({
  PDFDocument: {
    load: vi.fn(),
  },
}));

describe('PDFsPage', () => {
  const mockAddToast = vi.fn();
  const mockSetText = vi.fn();
  const mockGetTextField = vi.fn(() => ({ setText: mockSetText }));
  const mockGetForm = vi.fn(() => ({
    getFields: () => [{ getName: () => 'Incident Name' }, { getName: () => 'Operational Period' }],
    getTextField: mockGetTextField,
  }));
  const mockSave = vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]));

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      arrayBuffer: async () => new ArrayBuffer(8),
    }));
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn((blob) => `blob:${blob.size}`),
      revokeObjectURL: vi.fn(),
    });

    vi.mocked(useIncident).mockReturnValue({
      incidentData: { name: 'Test Incident', opNumber: '1' },
      incidentId: 'inc-123',
      responderName: 'Test User',
    });
    vi.mocked(useToast).mockReturnValue({ addToast: mockAddToast });
    vi.mocked(PDFDocument.load).mockResolvedValue({
      getForm: mockGetForm,
      save: mockSave,
    });
  });

  it('loads, parses, and auto-fills a PDF when selected', async () => {
    render(<PDFsPage />);
    const selector = screen.getByLabelText(/Select Document/i);
    
    fireEvent.change(selector, { target: { value: '/src/assets/ICS201.pdf' } });

    await waitFor(() => {
      // Verify it was fetched and parsed
      expect(fetch).toHaveBeenCalledWith('/src/assets/ICS201.pdf');
      expect(PDFDocument.load).toHaveBeenCalled();
      
      // Verify auto-fill logic was attempted
      expect(mockGetTextField).toHaveBeenCalledWith('Incident Name');
      expect(mockSetText).toHaveBeenCalledWith('Test Incident');
      expect(mockGetTextField).toHaveBeenCalledWith('Operational Period');
      expect(mockSetText).toHaveBeenCalledWith('1');

      // Verify the iframe is rendered with the new blob URL
      expect(screen.getByTitle('PDF Viewer')).toHaveAttribute('src', 'blob:3');
    });
  });

});

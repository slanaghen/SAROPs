import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import AdminResponderFormModal from './AdminResponderFormModal';
import { useToast } from '../../context/ToastContext';
import { useIncident } from '../../context/IncidentContext';

// Mock dependencies
vi.mock('../../context/ToastContext', () => ({
  useToast: vi.fn(),
}));

vi.mock('../../context/IncidentContext', () => ({
  useIncident: vi.fn(),
}));

describe('AdminResponderFormModal', () => {
  const mockOnSave = vi.fn();
  const mockOnClose = vi.fn();
  const mockAddToast = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useToast).mockReturnValue({ addToast: mockAddToast });
    vi.mocked(useIncident).mockReturnValue({
      incidentId: 'inc-123',
    });
  });

  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    onSave: mockOnSave,
    loading: false,
    error: null,
  };

  it('renders in "Add New" mode with correct defaults', () => {
    render(<AdminResponderFormModal {...defaultProps} initialData={null} />);

    expect(screen.getByRole('heading', { name: 'Add New Responder' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Full Name/i)).toHaveValue('');
    expect(screen.getByLabelText(/Full Name/i)).toBeRequired();
  });

  it('renders in "Edit" mode and populates fields from initialData', () => {
    const initialData = {
      responder_id: 'r1',
      name: 'John Smith',
      agency: 'SAR',
      identifier: 'K9-1',
      cell_phone: '555-1234',
      email: 'john@sar.com',
    };
    render(<AdminResponderFormModal {...defaultProps} initialData={initialData} />);

    expect(screen.getByRole('heading', { name: `Edit Responder: ${initialData.name}` })).toBeInTheDocument();
    expect(screen.getByLabelText(/Full Name/i)).toHaveValue('John Smith');
    expect(screen.getByLabelText(/Agency/i)).toHaveValue('SAR');
    expect(screen.getByLabelText(/Identifier/i)).toHaveValue('K9-1');
    expect(screen.getByLabelText(/Phone Number/i)).toHaveValue('555-1234');
  });

  it('calls onSave with form data when "Save Responder" is clicked', async () => {
    render(<AdminResponderFormModal {...defaultProps} initialData={null} />);

    fireEvent.change(screen.getByLabelText(/Full Name/i), { target: { value: 'Jane Doe' } });
    fireEvent.change(screen.getByLabelText(/Agency/i), { target: { value: 'CERT' } });
    fireEvent.change(screen.getByLabelText(/Identifier/i), { target: { value: 'C-1' } });

    fireEvent.click(screen.getByRole('button', { name: /Save Responder/i }));

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Jane Doe',
          agency: 'CERT',
          identifier: 'C-1',
        })
      );
    });
  });
});
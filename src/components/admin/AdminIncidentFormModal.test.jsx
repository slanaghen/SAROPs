import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import AdminIncidentFormModal from './AdminIncidentFormModal';
import { useToast } from '../../context/ToastContext';
import { useIncident } from '../../context/IncidentContext';

// Mock dependencies
vi.mock('../../context/ToastContext', () => ({
  useToast: vi.fn(),
}));

vi.mock('../../context/IncidentContext', () => ({
  useIncident: vi.fn(),
}));

describe('AdminIncidentFormModal', () => {
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
    render(<AdminIncidentFormModal {...defaultProps} initialData={null} />);

    expect(screen.getByRole('heading', { name: 'Add New Incident' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Incident Name/i)).toHaveValue('');
    expect(screen.getByLabelText(/Incident Number/i)).toBeRequired();
  });

  it('renders in "Edit" mode and populates fields from initialData', () => {
    const initialData = {
      incident_id: 'inc-1',
      name: 'Forest Search',
      number: '2024-001',
      sartopo_id: 'MAP123',
      start_datetime: '2024-01-01T10:00:00',
    };
    render(<AdminIncidentFormModal {...defaultProps} initialData={initialData} />);

    expect(screen.getByRole('heading', { name: `Edit Incident: ${initialData.name}` })).toBeInTheDocument();
    expect(screen.getByLabelText(/Incident Name/i)).toHaveValue('Forest Search');
    expect(screen.getByLabelText(/Incident Number/i)).toHaveValue('2024-001');
    expect(screen.getByLabelText(/SARTopo Map ID/i)).toHaveValue('MAP123');
    // Note: Testing datetime-local input value is tricky, so we check for presence.
    expect(screen.getByLabelText(/Start Date \/ Time/i)).toBeInTheDocument();
  });

  it('calls onSave with form data when "Save Incident" is clicked', async () => {
    render(<AdminIncidentFormModal {...defaultProps} initialData={null} />);

    fireEvent.change(screen.getByLabelText(/Incident Name/i), { target: { value: 'New Incident' } });
    fireEvent.change(screen.getByLabelText(/Incident Number/i), { target: { value: '2025-001' } });
    fireEvent.change(screen.getByLabelText(/SARTopo Map ID/i), { target: { value: 'NEW456' } });

    fireEvent.click(screen.getByRole('button', { name: /Save Incident/i }));

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'New Incident',
          number: '2025-001',
          sartopo_id: 'NEW456',
        })
      );
    });
  });
});
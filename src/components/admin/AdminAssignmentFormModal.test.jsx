import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import AdminAssignmentFormModal from './AdminAssignmentFormModal';
import { useToast } from '../../context/ToastContext';
import { useIncident } from '../../context/IncidentContext';

// Mock dependencies
vi.mock('../../context/ToastContext', () => ({
  useToast: vi.fn(),
}));

vi.mock('../../context/IncidentContext', () => ({
  useIncident: vi.fn(),
}));

describe('AdminAssignmentFormModal', () => {
  const mockOnSave = vi.fn();
  const mockOnClose = vi.fn();
  const mockAddToast = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useToast).mockReturnValue({ addToast: mockAddToast });
    vi.mocked(useIncident).mockReturnValue({
      incidentId: 'inc-123',
      incidentData: { opPeriodId: 'op-123' },
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
    render(<AdminAssignmentFormModal {...defaultProps} initialData={null} />);

    expect(screen.getByRole('heading', { name: 'Add New Assignment' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Title/i)).toHaveValue('');
    expect(screen.getByLabelText(/Status/i)).toHaveValue('Planned');
    expect(screen.getByLabelText(/Title/i)).toBeRequired();
  });

  it('renders in "Edit" mode and populates fields from initialData', () => {
    const initialData = {
      assignment_id: 'a1',
      title: 'Sector Alpha',
      status: 'Deployed',
      segment: 'Alpha',
      resource_type: 'Ground',
    };
    render(<AdminAssignmentFormModal {...defaultProps} initialData={initialData} />);

    expect(screen.getByRole('heading', { name: `Edit Assignment: ${initialData.title}` })).toBeInTheDocument();
    expect(screen.getByLabelText(/Title/i)).toHaveValue('Sector Alpha');
    expect(screen.getByLabelText(/Status/i)).toHaveValue('Deployed');
    expect(screen.getByLabelText(/Segment/i)).toHaveValue('Alpha');
    expect(screen.getByLabelText(/Resource Type/i)).toHaveValue('Ground');
  });

  it('calls onSave with form data when "Save Assignment" is clicked', async () => {
    render(<AdminAssignmentFormModal {...defaultProps} initialData={null} />);

    fireEvent.change(screen.getByLabelText(/Title/i), { target: { value: 'New Task' } });
    fireEvent.change(screen.getByLabelText(/Status/i), { target: { value: 'Assigned' } });
    fireEvent.change(screen.getByLabelText(/Segment/i), { target: { value: 'Bravo' } });
    fireEvent.change(screen.getByLabelText(/Team Size/i), { target: { value: '3' } });

    // This test appears to have been saved in an incomplete state, causing a parse error.
    // The following lines complete the test case.
    fireEvent.click(screen.getByRole('button', { name: /Save Assignment/i }));

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'New Task',
          status: 'Assigned',
          segment: 'Bravo',
          team_size: '3',
        })
      );
    });
  });
});

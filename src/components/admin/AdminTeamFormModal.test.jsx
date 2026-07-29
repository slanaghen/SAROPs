import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import AdminTeamFormModal from './AdminTeamFormModal';
import { useToast } from '../../context/ToastContext';

// Mock dependencies
vi.mock('../../context/ToastContext', () => ({
  useToast: vi.fn(),
}));

describe('AdminTeamFormModal', () => {
  const mockOnSave = vi.fn();
  const mockOnClose = vi.fn();
  const mockAddToast = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useToast).mockReturnValue({ addToast: mockAddToast });
  });

  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    onSave: mockOnSave,
    loading: false,
    error: null,
    responders: [],
  };

  it('renders in "Add New" mode with correct defaults', () => {
    render(<AdminTeamFormModal {...defaultProps} initialData={null} />);

    expect(screen.getByRole('heading', { name: 'Add New Team' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Team Name \/ Number/i)).toHaveValue('');
    expect(screen.getByLabelText(/Type/i)).toHaveValue('Ground'); // Assuming 'Ground' is a default
    expect(screen.getByLabelText(/Team Name \/ Number/i)).toBeRequired();
  });

  it('renders in "Edit" mode and populates fields from initialData', () => {
    const initialData = {
      team_id: 't1',
      team_name_number: 'Alpha Team',
      type: 'Hasty',
      sartopo_color_hex: '#0000ff',
    };
    render(<AdminTeamFormModal {...defaultProps} initialData={initialData} />);

    expect(screen.getByRole('heading', { name: `Edit Team: ${initialData.team_name_number}` })).toBeInTheDocument();
    expect(screen.getByLabelText(/Team Name \/ Number/i)).toHaveValue('Alpha Team');
    expect(screen.getByLabelText(/Type/i)).toHaveValue('Hasty');
    expect(screen.getByLabelText(/SARTopo Color \(Hex\)/i)).toHaveValue('#0000ff');
  });

  it('calls onSave with form data when "Save Team" is clicked', async () => {
    render(<AdminTeamFormModal {...defaultProps} initialData={null} />);

    fireEvent.change(screen.getByLabelText(/Team Name \/ Number/i), { target: { value: 'Bravo Team' } });
    fireEvent.change(screen.getByLabelText(/Type/i), { target: { value: 'UAS' } });
    fireEvent.change(screen.getByLabelText(/SARTopo Color \(Hex\)/i), { target: { value: '#ff0000' } });

    fireEvent.click(screen.getByRole('button', { name: /Save Team/i }));

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith(
        expect.objectContaining({
          team_name_number: 'Bravo Team',
          type: 'UAS',
          sartopo_color_hex: '#ff0000',
        })
      );
    });
  });
});
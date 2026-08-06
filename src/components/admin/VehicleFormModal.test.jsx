import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import VehicleFormModal from './VehicleFormModal';
import { useToast } from '../../context/ToastContext';

// Mock dependencies
vi.mock('../../context/ToastContext', () => ({
  useToast: vi.fn(),
}));

// Mock BaseModal to isolate form logic
vi.mock('../BaseModal', () => ({
  default: ({ children, title, actions }) => (
    <div>
      <h1>{title}</h1>
      <div>{children}</div>
      <div>{actions}</div>
    </div>
  ),
}));

describe('VehicleFormModal', () => {
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
  };

  it('renders in "Add New" mode with correct defaults', () => {
    render(<VehicleFormModal {...defaultProps} initialData={null} />);

    expect(screen.getByRole('heading', { name: 'Add New Vehicle' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Vehicle Designation/i)).toHaveValue('');
    expect(screen.getByLabelText(/Vehicle Designation/i)).toBeRequired();
    expect(screen.getByLabelText(/Status/i)).toHaveValue('Staged');
  });

  it('renders in "Edit" mode and populates fields from initialData', () => {
    const initialData = {
      vehicle_id: 'v1',
      designation: 'SAR-1',
      type: 'Truck',
      status: 'Deployed',
    };
    render(<VehicleFormModal {...defaultProps} initialData={initialData} />);

    expect(screen.getByRole('heading', { name: `Edit Vehicle: ${initialData.designation}` })).toBeInTheDocument();
    expect(screen.getByLabelText(/Vehicle Designation/i)).toHaveValue('SAR-1');
    expect(screen.getByLabelText(/Vehicle Type/i)).toHaveValue('Truck');
    expect(screen.getByLabelText(/Status/i)).toHaveValue('Deployed');
  });

  it('calls onSave with form data when "Save & Exit" is clicked', async () => {
    render(<VehicleFormModal {...defaultProps} initialData={null} />);

    fireEvent.change(screen.getByLabelText(/Vehicle Designation/i), { target: { value: 'CERT-1' } });
    fireEvent.change(screen.getByLabelText(/Vehicle Type/i), { target: { value: 'Van' } });

    fireEvent.click(screen.getByRole('button', { name: /Save & Exit/i }));

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith(
        expect.objectContaining({
          designation: 'CERT-1',
          type: 'Van',
        }),
        false // stayOpen = false
      );
    });
  });
});
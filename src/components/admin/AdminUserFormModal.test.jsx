import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import AdminUserFormModal from './AdminUserFormModal';
import { useToast } from '../../context/ToastContext';

// Mock dependencies
vi.mock('../../context/ToastContext', () => ({
  useToast: vi.fn(),
}));

describe('AdminUserFormModal', () => {
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
    render(<AdminUserFormModal {...defaultProps} initialData={null} />);

    expect(screen.getByRole('heading', { name: 'Add New User' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Username/i)).toHaveValue('');
    expect(screen.getByLabelText(/Password/i)).toBeRequired();
    expect(screen.getByRole('button', { name: /Save & Add Another/i })).toBeInTheDocument();
  });

  it('renders in "Edit" mode and populates fields from initialData', () => {
    const initialData = {
      email: 'test@example.com',
      username: 'testuser',
      name: 'Test User',
      access_level: 'staff',
      agency: 'SAR',
    };
    render(<AdminUserFormModal {...defaultProps} initialData={initialData} />);

    expect(screen.getByRole('heading', { name: `Edit User: ${initialData.email}` })).toBeInTheDocument();
    expect(screen.getByLabelText(/Username/i)).toHaveValue('testuser');
    expect(screen.getByLabelText(/Username/i)).toBeDisabled(); // Username/email should be immutable
    expect(screen.getByLabelText(/Full Name/i)).toHaveValue('Test User');
    expect(screen.getByLabelText(/Access Level/i)).toHaveValue('staff');
    expect(screen.getByLabelText(/Password/i)).not.toBeRequired();
    expect(screen.queryByRole('button', { name: /Save & Add Another/i })).not.toBeInTheDocument();
  });

  it('renders in "Profile Settings" mode and disables access level', () => {
    const initialData = { email: 'profile@example.com', access_level: 'admin' };
    render(<AdminUserFormModal {...defaultProps} initialData={initialData} isProfileSettings={true} />);

    expect(screen.getByRole('heading', { name: 'Account Settings' })).toBeInTheDocument();
    const accessSelect = screen.getByLabelText(/Access Level/i);
    expect(accessSelect).toBeDisabled();
    expect(screen.getByText(/Contact an administrator to change permissions/i)).toBeInTheDocument();
  });

  it('calls onSave with form data when "Save & Exit" is clicked', async () => {
    render(<AdminUserFormModal {...defaultProps} initialData={null} />);

    fireEvent.change(screen.getByLabelText(/Username/i), { target: { value: 'newuser' } });
    fireEvent.change(screen.getByLabelText(/Email Address/i), { target: { value: 'new@user.com' } });
    fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'newpass' } });
    fireEvent.change(screen.getByLabelText(/Full Name/i), { target: { value: 'New User' } });

    fireEvent.click(screen.getByRole('button', { name: /Save & Exit/i }));

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith(
        expect.objectContaining({
          username: 'newuser',
          email: 'new@user.com',
          password: 'newpass',
          name: 'New User',
        }),
        false // stayOpen = false
      );
    });
  });

  it('calls onSave with stayOpen=true when "Save & Add Another" is clicked', async () => {
    render(<AdminUserFormModal {...defaultProps} initialData={null} />);

    fireEvent.change(screen.getByLabelText(/Email Address/i), { target: { value: 'another@user.com' } });
    fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'pass' } });

    fireEvent.click(screen.getByRole('button', { name: /Save & Add Another/i }));

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'another@user.com' }),
        true // stayOpen = true
      );
    });
  });
});
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import ResponderFormModal from './ResponderFormModal';

// Mock BaseModal to focus on the form logic
vi.mock('../BaseModal', () => ({
  default: ({ children, title, actions }) => (
    <div>
      <h1>{title}</h1>
      <div>{children}</div>
      <div>{actions}</div>
    </div>
  ),
}));

describe('ResponderFormModal', () => {
  const mockOnSave = vi.fn();
  const mockOnClose = vi.fn();
  const mockOnCheckOut = vi.fn();

  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    onSave: mockOnSave,
    onCheckOut: mockOnCheckOut,
    loading: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders in "Add New" mode with default values', () => {
    render(<ResponderFormModal {...defaultProps} initialData={{}} />);
    expect(screen.getByRole('heading', { name: /Add New Responder/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Full Name/i)).toHaveValue('');
    expect(screen.getByLabelText(/Access Level/i)).toHaveValue('responder');
  });

  it('renders in "Edit" mode and populates fields from initialData', () => {
    const initialData = {
      responder_id: 'res-1',
      name: 'John Doe',
      agency: 'SAR Team',
      identifier: 'JD1',
      access_level: 'staff',
    };
    render(<ResponderFormModal {...defaultProps} initialData={initialData} />);
    expect(screen.getByRole('heading', { name: /Edit Responder/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Full Name/i)).toHaveValue('John Doe');
    expect(screen.getByLabelText(/Agency/i)).toHaveValue('SAR Team');
    expect(screen.getByLabelText(/Access Level/i)).toHaveValue('staff');
  });

  it('calls onSave with form data for "Save & Exit"', () => {
    render(<ResponderFormModal {...defaultProps} initialData={{}} />);
    fireEvent.change(screen.getByLabelText(/Full Name/i), { target: { value: 'New Person' } });
    fireEvent.click(screen.getByRole('button', { name: /Save & Exit/i }));
    expect(mockOnSave).toHaveBeenCalledWith(expect.objectContaining({ name: 'New Person' }), false);
  });

  it('calls onSave with form data for "Save & Add Another"', () => {
    render(<ResponderFormModal {...defaultProps} initialData={{}} />);
    fireEvent.change(screen.getByLabelText(/Full Name/i), { target: { value: 'Another Person' } });
    fireEvent.click(screen.getByRole('button', { name: /Save & Add Another/i }));
    expect(mockOnSave).toHaveBeenCalledWith(expect.objectContaining({ name: 'Another Person' }), true);
  });

  it('calls onCheckOut when the "Check Out" button is clicked', () => {
    render(<ResponderFormModal {...defaultProps} initialData={{ responder_id: 'res-1' }} />);
    fireEvent.click(screen.getByRole('button', { name: /Check Out/i }));
    expect(mockOnCheckOut).toHaveBeenCalled();
  });

  it('disables the Access Level dropdown when not in admin mode', () => {
    render(<ResponderFormModal {...defaultProps} isAdminMode={false} />);
    expect(screen.getByLabelText(/Access Level/i)).toBeDisabled();
  });

  it('enables the Access Level dropdown when in admin mode', () => {
    render(<ResponderFormModal {...defaultProps} isAdminMode={true} />);
    expect(screen.getByLabelText(/Access Level/i)).not.toBeDisabled();
  });
});
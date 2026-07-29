import { render, screen, fireEvent, within } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import AdminUsersTable from './AdminUsersTable';

describe('AdminUsersTable', () => {
  const mockHandleEditUser = vi.fn();
  const mockHandleNewUser = vi.fn();
  const mockHandleRemoveAdmin = vi.fn();
  const mockHandleChangePassword = vi.fn();

  const mockUsers = [
    { email: 'zulu@test.com', username: 'zulu', name: 'User Zulu', access_level: 'responder' },
    { email: 'alpha@test.com', username: 'alpha', name: 'User Alpha', access_level: 'admin' },
  ];

  const defaultProps = {
    users: mockUsers,
    isUsersExpanded: true,
    setIsUsersExpanded: vi.fn(),
    handleEditUser: mockHandleEditUser,
    handleNewUser: mockHandleNewUser,
    handleRemoveAdmin: mockHandleRemoveAdmin,
    handleChangePassword: mockHandleChangePassword,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders user rows and their data correctly', () => {
    render(<AdminUsersTable {...defaultProps} />);
    expect(screen.getByText('zulu@test.com')).toBeInTheDocument();
    expect(screen.getByText('User Zulu')).toBeInTheDocument();
    expect(screen.getByText('alpha@test.com')).toBeInTheDocument();
    expect(screen.getByText('User Alpha')).toBeInTheDocument();
  });

  it('sorts users by name by default (asc) and toggles direction', () => {
    render(<AdminUsersTable {...defaultProps} />);
    const rows = screen.getAllByRole('row'); // includes header row
    // Default sort is by name asc, so 'User Alpha' should be before 'User Zulu'
    expect(within(rows[1]).getByText('User Alpha')).toBeInTheDocument();
    expect(within(rows[2]).getByText('User Zulu')).toBeInTheDocument();

    // Click to sort descending
    fireEvent.click(screen.getByText(/Name/));
    const rerenderedRows = screen.getAllByRole('row');
    expect(within(rerenderedRows[1]).getByText('User Zulu')).toBeInTheDocument();
    expect(within(rerenderedRows[2]).getByText('User Alpha')).toBeInTheDocument();
  });

  it('calls the correct handlers for action buttons', () => {
    render(<AdminUsersTable {...defaultProps} />);
    const alphaRow = screen.getByText('alpha@test.com').closest('tr');

    // Test Edit
    fireEvent.click(within(alphaRow).getByRole('button', { name: /Edit/i }));
    expect(mockHandleEditUser).toHaveBeenCalledWith(mockUsers[1]);

    // Test Password
    fireEvent.click(within(alphaRow).getByRole('button', { name: /Password/i }));
    expect(mockHandleChangePassword).toHaveBeenCalledWith('alpha@test.com');

    // Test Remove
    fireEvent.click(within(alphaRow).getByRole('button', { name: /Remove/i }));
    expect(mockHandleRemoveAdmin).toHaveBeenCalledWith('alpha@test.com');
  });

  it('calls the new user handler when "+ New" is clicked', () => {
    render(<AdminUsersTable {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: '+ New' }));
    expect(mockHandleNewUser).toHaveBeenCalled();
  });
});
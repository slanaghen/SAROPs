import { render, screen, fireEvent, within } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import AdminRespondersTable from './AdminRespondersTable';

describe('AdminRespondersTable', () => {
  const mockHandleCheckOutResponder = vi.fn();
  const mockHandleEditResponder = vi.fn();
  const mockHandleNewResponder = vi.fn();
  const mockHandleDeleteResponder = vi.fn();

  const mockResponders = [
    { responder_id: 'r1', name: 'Zoe', agency: 'Agency Z', identifier: 'Z1', status: 'Staged', checkout_datetime: null },
    { responder_id: 'r2', name: 'Adam', agency: 'Agency A', identifier: 'A1', status: 'Deployed', checkout_datetime: null },
  ];

  const defaultProps = {
    allResponders: mockResponders,
    allIncidents: [],
    allTeams: [],
    isRespondersExpanded: true,
    setIsRespondersExpanded: vi.fn(),
    handleCheckOutResponder: mockHandleCheckOutResponder,
    handleEditResponder: mockHandleEditResponder,
    handleNewResponder: mockHandleNewResponder,
    handleDeleteResponder: mockHandleDeleteResponder,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders responder rows and their data correctly', () => {
    render(<AdminRespondersTable {...defaultProps} />);
    expect(screen.getByText('Zoe')).toBeInTheDocument();
    expect(screen.getByText('Agency Z')).toBeInTheDocument();
    expect(screen.getByText('Adam')).toBeInTheDocument();
    expect(screen.getByText('Agency A')).toBeInTheDocument();
  });

  it('sorts responders by name by default (asc) and toggles direction', () => {
    render(<AdminRespondersTable {...defaultProps} />);
    const rows = screen.getAllByRole('row'); // includes header row
    // Default sort is by name asc, so Adam (A) should be before Zoe (Z)
    expect(within(rows[1]).getByText('Adam')).toBeInTheDocument();
    expect(within(rows[2]).getByText('Zoe')).toBeInTheDocument();

    // Click to sort descending
    fireEvent.click(screen.getByText(/Name/));
    const rerenderedRows = screen.getAllByRole('row');
    expect(within(rerenderedRows[1]).getByText('Zoe')).toBeInTheDocument();
    expect(within(rerenderedRows[2]).getByText('Adam')).toBeInTheDocument();
  });

  it('calls the correct handlers for action buttons', () => {
    render(<AdminRespondersTable {...defaultProps} />);
    const zoeRow = screen.getByText('Zoe').closest('tr');
    const adamRow = screen.getByText('Adam').closest('tr');

    // Test Check Out (only available for non-checked-out responders)
    fireEvent.click(within(zoeRow).getByRole('button', { name: /Check Out/i }));
    expect(mockHandleCheckOutResponder).toHaveBeenCalledWith('r1');

    // Test Edit
    fireEvent.click(within(adamRow).getByRole('button', { name: /Edit/i }));
    expect(mockHandleEditResponder).toHaveBeenCalledWith(mockResponders[1]);

    // Test Delete
    fireEvent.click(within(zoeRow).getByRole('button', { name: /Delete/i }));
    expect(mockHandleDeleteResponder).toHaveBeenCalledWith('r1', 'Zoe', 'Agency Z');
  });

  it('hides the "Check Out" button for responders who are already checked out', () => {
    const checkedOutResponder = { ...mockResponders[0], checkout_datetime: new Date().toISOString() };
    render(<AdminRespondersTable {...defaultProps} allResponders={[checkedOutResponder]} />);
    
    const row = screen.getByText('Zoe').closest('tr');
    expect(within(row).queryByRole('button', { name: /Check Out/i })).not.toBeInTheDocument();
  });

  it('calls the new responder handler when "+ New" is clicked', () => {
    render(<AdminRespondersTable {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: '+ New' }));
    expect(mockHandleNewResponder).toHaveBeenCalled();
  });
});
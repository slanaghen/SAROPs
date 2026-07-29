import { render, screen, fireEvent, within } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import AdminVehiclesTable from './AdminVehiclesTable';

describe('AdminVehiclesTable', () => {
  const mockHandleCheckOutVehicle = vi.fn();
  const mockHandleEditVehicle = vi.fn();
  const mockHandleNewVehicle = vi.fn();
  const mockHandleDeleteVehicle = vi.fn();

  const mockVehicles = [
    { vehicle_id: 'v1', designation: 'SAR-2', type: 'UTV', status: 'Staged', license_plate: 'ZULU-1' },
    { vehicle_id: 'v2', designation: 'SAR-1', type: 'Truck', status: 'Unavailable', license_plate: 'ALPHA-1' },
  ];

  const defaultProps = {
    allVehicles: mockVehicles,
    isVehiclesExpanded: true,
    setIsVehiclesExpanded: vi.fn(),
    handleCheckOutVehicle: mockHandleCheckOutVehicle,
    handleEditVehicle: mockHandleEditVehicle,
    handleNewVehicle: mockHandleNewVehicle,
    handleDeleteVehicle: mockHandleDeleteVehicle,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders vehicle rows and their data correctly', () => {
    render(<AdminVehiclesTable {...defaultProps} />);
    expect(screen.getByText('SAR-2')).toBeInTheDocument();
    expect(screen.getByText('UTV')).toBeInTheDocument();
    expect(screen.getByText('SAR-1')).toBeInTheDocument();
    expect(screen.getByText('Truck')).toBeInTheDocument();
  });

  it('sorts vehicles by designation by default (asc) and toggles direction', () => {
    render(<AdminVehiclesTable {...defaultProps} />);
    const rows = screen.getAllByRole('row'); // includes header row
    // Default sort is by designation asc, so SAR-1 should be before SAR-2
    expect(within(rows[1]).getByText('SAR-1')).toBeInTheDocument();
    expect(within(rows[2]).getByText('SAR-2')).toBeInTheDocument();

    // Click to sort descending
    fireEvent.click(screen.getByText(/Designation/));
    const rerenderedRows = screen.getAllByRole('row');
    expect(within(rerenderedRows[1]).getByText('SAR-2')).toBeInTheDocument();
    expect(within(rerenderedRows[2]).getByText('SAR-1')).toBeInTheDocument();
  });

  it('calls the correct handlers for action buttons', () => {
    render(<AdminVehiclesTable {...defaultProps} />);
    const sar1Row = screen.getByText('SAR-1').closest('tr');
    const sar2Row = screen.getByText('SAR-2').closest('tr');

    // Test Check Out
    fireEvent.click(within(sar2Row).getByRole('button', { name: /Check Out/i }));
    expect(mockHandleCheckOutVehicle).toHaveBeenCalledWith('v1');

    // Test Edit
    fireEvent.click(within(sar1Row).getByRole('button', { name: /Edit/i }));
    expect(mockHandleEditVehicle).toHaveBeenCalledWith(mockVehicles[1]);

    // Test Delete
    fireEvent.click(within(sar1Row).getByRole('button', { name: /Remove/i }));
    expect(mockHandleDeleteVehicle).toHaveBeenCalledWith('v2', 'SAR-1');
  });

  it('hides the "Check Out" button for vehicles that are already checked out', () => {
    const checkedOutVehicle = { ...mockVehicles[0], status: 'CheckedOut' };
    render(<AdminVehiclesTable {...defaultProps} allVehicles={[checkedOutVehicle]} />);
    
    const row = screen.getByText('SAR-2').closest('tr');
    expect(within(row).queryByRole('button', { name: /Check Out/i })).not.toBeInTheDocument();
  });

  it('calls the new vehicle handler when "+ New" is clicked', () => {
    render(<AdminVehiclesTable {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: '+ New' }));
    expect(mockHandleNewVehicle).toHaveBeenCalled();
  });
});
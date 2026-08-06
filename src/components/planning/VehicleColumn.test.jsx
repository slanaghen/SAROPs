import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import VehicleColumn from './VehicleColumn';

describe('VehicleColumn', () => {
  const mockVehicles = [
    { vehicle_id: 'v1', designation: 'SAR-1', type: 'Truck', status: 'Staged' },
    { vehicle_id: 'v2', designation: 'UTV-1', type: 'UTV', status: 'Staged' },
  ];

  const defaultProps = {
    vehicles: mockVehicles,
    filter: '',
    onFilterChange: vi.fn(),
    onNew: vi.fn(),
    onEdit: vi.fn(),
    onCheckOut: vi.fn(),
    isVehicleHighlighted: vi.fn(() => false),
    draggedItem: null,
    dndHandlers: {
      handleDragStart: vi.fn(),
      handleDragEnd: vi.fn(),
      handleDragOver: vi.fn(),
      handleDragEnter: vi.fn(),
      handleDragLeave: vi.fn(),
      handleDrop: vi.fn(),
    },
  };

  it('renders the header, filter, and new button', () => {
    render(<VehicleColumn {...defaultProps} />);
    expect(screen.getByRole('heading', { name: /Staged Vehicles \(2\)/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Search designation or type/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /New Vehicle/i })).toBeInTheDocument();
  });

  it('calls onNew when the new button is clicked', () => {
    render(<VehicleColumn {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /New Vehicle/i }));
    expect(defaultProps.onNew).toHaveBeenCalled();
  });

  it('calls onFilterChange when the filter input changes', () => {
    render(<VehicleColumn {...defaultProps} />);
    fireEvent.change(screen.getByPlaceholderText(/Search designation or type/i), { target: { value: 'test' } });
    expect(defaultProps.onFilterChange).toHaveBeenCalledWith('test');
  });

  it('renders a list of vehicle cards', () => {
    render(<VehicleColumn {...defaultProps} />);
    expect(screen.getByText('SAR-1')).toBeInTheDocument();
    expect(screen.getByText('UTV-1')).toBeInTheDocument();
    expect(screen.getByText('Truck')).toBeInTheDocument();
  });

  it('calls onEdit when a vehicle card is clicked', () => {
    render(<VehicleColumn {...defaultProps} />);
    fireEvent.click(screen.getByText('SAR-1'));
    expect(defaultProps.onEdit).toHaveBeenCalledWith(mockVehicles[0]);
  });

  it('calls onCheckOut when the check out button is clicked', () => {
    render(<VehicleColumn {...defaultProps} />);
    const checkOutButtons = screen.getAllByRole('button', { name: /Check Out/i });
    fireEvent.click(checkOutButtons[0]);
    expect(defaultProps.onCheckOut).toHaveBeenCalledWith(mockVehicles[0]);
  });

  it('shows an empty state when there are no vehicles', () => {
    render(<VehicleColumn {...defaultProps} vehicles={[]} />);
    expect(screen.getByText(/No available vehicles in staging/i)).toBeInTheDocument();
  });
});
import { render, screen, fireEvent, within } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import AdminIncidentsTable from './AdminIncidentsTable';

describe('AdminIncidentsTable', () => {
  const mockHandleEndIncident = vi.fn();
  const mockHandleEditIncident = vi.fn();
  const mockHandleNewIncident = vi.fn();
  const mockHandleDeleteIncident = vi.fn();

  const mockIncidents = [
    {
      incident_id: 'inc-1',
      name: 'Active Incident',
      number: '2024-001',
      start_datetime: '2024-01-01T10:00:00Z',
      end_datetime: null,
      operational_periods: [{ op_number: 2 }],
    },
    {
      incident_id: 'inc-2',
      name: 'Ended Incident',
      number: '2023-050',
      start_datetime: '2023-12-01T10:00:00Z',
      end_datetime: '2023-12-02T10:00:00Z',
      operational_periods: [{ op_number: 1 }],
    },
  ];

  const defaultProps = {
    allIncidents: mockIncidents,
    isIncidentsExpanded: true,
    setIsIncidentsExpanded: vi.fn(),
    handleEndIncident: mockHandleEndIncident,
    handleEditIncident: mockHandleEditIncident,
    handleNewIncident: mockHandleNewIncident,
    handleDeleteIncident: mockHandleDeleteIncident,
    currentIncidentId: 'inc-1',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders incident rows and highlights the current active session', () => {
    render(<AdminIncidentsTable {...defaultProps} />);

    const activeRow = screen.getByText('Active Incident').closest('tr');
    const endedRow = screen.getByText('Ended Incident').closest('tr');

    expect(activeRow).toBeInTheDocument();
    expect(endedRow).toBeInTheDocument();

    // Check for active session highlight
    expect(activeRow).toHaveStyle('background-color: #f0f9ff');
    expect(within(activeRow).getByText('Active Session')).toBeInTheDocument();
    expect(endedRow).not.toHaveStyle('background-color: #f0f9ff');
  });

  it('displays the correct status chip for active and ended incidents', () => {
    render(<AdminIncidentsTable {...defaultProps} />);

    const activeRow = screen.getByText('Active Incident').closest('tr');
    const endedRow = screen.getByText('Ended Incident').closest('tr');

    expect(within(activeRow).getByText('Active')).toHaveClass('status-chip-active');
    expect(within(endedRow).getByText('Ended')).toHaveClass('status-chip-ended');
  });

  it('calls the correct handler when action buttons are clicked', () => {
    render(<AdminIncidentsTable {...defaultProps} />);

    const activeRow = screen.getByText('Active Incident').closest('tr');
    const endedRow = screen.getByText('Ended Incident').closest('tr');

    // Test End Incident
    fireEvent.click(within(activeRow).getByRole('button', { name: /End Incident/i }));
    expect(mockHandleEndIncident).toHaveBeenCalledWith('inc-1');

    // Test Edit Incident
    fireEvent.click(within(activeRow).getByRole('button', { name: /Edit/i }));
    expect(mockHandleEditIncident).toHaveBeenCalledWith(mockIncidents[0]);

    // Test Delete Incident (should only be on ended incidents)
    expect(within(activeRow).queryByRole('button', { name: /Delete/i })).not.toBeInTheDocument();
    fireEvent.click(within(endedRow).getByRole('button', { name: /Delete/i }));
    expect(mockHandleDeleteIncident).toHaveBeenCalledWith('inc-2', 'Ended Incident');
  });

  it('calls the new incident handler when the "+ New" button is clicked', () => {
    render(<AdminIncidentsTable {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: '+ New' }));
    expect(mockHandleNewIncident).toHaveBeenCalled();
  });

  it('collapses the table body when the header is clicked', () => {
    const mockSetIsExpanded = vi.fn();
    render(<AdminIncidentsTable {...defaultProps} setIsIncidentsExpanded={mockSetIsExpanded} />);
    
    fireEvent.click(screen.getByRole('heading', { name: /Incident Management/i }));
    expect(mockSetIsExpanded).toHaveBeenCalledWith(false);
  });
});
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import AdminActivationSection from './AdminActivationSection';

describe('AdminActivationSection Component', () => {
  const mockSetSelectedActivationId = vi.fn();
  const mockHandleLeaveIncident = vi.fn();
  const mockHandleActivateSession = vi.fn();

  const defaultProps = {
    isActive: false,
    incidentData: null,
    allIncidents: [
      { incident_id: 'inc-1', name: 'Incident One', number: '1' },
      { incident_id: 'inc-2', name: 'Incident Two', number: '2' },
    ],
    loading: false,
    fetching: false,
    selectedActivationId: '',
    setSelectedActivationId: mockSetSelectedActivationId,
    handleLeaveIncident: mockHandleLeaveIncident,
    handleActivateSession: mockHandleActivateSession,
    responderStatus: 'Staged',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the inactive session view by default', () => {
    render(<AdminActivationSection {...defaultProps} />);
    expect(screen.getByRole('heading', { name: /Incident Activation/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Select Incident/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Check in to Incident/i })).toBeInTheDocument();
  });

  it('renders the active session view when isActive is true', () => {
    const activeProps = {
      ...defaultProps,
      isActive: true,
      incidentData: { name: 'Incident One' },
    };
    render(<AdminActivationSection {...activeProps} />);
    expect(screen.getByText(/Current Active Session: Incident One/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Check out from Incident/i })).toBeInTheDocument();
  });

  it('populates the dropdown with active incidents', () => {
    render(<AdminActivationSection {...defaultProps} />);
    const options = screen.getAllByRole('option');
    // 1 for "select" + 2 for incidents
    expect(options).toHaveLength(3);
    expect(screen.getByRole('option', { name: 'Incident One (#1)' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Incident Two (#2)' })).toBeInTheDocument();
  });

  it('calls setSelectedActivationId when dropdown value changes', () => {
    render(<AdminActivationSection {...defaultProps} />);
    const dropdown = screen.getByLabelText(/Select Incident/i);
    fireEvent.change(dropdown, { target: { value: 'inc-2' } });
    expect(mockSetSelectedActivationId).toHaveBeenCalledWith('inc-2');
  });

  it('disables the "Check in" button when no incident is selected', () => {
    render(<AdminActivationSection {...defaultProps} selectedActivationId="" />);
    expect(screen.getByRole('button', { name: /Check in to Incident/i })).toBeDisabled();
  });

  it('disables the "Check in" button when loading or fetching', () => {
    const { rerender } = render(<AdminActivationSection {...defaultProps} selectedActivationId="inc-1" loading={true} />);
    expect(screen.getByRole('button', { name: /Joining.../i })).toBeDisabled();

    rerender(<AdminActivationSection {...defaultProps} selectedActivationId="inc-1" fetching={true} />);
    expect(screen.getByRole('button', { name: /Loading Data.../i })).toBeDisabled();
  });

  it('calls handleActivateSession when "Check in" button is clicked', () => {
    render(<AdminActivationSection {...defaultProps} selectedActivationId="inc-1" />);
    const checkinButton = screen.getByRole('button', { name: /Check in to Incident/i });
    fireEvent.click(checkinButton);
    expect(mockHandleActivateSession).toHaveBeenCalledTimes(1);
  });

  it('calls handleLeaveIncident when "Check out" button is clicked', () => {
    render(<AdminActivationSection {...defaultProps} isActive={true} />);
    const checkoutButton = screen.getByRole('button', { name: /Check out from Incident/i });
    fireEvent.click(checkoutButton);
    expect(mockHandleLeaveIncident).toHaveBeenCalledTimes(1);
  });

  it('disables "Check out" button if responder status is not Staged', () => {
    render(<AdminActivationSection {...defaultProps} isActive={true} responderStatus="Deployed" />);
    const checkoutButton = screen.getByRole('button', { name: /Check out from Incident/i });
    expect(checkoutButton).toBeDisabled();
    expect(checkoutButton).toHaveAttribute('title', expect.stringContaining("You must return to 'Staged' status"));
  });

  it('shows a warning when no active incidents are available', () => {
    render(<AdminActivationSection {...defaultProps} allIncidents={[]} />);
    expect(screen.getByText(/No active incidents found/i)).toBeInTheDocument();
  });
});
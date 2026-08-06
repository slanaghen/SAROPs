import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import TeamSection from './TeamSection';
import { useIncident } from '../context/IncidentContext';

vi.mock('../context/IncidentContext', () => ({
  useIncident: vi.fn(),
}));

describe('TeamSection Component', () => {
  const mockTeam = {
    team_id: 't1',
    team_name_number: 'Ground 1',
    type: 'Ground',
    status: 'Deployed',
    leader_responder_id: 'r1',
  };

  const defaultProps = {
    team: mockTeam,
    parRequired: false,
    timeSinceLastPar: '5m ago',
    parInterval: 60,
    leaderById: { r1: 'John Doe' },
    handleParResponse: vi.fn(),
    handleLeaveTeam: vi.fn(),
    isLeavingTeam: false,
    accessLevel: 'responder',
    icsRole: null,
    isExpanded: true,
    onToggle: vi.fn(),
    assignmentStatus: 'Deployed',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useIncident).mockReturnValue({
      responderId: 'user-not-leader', // This user is not the leader ('r1')
    });
  });

  it('renders team information correctly', () => {
    render(<TeamSection {...defaultProps} />);
    expect(screen.getByText('Your Team: Ground 1')).toBeInTheDocument();
    expect(screen.getByText('Ground')).toBeInTheDocument();
    expect(screen.getByText('Deployed')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });

  it('calls onToggle when the header is clicked', () => {
    render(<TeamSection {...defaultProps} />);
    fireEvent.click(screen.getByText('Your Team: Ground 1'));
    expect(defaultProps.onToggle).toHaveBeenCalledWith('team');
  });

  it('shows PAR check-in required warning when parRequired is true', () => {
    render(<TeamSection {...defaultProps} parRequired={true} />);
    expect(screen.getByText(/Check-in Required!/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /PAR OK/i })).toBeInTheDocument();
  });

  it('calls handleParResponse when "PAR OK" is clicked', () => {
    render(<TeamSection {...defaultProps} parRequired={true} />);
    fireEvent.click(screen.getByRole('button', { name: /PAR OK/i }));
    expect(defaultProps.handleParResponse).toHaveBeenCalledWith('OK');
  });

  it('calls handleLeaveTeam when "Leave Team" is clicked', () => {
    render(<TeamSection {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /Leave Team/i }));
    expect(defaultProps.handleLeaveTeam).toHaveBeenCalled();
  });

  it('displays the ICS role if provided', () => {
    render(<TeamSection {...defaultProps} icsRole="Operations Chief" />);
    expect(screen.getByText('Role: Operations Chief')).toBeInTheDocument();
  });

  it('disables the "Leave Team" button if the current user is the leader', () => {
    vi.mocked(useIncident).mockReturnValue({
      responderId: 'r1', // This user IS the leader
    });
    render(<TeamSection {...defaultProps} />);
    const leaveButton = screen.getByRole('button', { name: /Leave Team/i });
    expect(leaveButton).toBeDisabled();
    expect(leaveButton).toHaveAttribute('title', expect.stringContaining('A Team Leader cannot leave'));
  });
});
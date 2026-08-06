import { render, screen, fireEvent, within } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import TeamColumn from './TeamColumn';

describe('TeamColumn', () => {
  const mockTeams = [
    { team_id: 't1', team_name_number: 'Ground 1', type: 'Ground', status: 'Staged', leader_responder_id: 'r1', equipment: ['Radio'] },
    { team_id: 't2', team_name_number: 'Hasty 1', type: 'Hasty', status: 'Deployed', leader_responder_id: 'r2', equipment: [] },
  ];

  const defaultProps = {
    teams: mockTeams,
    filter: '',
    onFilterChange: vi.fn(),
    onNew: vi.fn(),
    onEdit: vi.fn(),
    onDisband: vi.fn(),
    isTeamHighlighted: vi.fn(() => false),
    getResponderName: vi.fn(id => `Leader ${id}`),
    getTeamMemberCount: vi.fn(() => 3),
    getTeamVehicleCount: vi.fn(() => 1),
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
    render(<TeamColumn {...defaultProps} />);
    expect(screen.getByRole('heading', { name: /Teams \(2\)/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Search team or leader/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /New Team/i })).toBeInTheDocument();
  });

  it('calls onNew when the new button is clicked', () => {
    render(<TeamColumn {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /New Team/i }));
    expect(defaultProps.onNew).toHaveBeenCalled();
  });

  it('calls onFilterChange when the filter input changes', () => {
    render(<TeamColumn {...defaultProps} />);
    fireEvent.change(screen.getByPlaceholderText(/Search team or leader/i), { target: { value: 'test' } });
    expect(defaultProps.onFilterChange).toHaveBeenCalledWith('test');
  });

  it('calls onEdit when a team card is clicked', () => {
    render(<TeamColumn {...defaultProps} />);
    fireEvent.click(screen.getByText('Ground 1'));
    expect(defaultProps.onEdit).toHaveBeenCalledWith('t1');
  });

  it('calls onDisband when the disband button is clicked', () => {
    render(<TeamColumn {...defaultProps} />);
    const disbandButtons = screen.getAllByRole('button', { name: /Disband/i });
    fireEvent.click(disbandButtons[0]);
    expect(defaultProps.onDisband).toHaveBeenCalledWith(mockTeams[0]);
  });

  it('disables the disband button for deployed teams', () => {
    render(<TeamColumn {...defaultProps} />);
    const deployedTeamCard = screen.getByText('Hasty 1').closest('.team-card');
    const disbandButton = within(deployedTeamCard).getByRole('button', { name: /Disband/i });
    expect(disbandButton).toBeDisabled();
  });

  it('shows an empty state when there are no teams', () => {
    render(<TeamColumn {...defaultProps} teams={[]} />);
    expect(screen.getByText(/No teams matching criteria/i)).toBeInTheDocument();
  });
});

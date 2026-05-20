import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
import { vi, describe, it, expect, afterEach, beforeEach } from 'vitest';
import TeamFormModal from '../components/TeamFormModal';
import { useIncident } from '../context/IncidentContext';

expect.extend(matchers);

vi.mock('../context/IncidentContext', () => ({
  useIncident: vi.fn(),
}));

afterEach(() => {
  cleanup();
});

describe('TeamFormModal', () => {
  beforeEach(() => {
    vi.mocked(useIncident).mockReturnValue({
      incidentId: 'inc-123',
      responderName: 'Steve',
      user: { email: 'steve@example.com' },
      incidentData: { opPeriodId: 'op-123' }
    });
  });

  const mockResponders = [
    { responder_id: 'r1', name: 'Responder 1', agency: 'Agency A', status: 'Staged' },
    { responder_id: 'r2', name: 'Responder 2', agency: 'Agency B', status: 'Staged' }
  ];

  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onSave: vi.fn(),
    initialData: {
      team_id: 't1',
      team_name_number: 'Team 1',
      type: 'Ground Search',
      status: 'Staged',
      leader_responder_id: null,
      equipment: [],
      responder_ids: []
    },
    responders: mockResponders
  };

  it('renders correctly when open', () => {
    render(<TeamFormModal {...defaultProps} />);
    expect(screen.getByText('Edit Team')).toBeInTheDocument();
    expect(screen.getByLabelText(/Team Name/i)).toHaveValue('Team 1');
  });

  it('does not render when closed', () => {
    const { container } = render(<TeamFormModal {...defaultProps} isOpen={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('updates leader via drag and drop and removes them from the staged pool', () => {
    render(<TeamFormModal {...defaultProps} />);
    
    // Verify Responder 1 is in the pool initially
    expect(screen.getByText('Responder 1')).toBeInTheDocument();

    const responderChip = screen.getByText('Responder 1').closest('[draggable="true"]');
    const leaderRow = screen.getByText(/Drop chip here to assign Team Leader/i).closest('tr');

    // Simulate drag and drop
    const dataTransfer = {
      setData: vi.fn(),
      getData: vi.fn().mockReturnValue('r1')
    };

    fireEvent.dragStart(responderChip, { dataTransfer });
    fireEvent.drop(leaderRow, { dataTransfer });
    
    // Responder 1 should now be in the composition table (Row 1)
    const table = screen.getByRole('table');
    expect(within(table).getByText('Responder 1')).toBeInTheDocument();

    // Responder 1 should be removed from the pool (the available responder list)
    const pool = screen.getByText(/Staged Responders/i).closest('.responder-pool');
    expect(within(pool).queryByText('Responder 1')).not.toBeInTheDocument();
  });

  it('calls onSave with updated data when Save is clicked', () => {
    // Pass a leader in initialData to ensure the Save button is enabled
    const propsWithLeader = {
      ...defaultProps,
      initialData: { ...defaultProps.initialData, leader_responder_id: 'r1' }
    };
    render(<TeamFormModal {...propsWithLeader} />);
    
    fireEvent.change(screen.getByLabelText(/Team Name/i), { target: { value: 'Team 99' } });
    fireEvent.click(screen.getByText('Save'));

    expect(defaultProps.onSave).toHaveBeenCalledWith(expect.objectContaining({
      team_name_number: 'Team 99'
    }));
  });

  it('disables save button when no leader is selected', () => {
    const propsNoLeader = {
      ...defaultProps,
      initialData: { ...defaultProps.initialData, leader_responder_id: null, responder_ids: [] }
    };
    render(<TeamFormModal {...propsNoLeader} />);
    
    expect(screen.getByRole('button', { name: /Save/i })).toBeDisabled();
  });

  it('calls onClose when Cancel is clicked', () => {
    render(<TeamFormModal {...defaultProps} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('enforces unique staff positions: moving IC role clears it from previous holder', () => {
    const staffProps = {
      ...defaultProps,
      initialData: { 
        ...defaultProps.initialData, 
        type: 'Staff', 
        leader_responder_id: 'r1',
        responder_roles: { 'r1': 'Incident Commander' }
      }
    };
    render(<TeamFormModal {...staffProps} />);

    // Find Responder 2 chip and the IC drop zone (Row 1)
    const r2Chip = screen.getByText('Responder 2').closest('[draggable="true"]');
    const icRow = screen.getByText('Incident Commander').closest('tr');

    const dataTransfer = { setData: vi.fn(), getData: vi.fn().mockReturnValue('r2') };
    fireEvent.dragStart(r2Chip, { dataTransfer });
    fireEvent.drop(icRow, { dataTransfer });

    // Responder 2 should now be the IC
    const table = screen.getByRole('table');
    const rows = within(table).getAllByRole('row');
    expect(within(rows[1]).getByText('Responder 2')).toBeInTheDocument();
    // Responder 1 is no longer IC (it would move to custom members or clear)
    expect(within(rows[1]).queryByText('Responder 1')).not.toBeInTheDocument();
  });
});
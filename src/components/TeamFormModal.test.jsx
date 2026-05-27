import { render, screen, fireEvent, cleanup, within, waitFor } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
import { vi, describe, it, expect, afterEach, beforeEach } from 'vitest';
import TeamFormModal from './TeamFormModal';
import { useIncident } from '../context/IncidentContext';
import { supabase } from '../lib/supabase';

expect.extend(matchers);

vi.mock('../context/IncidentContext', () => ({
  useIncident: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => globalThis.createSupabaseQueryMock([])),
    channel: vi.fn().mockImplementation(() => {
      const mockChannel = {
        on: vi.fn().mockImplementation(() => mockChannel),
        subscribe: vi.fn().mockImplementation(() => mockChannel)
      };
      return mockChannel;
    }),
    removeChannel: vi.fn(),
  },
}));

describe('TeamFormModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useIncident).mockReturnValue({
      incidentId: 'inc-123',
      responderName: 'Steve',
      user: { email: 'steve@example.com' },
      incidentData: { opPeriodId: 'op-123' }
    });
  });

  afterEach(() => {
    cleanup();
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
      type: 'Ground',
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

  it('renders role input fields for custom team members', () => {
    const propsWithMember = {
      ...defaultProps,
      initialData: { 
        ...defaultProps.initialData, 
        leader_responder_id: 'r1',
        responder_ids: ['r1', 'r2'],
        responder_roles: { 'r1': 'Team Leader', 'r2': 'Tracker' }
      }
    };
    render(<TeamFormModal {...propsWithMember} />);

    // R1 is the leader (Role is a fixed label)
    expect(screen.getByText('Team Leader')).toBeInTheDocument();
    
    // R2 is a custom member
    const trackerInput = screen.getByPlaceholderText(/Assign role.../i);
    expect(trackerInput).toHaveValue('Tracker');

    fireEvent.change(trackerInput, { target: { value: 'Medic' } });
    expect(propsWithMember.onSave).not.toHaveBeenCalled(); // Ensure local state change only
  });

  it('hides the "Staff" type option when a staff team already exists', () => {
    const propsWithExistingStaff = {
      ...defaultProps,
      commandStaffExists: true,
      initialData: { ...defaultProps.initialData, team_id: null, type: 'Ground' }
    };
    render(<TeamFormModal {...propsWithExistingStaff} />);
    
    const typeSelect = screen.getByLabelText(/Type/i);
    const options = within(typeSelect).queryAllByRole('option');
    const staffOption = options.find(o => o.getAttribute('value') === 'Staff');
    
    expect(staffOption).toBeUndefined();
  });

  it('renders staged responders regardless of case in status values', () => {
    const mixedStatusResponders = [
      ...mockResponders,
      { responder_id: 'r3', name: 'Responder 3', agency: 'Agency C', status: 'staged' }
    ];

    render(<TeamFormModal {...defaultProps} responders={mixedStatusResponders} />);
    expect(screen.getByText('Responder 3')).toBeInTheDocument();
  });

  it('normalizes legacy "Search" suffixes in team type on load', () => {
    const legacyProps = {
      ...defaultProps,
      initialData: { ...defaultProps.initialData, type: 'Vehicle Search' }
    };
    render(<TeamFormModal {...legacyProps} />);
    
    expect(screen.getByLabelText(/Type/i)).toHaveValue('Vehicle');
  });

  it('updates the messaging channel when a specific recipient is selected in Staff mode', async () => {
    const mockAllTeams = [
      { team_id: 't-field-1', team_name_number: 'Ground 1', type: 'Ground' }
    ];
    
    // Mock the teams fetch for the recipient dropdown
    vi.mocked(supabase.from).mockImplementation((table) => {
      if (table === 'teams') return globalThis.createSupabaseQueryMock(mockAllTeams);
      return globalThis.createSupabaseQueryMock([]);
    });

    const staffProps = {
      ...defaultProps,
      initialData: { team_id: 'staff-id', type: 'Staff', team_name_number: 'Staff' }
    };
    
    render(<TeamFormModal {...staffProps} />);

    // Wait for the recipient dropdown to populate with the field team option.
    // This ensures the initial mount fetches (Call 1) are processed and the component is stable.
    await screen.findByText('Ground 1');
    const recipientSelect = screen.getByDisplayValue(/Broadcast/i);
    expect(recipientSelect).toBeInTheDocument();

    // Select "Ground 1" from the dropdown
    fireEvent.change(recipientSelect, { target: { value: 't-field-1' } });

    // Verify messaging history fetch was re-triggered for the new channel
    await waitFor(() => {
      const messageCalls = vi.mocked(supabase.from).mock.calls.filter(c => c[0] === 'team_messages');
      // At least two calls: one for initial Staff channel, one for the selected field team
      expect(messageCalls.length).toBeGreaterThan(1);
    });
  });

  it('removes a responder from the team when dropped back into the staged pool', async () => {
    const propsWithMember = {
      ...defaultProps,
      initialData: { 
        ...defaultProps.initialData, 
        responder_ids: ['r1'],
        responder_roles: { 'r1': 'Medic' }
      }
    };
    render(<TeamFormModal {...propsWithMember} />);

    const memberChip = screen.getByText('Responder 1').closest('[draggable="true"]');
    const pool = screen.getByText(/Staged Responders/i).closest('.responder-pool');

    const dataTransfer = { setData: vi.fn(), getData: vi.fn().mockReturnValue('r1') };
    fireEvent.dragStart(memberChip, { dataTransfer });
    fireEvent.drop(pool, { dataTransfer });

    expect(within(pool).getByText('Responder 1')).toBeInTheDocument();
  });

  it('prevents adding the same responder twice to the team composition', () => {
    render(<TeamFormModal {...defaultProps} initialData={{ ...defaultProps.initialData, responder_ids: ['r1'] }} />);
    const compositionTable = screen.getByRole('table');
    const dataTransfer = { getData: vi.fn().mockReturnValue('r1') };
    
    // Attempt to drop R1 onto the member row again
    fireEvent.drop(within(compositionTable).getByText(/Drop chips here/i), { dataTransfer });
    expect(within(compositionTable).getAllByText('Responder 1')).toHaveLength(1);
  });
});
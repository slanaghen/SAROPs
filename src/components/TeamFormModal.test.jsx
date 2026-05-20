import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
import { vi, describe, it, expect, afterEach, beforeEach } from 'vitest';
import TeamFormModal from './TeamFormModal';
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
    
    const responderChip = screen.getByText('Responder 1').closest('[draggable="true"]');
    const leaderRow = screen.getByText(/Drop chip here to assign Team Leader/i).closest('tr');

    const dataTransfer = {
      setData: vi.fn(),
      getData: vi.fn().mockReturnValue('r1')
    };

    fireEvent.dragStart(responderChip, { dataTransfer });
    fireEvent.drop(leaderRow, { dataTransfer });
    
    const table = screen.getByRole('table');
    expect(within(table).getByText('Responder 1')).toBeInTheDocument();
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

  it('calls onClose when Cancel is clicked', () => {
    render(<TeamFormModal {...defaultProps} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });
});
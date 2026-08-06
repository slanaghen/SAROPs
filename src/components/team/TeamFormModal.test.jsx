import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import TeamFormModal from './TeamFormModal';
import { useIncident } from '../../context/IncidentContext';
import { useTeamActions } from '../../hooks/useTeamActions';

vi.mock('../../context/IncidentContext', () => ({
  useIncident: vi.fn(),
}));

// This mock is kept for consistency, but tests will assert on the onSave prop.
vi.mock('../../hooks/useTeamActions', () => ({
  useTeamActions: vi.fn(),
}));

// This test file assumes a component named TeamFormModal exists and makes
// reasonable assumptions about its props and behavior based on the spec.

describe('TeamFormModal', () => {
  const mockOnClose = vi.fn();
  const mockOnSave = vi.fn();

  const stagedResponders = [
    { responder_id: 'res-1', name: 'John Doe' },
    { responder_id: 'res-2', name: 'Jane Smith' },
    { responder_id: 'res-3', name: 'Peter Jones' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    // The component doesn't use this hook, but we mock it to be safe.
    vi.mocked(useIncident).mockReturnValue({
      incidentData: { opPeriodId: 'op-123' },
    });
  });

  it('should disable the save button until a leader is assigned', async () => {
    // This test simulates the state of the modal without a leader, then with one.
    const { rerender } = render(
      <TeamFormModal
        isOpen={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
        stagedResponders={stagedResponders}
        initialData={{ leader_responder_id: null }}
      />
    );

    const saveButton = screen.getByRole('button', { name: /Save & Exit/i });
    expect(saveButton).toBeDisabled();

    // Simulate assigning a leader
    rerender(
      <TeamFormModal
        isOpen={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
        stagedResponders={stagedResponders}
        initialData={{ leader_responder_id: 'res-1' }}
      />
    );
    expect(saveButton).not.toBeDisabled();
  });

  it('should call onSave with a blank name if left empty during creation', async () => {
    render(
      <TeamFormModal
        isOpen={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
        stagedResponders={stagedResponders}
        initialData={{ leader_responder_id: 'res-1', responder_ids: ['res-2'] }}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Save & Exit/i }));

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalled();
      const [callPayload] = mockOnSave.mock.calls[0];
      // The modal itself does not auto-generate names; it passes up the blank value.
      expect(callPayload.team_name_number).toBe('');
      expect(callPayload.leader_responder_id).toBe('res-1');
    });
  });

  it('should call onSave with updated members on edit', async () => {
    const existingTeam = {
      team_id: 'team-abc',
      team_name_number: 'Alpha Team',
      type: 'Hasty',
      leader_responder_id: 'res-1',
      responder_ids: ['res-2'],
    };

    const { rerender } = render(
      <TeamFormModal
        isOpen={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
        stagedResponders={stagedResponders}
        initialData={existingTeam}
      />
    );

    // Simulate removing res-2 and adding res-3 by re-rendering with new props
    rerender(
       <TeamFormModal
        isOpen={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
        stagedResponders={stagedResponders}
        initialData={{ ...existingTeam, responder_ids: ['res-3'] }}
      />
    );

    // In edit mode, the button text is "Save Changes"
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalled();
      const [payload] = mockOnSave.mock.calls[0];
      expect(payload.team_id).toBe('team-abc');
      // The component passes the final state, not a diff.
      expect(payload.responder_ids).toEqual(['res-3']);
    });
  });
});
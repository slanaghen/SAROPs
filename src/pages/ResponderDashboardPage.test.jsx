import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import ResponderDashboardPage from './ResponderDashboardPage';
import { useIncident } from '../context/IncidentContext';
import { useToast } from '../context/ToastContext';
import useResponderTeamAndAssignment from '../hooks/useResponderTeamAndAssignment';
import { removeResponderFromTeam } from '../services/responderService';
import { supabase } from '../lib/supabase';

// Mock dependencies
vi.mock('../context/IncidentContext');
vi.mock('../context/ToastContext');
vi.mock('../hooks/useResponderTeamAndAssignment');
vi.mock('../services/responderService');

// Values captured by a vi.mock factory must be initialized before Vitest hoists it.
const { mockInsert } = vi.hoisted(() => ({ mockInsert: vi.fn() }));

vi.mock('../lib/supabase', () => {
  const queryBuilderMock = {
    select: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    insert: mockInsert, // Use the spy
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: {}, error: null }),
    // Make the builder thenable so it can be awaited
    then: (callback) => Promise.resolve({ data: [], error: null }).then(callback),
  };

  // Configure the spy to return a chainable object for .select().single()
  mockInsert.mockImplementation(() => ({
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: { id: 'new-msg' }, error: null }),
  }));

  return {
    supabase: {
      from: vi.fn(() => queryBuilderMock),
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
    })),
    removeChannel: vi.fn(),
  },
}});

describe('ResponderDashboardPage', () => {
  const mockAddToast = vi.fn();

  const mockTeam = {
    team_id: 't1',
    team_name_number: 'Ground 1',
    type: 'Ground',
    status: 'Deployed',
    leader_responder_id: 'res-leader',
    last_par_check: new Date().toISOString(),
  };

  const mockAssignment = {
    assignment_id: 'a1',
    title: 'Search Area Alpha',
    status: 'Deployed',
    description: 'Grid search the designated area.',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockInsert.mockClear();
    window.confirm = vi.fn().mockReturnValue(true);

    vi.mocked(useIncident).mockReturnValue({
      incidentId: 'inc-123',
      incidentData: { opPeriodId: 'op-123', parInterval: 60 },
      responderId: 'res-1',
      responderName: 'John Doe',
      accessLevel: 'responder',
      setResponderStatus: vi.fn(),
      setCurrentTeamStatus: vi.fn(),
      setCurrentAssignmentStatus: vi.fn(),
    });

    vi.mocked(useToast).mockReturnValue({ addToast: mockAddToast });
  });

  it('renders team and assignment information when assigned', () => {
    vi.mocked(useResponderTeamAndAssignment).mockReturnValue({
      team: mockTeam,
      assignment: mockAssignment,
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<MemoryRouter><ResponderDashboardPage /></MemoryRouter>);

    expect(screen.getByText(/Your Team: Ground 1/i)).toBeInTheDocument();
    expect(screen.getByText(/Team Assignment: Search Area Alpha/i)).toBeInTheDocument();
    expect(screen.getByText(/Grid search the designated area/i)).toBeInTheDocument();
  });

  it('renders an empty state message when not assigned to a team', () => {
    vi.mocked(useResponderTeamAndAssignment).mockReturnValue({
      team: null,
      assignment: null,
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<MemoryRouter><ResponderDashboardPage /></MemoryRouter>);

    expect(screen.getByText(/You are currently not attached to a team/i)).toBeInTheDocument();
  });

  it('allows a responder to send a message', async () => {
    vi.mocked(useResponderTeamAndAssignment).mockReturnValue({
      team: mockTeam,
      assignment: null,
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<MemoryRouter><ResponderDashboardPage /></MemoryRouter>);

    const messageInput = screen.getByPlaceholderText(/Send message.../i);
    const sendButton = screen.getByRole('button', { name: /Send/i });

    fireEvent.change(messageInput, { target: { value: 'Test message from responder' } });
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          team_id: 't1',
          message_text: 'Test message from responder',
          sender_name: expect.stringContaining('John Doe'),
        })
      );
    });
  });

  it('allows a responder to leave their team', async () => {
    vi.mocked(useResponderTeamAndAssignment).mockReturnValue({
      team: mockTeam,
      assignment: null,
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
    vi.mocked(removeResponderFromTeam).mockResolvedValue(undefined);

    render(<MemoryRouter><ResponderDashboardPage /></MemoryRouter>);

    const leaveButton = screen.getByRole('button', { name: /Leave Team/i });
    fireEvent.click(leaveButton);

    await waitFor(() => {
      expect(removeResponderFromTeam).toHaveBeenCalledWith(supabase, 'res-1', 't1');
    });
  });

  it('disables the "Leave Team" button for the team leader', () => {
    vi.mocked(useResponderTeamAndAssignment).mockReturnValue({
      team: { ...mockTeam, leader_responder_id: 'res-1' }, // Current user is the leader
      assignment: null,
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<MemoryRouter><ResponderDashboardPage /></MemoryRouter>);

    const leaveButton = screen.getByRole('button', { name: /Leave Team/i });
    expect(leaveButton).toBeDisabled();
  });
});

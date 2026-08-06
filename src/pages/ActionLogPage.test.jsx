import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import ActionLogPage from './ActionLogPage';
import { useIncident } from '../context/IncidentContext';
import { useToast } from '../context/ToastContext';
import { supabase } from '../lib/supabase';

// Mock dependencies
vi.mock('../context/IncidentContext');
vi.mock('../context/ToastContext');
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
  },
}));

describe('ActionLogPage', () => {
  const mockAddToast = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useToast).mockReturnValue({ addToast: mockAddToast });
  });

  it('renders loading state and then an empty message if no logs are found', async () => {
    vi.mocked(useIncident).mockReturnValue({
      incidentId: 'inc-123',
      responderName: 'Test User',
    });
    vi.mocked(supabase.from('action_logs').order).mockResolvedValue({ data: [], error: null });

    render(<MemoryRouter><ActionLogPage /></MemoryRouter>);

    expect(screen.getByText(/Loading logs.../i)).toBeInTheDocument();
    expect(await screen.findByText(/No actions recorded yet/i)).toBeInTheDocument();
  });

  it('fetches and displays action logs for the current incident', async () => {
    const mockLogs = [
      { id: 1, created_at: new Date().toISOString(), action: 'Incident Started', user_name: 'Admin' },
      { id: 2, created_at: new Date().toISOString(), action: 'Team Deployed', user_name: 'Ops Chief' },
    ];
    vi.mocked(useIncident).mockReturnValue({
      incidentId: 'inc-123',
      responderName: 'Test User',
    });
    vi.mocked(supabase.from('action_logs').order).mockResolvedValue({ data: mockLogs, error: null });

    render(<MemoryRouter><ActionLogPage /></MemoryRouter>);

    expect(await screen.findByText(/Incident Started/i)).toBeInTheDocument();
    expect(screen.getByText(/Team Deployed/i)).toBeInTheDocument();
    expect(screen.getByText('Admin')).toBeInTheDocument();
    expect(screen.getByText('Ops Chief')).toBeInTheDocument();
  });

  it('allows a user to add a manual log entry', async () => {
    const mockInsert = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(supabase.from('action_logs').insert).mockImplementation(mockInsert);
    vi.mocked(supabase.from('action_logs').order).mockResolvedValue({ data: [], error: null });

    vi.mocked(useIncident).mockReturnValue({
      incidentId: 'inc-123',
      responderName: 'Manual Logger',
    });

    render(<MemoryRouter><ActionLogPage /></MemoryRouter>);

    const input = screen.getByPlaceholderText(/Manually record an action/i);
    const addButton = screen.getByRole('button', { name: /Add to Log/i });

    fireEvent.change(input, { target: { value: 'Subject located by Team 1' } });
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(mockInsert).toHaveBeenCalledWith({
        incident_id: 'inc-123',
        action: 'Subject located by Team 1',
        user_name: 'Manual Logger',
      });
    });
  });

  it('shows a message if no incident is active', () => {
    vi.mocked(useIncident).mockReturnValue({ incidentId: null });
    render(<MemoryRouter><ActionLogPage /></MemoryRouter>);
    expect(screen.getByText(/Please select or start an incident/i)).toBeInTheDocument();
  });
});
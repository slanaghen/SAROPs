import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import ActionLogPage from '../pages/ActionLogPage';
import { useIncident } from '../context/IncidentContext';
import { supabase } from '../lib/supabase';

expect.extend(matchers);

vi.mock('../context/IncidentContext', () => ({
  useIncident: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe('ActionLogPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  const mockLogs = [
    { id: '1', created_at: new Date().toISOString(), action: 'Team 1 Assigned', user_name: 'Steve' },
  ];

  it('displays a prompt if no incident is active', () => {
    vi.mocked(useIncident).mockReturnValue({ incidentId: null });
    render(<ActionLogPage />);
    expect(screen.getByText(/Please select or start an incident/i)).toBeInTheDocument();
  });

  it('renders log entries from the database', async () => {
    vi.mocked(useIncident).mockReturnValue({ incidentId: 'inc-123' });
    
    supabase.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: mockLogs, error: null })
    });

    render(<ActionLogPage />);

    await waitFor(() => {
      expect(screen.getByText('Team 1 Assigned')).toBeInTheDocument();
      expect(screen.getByText('Steve')).toBeInTheDocument();
    });
  });

  it('allows manual entry of log items', async () => {
    vi.mocked(useIncident).mockReturnValue({ incidentId: 'inc-123', responderName: 'Steve' });
    supabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
        insert: vi.fn().mockResolvedValue({ error: null })
    });

    render(<ActionLogPage />);
    
    const input = screen.getByPlaceholderText(/Manually record an action/i);
    fireEvent.change(input, { target: { value: 'Manual radio check' } });
    fireEvent.click(screen.getByText('Add to Log'));

    await waitFor(() => {
      expect(supabase.from).toHaveBeenCalledWith('action_logs');
    });
  });
});
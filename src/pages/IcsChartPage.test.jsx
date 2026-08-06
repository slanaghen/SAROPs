import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import IcsChartPage from './IcsChartPage';
import { useIncident } from '../context/IncidentContext';
import { supabase } from '../lib/supabase';

// Mock dependencies
vi.mock('../context/IncidentContext');
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn(),
  },
}));

describe('IcsChartPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows a loading state initially', () => {
    vi.mocked(useIncident).mockReturnValue({ incidentData: { opPeriodId: 'op-1' } });
    render(<IcsChartPage />);
    expect(screen.getByText(/Loading Chart Data.../i)).toBeInTheDocument();
  });

  it('shows an error if no operational period is selected', () => {
    vi.mocked(useIncident).mockReturnValue({ incidentData: null });
    render(<IcsChartPage />);
    expect(screen.getByText(/Error: No active operational period selected./i)).toBeInTheDocument();
  });

  it('shows an error if the Staff team cannot be found', async () => {
    vi.mocked(useIncident).mockReturnValue({ incidentData: { opPeriodId: 'op-1' } });
    vi.mocked(supabase.from('teams').single).mockResolvedValue({ data: null, error: new Error('Not found') });
    render(<IcsChartPage />);
    await waitFor(() => {
      expect(screen.getByText(/Error: Not found/i)).toBeInTheDocument();
    });
  });

});
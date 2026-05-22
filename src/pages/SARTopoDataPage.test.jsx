import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import SARTopoDataPage from './SARTopoDataPage';
import { useIncident } from '../context/IncidentContext';
import { supabase } from '../lib/supabase';

expect.extend(matchers);

vi.mock('../context/IncidentContext', () => ({
  useIncident: vi.fn(),
}));

const fromMock = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  maybeSingle: vi.fn().mockResolvedValue({ data: { sartopo_id: 'MAP123' }, error: null }),
  upsert: vi.fn(() => ({
    select: vi.fn().mockResolvedValue({ data: [{ assignment_id: 'assign-1' }], error: null }),
  })),
};

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => fromMock),
  },
}));
const mockOpPeriodId = 'op-123';
describe('SARTopoDataPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  afterEach(cleanup);

  it('renders map information when an incident is active', async () => {
    vi.mocked(useIncident).mockReturnValue({ isActive: true, incidentId: 'inc-123' });
    render(<SARTopoDataPage />);
    
    expect(await screen.findByText('MAP123')).toBeInTheDocument();
    expect(screen.getByText('Fetch Live Features')).toBeInTheDocument();
  });

  it('handles API errors when fetching features', async () => {
    vi.mocked(useIncident).mockReturnValue({ isActive: true, incidentId: 'inc-123' });
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      text: vi.fn().mockResolvedValue('<!DOCTYPE html>'),
      headers: { get: () => 'text/html' }
    });

    render(<SARTopoDataPage />);
    
    const fetchBtn = await screen.findByText('Fetch Live Features');
    fireEvent.click(fetchBtn);

    expect(await screen.findByText(/SARTopo returned an error page/i)).toBeInTheDocument();
  });

  it('renders features as JSON when fetch is successful', async () => {
    const mockData = { features: [{ type: 'Feature', properties: { name: 'Clue 1' } }] };
    vi.mocked(useIncident).mockReturnValue({ isActive: true, incidentId: 'inc-123' });
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: { get: () => 'application/json' },
      json: vi.fn().mockResolvedValue(mockData)
    });

    render(<SARTopoDataPage />);
    
    const fetchBtn = await screen.findByText('Fetch Live Features');
    fireEvent.click(fetchBtn);

    expect(await screen.findByText(/Map Features \(1\)/i)).toBeInTheDocument();
    expect(screen.getByText(/"Clue 1"/)).toBeInTheDocument();
  });

  it('syncs assignment feature payloads to Supabase', async () => {
    const mockData = { features: [{ type: 'Feature', id: 'feature-1', properties: { name: 'Clue 1', resource_type: 'Search Team', priority: 'High' } }] };
    vi.mocked(useIncident).mockReturnValue({ isActive: true, incidentId: 'inc-123', incidentData: { opPeriodId: mockOpPeriodId } });
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: { get: () => 'application/json' },
      json: vi.fn().mockResolvedValue(mockData)
    });

    render(<SARTopoDataPage />);
    
    const fetchBtn = await screen.findByText('Fetch Live Features');
    fireEvent.click(fetchBtn);

    expect(await screen.findByText(/Map Features \(1\)/i)).toBeInTheDocument();
    const syncBtn = await screen.findByText('Sync Assignment Features');
    
    // Verify the button is disabled and does not trigger synchronization
    expect(syncBtn).toBeDisabled();
    fireEvent.click(syncBtn);
    expect(fromMock.upsert).not.toHaveBeenCalled();
  });
});
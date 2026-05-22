import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react';
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
  insert: vi.fn(() => ({
    select: vi.fn().mockResolvedValue({ data: [], error: null }),
  })),
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
    // Provide a fetch mock to satisfy the automated initial fetch on mount
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: vi.fn().mockResolvedValue({ features: [] })
    });

    render(<SARTopoDataPage />);
    
    expect(await screen.findByText('MAP123')).toBeInTheDocument();
    // Use findByText to wait for the automated initial fetch to complete and the button to revert to idle
    expect(await screen.findByText('Fetch Live Features')).toBeInTheDocument();
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
    const mockData = { features: [{ type: 'Feature', properties: { name: 'Clue 1', class: 'Assignment' } }] };
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

    const mapFeaturesHeading = await screen.findByRole('heading', { name: /Map Features \(1\)/i });
    const mapFeaturesSection = mapFeaturesHeading.closest('.section-card');
    expect(mapFeaturesSection).toBeInTheDocument();
    expect(within(mapFeaturesSection).getByText(/"Clue 1"/)).toBeInTheDocument();
  });

  it('syncs assignment feature payloads to Supabase', async () => {
    const mockData = { 
      features: [{ 
        type: 'Feature', 
        id: 'feature-1', 
        properties: { 
          name: 'Clue 1', 
          resource_type: 'Search Team', 
          priority: 'High',
          class: 'Assignment'
        } 
      }] 
    };
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
    
    // Requirement: Verify synchronization triggers and sends correct data
    expect(syncBtn).not.toBeDisabled();
    await waitFor(() => expect(fromMock.upsert).toHaveBeenCalled());
    expect(fromMock.upsert.mock.calls[0][0][0]).toMatchObject({
      op_period_id: mockOpPeriodId,
      sartopo_id: 'feature-1',
      title: 'Clue 1',
      resource_type: 'Search Team',
      priority: 'High'
    });
  });

  it('correctly maps SARTopo Responsive POD and Primary Frequency to SAROps fields', async () => {
    const mockData = { 
      features: [{ 
        type: 'Feature', 
        id: 'feat-pod', 
        properties: { 
          class: 'Assignment',
          title: 'POD Test', 
          unresponsive_pod: '85',
          primary_frequency: 'TAC 4',
          teamSize: '4'
        } 
      }] 
    };
    
    vi.mocked(useIncident).mockReturnValue({ isActive: true, incidentId: 'inc-123', incidentData: { opPeriodId: 'op-123' } });
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: vi.fn().mockResolvedValue(mockData)
    });

    render(<SARTopoDataPage />);
    
    await waitFor(() => expect(fromMock.upsert).toHaveBeenCalled());
    
    expect(fromMock.upsert.mock.calls[0][0][0]).toMatchObject({
      probability_of_detection: 85,
      frequency_primary: 'TAC 4',
      team_size: 4,
      title: 'POD Test'
    });
  });

  it('updates the fetch URL with a timestamp after a successful fetch', async () => {
    vi.mocked(useIncident).mockReturnValue({ isActive: true, incidentId: 'inc-123' });
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: vi.fn().mockResolvedValue({ features: [] })
    });

    render(<SARTopoDataPage />);
    
    // Wait for the initial fetch to complete and update lastFetchTime
    await waitFor(() => {
      const url = screen.getByText(/\/since\/\d+/);
      expect(url.textContent).not.toContain('/since/0');
    });
  });
});
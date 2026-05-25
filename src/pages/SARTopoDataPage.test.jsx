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
  not: vi.fn().mockReturnThis(),
  gt: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  maybeSingle: vi.fn().mockResolvedValue({ data: { sartopo_id: 'MAP123' }, error: null }),
  insert: vi.fn(() => ({
    select: vi.fn().mockResolvedValue({ data: [], error: null }),
  })),
  upsert: vi.fn(() => ({
    select: vi.fn().mockResolvedValue({ data: [{ assignment_id: 'assign-1' }], error: null }),
  })).mockReturnThis(),
  then: vi.fn((onFulfilled) => Promise.resolve({ data: [], error: null }).then(onFulfilled)),
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
    localStorage.clear();
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
    expect(await screen.findByText('Download')).toBeInTheDocument();
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
    
    const fetchBtn = await screen.findByText('Download');
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
    
    const fetchBtn = await screen.findByText('Download');
    fireEvent.click(fetchBtn);

    const mapFeaturesHeading = await screen.findByRole('heading', { name: /Map Download \(1\)/i });
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
    
    const fetchBtn = await screen.findByText('Download');
    fireEvent.click(fetchBtn);

    expect(await screen.findByText(/Map Download \(1\)/i)).toBeInTheDocument();
    
    // Requirement: Verify synchronization triggers and sends correct data
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
    
    // Trigger fetch manually as it no longer auto-syncs on load by default
    const fetchBtn = await screen.findByText('Download');
    fireEvent.click(fetchBtn);

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
    
    // Trigger fetch manually as it no longer auto-syncs on load by default
    fireEvent.click(await screen.findByText('Download'));

    await waitFor(() => {
      const url = screen.getByText(/\/since\/\d+/);
      expect(url.textContent).not.toContain('/since/0');
    });
  });

  it('generates upload GeoJSON from Supabase assignments', async () => {
    const mockAsns = [
      { assignment_id: 'a1', title: 'Task 1', status: 'Assigned', op_period_id: 'op-123', updated_at: new Date().toISOString(), origin: 'SARTopo', sartopo_id: 's1' }
    ];
    
    fromMock.then.mockImplementationOnce((onFulfilled) => 
      Promise.resolve({ data: mockAsns, error: null }).then(onFulfilled)
    );
    
    vi.mocked(useIncident).mockReturnValue({ 
      isActive: true, 
      incidentId: 'inc-123', 
      incidentData: { opPeriodId: 'op-123' } 
    });

    render(<SARTopoDataPage />);
    
    const uploadBtn = await screen.findByText('Upload');
    fireEvent.click(uploadBtn);

    expect(await screen.findByText(/Map Upload \(1\)/i)).toBeInTheDocument();
    expect(screen.getByText(/"Task 1"/i)).toBeInTheDocument();
  });

  it('toggles periodic refresh via Pause/Sync button', async () => {
    vi.mocked(useIncident).mockReturnValue({ isActive: true, incidentId: 'inc-123' });
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: vi.fn().mockResolvedValue({ features: [] })
    });

    render(<SARTopoDataPage />);
    
    // Default state is now disabled per request, so button shows "Sync"
    const syncBtn = await screen.findByText('Sync');
    fireEvent.click(syncBtn);
    expect(screen.getByText('Pause')).toBeInTheDocument();
    
    fireEvent.click(screen.getByText('Pause'));
    expect(screen.getByText('Sync')).toBeInTheDocument();
  });

  it('resets the fetch timestamp to 0 when the Reset button is clicked', async () => {
    vi.mocked(useIncident).mockReturnValue({ isActive: true, incidentId: 'inc-123' });
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: vi.fn().mockResolvedValue({ features: [] })
    });

    render(<SARTopoDataPage />);
    
    // Trigger fetch manually as it no longer auto-syncs on load by default
    fireEvent.click(await screen.findByText('Download'));

    await waitFor(() => {
      const url = screen.getByText(/\/since\/\d+/);
      expect(url.textContent).not.toContain('/since/0');
    });

    const resetBtn = screen.getByTitle(/Reset fetch and upload timestamps to 0/i);
    fireEvent.click(resetBtn);

    // Verify URL now contains /since/0
    expect(screen.getByText(/\/since\/0/)).toBeInTheDocument();
  });

  it('toggles between showing all download objects and only assignments', async () => {
    const mockData = {
      features: [
        { type: 'Feature', properties: { name: 'Clue 1', class: 'Assignment' }, id: 'a1' },
        { type: 'Feature', properties: { name: 'POI 1', class: 'Point of Interest' }, id: 'p1' },
        { type: 'Feature', properties: { name: 'Clue 2', class: 'Assignment' }, id: 'a2' },
      ]
    };
    vi.mocked(useIncident).mockReturnValue({ isActive: true, incidentId: 'inc-123' });
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: vi.fn().mockResolvedValue(mockData)
    });

    render(<SARTopoDataPage />);
    
    const fetchBtn = await screen.findByText('Download');
    fireEvent.click(fetchBtn);

    // Initially, only assignments should be shown (2 features)
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Map Download \(2\)/i })).toBeInTheDocument();
      expect(screen.getByText(/"Clue 1"/)).toBeInTheDocument();
      expect(screen.queryByText(/"POI 1"/)).not.toBeInTheDocument();
    });

    // Click the toggle button to show all objects
    fireEvent.click(screen.getByTitle('Show All Objects'));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Map Download \(3\)/i })).toBeInTheDocument();
      expect(screen.getByText(/"POI 1"/)).toBeInTheDocument();
    });
  });

  it('sends generated GeoJSON features to SARTopo API on Upload button click', async () => {
    const mockAsns = [
      { assignment_id: 'a1', title: 'Task 1', status: 'Assigned', op_period_id: 'op-123', updated_at: new Date().toISOString(), origin: 'SARTopo', sartopo_id: 's1' },
      { assignment_id: 'a2', title: 'Task 2', status: 'Planned', op_period_id: 'op-123', updated_at: new Date().toISOString(), origin: 'SARTopo', sartopo_id: 's2' }
    ];

    // Mock the Supabase query for assignments
    fromMock.then.mockImplementation((onFulfilled) => 
      Promise.resolve({ data: mockAsns, error: null }).then(onFulfilled)
    );
    
    vi.mocked(useIncident).mockReturnValue({ 
      isActive: true, 
      incidentId: 'inc-123', 
      incidentData: { opPeriodId: 'op-123' } 
    });

    // Mock fetch for the SARTopo POST requests
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue('OK')
    });

    render(<SARTopoDataPage />);
    
    const uploadBtn = await screen.findByRole('button', { name: /Upload/i });
    fireEvent.click(uploadBtn);

    // Expect fetch to be called for each assignment
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(global.fetch).toHaveBeenCalledWith(
        '/sartopo-api/api/v1/map/MAP123/Assignment/s1',
        expect.objectContaining({
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          credentials: 'include',
          body: expect.stringContaining('"title":"Task 1"')
        })
      );
      expect(global.fetch).toHaveBeenCalledWith(
        '/sartopo-api/api/v1/map/MAP123/Assignment/s2',
        expect.objectContaining({
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          credentials: 'include',
          body: expect.any(String)
        })
      );
    });
  });
});
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
    vi.stubGlobal('alert', vi.fn());
    // Ensure a robust default fetch mock is available to prevent 'undefined' response errors
    const defaultFetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: (name) => name === 'content-type' ? 'application/json' : null },
      json: async () => ({ features: [] }),
      text: async () => 'OK'
    });
    vi.stubGlobal('fetch', defaultFetchMock);

    // Reset the shared Supabase mock implementation to a safe default
    fromMock.then.mockImplementation((onFulfilled) => 
      Promise.resolve({ data: [], error: null }).then(onFulfilled)
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('sartopoConfig correctly parses Map ID and injects API Key', async () => {
    vi.stubEnv('VITE_SARTOPO_API_KEY', 'SECRET_KEY');
    vi.mocked(useIncident).mockReturnValue({ 
      isActive: true, 
      incidentId: 'inc-123',
      incidentData: { opPeriodId: 'op-123' } 
    });

    // Component fetches sartopo_id on mount; override the default mock to return the complex URL
    fromMock.maybeSingle.mockResolvedValueOnce({ 
      data: { sartopo_id: 'https://sartopo.com/m/ABCD?foo=bar' }, error: null 
    });

    render(<SARTopoDataPage />);
    
    // Trigger fetch to verify the generated URL via the network call
    fireEvent.click(await screen.findByText('Download from SARTopo'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('ABCD/since/0?foo=bar&k=SECRET_KEY')
      );
    });
    vi.unstubAllEnvs();
  });

  it('appends the SARTopo API key from environment variables to request URLs', async () => {
    // Mock the environment variable in the test context
    vi.stubEnv('VITE_SARTOPO_API_KEY', 'SECRET_KEY_123');
    
    vi.mocked(useIncident).mockReturnValue({ isActive: true, incidentId: 'inc-123', incidentData: { opPeriodId: 'op-1' } });

    render(<SARTopoDataPage />);
    
    fireEvent.click(await screen.findByText('Download from SARTopo'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('since/0?k=SECRET_KEY_123')
      );
    });

    // Cleanup environment stubs
    vi.unstubAllEnvs();
  });

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
    expect(await screen.findByText('Download from SARTopo')).toBeInTheDocument();
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
    
    const fetchBtn = await screen.findByText('Download from SARTopo');
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
    
    const fetchBtn = await screen.findByText('Download from SARTopo');
    fireEvent.click(fetchBtn);

    const mapFeaturesHeading = await screen.findByRole('heading', { name: /Map Download from SARTopo \(1\)/i });
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
    
    const fetchBtn = await screen.findByText('Download from SARTopo');
    fireEvent.click(fetchBtn);

    expect(await screen.findByText(/Map Download from SARTopo \(1\)/i)).toBeInTheDocument();
    
    // Requirement: Verify synchronization triggers and sends correct data
    await waitFor(() => expect(fromMock.upsert).toHaveBeenCalled());
    expect(fromMock.upsert.mock.calls[0][0][0]).toMatchObject({
      op_period_id: mockOpPeriodId,
      sartopo_id: 'feature-1',
      title: 'Clue 1',
      resource_type: 'Search Team',
      priority: 'High',
      origin: 'SARTopo',
      status: 'Planned',
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
    const fetchBtn = await screen.findByText('Download from SARTopo');
    fireEvent.click(fetchBtn);

    await waitFor(() => expect(fromMock.upsert).toHaveBeenCalled());
    
    expect(fromMock.upsert.mock.calls[0][0][0]).toMatchObject({
      probability_of_detection: 85,
      frequency_primary: 'TAC 4',
      team_size: 4,
      title: 'POD Test'
    });
  });

  it('displays the "Latest Download" timestamp after a successful fetch', async () => {
    vi.mocked(useIncident).mockReturnValue({ isActive: true, incidentId: 'inc-123', incidentData: { opPeriodId: 'op-1' } });

    render(<SARTopoDataPage />);
    
    expect(screen.queryByText(/Latest Download:/i)).not.toBeInTheDocument();
    
    // Trigger fetch manually as it no longer auto-syncs on load by default
    fireEvent.click(await screen.findByText('Download from SARTopo'));

    await waitFor(() => {
      expect(screen.getByText(/Latest Download:/i)).toBeInTheDocument();
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

    // Mock Supabase to return our task for all queries in this test
    fromMock.then.mockImplementation((onFulfilled) => 
      Promise.resolve({ data: mockAsns, error: null }).then(onFulfilled)
    );

    // Mock fetch for the reconciliation logic
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: (name) => name === 'content-type' ? 'application/json' : null },
      json: async () => ({ features: [{ id: 's1', geometry: null, properties: { class: 'Assignment', title: 'Task 1' } }] })
    });

    render(<SARTopoDataPage />);
    
    // Must populate internal features state first
    fireEvent.click(await screen.findByText('Download from SARTopo'));
    await waitFor(() => expect(screen.getByText(/Latest Download:/i)).toBeInTheDocument());

    const generateBtn = await screen.findByRole('button', { name: /Generate JSON/i });
    fireEvent.click(generateBtn);

    const uploadHeading = await screen.findByText(/Map Upload to SARTopo \(1\)/i);
    expect(uploadHeading).toBeInTheDocument();
    const uploadSection = uploadHeading.closest('.section-card');
    expect(within(uploadSection).getByText(/"Task 1"/i)).toBeInTheDocument();
  });

  it('toggles visibility of geometry in the upload JSON preview', async () => {
    const mockAsns = [
      { assignment_id: 'a1', title: 'Task 1', status: 'Assigned', op_period_id: 'op-123', updated_at: new Date().toISOString(), origin: 'SARTopo', sartopo_id: 's1' }
    ];
    
    fromMock.then.mockImplementation((onFulfilled) => 
      Promise.resolve({ data: mockAsns, error: null }).then(onFulfilled)
    );
    
    vi.mocked(useIncident).mockReturnValue({ 
      isActive: true, 
      incidentId: 'inc-123', 
      incidentData: { opPeriodId: 'op-123' } 
    });

    // Mock fetch for the reconciliation logic (fetching base features)
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: (name) => name === 'content-type' ? 'application/json' : null },
      json: async () => ({ features: [{ id: 's1', geometry: { type: 'Point', coordinates: [0,0] }, properties: { class: 'Assignment', title: 'Task 1' } }] })
    });

    render(<SARTopoDataPage />);
    
    // 1. Requirement: Must download features first so generateUploadGeoJSON has a base state to merge with
    fireEvent.click(await screen.findByText('Download from SARTopo'));
    await waitFor(() => expect(screen.getByText(/Latest Download:/i)).toBeInTheDocument());

    // 2. Click Generate JSON
    fireEvent.click(await screen.findByRole('button', { name: /Generate JSON/i }));

    // 3. Wait for generation results to appear in the preview heading
    expect(await screen.findByText(/Map Upload to SARTopo \(1\)/i)).toBeInTheDocument();

    const uploadSection = screen.getByRole('heading', { name: /Map Upload to SARTopo/i }).closest('.section-card');
    expect(uploadSection).toBeInTheDocument();

    // By default, geometry is hidden
    expect(screen.queryByText(/"geometry":/i)).not.toBeInTheDocument();

    // Toggle Show Geometry
    fireEvent.click(within(uploadSection).getByText('Show Geometry'));
    // Wait for the UI to update the JSON string display
    expect(await within(uploadSection).findByText(/"geometry":/i)).toBeInTheDocument();
    expect(within(uploadSection).getByText('Hide Geometry')).toBeInTheDocument();
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
    fireEvent.click(await screen.findByText('Download from SARTopo'));

    await waitFor(() => {
      expect(screen.getByText(/Latest Download:/i)).toBeInTheDocument();
    });

    const resetBtn = screen.getByTitle(/Reset fetch and upload timestamps to 0/i);
    fireEvent.click(resetBtn);

    // Verify timestamp label is removed on reset
    expect(screen.queryByText(/Latest Download:/i)).not.toBeInTheDocument();
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
    
    const fetchBtn = await screen.findByText('Download from SARTopo');
    fireEvent.click(fetchBtn);

    // Initially, only assignments should be shown (2 features)
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Map Download from SARTopo \(2\)/i })).toBeInTheDocument();
      expect(screen.getByText(/"Clue 1"/)).toBeInTheDocument();
      expect(screen.queryByText(/"POI 1"/)).not.toBeInTheDocument();
    });

    // Click the toggle button to show all objects
    fireEvent.click(screen.getByTitle('Show All Objects'));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Map Download from SARTopo \(3\)/i })).toBeInTheDocument();
      expect(screen.getByText(/"POI 1"/)).toBeInTheDocument();
    });
  });

  it('sends generated GeoJSON features to SARTopo API on Upload button click', async () => {
    const mockAsns = [
      { assignment_id: 'a1', title: 'Task 1', status: 'Assigned', op_period_id: 'op-123', updated_at: new Date().toISOString(), origin: 'SARTopo', sartopo_id: 's1' },
      { assignment_id: 'a2', title: 'Task 2', status: 'Planned', op_period_id: 'op-123', updated_at: new Date().toISOString(), origin: 'SARTopo', sartopo_id: 's2' }
    ];

    // Mock API key to match implementation's expectations
    const mockKey = 'x7+lOzSEs6+q6m37cUV2S7a19ucAKUxEve60nzRYq6k=';
    vi.stubEnv('VITE_SARTOPO_API_KEY', mockKey);

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
      json: async () => ({ 
        features: [
          { id: 's1', properties: { title: 'Old Task 1', class: 'Assignment', pod: 50 } },
          { id: 's2', properties: { title: 'Old Task 2', class: 'Assignment', team_size: 2 } }
        ] 
      }),
      text: async () => 'OK'
    });

    render(<SARTopoDataPage />);
    
    const uploadBtn = await screen.findByRole('button', { name: /Upload to SARTopo/i });
    fireEvent.click(uploadBtn);

    // Requirement: Expect fetch to be called 3 times: 1 for Step 1 (GET State), and 2 for Step 3 (POST updates)
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(3);
      // Step 1: Ensure reconciliation uses the reliable /since/0 endpoint
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/since/0'));
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(`/sartopo-api/api/v1/map/MAP123/features?readCode=${mockKey}`),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"id":"s1"')
        })
      );
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(`/sartopo-api/api/v1/map/MAP123/features?readCode=${mockKey}`),
        expect.objectContaining({
          method: 'POST',
          body: expect.any(String)
        })
      );
    });
    vi.unstubAllEnvs();
  });

  it('records a detailed audit log entry when assignments are synced', async () => {
    const mockData = { 
      features: [{ 
        type: 'Feature', id: 'f1', 
        properties: { name: 'Audit Task', class: 'Assignment' } 
      }] 
    };
    vi.mocked(useIncident).mockReturnValue({ 
      isActive: true, incidentId: 'inc-123', responderName: 'Steve', 
      incidentData: { opPeriodId: 'op-123' } 
    });
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: vi.fn().mockResolvedValue(mockData)
    });

    render(<SARTopoDataPage />);
    fireEvent.click(await screen.findByText('Download from SARTopo'));

    await waitFor(() => {
      expect(supabase.from).toHaveBeenCalledWith('action_logs');
      const logCall = vi.mocked(fromMock.insert).mock.calls.find(c => c[0].action?.includes('Synced'));
      expect(logCall[0]).toEqual(expect.objectContaining({ user_name: 'Steve' }));
    });
  });
});
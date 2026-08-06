import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import SARTopoDataPage from './SARTopoDataPage';
import { useIncident } from '../context/IncidentContext';
import { supabase } from '../lib/supabase';
import { useToast } from '../context/ToastContext';

import SartopoHeader from '../components/sartopo/SartopoHeader';
import SartopoSyncedAssignments from '../components/sartopo/SartopoSyncedAssignments';
expect.extend(matchers);

vi.mock('../context/IncidentContext', () => ({
  useIncident: vi.fn(),
}));

vi.mock('../context/ToastContext', () => ({
  useToast: vi.fn(),
}));

vi.mock('../components/sartopo/SartopoHeader', () => ({
  default: vi.fn(({ sartopoId, lastFetchTime, onFetch, onReset, onUpload, isAutoRefreshEnabled, toggleAutoRefresh }) => (
    <div>
      <span data-testid="sartopo-id-display">{sartopoId}</span>
      {lastFetchTime > 0 && <span data-testid="latest-download-time">Latest Download: {new Date(lastFetchTime).toLocaleString()}</span>}
      <button onClick={onFetch}>Download from SARTopo</button>
      <button onClick={onReset} title="Reset fetch and upload timestamps to 0">Reset</button>
      <button onClick={onUpload}>Upload to SARTopo</button>
      <button onClick={toggleAutoRefresh}>{isAutoRefreshEnabled ? 'Pause Sync' : 'Sync'}</button>
    </div>
  )),
}));

vi.mock('../components/sartopo/SartopoSyncedAssignments', () => ({
  default: vi.fn(() => <div data-testid="synced-assignments-mock" />),
}));

/**
 * Shared reference to track DB operations across multiple independent query mocks.
 */
const mockTrackers = {
  upsert: vi.fn().mockImplementation(() => Promise.resolve({ error: null })),
  insert: vi.fn().mockImplementation(() => Promise.resolve({ error: null })),
  update: vi.fn().mockImplementation(() => Promise.resolve({ error: null })),
  delete: vi.fn().mockImplementation(() => Promise.resolve({ error: null })),
};

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn().mockImplementation((table) => {
      let data = [];
      if (table === 'incidents') {
        data = { sartopo_id: 'MAP123', sartopo_sync_enabled: false, sartopo_last_fetch_at: 0, sartopo_last_upload_at: 0, sartopo_synced_titles: [] };
      }
      const mock = globalThis.createSupabaseQueryMock(data);
      // Wire up trackers to chainable methods
      mock.upsert = vi.fn((...args) => ({ ...mock, then: (cb) => mockTrackers.upsert(...args).then(cb) }));
      mock.insert = vi.fn((...args) => ({ ...mock, then: (cb) => mockTrackers.insert(...args).then(cb) }));
      mock.update = vi.fn((...args) => ({ ...mock, then: (cb) => mockTrackers.update(...args).then(cb) }));
      mock.delete = vi.fn((...args) => ({ ...mock, then: (cb) => mockTrackers.delete(...args).then(cb) }));
      return mock;
    }),
    auth: {
      refreshSession: vi.fn().mockResolvedValue({ data: { session: {} }, error: null }),
      // Add getSession for initial auth checks that might be present
      getSession: vi.fn().mockResolvedValue({ data: { session: { user: { email: 'admin@test.com' } } }, error: null }),
    },
    channel: vi.fn().mockImplementation(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    })),
    removeChannel: vi.fn(),
    // Requirement: The service now uses invoke, so the mock must include it.
    functions: {
      invoke: vi.fn(),
    }
  },
}));
const mockOpPeriodId = 'op-123';
describe('SARTopoDataPage', () => {
  // Helper to create a more robust mock for the Supabase fluent query API
  const createSupabaseQueryMock = (data, error = null) => {
    const mock = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data, error }),
      then: (cb) => Promise.resolve({ data, error }).then(cb),
      upsert: mockTrackers.upsert,
      insert: mockTrackers.insert,
      // The original `update` was the tracker function itself, which is not chainable.
      // This new implementation calls the tracker AND returns `this` to allow chaining.
      update: vi.fn(function(...args) {
        mockTrackers.update(...args);
        return this;
      }),
    };
    return mock;
  };
  const mockAddToast = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockAddToast.mockClear();
    localStorage.clear();
    vi.stubGlobal('alert', vi.fn());

    // Reset trackers
    Object.values(mockTrackers).forEach(m => m.mockClear());

    vi.mocked(supabase.from).mockImplementation((table) => {
      if (table === 'incidents') {
        const data = { sartopo_id: 'MAP123', sartopo_sync_enabled: false, sartopo_last_fetch_at: 0, sartopo_last_upload_at: 0, sartopo_synced_titles: [] };
        return createSupabaseQueryMock(data);
      }
      if (table === 'assignments') {
        return createSupabaseQueryMock([]);
      }
      if (table === 'action_logs') {
        return createSupabaseQueryMock(null);
      }
      return createSupabaseQueryMock(null); // Default fallback
    });

    // Requirement: Secure signing mandates valid Base64 credentials.
    vi.stubEnv('VITE_SARTOPO_API_CREDENTIAL_ID', 'ID_123');
    vi.stubEnv('VITE_SARTOPO_API_CREDENTIAL_SECRET', 'x7+lOzSEs6+q6m37cUV2S7a19ucAKUxEve60nzRYq6k=');

    // Set a default useIncident mock for tests that don't override it
    vi.mocked(useIncident).mockReturnValue({
      isActive: true,
      incidentId: 'inc-123',
      incidentData: { opPeriodId: 'op-123', name: 'Mock Incident' },
      responderName: 'Steve',
      user: { email: 'admin@test.com' }
      // Add other necessary properties if they are accessed by the component
      // e.g., setResponderStatus: vi.fn(), setCurrentTeamStatus: vi.fn(), etc.
    });

    vi.mocked(useToast).mockReturnValue({
      addToast: mockAddToast
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('sartopoConfig correctly parses Map ID and removes legacy keys', async () => {
    // This test verifies that even if legacy keys are pasted into the Map ID,
    // the system strips them before calling the proxy.
    vi.mocked(supabase.from).mockImplementation((table) => {
      if (table === 'incidents') {
        const data = { sartopo_id: 'https://sartopo.com/m/ABCD?foo=bar&k=OLD_KEY&readCode=OLD_KEY' };
        return createSupabaseQueryMock(data);
      }
      return createSupabaseQueryMock(null);
    });

    vi.mocked(supabase.functions.invoke).mockResolvedValue({ data: { features: [] }, error: null });

    render(<SARTopoDataPage />);
    fireEvent.click(await screen.findByText('Download from SARTopo'));

    await waitFor(() => {
      expect(supabase.functions.invoke).toHaveBeenCalled();
      const invokeCall = vi.mocked(supabase.functions.invoke).mock.calls[0][1];
      const sartopoConfigParams = invokeCall.body.sartopoConfig.params;

      // The params are stringified before sending to the proxy.
      expect(sartopoConfigParams).not.toContain('k=OLD_KEY');
      expect(sartopoConfigParams).not.toContain('readCode=OLD_KEY');
      expect(sartopoConfigParams).toContain('foo=bar');
    });
  });

  it('renders map information when an incident is active', async () => {
    render(<SARTopoDataPage />);
    
    // Mock the proxy call for the initial fetch (which happens on mount if sartopo_sync_enabled is true)
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: { features: [] },
      error: null,
    });
    
    expect(await screen.findByText('MAP123')).toBeInTheDocument();
    // Use findByText to wait for the automated initial fetch to complete and the button to revert to idle
    expect(await screen.findByText('Download from SARTopo')).toBeInTheDocument();
  });

  it('handles API errors when fetching features', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: null,
      error: { message: 'SARTopo returned an error page' }
    });

    render(<SARTopoDataPage />);

    const fetchBtn = await screen.findByText('Download from SARTopo');
    fireEvent.click(fetchBtn);

    // Requirement: Since the error alert div was removed in favor of Toasts, 
    // we verify the notification system was called instead of looking for DOM text.
    await waitFor(() => expect(mockAddToast).toHaveBeenCalledWith(expect.stringMatching(/Edge Function Error: SARTopo returned an error page/i), 'error'));
  });

  it('renders features as JSON when fetch is successful', async () => {
    const mockData = { features: [{ id: 'f1', type: 'Feature', properties: { name: 'Clue 1', class: 'Assignment' } }] };
    
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: mockData,
      error: null,
    });

    render(<SARTopoDataPage />); // Render once
    
    const fetchBtn = await screen.findByText('Download from SARTopo');
    fireEvent.click(fetchBtn);

    await waitFor(async () => {
      const heading = await screen.findByText((c, el) => el.tagName === 'H2' && c.includes('GeoJSON Download') && c.includes('1'));
      expect(heading).toBeInTheDocument();
      expect(within(heading.closest('.section-card')).getByText(/"Clue 1"/)).toBeInTheDocument();
    });
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
    vi.mocked(useIncident).mockReturnValue({ 
      isActive: true, incidentId: 'inc-123', 
      incidentData: { opPeriodId: mockOpPeriodId },
      user: { email: 'admin@test.com' }
    });
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: mockData,
      error: null,
    });

    render(<SARTopoDataPage />); // Render once
    
    const fetchBtn = await screen.findByText('Download from SARTopo');
    fireEvent.click(fetchBtn);

    await waitFor(async () => {
      const heading = await screen.findByText((c, el) => el.tagName === 'H2' && c.includes('GeoJSON Download') && c.includes('1'));
      expect(heading).toBeInTheDocument();
    });
    
    // Requirement: Verify synchronization triggers and sends correct data
    await waitFor(() => expect(mockTrackers.upsert).toHaveBeenCalled());
    expect(vi.mocked(mockTrackers.upsert).mock.calls[0][0][0]).toMatchObject({
      op_period_id: mockOpPeriodId,
      sartopo_id: 'feature-1',
      title: 'Clue 1',
      resource_type: 'Search Team',
      priority: 'High',
      origin: 'SARTopo',
      status: 'Planned',
    });
  });

  it('defaults resource_type to "Ground" for SARTopo assignments if undefined', async () => {
    const mockData = {
      features: [{
        type: 'Feature',
        id: 'feature-no-type',
        properties: {
          name: 'No Type Assignment',
          // resource_type is intentionally omitted
          class: 'Assignment'
        }
      }]
    };
    vi.mocked(useIncident).mockReturnValue({
      isActive: true,
      incidentId: 'inc-123',
      incidentData: { opPeriodId: mockOpPeriodId },
      user: { email: 'admin@test.com' }
    });
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: mockData,
      error: null,
    });

    render(<SARTopoDataPage />); // Render once
    
    const fetchBtn = await screen.findByText('Download from SARTopo');
    fireEvent.click(fetchBtn);

    await waitFor(() => expect(mockTrackers.upsert).toHaveBeenCalled());
    
    expect(vi.mocked(mockTrackers.upsert).mock.calls[0][0][0]).toMatchObject({
      sartopo_id: 'feature-no-type',
      title: 'No Type Assignment',
      resource_type: 'Ground', // Verify it defaults to Ground
    });
  });

  it('correctly maps SARTopo POD and Primary Frequency to SAROps fields', async () => {
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
    // Default useIncident mock from beforeEach is used
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: mockData,
      error: null,
    });

    render(<SARTopoDataPage />);
    
    // Trigger fetch manually as it no longer auto-syncs on load by default
    const fetchBtn = await screen.findByText('Download from SARTopo');
    fireEvent.click(fetchBtn);

    await waitFor(() => expect(mockTrackers.upsert).toHaveBeenCalled());
    
    expect(vi.mocked(mockTrackers.upsert).mock.calls[0][0][0]).toMatchObject({
      probability_of_detection: 85,
      frequency_primary: 'TAC 4',
      team_size: 4,
      title: 'POD Test'
    });
  });

  it('displays the "Latest Download" timestamp after a successful fetch', async () => {
    // Default useIncident mock from beforeEach is used

    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: { features: [] },
      error: null,
    });

    render(<SARTopoDataPage />); // Render once
    const downloadBtn = await screen.findByText('Download from SARTopo');
    fireEvent.click(downloadBtn);

    await waitFor(() => {
      expect(screen.getByTestId('latest-download-time')).toBeInTheDocument();
    });
  });

  it('generates upload GeoJSON from Supabase assignments', async () => {
    const mockAsns = [
      { assignment_id: 'a1', title: 'Task 1', status: 'Assigned', op_period_id: 'op-123', updated_at: new Date().toISOString(), origin: 'SARTopo', sartopo_id: 's1' }
    ];
    
    vi.mocked(supabase.from).mockImplementation((table) => {
      let data = [];
      if (table === 'assignments') data = mockAsns;
      else if (table === 'incidents') {
        data = { sartopo_id: 'MAP123', sartopo_sync_enabled: false, sartopo_last_fetch_at: 0, sartopo_last_upload_at: 0, sartopo_synced_titles: [] };
      }
      return globalThis.createSupabaseQueryMock(data);
    });

    // Mock invoke for reconciliation
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: { features: [{ id: 's1', geometry: null, properties: { class: 'Assignment', title: 'Task 1' } }] },
      error: null,
    });

    render(<SARTopoDataPage />); // Render once
    
    // Must populate internal features state first
    const downloadBtn = await screen.findByText('Download from SARTopo');
    fireEvent.click(downloadBtn);
    await waitFor(() => expect(screen.getByTestId('latest-download-time')).toBeInTheDocument());

    const generateBtn = await screen.findByRole('button', { name: /Generate JSON/i });
    fireEvent.click(generateBtn);

    const uploadHeading = await screen.findByText((c, el) => el.tagName === 'H2' && c.includes('GeoJSON Upload') && c.includes('1'));
    const uploadSection = uploadHeading.closest('.section-card');
    expect(within(uploadSection).getByText(/"Task 1"/i)).toBeInTheDocument();
  });

  it('toggles visibility of geometry in the upload JSON preview', async () => {
    const mockAsns = [
      { assignment_id: 'a1', title: 'Task 1', status: 'Assigned', op_period_id: 'op-123', updated_at: new Date().toISOString(), origin: 'SARTopo', sartopo_id: 's1' }
    ];
    
    vi.mocked(supabase.from).mockImplementation((table) => {
      let data = [];
      if (table === 'assignments') data = mockAsns;
      else if (table === 'incidents') {
        data = { sartopo_id: 'MAP123', sartopo_sync_enabled: false, sartopo_last_fetch_at: 0, sartopo_last_upload_at: 0, sartopo_synced_titles: [] };
      }
      return globalThis.createSupabaseQueryMock(data);
    });

    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: { features: [{ id: 's1', geometry: { type: 'Point', coordinates: [0,0] }, properties: { class: 'Assignment', title: 'Task 1' } }] },
      error: null,
    });
    render(<SARTopoDataPage />); // Render once
    
    // 1. Requirement: Must download features first so generateUploadGeoJSON has a base state to merge with
    const downloadBtn = await screen.findByText('Download from SARTopo');
    fireEvent.click(downloadBtn);
    await waitFor(() => expect(screen.getByTestId('latest-download-time')).toBeInTheDocument());

    // 2. Click Generate JSON
    const generateBtn = await screen.findByRole('button', { name: /Generate JSON/i });
    fireEvent.click(generateBtn);

    // 3. Wait for generation results to appear in the preview heading
    const heading = await screen.findByText((c, el) => el.tagName === 'H2' && c.includes('GeoJSON Upload') && c.includes('1'));
    expect(heading).toBeInTheDocument();

    const uploadSection = screen.getByRole('heading', { name: /GeoJSON Upload to SARTopo/i }).closest('.section-card');
    expect(uploadSection).toBeInTheDocument();

    // By default, geometry is hidden
    expect(screen.queryByText(/"geometry":/i)).not.toBeInTheDocument();

    // Toggle Show Geometry
    fireEvent.click(within(uploadSection).getByText('Show Geometry'));
    // Wait for the UI to update the JSON string display
    const geometryText = await within(uploadSection).findByText(/"geometry":/i);
    expect(geometryText).toBeInTheDocument();
    expect(within(uploadSection).getByText('Hide Geometry')).toBeInTheDocument();
  });

  it('toggles periodic refresh via Pause/Sync button', async () => {
    // Default useIncident mock from beforeEach is used
    vi.mocked(useIncident).mockReturnValue({ 
      isActive: true, 
      incidentId: 'inc-123',
      incidentData: { opPeriodId: 'op-123' } 
    });
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: { features: [] },
      error: null,
    });

    render(<SARTopoDataPage />); // Render once
    
    // Default state is now disabled per request, so button shows "Sync"
    const syncBtn = await screen.findByText('Sync');
    fireEvent.click(syncBtn);
    expect(await screen.findByText('Pause Sync')).toBeInTheDocument();
    
    fireEvent.click(screen.getByText('Pause Sync'));
    expect(await screen.findByText('Sync')).toBeInTheDocument();
  });

  it('resets the fetch timestamp to 0 when the Reset button is clicked', async () => {
    // Default useIncident mock from beforeEach is used
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: { features: [] }, error: null,
    });
    render(<SARTopoDataPage />); // Render once
    
    // Trigger fetch manually as it no longer auto-syncs on load by default
    fireEvent.click(await screen.findByText('Download from SARTopo'));

    await waitFor(() => {
      expect(screen.getByTestId('latest-download-time')).toBeInTheDocument();
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
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: mockData,
      error: null,
    });

    render(<SARTopoDataPage />); // Render once
    
    const fetchBtn = await screen.findByText('Download from SARTopo');
    fireEvent.click(fetchBtn);

    // Initially, only assignments should be shown (2 features)
    await waitFor(async () => {
      const heading = await screen.findByText((c, el) => el.tagName === 'H2' && c.includes('GeoJSON Download') && c.includes('2'));
      expect(heading).toBeInTheDocument();
      expect(screen.getByText(/"Clue 1"/)).toBeInTheDocument();
    });

    // Click the toggle button to show all objects
    fireEvent.click(screen.getByTitle('Show All Objects'));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /GeoJSON Download from SARTopo/i })).toHaveTextContent('3');
      expect(screen.getByText(/"POI 1"/)).toBeInTheDocument();
    });
  });

  it('sends generated GeoJSON features to SARTopo API on Upload button click', async () => {
    const mockAsns = [
      { assignment_id: 'a1', title: 'Task 1', status: 'Assigned', op_period_id: 'op-123', updated_at: new Date().toISOString(), origin: 'SARTopo', sartopo_id: 's1' },
      { assignment_id: 'a2', title: 'Task 2', status: 'Planned', op_period_id: 'op-123', updated_at: new Date().toISOString(), origin: 'SARTopo', sartopo_id: 's2' }
    ];

    // Default useIncident mock from beforeEach is used

    vi.mocked(supabase.from).mockImplementation((table) => {
      let data = [];
      if (table === 'assignments') data = mockAsns;
      else if (table === 'incidents') data = { sartopo_id: 'MAP123' };
      const mock = createSupabaseQueryMock(data);
      return mock;
    });

    // Mock invoke for both the GET and POST calls
    vi.mocked(supabase.functions.invoke).mockImplementation(async (functionName, options) => {
      if (options.body.method === 'GET') {
        return { data: { features: [{ id: 's1' }, { id: 's2' }] }, error: null };
      }
      return { data: {}, error: null }; // For POST
    });

    render(<SARTopoDataPage />); // Render once

    expect(await screen.findByText('MAP123')).toBeInTheDocument();

    const uploadBtn = await screen.findByRole('button', { name: /Upload to SARTopo/i });
    fireEvent.click(uploadBtn);

    await waitFor(() => {
      // Expect invoke to be called 3 times: 1 for GET, 2 for POST updates
      expect(supabase.functions.invoke).toHaveBeenCalledTimes(3);
      expect(supabase.functions.invoke).toHaveBeenCalledWith('sartopo-proxy', expect.objectContaining({ body: expect.objectContaining({ method: 'GET' }) }));
      expect(supabase.functions.invoke).toHaveBeenCalledWith('sartopo-proxy', expect.objectContaining({ body: expect.objectContaining({ method: 'POST', path: expect.stringContaining('Assignment/s1') }) }));
      expect(supabase.functions.invoke).toHaveBeenCalledWith('sartopo-proxy', expect.objectContaining({ body: expect.objectContaining({ method: 'POST', path: expect.stringContaining('Assignment/s2') }) }));
    });
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
      incidentData: { opPeriodId: 'op-123' },
      user: { email: 'admin@test.com' }
    });
    vi.mocked(supabase.from).mockImplementation((table) => {
      let data = (table === 'incidents') ? { sartopo_id: 'MAP123' } : [];
      const mock = globalThis.createSupabaseQueryMock(data);
      mock.insert = vi.fn((...args) => ({ ...mock, then: (cb) => mockTrackers.insert(...args).then(cb) }));
      return mock;
    });
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: mockData,
      error: null,
    });

    render(<SARTopoDataPage />); // Render once
    
    // Wait for the async initialization (fetchSartopoMapId) to complete.
    // This ensures the 'sartopoId' state is populated and the buttons are enabled.
    expect(await screen.findByText('MAP123')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Download from SARTopo/i }));

    await waitFor(() => {
      const logCall = mockTrackers.insert.mock.calls.find(c => c[0].action?.includes('Synced'));
      expect(logCall).toBeDefined();
      expect(logCall[0]).toEqual(expect.objectContaining({ user_name: 'Steve' }));
    });
  });
});

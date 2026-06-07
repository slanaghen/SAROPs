import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import SARTopoDataPage from './SARTopoDataPage';
import { useIncident } from '../context/IncidentContext';
import { supabase } from '../lib/supabase';
import { useToast } from '../context/ToastContext';

expect.extend(matchers);

vi.mock('../context/IncidentContext', () => ({
  useIncident: vi.fn(),
}));

vi.mock('../context/ToastContext', () => ({
  useToast: vi.fn(),
}));

vi.mock('../utils/indexedDBCache', () => ({
  getCachedMap: vi.fn().mockResolvedValue(null),
  setCachedMap: vi.fn().mockResolvedValue(undefined),
  mergeMapUpdates: vi.fn((baseFeatures = [], updateFeatures = []) => {
    const featureMap = new Map((baseFeatures || []).map(f => [f.id, f]));
    (updateFeatures || []).forEach(update => {
      if (update?.id) featureMap.set(update.id, update);
    });
    return Array.from(featureMap.values());
  }),
  clearMapCache: vi.fn().mockResolvedValue(undefined),
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
      refreshSession: vi.fn().mockResolvedValue({ data: { session: {} }, error: null })
    },
    channel: vi.fn().mockImplementation(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    })),
    removeChannel: vi.fn(),
  },
}));
const mockOpPeriodId = 'op-123';
describe('SARTopoDataPage', () => {
  const mockAddToast = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockAddToast.mockClear();
    localStorage.clear();
    vi.stubGlobal('alert', vi.fn());

    // Reset trackers
    Object.values(mockTrackers).forEach(m => m.mockClear());

    // Requirement: Correctly mock assignments fetch without breaking incident metadata initialization.
    vi.mocked(supabase.from).mockImplementation((table) => {
      let data = [];
      if (table === 'incidents') {
        data = { sartopo_id: 'MAP123', sartopo_sync_enabled: false, sartopo_last_fetch_at: 0, sartopo_last_upload_at: 0, sartopo_synced_titles: [] };
      }
      const mock = globalThis.createSupabaseQueryMock(data);
      // Wire up trackers
      mock.upsert = vi.fn((...args) => ({ ...mock, then: (cb) => mockTrackers.upsert(...args).then(cb) }));
      mock.insert = vi.fn((...args) => ({ ...mock, then: (cb) => mockTrackers.insert(...args).then(cb) }));
      mock.update = vi.fn((...args) => ({ ...mock, then: (cb) => mockTrackers.update(...args).then(cb) }));
      mock.delete = vi.fn((...args) => ({ ...mock, then: (cb) => mockTrackers.delete(...args).then(cb) }));
      return mock;
    });

    // Requirement: Secure signing mandates valid Base64 credentials.
    vi.stubEnv('VITE_SARTOPO_API_CREDENTIAL_ID', 'ID_123');
    vi.stubEnv('VITE_SARTOPO_API_CREDENTIAL_SECRET', 'x7+lOzSEs6+q6m37cUV2S7a19ucAKUxEve60nzRYq6k=');

    // Ensure a robust default fetch mock is available to prevent 'undefined' response errors
    const defaultFetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: (name) => name === 'content-type' ? 'application/json' : null },
      json: async () => ({ features: [] }),
      text: async () => 'OK'
    });
    vi.stubGlobal('fetch', defaultFetchMock);

    // Set a default useIncident mock for tests that don't override it
    vi.mocked(useIncident).mockReturnValue({
      isActive: true,
      incidentId: 'inc-123',
      incidentData: { opPeriodId: 'op-123', name: 'Mock Incident' },
      responderName: 'Steve',
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

  it('sartopoConfig correctly parses Map ID, removes legacy keys, and initiates signed requests', async () => {
    // This test verifies that even if legacy keys are pasted into the Map ID, 
    // the system strips them and performs a signed request instead.
    vi.mocked(supabase.from).mockImplementation((table) => {
      let data = [];
      if (table === 'incidents') {
        data = { sartopo_id: 'https://sartopo.com/m/ABCD?foo=bar&k=OLD_KEY&readCode=OLD_KEY' };
      }
      const mock = globalThis.createSupabaseQueryMock(data);
      mock.insert = vi.fn((...args) => ({ ...mock, then: (cb) => mockTrackers.insert(...args).then(cb) }));
      return mock;
    });

    render(<SARTopoDataPage />);
    fireEvent.click(await screen.findByText('Download from SARTopo'));

    await waitFor(() => {
      const fetchUrl = vi.mocked(global.fetch).mock.calls[0][0];
      // Requirement: No references to k= or other static URL parameters.
      expect(fetchUrl).not.toContain('k=OLD_KEY');
      expect(fetchUrl).not.toContain('readCode=');
      // Verify cryptographic signature is present
      expect(fetchUrl).toContain('signature=');
    });
  });

  it('renders map information when an incident is active', async () => {
    // Default useIncident mock from beforeEach is used
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
    // Default useIncident mock from beforeEach is used
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

    // Requirement: Since the error alert div was removed in favor of Toasts, 
    // we verify the notification system was called instead of looking for DOM text.
    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith(expect.stringMatching(/SARTopo returned an error page/i), 'error');
    });
  });

  it('renders features as JSON when fetch is successful', async () => {
    const mockData = { features: [{ id: 'f1', type: 'Feature', properties: { name: 'Clue 1', class: 'Assignment' } }] };
    // Default useIncident mock from beforeEach is used
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

    await waitFor(async () => {
      const heading = await screen.findByText((c, el) => el.tagName === 'H2' && c.includes('Map Download') && c.includes('(1)'));
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
      isActive: true, 
      incidentId: 'inc-123', 
      incidentData: { opPeriodId: mockOpPeriodId } 
    });
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

    await waitFor(async () => {
      const heading = await screen.findByText((c, el) => el.tagName === 'H2' && c.includes('Map Download') && c.includes('(1)'));
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
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: vi.fn().mockResolvedValue(mockData)
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

    render(<SARTopoDataPage />);
    
    expect(screen.queryByText(/Latest Download:/i)).not.toBeInTheDocument();
    
    // Trigger fetch manually as it no longer auto-syncs on load by default
    const fetchBtn = await screen.findByText('Download from SARTopo');
    fireEvent.click(fetchBtn);

    await waitFor(() => {
      expect(screen.getByText(/Latest Download:/i)).toBeInTheDocument();
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

    // Mock fetch for the reconciliation logic
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: (name) => name === 'content-type' ? 'application/json' : null },
      json: async () => ({ features: [{ id: 's1', geometry: null, properties: { class: 'Assignment', title: 'Task 1' } }] })
    });

    render(<SARTopoDataPage />);
    
    // Must populate internal features state first
    const downloadBtn = await screen.findByText('Download from SARTopo');
    fireEvent.click(downloadBtn);
    await waitFor(() => expect(screen.getByText(/Latest Download:/i)).toBeInTheDocument());

    const generateBtn = await screen.findByRole('button', { name: /Generate JSON/i });
    fireEvent.click(generateBtn);

    const uploadHeading = await screen.findByText((c, el) => el.tagName === 'H2' && c.includes('Map Upload') && c.includes('(1)'));
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

    // Mock fetch for the reconciliation logic (fetching base features)
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: (name) => name === 'content-type' ? 'application/json' : null },
      json: async () => ({ features: [{ id: 's1', geometry: { type: 'Point', coordinates: [0,0] }, properties: { class: 'Assignment', title: 'Task 1' } }] })
    });
    render(<SARTopoDataPage />);
    
    // 1. Requirement: Must download features first so generateUploadGeoJSON has a base state to merge with
    const downloadBtn = await screen.findByText('Download from SARTopo');
    fireEvent.click(downloadBtn);
    await waitFor(() => expect(screen.getByText(/Latest Download:/i)).toBeInTheDocument());

    // 2. Click Generate JSON
    const generateBtn = await screen.findByRole('button', { name: /Generate JSON/i });
    fireEvent.click(generateBtn);

    // 3. Wait for generation results to appear in the preview heading
    const heading = await screen.findByText((c, el) => el.tagName === 'H2' && c.includes('Map Upload') && c.includes('(1)'));
    expect(heading).toBeInTheDocument();

    const uploadSection = screen.getByRole('heading', { name: /Map Upload to SARTopo/i }).closest('.section-card');
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
    // Default useIncident mock from beforeEach is used
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
    await waitFor(async () => {
      const heading = await screen.findByText((c, el) => el.tagName === 'H2' && c.includes('Map Download') && c.includes('(2)'));
      expect(heading).toBeInTheDocument();
      expect(screen.getByText(/"Clue 1"/)).toBeInTheDocument();
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
    vi.stubEnv('VITE_SARTOPO_API_CREDENTIAL_ID', 'ID123');
    vi.stubEnv('VITE_SARTOPO_API_CREDENTIAL_SECRET', 'x7+lOzSEs6+q6m37cUV2S7a19ucAKUxEve60nzRYq6k=');

    // Default useIncident mock from beforeEach is used

    vi.mocked(supabase.from).mockImplementation((table) => {
      let data = [];
      if (table === 'assignments') data = mockAsns;
      else if (table === 'incidents') data = { sartopo_id: 'MAP123' };
      const mock = globalThis.createSupabaseQueryMock(data);
      mock.update = vi.fn((...args) => ({ ...mock, then: (cb) => mockTrackers.update(...args).then(cb) }));
      return mock;
    });

    // Mock fetch for the SARTopo POST requests (Step 3)
    global.fetch.mockImplementation(async (url) => {
      const isGet = !url.includes('Assignment/');
      return {
        ok: true,
        status: 200,
        json: async () => isGet ? { features: [{ id: 's1', properties: { class: 'Assignment' } }, { id: 's2', properties: { class: 'Assignment' } }] } : {},
        text: async () => 'OK'
      };
    });

    render(<SARTopoDataPage />);

    // Wait for the async initialization (fetchSartopoMapId) to complete.
    // This ensures the 'sartopoId' state is populated and the buttons are enabled.
    expect(await screen.findByText('MAP123')).toBeInTheDocument();

    const uploadBtn = await screen.findByRole('button', { name: /Upload to SARTopo/i });
    fireEvent.click(uploadBtn);

    // Requirement: Expect fetch to be called 3 times: 1 for Step 1 (GET State), and 2 for Step 3 (POST updates)
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(3);
      // Step 1: Ensure reconciliation uses the reliable /since/0 endpoint (Encoded params)
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining(`since/0`));
      
      // Step 3: Verify individual resource updates for each assignment
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(`Assignment/s1`),
        expect.objectContaining({
          method: 'POST',
          body: expect.any(URLSearchParams)
        })
      );
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(`Assignment/s2`),
        expect.objectContaining({
          method: 'POST',
          body: expect.any(URLSearchParams)
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
    vi.mocked(supabase.from).mockImplementation((table) => {
      let data = (table === 'incidents') ? { sartopo_id: 'MAP123' } : [];
      const mock = globalThis.createSupabaseQueryMock(data);
      mock.insert = vi.fn((...args) => ({ ...mock, then: (cb) => mockTrackers.insert(...args).then(cb) }));
      return mock;
    });
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: vi.fn().mockResolvedValue(mockData)
    });

    render(<SARTopoDataPage />);
    
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
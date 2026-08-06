import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BrowserRouter, useLocation } from 'react-router-dom';
import IncidentEditPage from './IncidentEditPage';
import { useIncident } from '../context/IncidentContext';
import { supabase } from '../lib/supabase';

const mockNavigate = vi.fn();
const mockUseLocation = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useBlocker: () => ({ state: 'unblocked' }),
    useLocation: () => mockUseLocation(),
  };
});

vi.mock('../context/IncidentContext', () => ({
  useIncident: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'u1', email: 'admin@test.com' } } } }),
      signInAnonymously: vi.fn(),
      refreshSession: vi.fn().mockResolvedValue({ error: null })
    },
    from: vi.fn(() => globalThis.createSupabaseQueryMock([])),
    rpc: vi.fn(),
    functions: { invoke: vi.fn() },
  },
}));

describe('IncidentEditPage Functional Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useIncident).mockReturnValue({
      isActive: false,
      incidentId: null,
      startIncident: vi.fn(),
      setResponderId: vi.fn(),
      setResponderName: vi.fn(),
      setResponderStatus: vi.fn(),
      setAccessLevel: vi.fn()
    });
    mockUseLocation.mockReturnValue({
      state: null, // Default to no state
    });
  });

  afterEach(cleanup);

  it('validates SARTopo Map ID length in real-time', async () => {
    render(<BrowserRouter><IncidentEditPage /></BrowserRouter>);
    
    // Wait for the asynchronous session initialization to complete and the form to render
    const mapInput = await screen.findByPlaceholderText(/e.g. 9ABC/i);
    fireEvent.change(mapInput, { target: { value: 'AB' } });

    expect(await screen.findByText(/Map ID is too short/i)).toBeInTheDocument();
    
    fireEvent.change(mapInput, { target: { value: 'ABCD' } });
    expect(screen.queryByText(/Map ID is too short/i)).not.toBeInTheDocument();
  });

  it('successfully creates a new SARTopo map using a signed request', async () => {
    // Requirement: Secure signing mandates valid Base64 credentials.
    vi.stubEnv('VITE_SARTOPO_API_CREDENTIAL_ID', 'ID_123');
    vi.stubEnv('VITE_SARTOPO_API_CREDENTIAL_SECRET', 'x7+lOzSEs6+q6m37cUV2S7a19ucAKUxEve60nzRYq6k=');
    vi.stubEnv('VITE_SARTOPO_ENABLED', 'true');

    vi.mocked(supabase.functions.invoke).mockResolvedValue({ data: { id: 'NEW_MAP_123' }, error: null });

    render(<BrowserRouter><IncidentEditPage /></BrowserRouter>);
    
    // Requirement: The "Create Map" button is disabled if a Map ID is already present.
    // Since the component defaults to a value ('CVJP9L4'), we must clear it to enable creation.
    const mapInput = await screen.findByPlaceholderText(/e.g. 9ABC/i);
    fireEvent.change(mapInput, { target: { value: '' } });

    const createBtn = await screen.findByRole('button', { name: /Create Map/i });
    expect(createBtn).not.toBeDisabled();
    fireEvent.click(createBtn);

    await waitFor(() => {
      expect(supabase.functions.invoke).toHaveBeenCalledWith('sartopo-proxy', expect.objectContaining({
        body: expect.objectContaining({
          method: 'POST',
          path: '/api/v1/acct/collaborative-map'
        })
      }));
      expect(screen.getByDisplayValue('NEW_MAP_123')).toBeInTheDocument();
    });
    vi.unstubAllEnvs();
  });

  it('triggers SARTopo background sync when a valid Map ID is entered during edit', async () => {
    vi.mocked(useIncident).mockReturnValue({
      isActive: true,
      incidentId: 'INC-1',
      incidentData: { opPeriodId: 'op-1' },
      startIncident: vi.fn()
    });

    vi.mocked(supabase.functions.invoke).mockResolvedValue({ data: { features: [] }, error: null });

    render(<BrowserRouter><IncidentEditPage /></BrowserRouter>);
    
    const mapInput = await screen.findByLabelText(/SARTopo Map ID/i);
    fireEvent.change(mapInput, { target: { value: 'SYNC123' } });

    await waitFor(() => {
      expect(supabase.functions.invoke).toHaveBeenCalledWith(
        'sartopo-proxy',
        expect.objectContaining({
          body: expect.objectContaining({
            path: '/api/v1/map/SYNC123/since/0'
          })
        })
      );
    }, { timeout: 2000 });
  });

  it('successfully creates a new incident, checks in the creator, and navigates to operations', async () => {
    // --- ARRANGE ---
    const mockStartIncident = vi.fn();
    const mockSetResponderId = vi.fn();
    const mockSetResponderName = vi.fn();
    const mockSetResponderStatus = vi.fn();
    const mockSetAccessLevel = vi.fn();

    vi.mocked(useIncident).mockReturnValue({
      isActive: false,
      incidentId: null,
      startIncident: mockStartIncident,
      setResponderId: mockSetResponderId,
      setResponderName: mockSetResponderName,
      setResponderStatus: mockSetResponderStatus,
      setAccessLevel: mockSetAccessLevel,
    });

    // Mock useLocation to provide the responderData from the login navigation (see NavSpec.md)
    const creatorData = { name: 'Admin User', agency: 'HQ', identifier: 'A1' };
    mockUseLocation.mockReturnValue({ state: { responderData: creatorData } });

    // Mock Supabase calls for the creation flow
    const mockIncidentInsert = vi.fn().mockResolvedValue({ error: null });
    const mockOpPeriodInsert = vi.fn().mockResolvedValue({ error: null });
    const mockActionLogInsert = vi.fn().mockResolvedValue({ data: [], error: null });
    const mockCheckinRpc = vi.fn().mockResolvedValue({ data: { responder_id: 'resp-abc', name: 'Admin User', status: 'Deployed' }, error: null });
    const mockUserSelect = vi.fn().mockResolvedValue({ data: { access_level: 'admin' }, error: null });

    vi.mocked(supabase.from).mockImplementation((table) => {
      switch (table) {
        case 'incidents': // The component calls .insert() and expects a promise.
          return { insert: mockIncidentInsert };
        case 'operational_periods': // The component calls .insert() and expects a promise.
          return { insert: mockOpPeriodInsert };
        case 'action_logs':
          return { insert: mockActionLogInsert };
        case 'users':
          return { select: () => ({ eq: () => ({ maybeSingle: mockUserSelect }) }) };
        default:
          return globalThis.createSupabaseQueryMock([]);
      }
    });
    // The rpc mock must return an object with a `maybeSingle` method.
    vi.mocked(supabase.rpc).mockImplementation((rpcName) => {
      if (rpcName === 'checkin_responder_securely') {
        return { maybeSingle: mockCheckinRpc };
      }
      return { maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) };
    });

    render(<BrowserRouter><IncidentEditPage /></BrowserRouter>);

    // --- ACT ---
    const incidentNumberInput = await screen.findByLabelText(/Incident Number/i);
    fireEvent.change(incidentNumberInput, { target: { value: '2026-001' } });
    fireEvent.change(screen.getByLabelText(/Incident Name/i), { target: { value: 'Test Incident' } });
    fireEvent.click(screen.getByRole('button', { name: /Start Incident Tracking/i }));

    // --- ASSERT ---
    // Verify database writes for incident creation
    await waitFor(() => {
      expect(mockIncidentInsert).toHaveBeenCalled();
      expect(mockOpPeriodInsert).toHaveBeenCalled();
    });

    // Verify global state was updated with new incident data.
    expect(mockStartIncident).toHaveBeenCalledWith(
      '2026-001',
      'Test Incident',
      '1',
      expect.any(String), // opPeriodId is a UUID
      '',
      60
    );

    // Verify auto check-in RPC was called and state was updated
    await waitFor(() => {
      expect(mockCheckinRpc).toHaveBeenCalled();
      expect(mockSetResponderId).toHaveBeenCalledWith('resp-abc');
      expect(mockSetAccessLevel).toHaveBeenCalledWith('admin');
    });

    // Verify final navigation
    expect(mockNavigate).toHaveBeenCalledWith('/operations');
  });
});
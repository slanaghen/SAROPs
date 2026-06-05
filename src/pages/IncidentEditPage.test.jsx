import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import IncidentEditPage from './IncidentEditPage';
import { useIncident } from '../context/IncidentContext';
import { supabase } from '../lib/supabase';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate, useBlocker: () => ({ state: 'unblocked' }) };
});

vi.mock('../context/IncidentContext', () => ({
  useIncident: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'u1' } } } }),
      signInAnonymously: vi.fn(),
      refreshSession: vi.fn().mockResolvedValue({ error: null })
    },
    from: vi.fn(() => globalThis.createSupabaseQueryMock([])),
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

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'NEW_MAP_123' })
    });

    render(<BrowserRouter><IncidentEditPage /></BrowserRouter>);
    
    // Requirement: The "Create Map" button is disabled if a Map ID is already present.
    // Since the component defaults to a value ('CVJP9L4'), we must clear it to enable creation.
    const mapInput = await screen.findByPlaceholderText(/e.g. 9ABC/i);
    fireEvent.change(mapInput, { target: { value: '' } });

    const createBtn = await screen.findByRole('button', { name: /Create Map/i });
    expect(createBtn).not.toBeDisabled();
    fireEvent.click(createBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/acct/ID_123/CollaborativeMap'),
        expect.objectContaining({ 
          method: 'POST',
          headers: expect.objectContaining({ 'Content-Type': 'application/x-www-form-urlencoded' }),
          body: expect.any(URLSearchParams)
        })
      );
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

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({ features: [] })
    });

    render(<BrowserRouter><IncidentEditPage /></BrowserRouter>);
    
    const mapInput = await screen.findByLabelText(/SARTopo Map ID/i);
    fireEvent.change(mapInput, { target: { value: 'SYNC123' } });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('SYNC123/since/0'));
    }, { timeout: 2000 });
  });
});
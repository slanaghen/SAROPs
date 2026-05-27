import { render, screen, fireEvent, cleanup, waitFor, act } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
import { vi, describe, it, expect, afterEach, beforeEach } from 'vitest';
import IncidentEditPage from './IncidentEditPage';
import { useIncident } from '../context/IncidentContext';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

import { createMemoryRouter, RouterProvider } from 'react-router-dom';

expect.extend(matchers);

vi.mock('../context/IncidentContext', () => ({
  useIncident: vi.fn(),
}));

// Flexible Supabase Mock for CRUD tracking
const mockFrom = vi.fn();
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: (table) => mockFrom(table),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'test-user' } } } }),
    },
  },
}));

const createMockChain = (resolvedValue = { error: null, data: null }) => ({
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  maybeSingle: vi.fn().mockReturnThis(),
  single: vi.fn().mockReturnThis(),
  in: vi.fn().mockReturnThis(),
  is: vi.fn().mockReturnThis(),
  then: vi.fn((onFulfilled) => Promise.resolve(resolvedValue).then(onFulfilled)),
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('IncidentEditPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue(createMockChain());
    mockNavigate.mockReset();
    vi.mocked(useIncident).mockReturnValue({
      isActive: false,
      incidentId: null,
      incidentData: { name: '', opNumber: '', opPeriodId: '' },
      startIncident: vi.fn(),
      endIncident: vi.fn(),
    });
  });

  it('renders the form with default values', async () => {
    const router = createMemoryRouter([
      {
        path: "/",
        element: <IncidentEditPage />,
      },
    ]);
    render(<RouterProvider router={router} />);
    expect(await screen.findByDisplayValue('Missing Person Search')).toBeInTheDocument();
  });

  it('updates form fields on change', async () => {
    const router = createMemoryRouter([
      {
        path: "/",
        element: <IncidentEditPage />,
      },
    ]);
    render(<RouterProvider router={router} />);
    const nameInput = await screen.findByLabelText(/Incident Name/i);
    
    fireEvent.change(nameInput, { target: { value: 'Wildfire Response' } });
    expect(nameInput.value).toBe('Wildfire Response');
  });

  it('displays the End Incident button only when an incident is active', async () => {
    // Mocking active state specifically for this test
    vi.mocked(useIncident).mockReturnValue({ 
      isActive: true, 
      incidentId: 'SAR-2026-001',
      incidentData: { name: 'Active Incident', opNumber: '1', opPeriodId: '1e7148f1-ad69-4c24-a25f-8a074a5033f8' },
      startIncident: vi.fn(),
      endIncident: vi.fn(),
    });
    
    const router = createMemoryRouter([
      {
        path: "/",
        element: <IncidentEditPage />,
      },
    ]);
    render(<RouterProvider router={router} />);
    expect(await screen.findByText(/End Incident/i)).toBeInTheDocument();
  });

  it('persists new incident and operational period to database on create', async () => {
    const chain = createMockChain();
    mockFrom.mockReturnValue(chain);

    let router;
    await act(async () => {
      router = createMemoryRouter([
        {
          path: "/",
          element: <IncidentEditPage />,
        },
        {
          path: "/operations",
          element: <div>Operations Dashboard</div>,
        },
      ]);
      render(<RouterProvider router={router} />);
    });
    fireEvent.submit(await screen.findByRole('button', { name: /Start Incident Tracking/i }));

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith('incidents');
      expect(mockFrom).toHaveBeenCalledWith('operational_periods');
      expect(chain.insert).toHaveBeenCalled();
    });
  });

  it('persists updates to database when an incident is active', async () => {
    const chain = createMockChain();
    mockFrom.mockReturnValue(chain);

    // Setup active state
    vi.mocked(useIncident).mockReturnValue({ 
      isActive: true, 
      incidentId: 'SAR-2026-001',
      incidentData: { name: 'Old Name', opNumber: '1', opPeriodId: '1e7148f1-ad69-4c24-a25f-8a074a5033f8' },
      startIncident: vi.fn(),
      endIncident: vi.fn(),
    });
    
    const router = createMemoryRouter([
      {
        path: "/",
        element: <IncidentEditPage />,
      },
      {
        path: "/operations",
        element: <div>Operations Dashboard</div>,
      },
    ]);
    render(<RouterProvider router={router} />);
    
    const nameInput = await screen.findByLabelText(/Incident Name/i);
    fireEvent.change(nameInput, { target: { value: 'Updated Mission Name' } });
    
    fireEvent.submit(await screen.findByRole('button', { name: /Update Incident Information/i }));

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith('incidents');
      expect(chain.update).toHaveBeenCalledWith(expect.objectContaining({
        name: 'Updated Mission Name'
      }));
    });
  });

  it('should prompt for cleanup and perform bulk updates when ending an incident with active resources', async () => {
    const chain = createMockChain();
    mockFrom.mockReturnValue(chain);
    window.confirm = vi.fn().mockReturnValue(true);

    vi.mocked(useIncident).mockReturnValue({ 
      isActive: true, 
      incidentId: 'inc-123',
      incidentData: { opPeriodId: 'op-123' },
      endIncident: vi.fn(),
      logout: vi.fn(), // Add logout mock as it's called by endIncident
    });

    // Mock active assignments and responders response
    const mockTableChains = {};
    mockFrom.mockImplementation((table) => {
      if (!mockTableChains[table]) {
        let data = null;
        if (table === 'assignments') data = [{ status: 'Deployed' }, { status: 'Assigned' }];
        if (table === 'responders') data = [{ id: 'r1' }];
        mockTableChains[table] = createMockChain({ data, error: null });
      }
      return mockTableChains[table];
    });

    const router = createMemoryRouter([
      { path: "/", element: <IncidentEditPage /> },
      { path: "/checkin", element: <div>Check-in Page</div> }
    ]);
    await act(async () => {
      render(<RouterProvider router={router} />);
    });

    fireEvent.click(await screen.findByText(/End Incident/i));

    await waitFor(() => {
      expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('2 active assignments and 1 responders'));
      expect(mockFrom).toHaveBeenCalledWith('teams'); // Disband teams step
      expect(mockTableChains.teams.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'Disbanded' }));
      expect(mockTableChains.assignments.update).toHaveBeenCalledTimes(2); // Two updates for assignments (Deployed -> Incomplete, Assigned -> Planned)
      expect(mockTableChains.responders.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'CheckedOut' }));
      expect(mockTableChains.operational_periods.update).toHaveBeenCalledWith(expect.objectContaining({ end_datetime: expect.any(String) }));
      expect(mockTableChains.incidents.update).toHaveBeenCalledWith(expect.objectContaining({ end_datetime: expect.any(String) }));
    });
  });

  it('aborts the end-incident procedure if confirmation is declined', async () => {
    window.confirm = vi.fn().mockReturnValue(false); // User clicks "Cancel"

    vi.mocked(useIncident).mockReturnValue({ 
      isActive: true, 
      incidentId: 'inc-123',
      incidentData: { opPeriodId: 'op-123' },
      endIncident: vi.fn(),
    });

    // Mock finding active assignments to trigger the prompt
    mockFrom.mockReturnValue({
      ...createMockChain(),
      maybeSingle: vi.fn().mockResolvedValue({ data: [{ status: 'Deployed' }], error: null }),
      then: vi.fn((cb) => Promise.resolve({ data: [{ status: 'Deployed' }], error: null }).then(cb))
    });

    const router = createMemoryRouter([{ path: "/", element: <IncidentEditPage /> }]);
    render(<RouterProvider router={router} />);

    fireEvent.click(await screen.findByText(/End Incident/i));

    await waitFor(() => {
      expect(window.confirm).toHaveBeenCalled();
      expect(mockFrom).not.toHaveBeenCalledWith('teams'); // Should not have reached cleanup phase
    });
  });

  it('blocks navigation when the form is dirty and offers to stay', async () => {
    vi.mocked(useIncident).mockReturnValue({
      isActive: true,
      incidentId: 'inc-123',
      incidentData: { opPeriodId: 'op-123' },
    });

    const router = createMemoryRouter([
      { path: "/", element: <IncidentEditPage /> },
      { path: "/checkin", element: <div>Check-in Page</div> },
      { path: "/admin", element: <div>Admin Page</div> }
    ]);
    
    render(<RouterProvider router={router} />);
    
    // Make the form dirty
    const nameInput = await screen.findByLabelText(/Incident Name/i);
    fireEvent.change(nameInput, { target: { value: 'Dirty Change' } });
    
    // Try to navigate away
    act(() => { router.navigate('/admin'); });

    // Verify blocker modal is visible
    expect(await screen.findByText(/Unsaved Changes/i)).toBeInTheDocument();
    
    // Test "Stay" button
    fireEvent.click(await screen.findByText('Stay'));
    expect(screen.queryByText(/Unsaved Changes/i)).not.toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
  });

  it('allows navigation when blocker is shown and user chooses to commit changes', async () => {
    vi.mocked(useIncident).mockReturnValue({
      isActive: false,
      incidentId: null,
      incidentData: { name: '', opNumber: '', opPeriodId: '' },
      startIncident: vi.fn(),
    });

    const router = createMemoryRouter([
      { path: "/", element: <IncidentEditPage /> },
      { path: "/admin", element: <div>Admin Page</div> }
    ]);
    
    render(<RouterProvider router={router} />);
    
    // Make a change to dirty the form
    fireEvent.change(await screen.findByLabelText(/Incident Name/i), { target: { value: 'Modified Name' } });
    
    // Try to navigate away - this should trigger the blocker
    act(() => { router.navigate('/admin'); });

    // The blocker modal should appear
    await waitFor(() => {
      expect(screen.getByText('Unsaved Changes')).toBeInTheDocument();
      expect(screen.getByText('Commit Changes')).toBeInTheDocument();
      expect(screen.getByText('Stay')).toBeInTheDocument();
    });
  });

  it('auto check-in the creator when creating a new incident with responder data', async () => {
    const chain = createMockChain();
    mockFrom.mockReturnValue(chain);
    
    const mockStartIncident = vi.fn();
    vi.mocked(useIncident).mockReturnValue({
      isActive: false,
      incidentId: null,
      incidentData: { name: '', opNumber: '', opPeriodId: '' },
      startIncident: mockStartIncident,
      endIncident: vi.fn(),
      setResponderId: vi.fn(),
      setResponderName: vi.fn(),
      setAccessLevel: vi.fn(),
      setResponderStatus: vi.fn(),
    });

    const responderData = { name: 'Creator Steve', agency: 'SAR', identifier: 'IC-1', cell_phone: '555' };
    const router = createMemoryRouter([
      {
        path: "/",
        element: <IncidentEditPage />,
      },
      {
        path: "/operations",
        element: <div>Operations Dashboard</div>,
      },
    ], {
      initialEntries: [{ pathname: '/', state: { responderData } }]
    });

    await act(async () => {
      render(<RouterProvider router={router} />);
    });

    const submitBtn = await screen.findByRole('button', { name: /Start Incident Tracking/i });
    await act(async () => {
      fireEvent.submit(submitBtn);
    });
    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith('responders');
      expect(chain.insert).toHaveBeenCalledWith(expect.objectContaining({ name: 'Creator Steve' }));
      expect(mockStartIncident).toHaveBeenCalled();
    });
  });

  it('triggers SARTopo auto-sync when sartopo_id is entered/updated in an active incident', async () => {
    const mockSyncSartopoData = vi.fn();
    // Mock the module where syncSartopoData is defined
    vi.mock('../utils/gisUtils', () => ({
      mapSartopoToAssignment: vi.fn(),
    }));
    // Mock fetch to return a controlled promise to verify the "Syncing..." state
    let resolveFetch;
    const fetchPromise = new Promise((resolve) => {
      resolveFetch = resolve;
    });
    global.fetch = vi.fn().mockReturnValue(fetchPromise);

    vi.mocked(useIncident).mockReturnValue({
      isActive: true,
      incidentId: 'inc-123',
      incidentData: { name: 'Active Incident', opNumber: '1', opPeriodId: 'op-123', sartopo_id: '' },
      startIncident: vi.fn(),
      endIncident: vi.fn(),
      setResponderId: vi.fn(),
      setResponderName: vi.fn(),
      setAccessLevel: vi.fn(),
      setResponderStatus: vi.fn(),
    });

    const router = createMemoryRouter([{ path: "/", element: <IncidentEditPage /> }]);
    render(<RouterProvider router={router} />);
    
    // 1. Wait for initial auth loading to finish using real timers
    const sartopoInput = await screen.findByLabelText(/SARTopo Map ID/i); 

    // 2. Enable fake timers only for the debounce/sync interaction
    vi.useFakeTimers();
    fireEvent.change(sartopoInput, { target: { value: 'NEW_MAP_ID' } });

    // 3. Advance timers past the debounce period (1200ms)
    act(() => {
      vi.advanceTimersByTime(1200);
    });

    // 4. Switch to real timers and wait for "Syncing..." to appear
    vi.useRealTimers();
    expect(await screen.findByText(/Syncing/i)).toBeInTheDocument();

    // 5. Resolve the fetch promise to allow the sync process to finish
    await act(async () => {
      resolveFetch({
        ok: true,
        headers: { get: (name) => name === 'content-type' ? 'application/json' : null },
        json: async () => ({ features: [] }),
      });
    });

    // Verify fetch was called for SARTopo data
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/sartopo-api/api/v1/map/NEW_MAP_ID/since/0')
      );
    });

    // Expect "Syncing..." indicator to disappear
    expect(screen.queryByText(/Syncing/i)).not.toBeInTheDocument();
  });

  it('updates the global IncidentContext with sartopo_id and parInterval on save', async () => {
    const mockStartIncident = vi.fn();
    vi.mocked(useIncident).mockReturnValue({
      isActive: false,
      incidentId: null,
      incidentData: { name: '', opNumber: '', opPeriodId: '' },
      startIncident: mockStartIncident,
      endIncident: vi.fn(),
      setResponderId: vi.fn(), setResponderName: vi.fn(), setAccessLevel: vi.fn(), setResponderStatus: vi.fn(),
    });

    const router = createMemoryRouter([{ path: "/", element: <IncidentEditPage /> }]);
    render(<RouterProvider router={router} />);

    fireEvent.change(await screen.findByLabelText(/SARTopo Map ID/i), { target: { value: 'MAPID_CTX' } });
    fireEvent.change(await screen.findByLabelText(/PAR\/Status Check Interval \(minutes\)/i), { target: { value: '15' } });
    fireEvent.submit(await screen.findByRole('button', { name: /Start Incident Tracking/i }));

    await waitFor(() => {
      expect(mockStartIncident).toHaveBeenCalledWith(
        expect.any(String), // incidentId
        expect.any(String), // incidentName
        expect.any(String), // opNumber
        expect.any(String), // opPeriodId
        'MAPID_CTX', // sartopoId
        15 // parInterval
      );
    });
  });
});
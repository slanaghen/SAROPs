import { render, screen, fireEvent, cleanup, waitFor, act } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
import { vi, describe, it, expect, afterEach, beforeEach } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import IncidentEditPage from './IncidentEditPage';
import { useIncident } from '../context/IncidentContext';

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
  insert: vi.fn().mockResolvedValue(resolvedValue),
  update: vi.fn().mockResolvedValue(resolvedValue),
  eq: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  maybeSingle: vi.fn().mockResolvedValue(resolvedValue),
  single: vi.fn().mockResolvedValue(resolvedValue),
  in: vi.fn().mockResolvedValue(resolvedValue),
  is: vi.fn().mockResolvedValue(resolvedValue),
});

afterEach(cleanup);

describe('IncidentEditPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
        mockTableChains[table] = createMockChain();
      }
      // Configure specific behavior for each table's chain
      if (table === 'assignments') {
        mockTableChains[table].in.mockResolvedValue({ data: [{ status: 'Deployed' }] }); // Mock active assignments
      } else if (table === 'responders') {
        mockTableChains[table].is.mockResolvedValue({ data: [{ id: 'r1' }] }); // Mock active responders
      }
      return mockTableChains[table];
    });

    const router = createMemoryRouter([{ path: "/", element: <IncidentEditPage /> }]);
    await act(async () => {
      render(<RouterProvider router={router} />);
    });

    fireEvent.click(await screen.findByText(/End Incident/i));

    await waitFor(() => {
      expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('1 active assignments and 1 responders'));
      expect(mockFrom).toHaveBeenCalledWith('teams'); // Disband teams step
      expect(mockTableChains.teams.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'Disbanded' }));
      expect(mockTableChains.assignments.update).toHaveBeenCalledTimes(2); // Two updates for assignments (Deployed -> Incomplete, Assigned -> Planned)
      expect(mockTableChains.responders.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'Staged' }));
      expect(mockTableChains.operational_periods.update).toHaveBeenCalledWith(expect.objectContaining({ end_datetime: expect.any(String) }));
      expect(mockTableChains.incidents.update).toHaveBeenCalledWith(expect.objectContaining({ end_datetime: expect.any(String) }));
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
});
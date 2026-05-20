import { render, screen, fireEvent, cleanup, waitFor, act } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
import { vi, describe, it, expect, afterEach, beforeEach } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import IncidentEditPage from '../pages/IncidentEditPage';
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
  },
}));

const createMockChain = (resolvedValue = { error: null }) => ({
  insert: vi.fn().mockResolvedValue(resolvedValue),
  update: vi.fn().mockReturnThis(),
  eq: vi.fn().mockResolvedValue(resolvedValue),
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

  it('renders the form with default values', () => {
    const router = createMemoryRouter([
      {
        path: "/",
        element: <IncidentEditPage />,
      },
    ]);
    render(<RouterProvider router={router} />);
    expect(screen.getByDisplayValue('Missing Person Search')).toBeInTheDocument();
  });

  it('updates form fields on change', () => {
    const router = createMemoryRouter([
      {
        path: "/",
        element: <IncidentEditPage />,
      },
    ]);
    render(<RouterProvider router={router} />);
    const nameInput = screen.getByLabelText(/Incident Name/i);
    
    fireEvent.change(nameInput, { target: { value: 'Wildfire Response' } });
    expect(nameInput.value).toBe('Wildfire Response');
  });

  it('displays the End Incident button only when an incident is active', () => {
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
    expect(screen.getByText(/End Incident/i)).toBeInTheDocument();
  });

  it('persists new incident and operational period to database on create', async () => {
    const chain = createMockChain();
    mockFrom.mockReturnValue(chain);

    const router = createMemoryRouter([
      {
        path: "/",
        element: <IncidentEditPage />,
      },
    ]);
    render(<RouterProvider router={router} />);
    fireEvent.submit(screen.getByRole('button', { name: /Start Incident Tracking/i }));

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
    
    const nameInput = screen.getByLabelText(/Incident Name/i);
    fireEvent.change(nameInput, { target: { value: 'Updated Mission Name' } });
    
    fireEvent.submit(screen.getByRole('button', { name: /Update Incident Information/i }));

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
    });

    // Mock active assignments and responders response
    mockFrom.mockImplementation((table) => {
      if (table === 'assignments') return { ...chain, select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), in: vi.fn().mockResolvedValue({ data: [{ status: 'Deployed' }] }) };
      if (table === 'responders') return { ...chain, select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), is: vi.fn().mockResolvedValue({ data: [{ id: 'r1' }] }) };
      return chain;
    });

    const router = createMemoryRouter([{ path: "/", element: <IncidentEditPage /> }]);
    render(<RouterProvider router={router} />);

    fireEvent.click(screen.getByText(/End Incident/i));

    await waitFor(() => {
      expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('1 active assignments and 1 responders'));
      expect(mockFrom).toHaveBeenCalledWith('teams'); // Disband teams step
      expect(chain.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'Disbanded' }));
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
    const nameInput = screen.getByLabelText(/Incident Name/i);
    fireEvent.change(nameInput, { target: { value: 'Dirty Change' } });
    
    // Try to navigate away
    act(() => { router.navigate('/admin'); });

    // Verify blocker modal is visible
    expect(screen.getByText(/Unsaved Changes/i)).toBeInTheDocument();
    
    // Test "Stay" button
    fireEvent.click(screen.getByText('Stay'));
    expect(screen.queryByText(/Unsaved Changes/i)).not.toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
  });
});
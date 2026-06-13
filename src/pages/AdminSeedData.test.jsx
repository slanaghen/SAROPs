import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import AdminPage from './AdminPage';
import { useIncident } from '../context/IncidentContext';
import { useAdminData } from '../hooks/useAdminData';
import { useToast } from '../context/ToastContext';
import { supabase } from '../lib/supabase';

// Mock context and hooks
vi.mock('../context/IncidentContext', () => ({ useIncident: vi.fn() }));
vi.mock('../hooks/useAdminData', () => ({ useAdminData: vi.fn() }));
vi.mock('../context/ToastContext', () => ({ useToast: vi.fn() }));

// Define a stable mock function outside the factory to ensure it's a valid spy
const { mockRpc } = vi.hoisted(() => ({
  mockRpc: vi.fn(() => globalThis.createSupabaseQueryMock(null))
}));

// Mock Supabase client
vi.mock('../lib/supabase', () => ({
  supabase: {
    rpc: mockRpc,
    from: vi.fn(() => globalThis.createSupabaseQueryMock([])),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      refreshSession: vi.fn().mockResolvedValue({ data: { session: {} }, error: null }),
    },
  },
}));

describe('AdminPage Seed Data Action', () => {
  const mockAddToast = vi.fn();
  
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useToast).mockReturnValue({ addToast: mockAddToast });
    vi.mocked(useIncident).mockReturnValue({
      isAdmin: true,
      incidentId: 'inc-123',
      responderName: 'Steve',
      operationsRefreshInterval: 30000,
      responderRefreshInterval: 30000,
      sartopoRefreshInterval: 30000,
    });
    vi.mocked(useAdminData).mockReturnValue({
      users: [], incidents: [], responders: [], vehicles: [], teams: [], assignments: [],
      loading: false, refresh: vi.fn(), refreshAll: vi.fn()
    });
  });

  it('displays a specific error message if the RPC function is missing from schema cache', async () => {
    window.confirm = vi.fn().mockReturnValue(true);
    
    // Simulate PostgREST 404/Schema Cache error common after DB resets
    supabase.rpc.mockResolvedValueOnce({ 
      error: { message: 'Could not find the function public.seed_data_specific in the schema cache' } 
    });

    render(<BrowserRouter><AdminPage /></BrowserRouter>);
    
    const seedBtn = await screen.findByRole('button', { name: /Seed Data/i });
    fireEvent.click(seedBtn);

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith(
        expect.stringContaining('The database function "seed_data_specific" is not defined'),
        'error'
      );
    });
  });

  it('stops execution if the user cancels the confirmation dialog', async () => {
    window.confirm = vi.fn().mockReturnValue(false);
    
    render(<BrowserRouter><AdminPage /></BrowserRouter>);
    
    const seedBtn = await screen.findByRole('button', { name: /Seed Data/i });
    fireEvent.click(seedBtn);

    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(mockAddToast).not.toHaveBeenCalled();
  });

  it('shows a success toast and refreshes data on successful seeding', async () => {
    window.confirm = vi.fn().mockReturnValue(true);
    supabase.rpc.mockResolvedValueOnce({ error: null });
    const mockRefreshAll = vi.fn();
    vi.mocked(useAdminData).mockReturnValue({
      users: [], incidents: [], responders: [], vehicles: [], teams: [], assignments: [],
      loading: false, refresh: vi.fn(), refreshAll: mockRefreshAll
    });

    render(<BrowserRouter><AdminPage /></BrowserRouter>);
    
    const seedBtn = await screen.findByRole('button', { name: /Seed Data/i });
    fireEvent.click(seedBtn);

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith(expect.stringContaining('successfully seeded'), 'success');
      expect(mockRefreshAll).toHaveBeenCalled();
    });
  });
});
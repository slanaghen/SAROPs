import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import LoginPage from './LoginPage';
import { useIncident } from '../context/IncidentContext';
import { supabase } from '../lib/supabase';

// Mock dependencies
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../context/IncidentContext', () => ({
  useIncident: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn().mockReturnThis(),
    auth: {
      refreshSession: vi.fn().mockResolvedValue({ error: null }),
    },
  },
}));

// Mock the LoginForm child component to isolate LoginPage logic
vi.mock('../components/admin/Login', () => ({
  default: ({ onLoginSuccess }) => (
    <div data-testid="login-form-mock">
      <button onClick={() => onLoginSuccess(
        'inc-new-empty', // selectedId
        { email: 'first@responder.com', name: 'First Responder', access_level: 'responder' }, // userRecord
        { responder_id: 'resp-first', name: 'First Responder', access_level: 'staff' } // responderRecord (simulating trigger update)
      )}>
        Login as First Responder
      </button>
    </div>
  ),
}));

describe('LoginPage Functional Tests', () => {
  const mockSetIsAdmin = vi.fn();
  const mockSetResponderId = vi.fn();
  const mockSetResponderName = vi.fn();
  const mockSetResponderStatus = vi.fn();
  const mockSetAccessLevel = vi.fn();
  const mockStartIncident = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useIncident).mockReturnValue({
      setIsAdmin: mockSetIsAdmin,
      setResponderId: mockSetResponderId,
      setResponderName: mockSetResponderName,
      setResponderStatus: mockSetResponderStatus,
      setAccessLevel: mockSetAccessLevel,
      startIncident: mockStartIncident,
    });
  });

  it('handles "First Responder as IC" flow correctly', async () => {
    // --- ARRANGE ---
    // This test simulates the flow described in SAROPs-Special-Cases.md
    
    // Mock the database call to fetch incident details.
    const mockIncident = {
      incident_id: 'inc-new-empty',
      name: 'New Empty Incident',
      sartopo_id: 'MAP123',
      operational_periods: [{ op_number: 1, op_period_id: 'op-1', par_check_interval: 60 }],
    };
    vi.mocked(supabase.from).mockImplementation((table) => {
      const mock = globalThis.createSupabaseQueryMock([]);
      if (table === 'incidents') {
        mock.maybeSingle = vi.fn().mockResolvedValue({ data: mockIncident, error: null });
      }
      return mock;
    });

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    // --- ACT ---
    // Simulate the user logging in and selecting the new, empty incident.
    fireEvent.click(screen.getByText('Login as First Responder'));

    // --- ASSERT ---
    await waitFor(() => {
      expect(mockStartIncident).toHaveBeenCalledWith('inc-new-empty', 'New Empty Incident', 1, 'op-1', 'MAP123', 60);
      expect(mockSetResponderId).toHaveBeenCalledWith('resp-first');
      expect(mockSetAccessLevel).toHaveBeenCalledWith('staff');
      expect(mockNavigate).toHaveBeenCalledWith('/operations');
    });
  });
});
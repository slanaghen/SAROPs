import { render, screen, waitFor, cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import ResponderCheckinPage from './ResponderCheckinPage';
import { useIncident } from '../context/IncidentContext';

expect.extend(matchers);

// Mock navigation
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      // Supabase queries are thenable
      then: (cb: any, rej?: any) => Promise.resolve({ data: [], error: null }).then(cb, rej)
    }))
  }
}));

vi.mock('../hooks/useResponderCheckin', () => ({
  useResponderCheckin: () => ({
    checkedInResponder: null,
    isCheckedIn: false,
    loading: false,
    error: null,
    checkIn: vi.fn()
  })
}));

vi.mock('../context/IncidentContext', () => ({
  useIncident: vi.fn(),
}));

describe('ResponderCheckinPage Routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('should redirect active command staff to operations', async () => {
    vi.mocked(useIncident).mockReturnValue({
      isActive: true,
      responderName: 'Steve',
      responderStatus: 'Staged',
      incidentData: { name: 'Command Center' },
      startIncident: vi.fn(),
      setResponderName: vi.fn(),
      setResponderStatus: vi.fn(),
      setResponderId: vi.fn(),
    } as any);

    render(
      <BrowserRouter>
        <ResponderCheckinPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/operations');
    });
  });
});
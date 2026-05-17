import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import CheckOutPage from './CheckOutPage';
import { useIncident } from '../context/IncidentContext';
import { supabase } from '../lib/supabase';

expect.extend(matchers);

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
    from: vi.fn(),
  },
}));

describe('CheckOutPage', () => {
  const mockLogout = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    window.alert = vi.fn();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders "No Active Session" message when user is not checked in', () => {
    vi.mocked(useIncident).mockReturnValue({
      isActive: false,
      responderId: null,
      logout: mockLogout,
    } as any);

    render(
      <BrowserRouter>
        <CheckOutPage />
      </BrowserRouter>
    );

    expect(screen.getByText(/No Active Session/i)).toBeInTheDocument();
  });

  it('calls delete and logout when confirmation is clicked', async () => {
    vi.mocked(useIncident).mockReturnValue({
      isActive: true,
      responderId: 'res-123',
      responderName: 'Steve',
      logout: mockLogout,
    } as any);

    const mockDeleteChain = {
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null })
    };
    (supabase.from as any).mockReturnValue(mockDeleteChain);

    render(
      <BrowserRouter>
        <CheckOutPage />
      </BrowserRouter>
    );

    fireEvent.click(screen.getByText(/Confirm Check-Out/i));

    await waitFor(() => {
      expect(supabase.from).toHaveBeenCalledWith('responders');
      expect(mockLogout).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith('/checkin');
    });
  });
});
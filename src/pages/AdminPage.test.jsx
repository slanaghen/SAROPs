import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
import { vi, describe, it, expect, afterEach, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import AdminPage from './AdminPage';
import { useIncident } from '../context/IncidentContext';
import { supabase } from '../lib/supabase'; // Import the actual supabase object to mock it

expect.extend(matchers);

vi.mock('../context/IncidentContext', () => ({
  useIncident: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  supabase: { // Define the mock structure here
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      then: (onFulfilled) => Promise.resolve({ data: [], error: null }).then(onFulfilled),
    })),
    rpc: vi.fn(() => Promise.resolve({ data: null, error: null })),
  },
}));

afterEach(() => {
  cleanup();
});

describe('AdminPage Authentication Gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set default mock for useIncident for tests that don't override it
    vi.mocked(useIncident).mockReturnValue({
      isAdmin: false,
      setIsAdmin: vi.fn(),
      logout: vi.fn(),
    });
  });

  it('renders the login form if the user is not an admin', () => {
    render(
      <BrowserRouter>
        <AdminPage />
      </BrowserRouter>
    );

    expect(screen.getByText(/System Administration/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/admin@agency.gov/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Login/i })).toBeInTheDocument();
  });

  it('renders management tables when the user is an admin', async () => {
    vi.mocked(useIncident).mockReturnValue({
      isAdmin: true,
      setIsAdmin: vi.fn(),
      logout: vi.fn(),
    });

    // Mock data for incidents and responders
    const mockIncident = { incident_id: 'i1', name: 'Lost Hiker', number: '101', start_datetime: new Date().toISOString() };
    const mockAdmin = { email: 'admin@example.com', username: 'AdminUser' };
    
    supabase.from.mockImplementation((table) => {
      let data = [];
      if (table === 'incidents') data = [mockIncident];
      if (table === 'admin_users') data = [mockAdmin]; // Mock admin users fetch
      return {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data, error: null })
      };
    });

    render(<BrowserRouter><AdminPage /></BrowserRouter>);

    expect(await screen.findByText('Lost Hiker')).toBeInTheDocument();
    expect(await screen.findByText('AdminUser')).toBeInTheDocument(); // Check for admin user
    expect(screen.getByText('Responder Management')).toBeInTheDocument();
  });

  it('prompts for confirmation before deleting an incident', async () => {
    vi.mocked(useIncident).mockReturnValue({ isAdmin: true });
    window.confirm = vi.fn().mockReturnValue(true);
    
    // Mock an ended incident so the Delete button is rendered
    const mockIncident = { 
      incident_id: 'i1', 
      name: 'Ended Incident', 
      number: '102', 
      start_datetime: new Date().toISOString(),
      end_datetime: new Date().toISOString()
    };

    // Mock the supabase.from chain for fetching incidents and the delete operation
    supabase.from.mockImplementation((table) => {
      const query = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }), // Mock the delete operation
        then: (onFulfilled) => Promise.resolve({ data: table === 'incidents' ? [mockIncident] : [], error: null }).then(onFulfilled)
      };
      return query;
    });

    render(<BrowserRouter><AdminPage /></BrowserRouter>);

    await screen.findByText('Ended Incident');
    const deleteBtn = screen.getByRole('button', { name: /Delete/i });
    fireEvent.click(deleteBtn);

    expect(window.confirm).toHaveBeenCalled();
    expect(supabase.from).toHaveBeenCalledWith('incidents');
  });
});
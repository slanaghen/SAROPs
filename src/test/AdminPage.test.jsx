import { render, screen, cleanup, fireEvent, waitFor, act } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
import { vi, describe, it, expect, afterEach, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import AdminPage from '../pages/AdminPage';
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
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockReturnThis(),
      then: (onFulfilled) => Promise.resolve({ data: [], error: null }).then(onFulfilled),
    })),
    rpc: vi.fn(() => Promise.resolve({ data: null, error: null })),
    auth: {
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
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
      responderId: null, // Default for responder management tests
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
        order: vi.fn().mockReturnThis(),
        then: (onFulfilled) => Promise.resolve({ data, error: null }).then(onFulfilled)
      };
    });

    render(<BrowserRouter><AdminPage /></BrowserRouter>);

    // Expand sections to see the data
    fireEvent.click(screen.getByText(/Incident Management/i));
    fireEvent.click(screen.getByText(/Current Administrators/i));

    expect(await screen.findByText('Lost Hiker')).toBeInTheDocument();
    expect(await screen.findByText('AdminUser')).toBeInTheDocument(); // Check for admin user
    expect(screen.getByText(/Responder Management/i)).toBeInTheDocument();
  });

  it('should toggle visibility of management sections and show correct counts', async () => {
    vi.mocked(useIncident).mockReturnValue({ isAdmin: true });
    supabase.from.mockImplementation(() => {
      const query = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        then: (onFulfilled, onRejected) =>
          Promise.resolve({ data: [{ responder_id: 'r1', name: 'Res 1', status: 'Staged' }], error: null })
            .then(onFulfilled, onRejected),
      };
      return query;
    });

    render(<BrowserRouter><AdminPage /></BrowserRouter>);

    const header = await screen.findByText(/Responder Management \(1\)/i);
    expect(screen.queryByText('Res 1')).not.toBeInTheDocument(); // Collapsed by default

    fireEvent.click(header);
    expect(await screen.findByText('Res 1')).toBeInTheDocument(); // Expanded

    fireEvent.click(header);
    expect(screen.queryByText('Res 1')).not.toBeInTheDocument(); // Collapsed again
  });

  it('should disband a team and release responders', async () => {
    vi.mocked(useIncident).mockReturnValue({ isAdmin: true });
    window.confirm = vi.fn().mockReturnValue(true);
    const mockTeam = { team_id: 't1', team_name_number: 'Team Alpha', status: 'Staged' };
    const mockMember = { responder_id: 'r1' };
    
    supabase.from.mockImplementation((table) => {
      const query = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        then: (onFulfilled, onRejected) => {
          let data = [];
          if (table === 'teams') data = [mockTeam];
          if (table === 'team_responders') data = [mockMember];
          return Promise.resolve({ data, error: null }).then(onFulfilled, onRejected);
        },
      };
      return query;
    });

    render(<BrowserRouter><AdminPage /></BrowserRouter>);
    fireEvent.click(screen.getByText(/Team Management/i));

    const disbandBtn = await screen.findByRole('button', { name: /Disband/i });
    fireEvent.click(disbandBtn);

    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('Disband team "Team Alpha"'));
    expect(supabase.from).toHaveBeenCalledWith('responders'); // Verify cascade to responders
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

    const mockDelete = vi.fn().mockReturnThis();
    // Mock the supabase.from chain for fetching incidents and the delete operation
    supabase.from.mockImplementation((table) => {
      const query = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        delete: mockDelete,
        eq: vi.fn().mockResolvedValue({ error: null }), // Mock the delete operation
        then: (onFulfilled) => Promise.resolve({ data: table === 'incidents' ? [mockIncident] : [], error: null }).then(onFulfilled)
      };
      return query;
    });

    render(<BrowserRouter><AdminPage /></BrowserRouter>);

    // Expand section to access the delete button
    fireEvent.click(screen.getByText(/Incident Management/i));

    await screen.findByText('Ended Incident');
    const deleteBtn = screen.getByRole('button', { name: /Delete/i });
    fireEvent.click(deleteBtn);

    expect(window.confirm).toHaveBeenCalled();
    expect(supabase.from).toHaveBeenCalledWith('incidents');
    expect(mockDelete).toHaveBeenCalled();
  });

  it('should add a new administrator', async () => {
    vi.mocked(useIncident).mockReturnValue({ isAdmin: true, setIsAdmin: vi.fn(), logout: vi.fn() });
    
    const mockInsert = vi.fn().mockResolvedValue({ error: null });
    supabase.from.mockImplementation((table) => {
      if (table === 'admin_users') return {
        insert: mockInsert,
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        then: (onFulfilled) => Promise.resolve({ data: [], error: null }).then(onFulfilled)
      };
      return {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
        then: (onFulfilled) => Promise.resolve({ data: [], error: null }).then(onFulfilled),
      };
    });

    render(<BrowserRouter><AdminPage /></BrowserRouter>);

    // Expand section to see the add form results in the list later
    fireEvent.click(screen.getByText(/Current Administrators/i));

    fireEvent.change(screen.getByPlaceholderText('CommandCenter1'), { target: { value: 'NewAdmin' } });
    fireEvent.change(screen.getByPlaceholderText('admin@agency.gov'), { target: { value: 'new@admin.com' } });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'password123' } });
    const addButton = await screen.findByRole('button', { name: /Add Admin/i });
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(mockInsert).toHaveBeenCalledWith([{
        email: 'new@admin.com',
        username: 'NewAdmin',
        password: 'password123',
      }]);
    });
  });

  it('should change an administrator\'s password', async () => {
    vi.mocked(useIncident).mockReturnValue({ isAdmin: true, setIsAdmin: vi.fn(), logout: vi.fn() });
    window.prompt = vi.fn().mockReturnValue('newpassword');

    const mockUpdate = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockResolvedValue({ error: null });
    supabase.from.mockImplementation((table) => {
      if (table === 'admin_users') return {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        update: mockUpdate,
        eq: mockEq,
        then: (onFulfilled) => Promise.resolve({ data: [{ email: 'existing@admin.com', username: 'ExistingAdmin' }], error: null }).then(onFulfilled),
      };
      return {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
        then: (onFulfilled) => Promise.resolve({ data: [], error: null }).then(onFulfilled),
      };
    });

    render(<BrowserRouter><AdminPage /></BrowserRouter>);

    // Expand section to access the admin list and buttons
    fireEvent.click(screen.getByText(/Current Administrators/i));

    await screen.findByText('ExistingAdmin');
    fireEvent.click(screen.getByRole('button', { name: /Change Password/i }));

    await waitFor(() => {
      expect(window.prompt).toHaveBeenCalledWith('Enter new password for existing@admin.com:');
      expect(mockUpdate).toHaveBeenCalledWith({ password: 'newpassword' });
      expect(mockEq).toHaveBeenCalledWith('email', 'existing@admin.com');
    });
  });

  it('should check out a responder', async () => {
    vi.mocked(useIncident).mockReturnValue({ isAdmin: true, logout: vi.fn(), responderId: 'res-123' });
    window.confirm = vi.fn().mockReturnValue(true);

    const mockResponder = { responder_id: 'res-123', name: 'Test Responder', status: 'Staged', checkin_datetime: new Date().toISOString(), checkout_datetime: null };
    
    const mockUpdate = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockResolvedValue({ error: null });

    supabase.from.mockImplementation((table) => {
      const query = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        update: mockUpdate,
        eq: mockEq,
        delete: vi.fn().mockReturnThis(),
        then: (onFulfilled) => {
          const data = table === 'responders' ? [mockResponder] : [];
          return Promise.resolve({ data, error: null }).then(onFulfilled);
        }
      };
      return query;
    });

    render(<BrowserRouter><AdminPage /></BrowserRouter>);

    // Expand section to see the responder list
    fireEvent.click(screen.getByText(/Responder Management/i));

    await screen.findByText('Test Responder');
    fireEvent.click(screen.getByRole('button', { name: /Check Out/i }));

    await waitFor(() => {
      expect(window.confirm).toHaveBeenCalled();
      // Application now records checkout via timestamp, not status string
      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ checkout_datetime: expect.any(String) }));
      expect(mockEq).toHaveBeenCalledWith('responder_id', 'res-123');
    });
  });
});
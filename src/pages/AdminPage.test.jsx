import { render, screen, cleanup, fireEvent, waitFor, act } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
import { vi, describe, it, expect, afterEach, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import AdminPage from './AdminPage';
import { useIncident } from '../context/IncidentContext';
import { usePlanningDashboard } from '../hooks/usePlanningDashboard';
import { supabase } from '../lib/supabase'; // Import the actual supabase object to mock it

expect.extend(matchers);

vi.mock('../context/IncidentContext', () => ({
  useIncident: vi.fn(),
}));

vi.mock('../hooks/usePlanningDashboard', () => ({
  usePlanningDashboard: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  supabase: { // Define the mock structure here
    from: vi.fn(() => {
      const mock = globalThis.createSupabaseQueryMock([]);
      mock.neq = vi.fn().mockReturnThis();
      return mock;
    }),
    rpc: vi.fn(() => globalThis.createSupabaseQueryMock(null)),
    auth: {
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
    channel: vi.fn().mockReturnThis(),
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnThis(),
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
    vi.mocked(usePlanningDashboard).mockReturnValue({
      recordAction: vi.fn(),
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

  it('should log in successfully as an administrator', async () => {
    const mockSetIsAdmin = vi.fn();
    vi.mocked(useIncident).mockReturnValue({
      isAdmin: false,
      setIsAdmin: mockSetIsAdmin,
      logout: vi.fn(),
      responderId: null,
    });

    // Mock RPC result for successful login
    supabase.rpc.mockReturnValue(globalThis.createSupabaseQueryMock({ 
      email: 'admin@test.com', 
      username: 'Admin' 
    }));

    render(<BrowserRouter><AdminPage /></BrowserRouter>);

    fireEvent.change(screen.getByPlaceholderText(/admin@agency.gov/i), { target: { value: 'admin@test.com' } });
    fireEvent.change(screen.getByPlaceholderText(/••••••••/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /Login/i }));

    await waitFor(() => {
      expect(supabase.rpc).toHaveBeenCalledWith('verify_admin_login', {
        p_email: 'admin@test.com',
        p_password: 'password123'
      });
      expect(mockSetIsAdmin).toHaveBeenCalledWith(true);
    });
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
    const mockTeam = { team_id: 't1', team_name_number: 'Team Alpha', status: 'Staged', type: 'Staff' };
    const mockMember = { responder_id: 'r1' };
    const mockRecordAction = vi.fn();
    
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

    // Override recordAction mock specifically for this test
    vi.mocked(usePlanningDashboard).mockReturnValue({
      ...vi.mocked(usePlanningDashboard)(),
      recordAction: mockRecordAction
    });

    render(<BrowserRouter><AdminPage /></BrowserRouter>);
    fireEvent.click(screen.getByText(/Team Management/i));

    const disbandBtn = await screen.findByRole('button', { name: /Disband/i });
    fireEvent.click(disbandBtn);

    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('Disband team "Team Alpha"'));
    expect(supabase.from).toHaveBeenCalledWith('responders'); // Verify cascade to responders
    
    // Verify "is/are" phrasing in logs
    await waitFor(() => expect(mockRecordAction).toHaveBeenCalledWith(expect.stringContaining('status="Disbanded", last_par_check=null. All members status are "Staged"')));
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
    
    supabase.rpc.mockResolvedValue({ error: null });
    // Ensure admin list fetch still works for the UI render
    supabase.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null })
    });

    render(<BrowserRouter><AdminPage /></BrowserRouter>);
    // Expand section to see the add form results in the list later
    fireEvent.click(screen.getByText(/Current Administrators/i));

    fireEvent.change(screen.getByPlaceholderText('admin@agency.gov'), { target: { value: 'new@admin.com' } });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'password123' } });
    const addButton = await screen.findByRole('button', { name: /Add Admin/i });
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(supabase.rpc).toHaveBeenCalledWith('admin_add_user', expect.objectContaining({
        p_email: 'new@admin.com',
        p_password: 'password123'
      }));
    });
  });

  it('should change an administrator\'s password', async () => {
    vi.mocked(useIncident).mockReturnValue({ isAdmin: true, setIsAdmin: vi.fn(), logout: vi.fn() });
    window.prompt = vi.fn().mockReturnValue('newpassword');

    supabase.rpc.mockResolvedValue({ error: null });
    supabase.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockImplementation(() => ({
        then: (cb) => cb({ data: [{ email: 'existing@admin.com', username: 'ExistingAdmin' }], error: null })
      }))
    });

    render(<BrowserRouter><AdminPage /></BrowserRouter>);

    // Expand section to access the admin list and buttons
    fireEvent.click(screen.getByText(/Current Administrators/i));

    await screen.findByText('ExistingAdmin');
    fireEvent.click(screen.getByRole('button', { name: /Change Password/i }));

    await waitFor(() => {
      expect(supabase.rpc).toHaveBeenCalledWith('admin_update_password', {
        p_email: 'existing@admin.com',
        p_password: 'newpassword'
      });
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
      // Application now marks individual checkouts as 'Cleared'
      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ 
        status: 'Cleared',
        checkout_datetime: expect.any(String) 
      }));
      expect(mockEq).toHaveBeenCalledWith('responder_id', 'res-123');
    });
  });

  it('performs bulk cleanup of resources when ending an active incident', async () => {
    vi.mocked(useIncident).mockReturnValue({ 
      isAdmin: true, 
      incidentId: 'inc-123',
      endIncident: vi.fn()
    });
    window.confirm = vi.fn().mockReturnValue(true);

    // Mock finding 1 active assignment and 1 responder
    supabase.from.mockImplementation((table) => {
      let data = [];
      if (table === 'incidents') {
        data = [{ 
          incident_id: 'inc-123', 
          name: 'Active Incident', 
          number: '1', 
          start_datetime: new Date().toISOString() 
        }];
      }
      if (table === 'operational_periods') data = { op_period_id: 'op-1' };
      if (table === 'assignments') data = [{ assignment_id: 'a1', status: 'Deployed' }];
      if (table === 'responders') data = [{ responder_id: 'r1' }];
      
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
        then: (onFulfilled) => Promise.resolve({ data, error: null }).then(onFulfilled)
      };
    });

    render(<BrowserRouter><AdminPage /></BrowserRouter>);
    fireEvent.click(screen.getByText(/Incident Management/i));

    const endBtn = await screen.findByRole('button', { name: /End Incident/i });
    fireEvent.click(endBtn);

    expect(supabase.from).toHaveBeenCalledWith('assignments');
    expect(supabase.from).toHaveBeenCalledWith('teams');
    expect(supabase.from).toHaveBeenCalledWith('incidents');
  });

  it('successfully signs out the administrator and redirects to check-in', async () => {
    const mockLogout = vi.fn();
    vi.mocked(useIncident).mockReturnValue({ isAdmin: true, logout: mockLogout });
    
    render(<BrowserRouter><AdminPage /></BrowserRouter>);

    const logoutBtn = screen.getByRole('button', { name: /Sign Out Admin/i });
    fireEvent.click(logoutBtn);

    await waitFor(() => {
      expect(supabase.auth.signOut).toHaveBeenCalled();
      expect(mockLogout).toHaveBeenCalled();
    });
  });

  it('should delete an assignment when confirmed', async () => {
    vi.mocked(useIncident).mockReturnValue({ isAdmin: true });
    window.confirm = vi.fn().mockReturnValue(true);
    const mockAsn = { assignment_id: 'a1', title: 'Task to Delete', status: 'Planned' };
    
    supabase.from.mockImplementation((table) => ({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
      then: (cb) => Promise.resolve({ data: table === 'assignments' ? [mockAsn] : [], error: null }).then(cb)
    }));

    render(<BrowserRouter><AdminPage /></BrowserRouter>);
    fireEvent.click(screen.getByText(/Assignment Management/i));
    fireEvent.click(await screen.findByRole('button', { name: /Delete/i }));

    expect(supabase.from).toHaveBeenCalledWith('assignments');
  });

  it('should delete a responder when confirmed', async () => {
    vi.mocked(useIncident).mockReturnValue({ isAdmin: true });
    window.confirm = vi.fn().mockReturnValue(true);
    const mockRes = { responder_id: 'r1', name: 'Delete Me', status: 'Staged', checkin_datetime: new Date().toISOString(), agency: 'SAR', identifier: 'K9-1' };

    supabase.from.mockImplementation((table) => ({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
      then: (cb) => Promise.resolve({ data: table === 'responders' ? [mockRes] : [], error: null }).then(cb)
    }));

    render(<BrowserRouter><AdminPage /></BrowserRouter>);
    fireEvent.click(screen.getByText(/Responder Management/i));
    fireEvent.click(await screen.findByRole('button', { name: /Delete/i }));

    expect(supabase.from).toHaveBeenCalledWith('responders');
  });

  it('should remove an administrator when confirmed', async () => {
    vi.mocked(useIncident).mockReturnValue({ isAdmin: true });
    window.confirm = vi.fn().mockReturnValue(true);
    
    const mockAdmins = [
      { email: 'admin1@example.com', username: 'Admin1' },
      { email: 'admin2@example.com', username: 'Admin2' }
    ];

    supabase.rpc.mockResolvedValue({ error: null });
    supabase.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockImplementation(() => ({
        then: (cb) => cb({ data: mockAdmins, error: null })
      }))
    });

    render(<BrowserRouter><AdminPage /></BrowserRouter>);
    fireEvent.click(screen.getByText(/Current Administrators/i));
    
    const removeButtons = await screen.findAllByRole('button', { name: /Remove/i });
    fireEvent.click(removeButtons[0]);

    await waitFor(() => {
      expect(supabase.rpc).toHaveBeenCalledWith('admin_remove_user', { p_email: 'admin1@example.com' });
    });
  });

  it('prompts for confirmation and calls seed_data_specific RPC', async () => {
    vi.mocked(useIncident).mockReturnValue({ isAdmin: true });
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    supabase.rpc.mockResolvedValue({ error: null });

    render(<BrowserRouter><AdminPage /></BrowserRouter>);
    
    const seedBtn = await screen.findByRole('button', { name: /Seed Data/i });
    fireEvent.click(seedBtn);

    expect(confirmSpy).toHaveBeenCalled();
    expect(supabase.rpc).toHaveBeenCalledWith('seed_data_specific');
    
    confirmSpy.mockRestore();
  });
});
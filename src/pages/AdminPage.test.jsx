import { render, screen, cleanup, fireEvent, waitFor, within, act } from '@testing-library/react';
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
      return mock;
    }),
    rpc: vi.fn(() => globalThis.createSupabaseQueryMock(null)),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      signInAnonymously: vi.fn().mockResolvedValue({ data: { user: { id: 'test-anon-user' } }, error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
    channel: vi.fn().mockReturnThis(),
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnThis(),
  },
}));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('AdminPage Authentication Gate', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useRealTimers();
    // Set default mock for useIncident for tests that don't override it
    vi.mocked(useIncident).mockReturnValue({
      isAdmin: false,
      setIsAdmin: vi.fn(),
      logout: vi.fn(),
      responderId: null,
      incidentId: null,
      incidentData: { name: '', opNumber: '', opPeriodId: '' },
      operationsRefreshInterval: 30000,
      setOperationsRefreshInterval: vi.fn(),
      responderRefreshInterval: 30000,
      setResponderRefreshInterval: vi.fn(),
      sartopoRefreshInterval: 30000,
      setSartopoRefreshInterval: vi.fn(),
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
      incidentId: null,
      incidentData: { name: '', opNumber: '', opPeriodId: '' },
      operationsRefreshInterval: 30000,
      setOperationsRefreshInterval: vi.fn(),
      responderRefreshInterval: 30000,
      setResponderRefreshInterval: vi.fn(),
      sartopoRefreshInterval: 30000,
      setSartopoRefreshInterval: vi.fn(),
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
      endIncident: vi.fn(),
      incidentId: 'i1',
      responderId: 'r1',
      incidentData: { name: 'Lost Hiker', opNumber: '1', opPeriodId: 'op1' },
      operationsRefreshInterval: 30000,
      setOperationsRefreshInterval: vi.fn(),
      responderRefreshInterval: 30000,
      setResponderRefreshInterval: vi.fn(),
      sartopoRefreshInterval: 30000,
      setSartopoRefreshInterval: vi.fn(),
    });

    // Mock data for incidents and responders
    const mockIncident = { incident_id: 'i1', name: 'Lost Hiker', number: '101', start_datetime: new Date().toISOString() };
    const mockUser = { email: 'user@example.com', username: 'SystemUser', access_level: 'responder', name: 'Test User' };
    
    supabase.from.mockImplementation((table) => {
      let data = [];
      if (table === 'incidents') data = [mockIncident];
      if (table === 'users') data = [mockUser]; // Mock users fetch
      return {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        then: (onFulfilled) => Promise.resolve({ data, error: null }).then(onFulfilled)
      };
    });

    render(<BrowserRouter><AdminPage /></BrowserRouter>);

    expect(await screen.findByText('Lost Hiker')).toBeInTheDocument();
    expect(await screen.findByText('Test User')).toBeInTheDocument(); // Check for system user by name
    expect(screen.getByText(/user@example.com/)).toBeInTheDocument(); // Verify email is also present
    expect(screen.getByText(/Responder Management/i)).toBeInTheDocument();
  });
  
  it('should toggle visibility of management sections and show correct counts', async () => {
    vi.mocked(useIncident).mockReturnValue({ // Updated mock to include endIncident
      isAdmin: true,
      setIsAdmin: vi.fn(),
      logout: vi.fn(),
      endIncident: vi.fn(),
      incidentId: 'inc-1',
      incidentData: { opPeriodId: 'op-1' },
      operationsRefreshInterval: 30000,
      setOperationsRefreshInterval: vi.fn(),
      responderRefreshInterval: 30000,
      setResponderRefreshInterval: vi.fn(),
      sartopoRefreshInterval: 30000,
      setSartopoRefreshInterval: vi.fn(),
    });
    supabase.from.mockImplementation((table) => {
      if (table === 'responders') return globalThis.createSupabaseQueryMock([{ responder_id: 'r1', name: 'Res 1', status: 'Staged' }]);
      return globalThis.createSupabaseQueryMock([]);
    });

    render(<BrowserRouter><AdminPage /></BrowserRouter>);
    
    const header = await screen.findByText(/Responder Management \(1\)/i);
    const responderSection = header.closest('.section-card'); // Find the parent section containing the responders table
    expect(within(responderSection).getByText('Res 1')).toBeInTheDocument();
    
    fireEvent.click(header);
    expect(within(responderSection).queryByText('Res 1')).not.toBeInTheDocument(); // Now Collapsed
  });

  it('should open the user edit modal and populate the form with user data when "Edit" is clicked', async () => {
    const mockUserToEdit = { 
      email: 'edit@user.com', 
      username: 'EditUser', 
      access_level: 'staff', 
      name: 'Edit Test User',
      agency: 'Test Agency',
      identifier: 'E123',
      cell_phone: '555-123-4567',
      responder_type: 'Fire',
      special_skills: 'EMT, UAS'
    };

    vi.mocked(useIncident).mockReturnValue({ 
      isAdmin: true, 
      setIsAdmin: vi.fn(), 
      logout: vi.fn(),
      incidentId: 'inc-123',
      incidentData: { opPeriodId: 'op-123' },
      operationsRefreshInterval: 30000,
      setOperationsRefreshInterval: vi.fn(),
      responderRefreshInterval: 30000,
      setResponderRefreshInterval: vi.fn(),
      sartopoRefreshInterval: 30000,
      setSartopoRefreshInterval: vi.fn(),
    });

    supabase.from.mockImplementation((table) => {
      if (table === 'users') return globalThis.createSupabaseQueryMock([mockUserToEdit]);
      return globalThis.createSupabaseQueryMock([]);
    });

    render(<BrowserRouter><AdminPage /></BrowserRouter>);
    // System Users is expanded by default now

    const editButton = await screen.findByRole('button', { name: /Edit/i, exact: true });
    fireEvent.click(editButton);

    expect(screen.getByRole('heading', { name: /Edit User:/i })).toBeInTheDocument(); 
    expect(screen.getByLabelText('Email Address')).toHaveValue(mockUserToEdit.email);
    expect(screen.getByLabelText('Full Name')).toHaveValue(mockUserToEdit.name);
    expect(screen.getByLabelText('Agency')).toHaveValue(mockUserToEdit.agency);
    expect(screen.getByLabelText('Identifier')).toHaveValue(mockUserToEdit.identifier);
    expect(screen.getByLabelText('Phone Number')).toHaveValue(mockUserToEdit.cell_phone);
    expect(screen.getByLabelText('Access Level')).toHaveValue(mockUserToEdit.access_level);
    expect(screen.getByLabelText('Responder Type')).toHaveValue(mockUserToEdit.responder_type);
  });

  it('should disband a team and release responders (via DB trigger)', async () => { // Updated description
    vi.mocked(useIncident).mockReturnValue({
      isAdmin: true,
      setIsAdmin: vi.fn(),
      logout: vi.fn(),
      endIncident: vi.fn(),
      incidentId: 'inc-1',
      incidentData: { opPeriodId: 'op-1' },
      operationsRefreshInterval: 30000,
      setOperationsRefreshInterval: vi.fn(),
      responderRefreshInterval: 30000,
      setResponderRefreshInterval: vi.fn(),
      sartopoRefreshInterval: 30000,
      setSartopoRefreshInterval: vi.fn(),
    });
    window.confirm = vi.fn().mockReturnValue(true);
    const mockTeam = {
      team_id: 't1',
      team_name_number: 'Team Alpha',
      status: 'Staged',
      type: 'Staff',
      operational_periods: {
        op_number: '1',
        incidents: {
          name: 'Incident Name',
          number: 'INC-001'
        }
      }
    };
    const mockMember = { responder_id: 'r1' };
    const mockRecordAction = vi.fn();
    
    supabase.from.mockImplementation((table) => {
      if (table === 'teams') return globalThis.createSupabaseQueryMock([mockTeam]);
      if (table === 'team_responders') return globalThis.createSupabaseQueryMock([mockMember]);
      // For other tables, return a generic mock that resolves to empty data
      return globalThis.createSupabaseQueryMock([]);
    });

    // Override recordAction mock specifically for this test
    vi.mocked(usePlanningDashboard).mockReturnValue({
      ...vi.mocked(usePlanningDashboard)(),
      recordAction: mockRecordAction
    });

    render(<BrowserRouter><AdminPage /></BrowserRouter>);

    // Team Management is expanded by default. Wait for the mocked data to render.
    await screen.findByText('Team Alpha');

    const disbandBtn = await screen.findByRole('button', { name: /Disband/i }); // Use findByRole for robustness
    fireEvent.click(disbandBtn);

    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('Disband team "Team Alpha"'));
    expect(supabase.from).toHaveBeenCalledWith('teams'); // Verify primary status update
    
    await waitFor(() => expect(mockRecordAction).toHaveBeenCalledWith(
      `Admin disbanded team "${mockTeam.team_name_number}" (ID: ${mockTeam.team_id}, Type: ${mockTeam.type}). Fields modified: status="Disbanded", last_par_check=null. Automated trigger: All members released to "Staged".`
    ));
  });

  it('prompts for confirmation before deleting an incident and performs deletion', async () => {
    vi.mocked(useIncident).mockReturnValue({
      isAdmin: true,
      setIsAdmin: vi.fn(),
      logout: vi.fn(),
      endIncident: vi.fn(),
      incidentId: 'i1',
      incidentData: { opPeriodId: 'op1' },
      operationsRefreshInterval: 30000,
      setOperationsRefreshInterval: vi.fn(),
      responderRefreshInterval: 30000,
      setResponderRefreshInterval: vi.fn(),
      sartopoRefreshInterval: 30000,
      setSartopoRefreshInterval: vi.fn(),
    });
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

    const row = (await screen.findByText('Ended Incident')).closest('tr');
    const deleteBtn = within(row).getByRole('button', { name: /Delete/i });
    fireEvent.click(deleteBtn);

    expect(window.confirm).toHaveBeenCalled();
    expect(supabase.from).toHaveBeenCalledWith('incidents');
    expect(mockDelete).toHaveBeenCalled();
  });

  it('should open the add new user modal and add a new user', async () => {
    vi.mocked(useIncident).mockReturnValue({ 
      isAdmin: true, 
      setIsAdmin: vi.fn(), 
      logout: vi.fn(),
      incidentId: 'inc-123',
      incidentData: { opPeriodId: 'op-123' },
      operationsRefreshInterval: 30000,
      setOperationsRefreshInterval: vi.fn(),
      responderRefreshInterval: 30000,
      setResponderRefreshInterval: vi.fn(),
      sartopoRefreshInterval: 30000,
      setSartopoRefreshInterval: vi.fn(),
    });
    
    supabase.rpc.mockResolvedValue({ error: null });
    supabase.from.mockImplementation((table) => ({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null })
    }));

    render(<BrowserRouter><AdminPage /></BrowserRouter>);
    
    const userSection = screen.getByRole('heading', { name: /System Users/i, level: 2 }).closest('.section-card');
    fireEvent.click(within(userSection).getByRole('button', { name: /\+ New/i }));
    expect(screen.getByRole('heading', { name: /Add New User/i, level: 3 })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Email Address/i), { target: { value: 'new@user.com' } });
    fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /Save User/i }));

    await waitFor(() => {
      expect(supabase.rpc).toHaveBeenCalledWith('admin_add_user', expect.objectContaining({
        p_email: 'new@user.com',
        p_username: 'new@user.com', 
        p_password: 'password123',
        p_access_level: 'responder',
        p_name: '',
        p_agency: '',
        p_identifier: '',
        p_phone: '',
        p_type: 'SAR',
        p_skills: '',
      }));
    });
  });

  it('should open the user edit modal and update an existing user', async () => {
    const mockUserToEdit = { 
      email: 'edit@user.com', 
      username: 'EditUser', 
      access_level: 'staff', 
      name: 'Edit Test User',
      agency: 'Test Agency',
      identifier: 'E123',
      cell_phone: '555-123-4567',
      responder_type: 'Fire',
      special_skills: 'EMT, UAS'
    };

    vi.mocked(useIncident).mockReturnValue({ 
      isAdmin: true, 
      setIsAdmin: vi.fn(), 
      logout: vi.fn(),
      incidentId: 'inc-123',
      incidentData: { opPeriodId: 'op-123' },
      operationsRefreshInterval: 30000,
      setOperationsRefreshInterval: vi.fn(),
      responderRefreshInterval: 30000,
      setResponderRefreshInterval: vi.fn(),
      sartopoRefreshInterval: 30000,
      setSartopoRefreshInterval: vi.fn(),
    });
    supabase.rpc.mockResolvedValue({ error: null });
    supabase.from.mockImplementation((table) => {
      if (table === 'users') return globalThis.createSupabaseQueryMock([mockUserToEdit]); // Initial fetch
      return globalThis.createSupabaseQueryMock([]);
    });

    render(<BrowserRouter><AdminPage /></BrowserRouter>);
    fireEvent.click(await screen.findByRole('button', { name: /Edit/i, exact: true }));
    expect(screen.getByRole('heading', { name: /Edit User:/i })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Agency'), { target: { value: 'Updated Agency' } });
    fireEvent.click(screen.getByRole('button', { name: /Save User/i }));

    await waitFor(() => {
      expect(supabase.rpc).toHaveBeenCalledWith('admin_add_user', expect.objectContaining({ p_email: 'edit@user.com', p_agency: 'Updated Agency' }));
    });
  });

  it('should change an administrator\'s password', async () => {
    vi.mocked(useIncident).mockReturnValue({ 
      isAdmin: true, 
      setIsAdmin: vi.fn(), 
      logout: vi.fn(),
      incidentId: 'inc-123',
      incidentData: { opPeriodId: 'op-123' },
      operationsRefreshInterval: 30000,
      setOperationsRefreshInterval: vi.fn(),
      responderRefreshInterval: 30000,
      setResponderRefreshInterval: vi.fn(),
      sartopoRefreshInterval: 30000,
      setSartopoRefreshInterval: vi.fn(),
    });
    window.prompt = vi.fn().mockReturnValue('newpassword');

    supabase.rpc.mockResolvedValue({ error: null });
    supabase.from.mockImplementation((table) => ({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(), // Ensure order is chained before then
      then: (cb) => Promise.resolve({ data: table === 'users' ? [{ email: 'existing@user.com', username: 'ExistingUser' }] : [], error: null }).then(cb)
    }));

    render(<BrowserRouter><AdminPage /></BrowserRouter>);

    // Expand section to access the admin list and buttons
    // System Users section is expanded by default

    await screen.findByText('ExistingUser');
    fireEvent.click(screen.getByRole('button', { name: /Password/i }));

    await waitFor(() => {
      expect(supabase.rpc).toHaveBeenCalledWith('admin_update_password', {
        p_email: 'existing@user.com',
        p_password: 'newpassword'
      });
    });
  });

  it('should check out a responder', async () => {
    vi.mocked(useIncident).mockReturnValue({
      isAdmin: true,
      setIsAdmin: vi.fn(),
      logout: vi.fn(),
      endIncident: vi.fn(),
      responderId: 'res-123',
      incidentId: 'inc-123',
      incidentData: { opPeriodId: 'op-123' },
      operationsRefreshInterval: 30000,
      setOperationsRefreshInterval: vi.fn(),
      responderRefreshInterval: 30000,
      setResponderRefreshInterval: vi.fn(),
      sartopoRefreshInterval: 30000,
      setSartopoRefreshInterval: vi.fn(),
    });
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

    await screen.findByText('Test Responder');
    fireEvent.click(screen.getByRole('button', { name: /Check Out/i }));

    await waitFor(() => {
      expect(window.confirm).toHaveBeenCalled();
      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ 
        status: 'CheckedOut',
        checkout_datetime: expect.any(String) 
      }));
      expect(mockEq).toHaveBeenCalledWith('responder_id', 'res-123');
    });
  });

  it('performs bulk cleanup of resources when ending an active incident', async () => {
    vi.mocked(useIncident).mockReturnValue({ 
      isAdmin: true,
      setIsAdmin: vi.fn(),
      logout: vi.fn(),
      incidentId: 'inc-123',
      endIncident: vi.fn(),
      incidentData: { opPeriodId: 'op-1' },
      operationsRefreshInterval: 30000,
      setOperationsRefreshInterval: vi.fn(),
      responderRefreshInterval: 30000,
      setResponderRefreshInterval: vi.fn(),
      sartopoRefreshInterval: 30000,
      setSartopoRefreshInterval: vi.fn(),
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
      if (table === 'responders') data = [{ responder_id: 'r1', status: 'Staged' }];
      
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
    // Incident Management is expanded by default

    const endBtn = await screen.findByRole('button', { name: /End Incident/i });
    fireEvent.click(endBtn);

    expect(supabase.from).toHaveBeenCalledWith('assignments');
    expect(supabase.from).toHaveBeenCalledWith('teams');
    expect(supabase.from).toHaveBeenCalledWith('incidents');
  });

  it('successfully signs out the administrator and redirects to check-in', async () => {
    const mockLogout = vi.fn();
    vi.mocked(useIncident).mockReturnValue({ 
      isAdmin: true, 
      logout: mockLogout,
      incidentId: 'inc-123',
      incidentData: { opPeriodId: 'op-123' },
      operationsRefreshInterval: 30000,
      setOperationsRefreshInterval: vi.fn(),
      responderRefreshInterval: 30000,
      setResponderRefreshInterval: vi.fn(),
      sartopoRefreshInterval: 30000,
      setSartopoRefreshInterval: vi.fn(),
    });
    
    render(<BrowserRouter><AdminPage /></BrowserRouter>);
    const logoutBtn = screen.getByRole('button', { name: /Sign Out Admin/i });
    fireEvent.click(logoutBtn);

    await waitFor(() => {
      expect(supabase.auth.signOut).toHaveBeenCalled();
      expect(mockLogout).toHaveBeenCalled();
    });
  });

  it('should delete an assignment when confirmed', async () => {
    vi.mocked(useIncident).mockReturnValue({
      isAdmin: true,
      setIsAdmin: vi.fn(),
      logout: vi.fn(),
      endIncident: vi.fn(),
      incidentId: 'inc-123',
      incidentData: { opPeriodId: 'op-123' },
      operationsRefreshInterval: 30000,
      setOperationsRefreshInterval: vi.fn(),
      responderRefreshInterval: 30000,
      setResponderRefreshInterval: vi.fn(),
      sartopoRefreshInterval: 30000,
      setSartopoRefreshInterval: vi.fn(),
    });
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
    // Assignment Management is expanded by default
    const row = (await screen.findByText('Task to Delete')).closest('tr');
    fireEvent.click(within(row).getByRole('button', { name: /Delete/i }));

    expect(supabase.from).toHaveBeenCalledWith('assignments');
  });

  it('should delete a responder when confirmed', async () => {
    vi.mocked(useIncident).mockReturnValue({
      isAdmin: true,
      setIsAdmin: vi.fn(),
      logout: vi.fn(),
      endIncident: vi.fn(),
      incidentId: 'inc-123',
      incidentData: { opPeriodId: 'op-123' },
      operationsRefreshInterval: 30000,
      setOperationsRefreshInterval: vi.fn(),
      responderRefreshInterval: 30000,
      setResponderRefreshInterval: vi.fn(),
      sartopoRefreshInterval: 30000,
      setSartopoRefreshInterval: vi.fn(),
    });
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
    // Responder Management is expanded by default
    const row = (await screen.findByText('Delete Me')).closest('tr');
    fireEvent.click(within(row).getByRole('button', { name: /Delete/i }));

    expect(supabase.from).toHaveBeenCalledWith('responders');
  });

  it('should remove an administrator when confirmed', async () => {
    vi.mocked(useIncident).mockReturnValue({
      isAdmin: true,
      setIsAdmin: vi.fn(),
      logout: vi.fn(),
      endIncident: vi.fn(),
      incidentId: 'inc-123',
      incidentData: { opPeriodId: 'op-123' },
      operationsRefreshInterval: 30000,
      setOperationsRefreshInterval: vi.fn(),
      responderRefreshInterval: 30000,
      setResponderRefreshInterval: vi.fn(),
      sartopoRefreshInterval: 30000,
      setSartopoRefreshInterval: vi.fn(),
    });
    window.confirm = vi.fn().mockReturnValue(true);
    
    const mockUsers = [
      { email: 'user1@example.com', username: 'User1' },
      { email: 'user2@example.com', username: 'User2' }
    ];

    supabase.rpc.mockResolvedValue({ error: null });
    supabase.from.mockImplementation((table) => ({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(), // Ensure order is chained before then
      then: (cb) => Promise.resolve({ data: table === 'users' ? mockUsers : [], error: null }).then(cb)
    }));

    render(<BrowserRouter><AdminPage /></BrowserRouter>);
    // System Users is expanded by default
    
    const removeButtons = await screen.findAllByRole('button', { name: /Remove/i });
    fireEvent.click(removeButtons[0]);

    await waitFor(() => {
      expect(supabase.rpc).toHaveBeenCalledWith('user_remove', { p_email: 'user1@example.com' });
    });
  });

  it('prompts for confirmation and calls seed_data_specific RPC', async () => {
    vi.mocked(useIncident).mockReturnValue({
      isAdmin: true,
      setIsAdmin: vi.fn(),
      logout: vi.fn(),
      endIncident: vi.fn(),
      incidentId: 'inc-123',
      incidentData: { opPeriodId: 'op-123' },
      operationsRefreshInterval: 30000,
      setOperationsRefreshInterval: vi.fn(),
      responderRefreshInterval: 30000,
      setResponderRefreshInterval: vi.fn(),
      sartopoRefreshInterval: 30000,
      setSartopoRefreshInterval: vi.fn(),
    });
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    supabase.rpc.mockResolvedValue({ error: null });

    render(<BrowserRouter><AdminPage /></BrowserRouter>);
    
    const seedBtn = await screen.findByRole('button', { name: /Seed Data/i });
    fireEvent.click(seedBtn);

    expect(confirmSpy).toHaveBeenCalled();
    expect(supabase.rpc).toHaveBeenCalledWith('seed_data_specific');
    
    confirmSpy.mockRestore();
  });

  it('prompts for confirmation and calls reinitialize_database RPC', async () => {
    const mockLogout = vi.fn();
    vi.mocked(useIncident).mockReturnValue({
      isAdmin: true,
      setIsAdmin: vi.fn(),
      logout: mockLogout,
      endIncident: vi.fn(),
      incidentId: 'inc-123',
      incidentData: { opPeriodId: 'op-123' },
      operationsRefreshInterval: 30000,
      setOperationsRefreshInterval: vi.fn(),
      responderRefreshInterval: 30000,
      setResponderRefreshInterval: vi.fn(),
      sartopoRefreshInterval: 30000,
      setSartopoRefreshInterval: vi.fn(),
    });
    
    const confirmSpy = vi.fn().mockReturnValue(true);
    vi.stubGlobal('confirm', confirmSpy);
    
    supabase.rpc.mockResolvedValue({ error: null });

    render(<BrowserRouter><AdminPage /></BrowserRouter>);
    
    const resetBtn = await screen.findByRole('button', { name: /Re-initialize Database/i });
    fireEvent.click(resetBtn);

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('DANGER'));
      expect(supabase.rpc).toHaveBeenCalledWith('reinitialize_database');
      expect(mockLogout).toHaveBeenCalled();
    });
  });

  it('disables the Re-initialize Database button while a reset operation is in progress', async () => {
    vi.mocked(useIncident).mockReturnValue({
      isAdmin: true,
      setIsAdmin: vi.fn(),
      logout: vi.fn(),
      endIncident: vi.fn(),
      incidentId: 'inc-123',
      incidentData: { opPeriodId: 'op-123' },
      operationsRefreshInterval: 30000,
      setOperationsRefreshInterval: vi.fn(),
      responderRefreshInterval: 30000,
      setResponderRefreshInterval: vi.fn(),
      sartopoRefreshInterval: 30000,
      setSartopoRefreshInterval: vi.fn(),
    });
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
    
    // Use a controlled promise that we can resolve later to avoid hanging the test runner
    let resolveReset;
    const resetPromise = new Promise((resolve) => { resolveReset = resolve; });
    supabase.rpc.mockReturnValue(resetPromise);

    render(<BrowserRouter><AdminPage /></BrowserRouter>);
    
    const resetBtn = await screen.findByRole('button', { name: /Re-initialize Database/i });
    fireEvent.click(resetBtn);

    // Re-query the button inside waitFor to handle React potentially 
    // replacing the element during the state-change re-render.
    await waitFor(() => {
      const updatedBtn = screen.getByRole('button', { name: /Resetting/i });
      expect(updatedBtn).toBeInTheDocument();
      expect(updatedBtn).toBeDisabled();
    });
    
    resolveReset({ error: null }); // Resolve to allow clean termination
  });
});
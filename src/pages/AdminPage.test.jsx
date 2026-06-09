import { render, screen, cleanup, fireEvent, waitFor, within, act } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
import { vi, describe, it, expect, afterEach, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import AdminPage from './AdminPage';
import { useIncident } from '../context/IncidentContext';
import { useAdminData } from '../hooks/useAdminData';
import { useToast } from '../context/ToastContext';
import { supabase } from '../lib/supabase'; // Import the actual supabase object to mock it

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

expect.extend(matchers);

vi.mock('../context/IncidentContext', () => ({
  useIncident: vi.fn(),
}));

vi.mock('../hooks/useAdminData', () => ({
  useAdminData: vi.fn(),
}));

vi.mock('../context/ToastContext', () => ({
  useToast: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  supabase: { // Define the mock structure here
    from: vi.fn(() => {
      const mock = globalThis.createSupabaseQueryMock([]);
      return mock;
    }),
    rpc: vi.fn(() => {
      const mock = globalThis.createSupabaseQueryMock(null);
      mock.maybeSingle = vi.fn().mockReturnThis();
      return mock;
    }),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      signInAnonymously: vi.fn().mockResolvedValue({ data: { user: { id: 'test-anon-user' } }, error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      refreshSession: vi.fn().mockResolvedValue({ data: { session: {} }, error: null }),
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
  const mockAddToast = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Re-establish default mock implementations that are lost when implementations are overridden in individual tests.
    supabase.from.mockImplementation(() => globalThis.createSupabaseQueryMock([]));
    supabase.rpc.mockImplementation(() => {
      const mock = globalThis.createSupabaseQueryMock(null);
      mock.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
      return mock;
    });
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
    vi.mocked(useAdminData).mockReturnValue({
      users: [],
      incidents: [],
      responders: [],
      vehicles: [],
      teams: [],
      assignments: [],
      loading: false,
      refresh: vi.fn(),
      refreshAll: vi.fn(),
    });
    vi.mocked(useToast).mockReturnValue({
      addToast: mockAddToast
    });
  });

  it('redirects to the login page if the user is not an admin', async () => {
    render(
      <BrowserRouter>
        <AdminPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/login');
    });
    
    expect(screen.queryByText(/SAROPs Login/i)).not.toBeInTheDocument();
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
    const mockIncident = { 
      incident_id: 'i1', 
      name: 'Lost Hiker', 
      number: '101', 
      start_datetime: new Date().toISOString(),
      // Include nested op periods to match the updated useAdminData behavior
      operational_periods: [{ op_number: 1, op_period_id: 'op1', start_datetime: new Date().toISOString() }]
    };
    const mockUser = { email: 'user@example.com', username: 'SystemUser', access_level: 'responder', name: 'Test User' };

    vi.mocked(useAdminData).mockReturnValue({
      users: [mockUser],
      incidents: [mockIncident],
      responders: [],
      vehicles: [{ vehicle_id: 'v1', designation: '3121', status: 'Staged' }],
      teams: [],
      assignments: [],
      loading: false,
      refresh: vi.fn(),
      refreshAll: vi.fn(),
    });

    render(<BrowserRouter><AdminPage /></BrowserRouter>);

    expect(await screen.findByText('3121')).toBeInTheDocument();
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

    vi.mocked(useAdminData).mockReturnValue({
      users: [],
      incidents: [],
      responders: [{ responder_id: 'r1', name: 'Res 1', status: 'Staged' }],
      vehicles: [],
      teams: [],
      assignments: [],
      loading: false,
      refresh: vi.fn(),
      refreshAll: vi.fn(),
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


    vi.mocked(useAdminData).mockReturnValue({
      users: [mockUserToEdit],
      incidents: [],
      responders: [],
      vehicles: [],
      teams: [],
      assignments: [],
      loading: false,
      refresh: vi.fn(),
      refreshAll: vi.fn(),
    });

    render(<BrowserRouter><AdminPage /></BrowserRouter>);
    // System Users is expanded by default now

    const userRow = (await screen.findByText(mockUserToEdit.email)).closest('tr');
    const editButton = within(userRow).getByRole('button', { name: /Edit/i });
    fireEvent.click(editButton);

    expect(screen.getByRole('heading', { name: /Edit User:/i })).toBeInTheDocument(); 
    expect(screen.getByLabelText(/Email Address/i)).toHaveValue(mockUserToEdit.email);
    expect(screen.getByLabelText(/Full Name/i)).toHaveValue(mockUserToEdit.name);
    expect(screen.getByLabelText(/Agency/i)).toHaveValue(mockUserToEdit.agency);
    expect(screen.getByLabelText(/Identifier/i)).toHaveValue(mockUserToEdit.identifier);
    expect(screen.getByLabelText(/Phone Number/i)).toHaveValue(mockUserToEdit.cell_phone);
    expect(screen.getByLabelText(/Access Level/i)).toHaveValue(mockUserToEdit.access_level);
    expect(screen.getByLabelText(/Responder Type/i)).toHaveValue(mockUserToEdit.responder_type);
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
    
    // Mock useAdminData to provide the team record for the find() lookup in handleDisbandTeam
    vi.mocked(useAdminData).mockReturnValue({
      users: [],
      incidents: [],
      responders: [],
      vehicles: [],
      teams: [mockTeam],
      assignments: [],
      loading: false,
      refresh: vi.fn(),
      refreshAll: vi.fn(),
    });

    render(<BrowserRouter><AdminPage /></BrowserRouter>);

    const disbandBtn = await screen.findByRole('button', { name: /Disband/i });
    fireEvent.click(disbandBtn);

    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('Disband team "Team Alpha"'));
    
    await waitFor(() => {
      expect(supabase.from).toHaveBeenCalledWith('teams');
      expect(supabase.from).toHaveBeenCalledWith('action_logs');
    });
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

    vi.mocked(useAdminData).mockReturnValue({
      users: [],
      incidents: [mockIncident],
      responders: [],
      vehicles: [],
      teams: [],
      assignments: [],
      loading: false,
      refresh: vi.fn(),
      refreshAll: vi.fn(),
    });

    supabase.from.mockImplementation(() => {
      const mock = globalThis.createSupabaseQueryMock([]);
      mock.delete = mockDelete;
      return mock;
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
    supabase.from.mockImplementation(() => {
      const mock = globalThis.createSupabaseQueryMock([]);
      mock.maybeSingle = vi.fn().mockReturnThis();
      return mock;
    });

    render(<BrowserRouter><AdminPage /></BrowserRouter>);
    
    const userSection = screen.getByRole('heading', { name: /System Users/i, level: 2 }).closest('.section-card');
    fireEvent.click(within(userSection).getByRole('button', { name: /\+ New/i }));
    expect(screen.getByRole('heading', { name: /Add New User/i, level: 3 })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Email Address/i), { target: { value: 'new@user.com' } });
    fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /Save & Exit/i }));

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
        p_display_density: 'comfortable',
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

    vi.mocked(useAdminData).mockReturnValue({
      users: [mockUserToEdit],
      incidents: [],
      responders: [],
      vehicles: [],
      teams: [],
      assignments: [],
      loading: false,
      refresh: vi.fn(),
      refreshAll: vi.fn(),
    });

    render(<BrowserRouter><AdminPage /></BrowserRouter>);
    fireEvent.click(await screen.findByRole('button', { name: /Edit/i, exact: true }));
    expect(screen.getByRole('heading', { name: /Edit User:/i })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Agency'), { target: { value: 'Updated Agency' } });
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

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
    vi.mocked(useAdminData).mockReturnValue({
      users: [{ email: 'existing@user.com', username: 'ExistingUser' }],
      incidents: [],
      vehicles: [],
      responders: [],
      teams: [],
      assignments: [],
      loading: false,
      refresh: vi.fn(),
      refreshAll: vi.fn(),
    });

    render(<BrowserRouter><AdminPage /></BrowserRouter>);

    // Expand section to access the admin list and buttons
    // System Users section is expanded by default

    await screen.findByText((content) => content.includes('ExistingUser'));
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
    
    vi.mocked(useAdminData).mockReturnValue({
      users: [],
      incidents: [],
      responders: [mockResponder],
      vehicles: [],
      teams: [],
      assignments: [],
      loading: false,
      refresh: vi.fn(),
      refreshAll: vi.fn(),
    });

    const mockUpdate = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockReturnThis();

    supabase.from.mockImplementation(() => {
      const mock = globalThis.createSupabaseQueryMock([]);
      mock.update = mockUpdate;
      mock.eq = mockEq;
      return mock;
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

    const mockIncident = { 
      incident_id: 'inc-123', 
      name: 'Active Incident', 
      number: '1', 
      start_datetime: new Date().toISOString() 
    };

    vi.mocked(useAdminData).mockReturnValue({
      users: [],
      incidents: [mockIncident],
      responders: [{ responder_id: 'r1', status: 'Staged' }],
      vehicles: [],
      teams: [],
      assignments: [{ assignment_id: 'a1', status: 'Deployed' }],
      loading: false,
      refresh: vi.fn(),
      refreshAll: vi.fn(),
    });

    supabase.from.mockImplementation(() => {
      const mock = globalThis.createSupabaseQueryMock([]);
      mock.maybeSingle = vi.fn().mockResolvedValue({ data: { op_period_id: 'op-1' }, error: null });
      return mock;
    });

    render(<BrowserRouter><AdminPage /></BrowserRouter>);
    // Incident Management is expanded by default

    const endBtn = await screen.findByRole('button', { name: /End Incident/i });
    fireEvent.click(endBtn);

    await waitFor(() => {
      expect(supabase.from).toHaveBeenCalledWith('assignments');
      expect(supabase.from).toHaveBeenCalledWith('responders');
      expect(supabase.from).toHaveBeenCalledWith('incidents');
      expect(supabase.from).toHaveBeenCalledWith('action_logs');
    });
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

    vi.mocked(useAdminData).mockReturnValue({
      users: [],
      incidents: [],
      responders: [],
      vehicles: [],
      teams: [],
      assignments: [mockAsn],
      loading: false,
      refresh: vi.fn(),
      refreshAll: vi.fn(),
    });

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

    vi.mocked(useAdminData).mockReturnValue({
      users: [],
      incidents: [],
      responders: [mockRes],
      vehicles: [],
      teams: [],
      assignments: [],
      loading: false,
      refresh: vi.fn(),
      refreshAll: vi.fn(),
    });

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


    vi.mocked(useAdminData).mockReturnValue({
      users: mockUsers,
      incidents: [],
      responders: [],
      vehicles: [],
      teams: [],
      assignments: [],
      loading: false,
      refresh: vi.fn(),
      refreshAll: vi.fn(),
    });

    supabase.rpc.mockResolvedValue({ error: null });

    render(<BrowserRouter><AdminPage /></BrowserRouter>);
    // System Users is expanded by default
    
    const removeButtons = await screen.findAllByRole('button', { name: /Remove/i });
    fireEvent.click(removeButtons[0]);

    await waitFor(() => {
      expect(supabase.rpc).toHaveBeenCalledWith('admin_remove_user', { p_email: 'user1@example.com' });
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

  it('deactivates the operational session context without logging out', async () => {
    const mockClearIncident = vi.fn();
    vi.mocked(useIncident).mockReturnValue({
      isAdmin: true,
      isActive: true,
      responderId: 'res-123',
      responderStatus: 'Staged',
      clearIncident: mockClearIncident,
      incidentData: { name: 'Active Session' },
      operationsRefreshInterval: 30000,
      responderRefreshInterval: 30000,
      sartopoRefreshInterval: 30000,
    });

    supabase.from.mockImplementation(() => globalThis.createSupabaseQueryMock([]));

    render(<BrowserRouter><AdminPage /></BrowserRouter>); // Render AdminPage
    
    const leaveBtn = await screen.findByRole('button', { name: /Check out from Incident/i });
    fireEvent.click(leaveBtn);

    await waitFor(() => {
      expect(supabase.from).toHaveBeenCalledWith('responders');
      expect(mockClearIncident).toHaveBeenCalled();
    });
  });

  it('should allow selecting a new incident after leaving an active one', async () => {
    let isActive = true;
    const mockClearIncident = vi.fn(() => { isActive = false; });
    const mockSetIsAdmin = vi.fn();
    const mockSetResponderId = vi.fn();
    const mockSetResponderStatus = vi.fn();
    const mockSetResponderName = vi.fn();
    const mockSetAccessLevel = vi.fn();
    const mockStartIncident = vi.fn();

    vi.mocked(useIncident).mockImplementation(() => ({
      isAdmin: true,
      setIsAdmin: mockSetIsAdmin,
      logout: vi.fn(),
      isActive: isActive,
      responderId: 'res-123',
      responderStatus: 'Staged',
      clearIncident: mockClearIncident,
      incidentId: isActive ? 'inc-active' : null,
      incidentData: isActive ? { name: 'Active Session', opPeriodId: 'op-active' } : null,
      operationsRefreshInterval: 30000,
      responderRefreshInterval: 30000,
      sartopoRefreshInterval: 30000,
      setResponderId: mockSetResponderId,
      setResponderStatus: mockSetResponderStatus,
      setResponderName: mockSetResponderName,
      setAccessLevel: mockSetAccessLevel,
      startIncident: mockStartIncident,
    }));

    // Mock useAdminData to provide incidents for the dropdown
    vi.mocked(useAdminData).mockReturnValue({
      users: [{ email: 'admin@test.com', name: 'Admin User', access_level: 'admin' }],
      incidents: [{ 
        incident_id: 'inc-new', 
        name: 'New Incident', 
        number: '002', 
        end_datetime: null, 
        operational_periods: [{ 
          op_period_id: 'op-new', 
          op_number: 1,
          par_check_interval: 60
        }] 
      }],
      responders: [], vehicles: [], teams: [], assignments: [], loading: false, refresh: vi.fn(), refreshAll: vi.fn(),
    });
    localStorage.setItem('sarops_user_email', 'admin@test.com');

    render(<BrowserRouter><AdminPage /></BrowserRouter>);

    const leaveBtn = await screen.findByRole('button', { name: /Check out from Incident/i });
    fireEvent.click(leaveBtn);

    await waitFor(() => {
      expect(mockClearIncident).toHaveBeenCalled();
      expect(screen.queryByText(/Current Active Session/i)).not.toBeInTheDocument();
      expect(screen.getByLabelText(/Select Incident/i)).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /New Incident/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Check in to Incident/i })).toBeDisabled(); // Should be disabled until selected
    });

    // Select the new incident
    fireEvent.change(screen.getByLabelText(/Select Incident/i), { target: { value: 'inc-new' } });
    expect(screen.getByRole('button', { name: /Check in to Incident/i })).not.toBeDisabled();

    // Mock the rpc call for checkin_responder_securely
    supabase.auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'auth-uid', email: 'admin@test.com' } } }, error: null });
    supabase.rpc.mockImplementation(() => ({
      maybeSingle: vi.fn().mockResolvedValue({ 
        data: { responder_id: 'res-new', name: 'Admin User', status: 'Staged', access_level: 'admin' }, 
        error: null 
      })
    }));
    supabase.auth.refreshSession.mockResolvedValue({ data: { session: { user: { id: 'auth-uid' } } }, error: null });
    supabase.from.mockImplementation((table) => {
      if (table === 'operational_periods') return globalThis.createSupabaseQueryMock({ op_period_id: 'op-new', op_number: 1, par_check_interval: 60 });
      return globalThis.createSupabaseQueryMock([]);
    });

    fireEvent.click(screen.getByRole('button', { name: /Check in to Incident/i }));

    await waitFor(() => {
      expect(mockStartIncident).toHaveBeenCalledWith(
        'inc-new',
        'New Incident',
        1, // op_number
        'op-new', // op_period_id
        undefined, // sartopo_id
        60 // par_check_interval
      );
      expect(mockAddToast).toHaveBeenCalledWith(expect.stringContaining('Session activated'), 'success');
      expect(mockNavigate).toHaveBeenCalledWith('/operations');
    });
  });

  it('displays an error message if incident activation RPC fails', async () => {
    vi.mocked(useIncident).mockReturnValue({
      isAdmin: true,
      isActive: false,
      incidentId: null,
      startIncident: vi.fn(),
      incidentData: { name: '' },
    });

    const mockIncident = { 
      incident_id: 'i1', 
      name: 'Failed Inc', 
      number: '101', 
      start_datetime: new Date().toISOString(),
      operational_periods: [{ op_number: 1, op_period_id: 'op1' }]
    };

    vi.mocked(useAdminData).mockReturnValue({
      users: [{ email: 'admin@test.com' }],
      incidents: [mockIncident],
      responders: [],
      vehicles: [],
      teams: [],
      assignments: [],
      loading: false,
      refresh: vi.fn(),
      refreshAll: vi.fn(),
    });
    
    supabase.auth.getSession.mockResolvedValue({ data: { session: { user: { email: 'admin@test.com' } } } });
    supabase.rpc.mockImplementation(() => {
      const mock = globalThis.createSupabaseQueryMock(null, { message: 'RPC Activation Error' });
      mock.maybeSingle = vi.fn().mockReturnThis();
      return mock;
    });

    render(<BrowserRouter><AdminPage /></BrowserRouter>);

    const select = await screen.findByLabelText(/Select Incident/i);
    fireEvent.change(select, { target: { value: 'i1' } });
    fireEvent.click(screen.getByRole('button', { name: /Check in to Incident/i }));

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith(expect.stringContaining('RPC Activation Error'), 'error');
    });
  });

  it('applies system refresh intervals and updates global context', async () => {
    const mockSetOpsRate = vi.fn();
    vi.mocked(useIncident).mockReturnValue({
      isAdmin: true,
      setIsAdmin: vi.fn(),
      setOperationsRefreshInterval: mockSetOpsRate,
      setResponderRefreshInterval: vi.fn(),
      setSartopoRefreshInterval: vi.fn(),
      operationsRefreshInterval: 30000,
      responderRefreshInterval: 30000,
      sartopoRefreshInterval: 30000,
      incidentId: 'i1',
      incidentData: { name: 'Test Mission' }
    });

    render(<BrowserRouter><AdminPage /></BrowserRouter>);

    const opsInput = screen.getByLabelText(/Operations Refresh/i);
    fireEvent.change(opsInput, { target: { value: '45' } });

    const applyBtn = screen.getByRole('button', { name: /Apply/i });
    fireEvent.click(applyBtn);

    expect(mockSetOpsRate).toHaveBeenCalledWith(45000);
    expect(mockAddToast).toHaveBeenCalledWith('System refresh intervals updated successfully.', 'success');
  });
});
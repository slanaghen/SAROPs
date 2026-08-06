import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import AdminPage from './AdminPage';
import { useIncident } from '../context/IncidentContext';
import { useAdminData } from '../hooks/useAdminData';
import { useTeamActions } from '../hooks/useTeamActions';
import { useToast } from '../context/ToastContext';
import { supabase } from '../lib/supabase';

// Mock all dependencies
vi.mock('react-router-dom', async () => ({
  ...await vi.importActual('react-router-dom'),
  useNavigate: vi.fn(),
}));
vi.mock('../context/IncidentContext');
vi.mock('../hooks/useAdminData');
vi.mock('../hooks/useTeamActions');
vi.mock('../context/ToastContext');
vi.mock('../lib/supabase');

// Mock child components to isolate AdminPage logic
vi.mock('./AdminActivationSection', () => ({ default: () => <div data-testid="admin-activation-section" /> }));
vi.mock('./AdminSystemSettings', () => ({ default: () => <div data-testid="admin-system-settings" /> }));
vi.mock('./AdminDataManagement', () => ({ default: () => <div data-testid="admin-data-management" /> }));
vi.mock('../components/admin/AdminUsersTable', () => ({ default: ({ handleNewUser }) => <button onClick={handleNewUser}>New User</button> }));
vi.mock('../components/admin/AdminRespondersTable', () => ({ default: ({ handleNewResponder }) => <button onClick={handleNewResponder}>New Responder</button> }));
vi.mock('../components/admin/AdminVehiclesTable', () => ({ default: ({ handleNewVehicle }) => <button onClick={handleNewVehicle}>New Vehicle</button> }));
vi.mock('../components/admin/AdminTeamsTable', () => ({ default: ({ handleNewTeam }) => <button onClick={handleNewTeam}>New Team</button> }));
vi.mock('../components/admin/AdminAssignmentsTable', () => ({ default: ({ handleNewAssignment }) => <button onClick={handleNewAssignment}>New Assignment</button> }));
vi.mock('../components/admin/AdminIncidentsTable', () => ({ default: ({ handleNewIncident }) => <button onClick={handleNewIncident}>New Incident</button> }));

// Mock modals
vi.mock('../components/admin/AdminUserFormModal', () => ({ default: ({ isOpen }) => isOpen ? <div data-testid="user-modal" /> : null }));
vi.mock('../components/responder/ResponderFormModal', () => ({ default: ({ isOpen }) => isOpen ? <div data-testid="responder-modal" /> : null }));
vi.mock('../components/admin/VehicleFormModal', () => ({ default: ({ isOpen }) => isOpen ? <div data-testid="vehicle-modal" /> : null }));
vi.mock('../components/team/TeamFormModal', () => ({ default: ({ isOpen }) => isOpen ? <div data-testid="team-modal" /> : null }));
vi.mock('../components/AssignmentFormModal', () => ({ default: ({ isOpen }) => isOpen ? <div data-testid="assignment-modal" /> : null }));

describe('AdminPage', () => {
  const mockRefreshDashboardData = vi.fn();
  const mockFetchTable = vi.fn();
  const mockNavigate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useNavigate).mockReturnValue(mockNavigate);
    vi.mocked(useIncident).mockReturnValue({ isAdmin: true, incidentId: 'inc-123', responderName: 'Admin User' });
    vi.mocked(useAdminData).mockReturnValue({ users: [], incidents: [], responders: [], teams: [], assignments: [], vehicles: [], loading: false, refresh: mockFetchTable, refreshAll: mockRefreshDashboardData });
    vi.mocked(useTeamActions).mockReturnValue({ updateTeam: vi.fn(), createTeam: vi.fn() });
    vi.mocked(useToast).mockReturnValue({ addToast: vi.fn() });
  });

  it('redirects if user is not an admin', () => {
    vi.mocked(useIncident).mockReturnValue({ isAdmin: false });
    render(<MemoryRouter><AdminPage /></MemoryRouter>);
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });

  it('fetches data on mount when user is admin', () => {
    render(<MemoryRouter><AdminPage /></MemoryRouter>);
    expect(mockRefreshDashboardData).toHaveBeenCalled();
    expect(mockFetchTable).toHaveBeenCalledWith('vehicles');
    expect(mockFetchTable).toHaveBeenCalledWith('responders');
  });

  it('opens the correct modal when a "New" button is clicked', () => {
    render(<MemoryRouter><AdminPage /></MemoryRouter>);

    fireEvent.click(screen.getByText('New User'));
    expect(screen.getByTestId('user-modal')).toBeInTheDocument();

    fireEvent.click(screen.getByText('New Responder'));
    expect(screen.getByTestId('responder-modal')).toBeInTheDocument();

    fireEvent.click(screen.getByText('New Vehicle'));
    expect(screen.getByTestId('vehicle-modal')).toBeInTheDocument();

    fireEvent.click(screen.getByText('New Team'));
    expect(screen.getByTestId('team-modal')).toBeInTheDocument();

    fireEvent.click(screen.getByText('New Assignment'));
    expect(screen.getByTestId('assignment-modal')).toBeInTheDocument();
  });

  it('calls navigate when "New Incident" is clicked', () => {
    render(<MemoryRouter><AdminPage /></MemoryRouter>);
    fireEvent.click(screen.getByText('New Incident'));
    expect(mockNavigate).toHaveBeenCalledWith('/incident', { state: { fromAdmin: true } });
  });
});
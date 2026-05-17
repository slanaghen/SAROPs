import { render, screen } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import App from './App';
import { useIncident } from './context/IncidentContext';

expect.extend(matchers);

vi.mock('./context/IncidentContext', () => ({
  useIncident: vi.fn(),
}));

vi.mock('./lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
  },
}));

describe('App Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the branding and guest status by default', () => {
    vi.mocked(useIncident).mockReturnValue({
      isActive: false,
      isAdmin: false,
      incidentData: null,
      responderName: null,
      responderStatus: null,
      logout: vi.fn(),
    });

    render(<MemoryRouter><App /></MemoryRouter>);
    expect(screen.getByText('SAROps')).toBeInTheDocument();
    expect(screen.getByText('Guest')).toBeInTheDocument();
  });

  it('shows incident name in banner when active', () => {
    vi.mocked(useIncident).mockReturnValue({
      isActive: true,
      isAdmin: false,
      incidentData: { name: 'Mountain Rescue', opNumber: '1' },
      responderName: 'Steve',
      responderStatus: 'Staged',
      logout: vi.fn(),
    });

    render(<MemoryRouter><App /></MemoryRouter>);
    expect(screen.getByText('Mountain Rescue')).toBeInTheDocument();
    expect(screen.getByText('Steve')).toBeInTheDocument();
  });
});
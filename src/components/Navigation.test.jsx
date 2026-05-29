import { render, screen, cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
import { vi, describe, it, expect, afterEach, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Navigation from './Navigation';
import { useIncident } from '../context/IncidentContext';

expect.extend(matchers);

vi.mock('../context/IncidentContext', () => ({
  useIncident: vi.fn(),
}));

afterEach(() => {
  cleanup();
});

describe('Navigation Component', () => {
  beforeEach(() => {
    vi.mocked(useIncident).mockReturnValue({
      isAdmin: false,
    });
  });

  it('renders all navigation links with correct text', () => {
    render(
      <MemoryRouter>
        <Navigation />
      </MemoryRouter>
    );

    expect(screen.getByText(/Operations/i)).toBeInTheDocument();
    expect(screen.getByText(/Planning/i)).toBeInTheDocument();
    expect(screen.getByText(/Check-In/i)).toBeInTheDocument();
    expect(screen.getByText(/Check-Out/i)).toBeInTheDocument();
    expect(screen.getByText(/My Dashboard/i)).toBeInTheDocument();
    expect(screen.getByText(/Incident/i)).toBeInTheDocument();
    expect(screen.getByText(/Login/i)).toBeInTheDocument();
  });

  it('renders the Admin link instead of Login when user is an admin', () => {
    vi.mocked(useIncident).mockReturnValue({
      isAdmin: true,
    });

    render(
      <MemoryRouter>
        <Navigation />
      </MemoryRouter>
    );

    expect(screen.getByText(/Admin/i)).toBeInTheDocument();
    expect(screen.queryByText(/Login/i)).not.toBeInTheDocument();
  });

  it('applies the active class to the tab matching the current path', () => {
    render(
      <MemoryRouter initialEntries={['/operations']}>
        <Navigation />
      </MemoryRouter>
    );

    const operationsTab = screen.getByText(/Operations/i);
    expect(operationsTab).toHaveClass('active');

    const planningTab = screen.getByText(/Planning/i);
    expect(planningTab).not.toHaveClass('active');
  });

  it('uses prefix matching for the planning tab', () => {
    render(
      <MemoryRouter initialEntries={['/planning/some-uuid']}>
        <Navigation />
      </MemoryRouter>
    );
    expect(screen.getByText(/Planning/i)).toHaveClass('active');
  });
});
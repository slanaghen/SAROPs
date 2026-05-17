import { render, screen, cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
import { vi, describe, it, expect, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Navigation from './Navigation';

expect.extend(matchers);

afterEach(() => {
  cleanup();
});

describe('Navigation Component', () => {
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
    expect(screen.getByText(/Incident Editor/i)).toBeInTheDocument();
    expect(screen.getByText(/Admin/i)).toBeInTheDocument();
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
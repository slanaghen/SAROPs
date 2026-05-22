import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter, useRouteError } from 'react-router-dom';
import ErrorPage from './ErrorPage';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useRouteError: vi.fn(),
    useNavigate: () => vi.fn(),
  };
});

describe('ErrorPage', () => {
  it('renders technical error messages from router state', () => {
    vi.mocked(useRouteError).mockReturnValue({ 
      statusText: 'Not Found', 
      message: 'Failed to fetch database record' 
    });

    render(
      <MemoryRouter>
        <ErrorPage />
      </MemoryRouter>
    );

    expect(screen.getByText(/Mission Interrupted/i)).toBeInTheDocument();
    expect(screen.getByText(/Not Found/i)).toBeInTheDocument();
  });

  it('renders a fallback message if no error detail is provided', () => {
    vi.mocked(useRouteError).mockReturnValue(null);
    render(<MemoryRouter><ErrorPage /></MemoryRouter>);
    expect(screen.getByText(/The application encountered an unexpected error/i)).toBeInTheDocument();
  });
});
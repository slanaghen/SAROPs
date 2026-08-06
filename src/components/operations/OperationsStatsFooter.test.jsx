import { render, screen, within } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import OperationsStatsFooter from './OperationsStatsFooter';

describe('OperationsStatsFooter', () => {
  const mockStats = {
    teams: { staged: 1, assigned: 2, deployed: 3, total: 6 },
    assignments: { planned: 4, assigned: 2, deployed: 3, complete: 1, incomplete: 0, total: 10 },
    responders: { staged: 5, attached: 5, assigned: 5, deployed: 5, total: 20 },
  };

  it('renders all stats correctly', () => {
    render(<OperationsStatsFooter stats={mockStats} rows={[]} currentTime={Date.now()} />);

    // Scope queries to each section to avoid ambiguity
    const teamsSection = screen.getByText('Teams').parentElement;
    const assignmentsSection = screen.getByText('Assignments').parentElement;
    const respondersSection = screen.getByText('Responders').parentElement;

    // Team Stats
    expect(within(teamsSection).getByText(/Staged: 1/)).toBeInTheDocument();
    expect(within(teamsSection).getByText(/Assigned: 2/)).toBeInTheDocument();
    expect(within(teamsSection).getByText(/Deployed: 3/)).toBeInTheDocument();
    expect(within(teamsSection).getByText(/Total: 6/)).toBeInTheDocument();

    // Assignment Stats
    expect(within(assignmentsSection).getByText(/Planned: 4/)).toBeInTheDocument();
    expect(within(assignmentsSection).getByText(/Assigned: 2/)).toBeInTheDocument();
    expect(within(assignmentsSection).getByText(/Complete: 1/)).toBeInTheDocument();

    // Responder Stats
    expect(within(respondersSection).getByText(/Attached: 5/)).toBeInTheDocument();
    expect(within(respondersSection).getByText(/Assigned: 5/)).toBeInTheDocument();
  });

  it('calculates and displays the correct overdue count', () => {
    const mockRows = [
      { isParOverdue: true },
      { isParOverdue: false },
      { isParOverdue: true },
    ];
    render(<OperationsStatsFooter stats={mockStats} rows={mockRows} currentTime={Date.now()} />);

    // The text "Overdue: 2" is split, so we find the parent and check its text content.
    const teamsSection = screen.getByText('Teams').parentElement;
    expect(teamsSection).toHaveTextContent(/Overdue: 2/);

    // To check the style, we specifically target the span containing the number.
    const overdueValueSpan = within(teamsSection).getByText('2');
    expect(overdueValueSpan).toHaveStyle('color: #dc2626');
  });

  it('handles null or undefined stats gracefully', () => {
    render(<OperationsStatsFooter stats={null} rows={[]} currentTime={Date.now()} />);

    // Scope queries to avoid ambiguity since "Staged: 0" and "Total: 0" appear multiple times
    const teamsSection = screen.getByText('Teams').parentElement;
    expect(within(teamsSection).getByText(/Staged: 0/)).toBeInTheDocument();
    expect(within(teamsSection).getByText(/Total: 0/)).toBeInTheDocument();

    const respondersSection = screen.getByText('Responders').parentElement;
    expect(within(respondersSection).getByText(/Staged: 0/)).toBeInTheDocument();
    expect(within(respondersSection).getByText(/Total: 0/)).toBeInTheDocument();
  });
});
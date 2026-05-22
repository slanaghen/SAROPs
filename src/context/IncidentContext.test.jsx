import React from 'react';
import { render, act, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IncidentProvider, useIncident } from './IncidentContext';

const TestComponent = () => {
  const { isActive, startIncident, logout, incidentId } = useIncident();
  return (
    <div>
      <div data-testid="active-status">{isActive ? 'Active' : 'Inactive'}</div>
      <div data-testid="incident-id">{incidentId || 'None'}</div>
      <button onClick={() => startIncident('2026-001', 'Test Mission', '1', 'op-uuid')}>Start</button>
      <button onClick={logout}>Logout</button>
    </div>
  );
};

describe('IncidentContext', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('starts in an inactive state by default', () => {
    render(
      <IncidentProvider>
        <TestComponent />
      </IncidentProvider>
    );
    expect(screen.getByTestId('active-status')).toHaveTextContent('Inactive');
  });

  it('correctly transitions to active and persists to localStorage', () => {
    render(
      <IncidentProvider>
        <TestComponent />
      </IncidentProvider>
    );

    act(() => {
      screen.getByText('Start').click();
    });

    expect(screen.getByTestId('active-status')).toHaveTextContent('Active');
    expect(screen.getByTestId('incident-id')).toHaveTextContent('2026-001');
    
    const stored = JSON.parse(localStorage.getItem('sarops_incident_session'));
    expect(stored.isActive).toBe(true);
    expect(stored.incidentId).toBe('2026-001');
  });

  it('clears state and localStorage on logout', () => {
    localStorage.setItem('sarops_incident_session', JSON.stringify({ isActive: true, incidentId: '123' }));
    render(<IncidentProvider><TestComponent /></IncidentProvider>);
    
    act(() => { screen.getByText('Logout').click(); });

    expect(screen.getByTestId('active-status')).toHaveTextContent('Inactive');
    expect(localStorage.getItem('sarops_incident_session')).toBeNull();
  });

  it('gracefully handles corrupted JSON in localStorage and uses defaults', () => {
    localStorage.setItem('sarops_incident_session', '{{{ invalid json');
    render(
      <IncidentProvider>
        <TestComponent />
      </IncidentProvider>
    );
    expect(screen.getByTestId('active-status')).toHaveTextContent('Inactive');
    expect(screen.getByTestId('incident-id')).toHaveTextContent('None');
  });
});
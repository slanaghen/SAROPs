import { render, act, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { IncidentProvider, useIncident } from './IncidentContext';
import React from 'react';

const TestComponent = () => {
  const { isActive, startIncident, logout, incidentData } = useIncident();
  return (
    <div>
      <div data-testid="status">{isActive ? 'Active' : 'Inactive'}</div>
      <div data-testid="name">{incidentData.name}</div>
      <button onClick={() => startIncident('1', 'Test Search', '1', 'op-1')}>Start</button>
      <button onClick={logout}>Logout</button>
    </div>
  );
};

describe('IncidentContext', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('provides default initial state', () => {
    const { getByTestId } = render(
      <IncidentProvider>
        <TestComponent />
      </IncidentProvider>
    );
    expect(getByTestId('status').textContent).toBe('Inactive');
  });

  it('updates state and persists to localStorage on startIncident', () => {
    const { getByTestId, getByText } = render(
      <IncidentProvider>
        <TestComponent />
      </IncidentProvider>
    );

    act(() => {
      getByText('Start').click();
    });

    expect(getByTestId('status').textContent).toBe('Active');
    expect(getByTestId('name').textContent).toBe('Test Search');
    expect(localStorage.getItem('sarops_incident_session')).toContain('Test Search');
  });

  it('clears state on logout', () => {
    const { getByTestId, getByText } = render(<IncidentProvider><TestComponent /></IncidentProvider>);
    
    act(() => { getByText('Start').click(); });
    act(() => { getByText('Logout').click(); });

    expect(getByTestId('status').textContent).toBe('Inactive');
    expect(localStorage.getItem('sarops_incident_session')).toBeNull();
  });
});
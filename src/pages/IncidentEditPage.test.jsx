import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
import { vi, describe, it, expect, afterEach, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import IncidentEditPage from './IncidentEditPage';
import { useIncident } from '../context/IncidentContext';

expect.extend(matchers);

vi.mock('../context/IncidentContext', () => ({
  useIncident: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: vi.fn().mockResolvedValue({ error: null }),
    })),
  },
}));

afterEach(cleanup);

describe('IncidentEditPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useIncident).mockReturnValue({
      isActive: false,
      incidentId: null,
      incidentData: { name: '', opNumber: '', opPeriodId: '' },
      startIncident: vi.fn(),
      endIncident: vi.fn(),
    });
  });

  it('renders the form with default values', () => {
    render(<MemoryRouter><IncidentEditPage /></MemoryRouter>);
    expect(screen.getByDisplayValue('Missing Person Search')).toBeInTheDocument();
  });

  it('updates form fields on change', () => {
    render(<MemoryRouter><IncidentEditPage /></MemoryRouter>);
    const nameInput = screen.getByLabelText(/Incident Name/i);
    
    fireEvent.change(nameInput, { target: { value: 'Wildfire Response' } });
    expect(nameInput.value).toBe('Wildfire Response');
  });

  it('displays the End Incident button only when an incident is active', () => {
    // Mocking active state specifically for this test
    vi.mocked(useIncident).mockReturnValue({ 
      isActive: true, 
      incidentId: '123',
      incidentData: { name: 'Active Incident', opNumber: '1', opPeriodId: 'op1' },
      startIncident: vi.fn(),
      endIncident: vi.fn(),
    });
    
    render(<MemoryRouter><IncidentEditPage /></MemoryRouter>);
    expect(screen.getByText(/End Incident/i)).toBeInTheDocument();
  });
});
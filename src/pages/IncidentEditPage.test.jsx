import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
import { vi, describe, it, expect, afterEach, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import IncidentEditPage from './IncidentEditPage';
import { useIncident } from '../context/IncidentContext';

expect.extend(matchers);

vi.mock('../context/IncidentContext', () => ({
  useIncident: vi.fn(),
}));

// Flexible Supabase Mock for CRUD tracking
const mockFrom = vi.fn();
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: (table) => mockFrom(table),
  },
}));

const createMockChain = (resolvedValue = { error: null }) => ({
  insert: vi.fn().mockResolvedValue(resolvedValue),
  update: vi.fn().mockReturnThis(),
  eq: vi.fn().mockResolvedValue(resolvedValue),
});

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
      incidentId: 'cc5b10f5-fe2f-4748-9df3-33f6c083e51b',
      incidentData: { name: 'Active Incident', opNumber: '1', opPeriodId: '1e7148f1-ad69-4c24-a25f-8a074a5033f8' },
      startIncident: vi.fn(),
      endIncident: vi.fn(),
    });
    
    render(<MemoryRouter><IncidentEditPage /></MemoryRouter>);
    expect(screen.getByText(/End Incident/i)).toBeInTheDocument();
  });

  it('persists new incident and operational period to database on create', async () => {
    const chain = createMockChain();
    mockFrom.mockReturnValue(chain);

    render(<MemoryRouter><IncidentEditPage /></MemoryRouter>);
    fireEvent.submit(screen.getByRole('button', { name: /Start Incident Tracking/i }));

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith('incidents');
      expect(mockFrom).toHaveBeenCalledWith('operational_periods');
      expect(chain.insert).toHaveBeenCalled();
    });
  });

  it('persists updates to database when an incident is active', async () => {
    const chain = createMockChain();
    mockFrom.mockReturnValue(chain);

    // Setup active state
    vi.mocked(useIncident).mockReturnValue({ 
      isActive: true, 
      incidentId: 'cc5b10f5-fe2f-4748-9df3-33f6c083e51b',
      incidentData: { name: 'Old Name', opNumber: '1', opPeriodId: '1e7148f1-ad69-4c24-a25f-8a074a5033f8' },
      startIncident: vi.fn(),
      endIncident: vi.fn(),
    });
    
    render(<MemoryRouter><IncidentEditPage /></MemoryRouter>);
    
    const nameInput = screen.getByLabelText(/Incident Name/i);
    fireEvent.change(nameInput, { target: { value: 'Updated Mission Name' } });
    
    fireEvent.submit(screen.getByRole('button', { name: /Update Incident Information/i }));

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith('incidents');
      expect(chain.update).toHaveBeenCalledWith(expect.objectContaining({
        name: 'Updated Mission Name'
      }));
    });
  });
});
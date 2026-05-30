import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import GoogleICSFormsPage from './GoogleICSFormsPage';
import { useIncident } from '../context/IncidentContext';
import { supabase } from '../lib/supabase';

vi.mock('../context/IncidentContext', () => ({
  useIncident: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => {
      const mock = globalThis.createSupabaseQueryMock([]);
      mock.maybeSingle = vi.fn().mockReturnThis();
      return mock;
    }),
  },
}));

describe('GoogleICSFormsPage', () => {
  const mockApiKey = 'MOCK_GOOGLE_KEY';
  
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('VITE_GOOGLE_SHEETS_API_KEY', mockApiKey);
    global.fetch = vi.fn();

    vi.mocked(useIncident).mockReturnValue({
      incidentData: { opPeriodId: 'op-123', opNumber: '1', name: 'Test Incident' },
      incidentId: 'inc-123',
      responderId: 'res-123',
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  it('renders the input field and disables load when empty', () => {
    render(<GoogleICSFormsPage />);
    const loadButton = screen.getByRole('button', { name: /Load/i });
    expect(loadButton).toBeDisabled();
  });

  it('displays named ranges when a valid URL is loaded', async () => {
    const mockData = { namedRanges: [{ name: 'IncidentName' }, { name: 'OpPeriod' }] };
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockData),
    });

    render(<GoogleICSFormsPage />);
    const urlInput = screen.getByPlaceholderText(/docs\.google\.com/i);
    fireEvent.change(urlInput, { target: { value: 'https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit' } });
    
    fireEvent.click(screen.getByRole('button', { name: /Load/i }));

    await waitFor(() => {
      expect(screen.getByText('IncidentName')).toBeInTheDocument();
      expect(screen.getByText('OpPeriod')).toBeInTheDocument();
      expect(screen.getByText(/Detected Named Ranges \(2\)/i)).toBeInTheDocument();
    });
  });

  it('handles API errors gracefully', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: () => Promise.resolve({ error: { message: 'API key not valid' } }),
    });

    render(<GoogleICSFormsPage />);
    fireEvent.change(screen.getByPlaceholderText(/docs\.google\.com/i), { target: { value: 'https://docs.google.com/spreadsheets/d/123/edit' } });
    fireEvent.click(screen.getByRole('button', { name: /Load/i }));

    await waitFor(() => {
      expect(screen.getByText(/API key not valid/i)).toBeInTheDocument();
    });
  });

  it('manually associates context fields with named ranges via drag and drop', async () => {
    const mockData = { namedRanges: [{ name: 'MissionName' }] };
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockData),
    });

    render(<GoogleICSFormsPage />);
    fireEvent.change(screen.getByPlaceholderText(/docs\.google\.com/i), { target: { value: 'https://docs.google.com/spreadsheets/d/123/edit' } });
    fireEvent.click(screen.getByRole('button', { name: /Load/i }));

    const rangeElement = await screen.findByText('MissionName');
    const fieldElement = screen.getByText('incident_name');

    // Simulate DnD DataTransfer
    const dataTransfer = { setData: vi.fn(), getData: vi.fn().mockReturnValue('incident_name') };
    fireEvent.dragStart(fieldElement.closest('div[draggable]'), { dataTransfer });
    fireEvent.drop(rangeElement.closest('div[style*="font-family: monospace"]'), { dataTransfer });

    expect(screen.getByText('(incident_name)')).toBeInTheDocument();
  });

  it('removes an existing association when the remove button is clicked', async () => {
    const mockData = { namedRanges: [{ name: 'MissionName' }] };
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockData),
    });

    render(<GoogleICSFormsPage />);
    fireEvent.change(screen.getByPlaceholderText(/docs\.google\.com/i), { target: { value: 'https://docs.google.com/spreadsheets/d/123/edit' } });
    fireEvent.click(screen.getByRole('button', { name: /Load/i }));

    const rangeElement = await screen.findByText('MissionName');
    const dataTransfer = { setData: vi.fn(), getData: vi.fn().mockReturnValue('incident_name') };
    
    // Add association first
    fireEvent.drop(rangeElement.closest('div[style*="font-family: monospace"]'), { dataTransfer });
    expect(screen.getByText('(incident_name)')).toBeInTheDocument();

    // Remove association
    fireEvent.click(screen.getByTitle(/Remove association/i));
    expect(screen.queryByText('(incident_name)')).not.toBeInTheDocument();
  });
});
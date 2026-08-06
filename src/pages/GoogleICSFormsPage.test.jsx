import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import GoogleICSFormsPage from './GoogleICSFormsPage';
import { useIncident } from '../context/IncidentContext';
import { useToast } from '../context/ToastContext';

// Mock dependencies
vi.mock('../context/IncidentContext');
vi.mock('../context/ToastContext');

describe('GoogleICSFormsPage', () => {
  const mockAddToast = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
    vi.mocked(useIncident).mockReturnValue({
      incidentData: { name: 'Test Incident', opNumber: '1' },
      incidentId: 'inc-123',
    });
    vi.mocked(useToast).mockReturnValue({ addToast: mockAddToast });
  });

  it('renders the initial state correctly', () => {
    render(<GoogleICSFormsPage />);
    expect(screen.getByRole('heading', { name: /Google Forms/i })).toBeInTheDocument();
    expect(screen.getByText(/No named ranges loaded/i)).toBeInTheDocument();
  });

  it('shows an error toast for an invalid Google Sheets URL', async () => {
    render(<GoogleICSFormsPage />);
    const urlInput = screen.getByLabelText(/Google Sheet URL/i);
    fireEvent.change(urlInput, { target: { value: 'not-a-url' } });
    fireEvent.click(screen.getByRole('button', { name: /Load/i }));

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith(expect.stringContaining('Invalid URL'), 'error');
    });
  });

  it('fetches and displays named ranges on load', async () => {
    const mockRanges = { namedRanges: [{ name: 'IncidentName' }, { name: 'OpPeriod' }] };
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => mockRanges,
    });

    render(<GoogleICSFormsPage />);
    fireEvent.click(screen.getByRole('button', { name: /Load/i }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/sheets/named-ranges', expect.any(Object));
      expect(screen.getByText('IncidentName')).toBeInTheDocument();
      expect(screen.getByText('OpPeriod')).toBeInTheDocument();
    });
  });

  it('allows associating a context field with a named range via drag and drop', async () => {
    const mockRanges = { namedRanges: [{ name: 'IncidentName' }] };
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => mockRanges });

    render(<GoogleICSFormsPage />);
    fireEvent.click(screen.getByRole('button', { name: /Load/i }));

    const contextField = await screen.findByText('incident_name');
    const namedRangeTarget = await screen.findByText('IncidentName');

    const dataTransfer = {
      setData: vi.fn(),
      getData: vi.fn().mockReturnValue('incident_name'),
    };

    fireEvent.dragStart(contextField, { dataTransfer });
    fireEvent.drop(namedRangeTarget, { dataTransfer });

    await waitFor(() => {
      // Check that the association is displayed
      expect(screen.getByText('(incident_name)')).toBeInTheDocument();
    });
  });

  it('sends the correct data to the proxy on "Transfer Data"', async () => {
    // 1. Load ranges
    const mockRanges = { namedRanges: [{ name: 'IncidentNameRange' }, { name: 'OpPeriodRange' }] };
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => mockRanges });
    render(<GoogleICSFormsPage />);
    fireEvent.click(screen.getByRole('button', { name: /Load/i }));

    // 2. Create associations
    const incidentNameField = await screen.findByText('incident_name');
    const opPeriodField = await screen.findByText('op_period_number');
    const incidentNameTarget = await screen.findByText('IncidentNameRange');
    const opPeriodTarget = await screen.findByText('OpPeriodRange');
    const dt = { setData: vi.fn(), getData: vi.fn() };

    dt.getData.mockReturnValue('incident_name');
    fireEvent.dragStart(incidentNameField, { dataTransfer: dt });
    fireEvent.drop(incidentNameTarget, { dataTransfer: dt });

    dt.getData.mockReturnValue('op_period_number');
    fireEvent.dragStart(opPeriodField, { dataTransfer: dt });
    fireEvent.drop(opPeriodTarget, { dataTransfer: dt });

    // 3. Click Transfer
    vi.mocked(fetch).mockClear(); // Clear previous fetch calls
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({}) }); // Mock for the update call
    fireEvent.click(screen.getByRole('button', { name: /Transfer Data/i }));

    // 4. Assert the correct payload was sent
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/sheets/update-values', expect.any(Object));
      const fetchOptions = vi.mocked(fetch).mock.calls[0][1];
      const body = JSON.parse(fetchOptions.body);
      expect(body.values).toEqual({
        IncidentNameRange: 'Test Incident',
        OpPeriodRange: '1',
      });
      expect(mockAddToast).toHaveBeenCalledWith(expect.stringContaining('Data successfully transferred'), 'success');
    });
  });
});
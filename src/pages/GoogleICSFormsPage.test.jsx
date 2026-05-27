import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import GoogleICSFormsPage from './GoogleICSFormsPage';

describe('GoogleICSFormsPage', () => {
  const mockApiKey = 'MOCK_GOOGLE_KEY';
  
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('VITE_GOOGLE_SHEETS_API_KEY', mockApiKey);
    global.fetch = vi.fn();
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
});
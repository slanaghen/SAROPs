import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import QRCodesPage from './QRCodesPage';
import { useIncident } from '../context/IncidentContext';
import { supabase } from '../lib/supabase';

vi.mock('../context/IncidentContext', () => ({
  useIncident: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    })),
    removeChannel: vi.fn(),
  },
}));

describe('QRCodesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders generic check-in QR code when no incident is active', async () => {
    vi.mocked(useIncident).mockReturnValue({ isActive: false, user: { email: 'test@example.com' } });
    render(<QRCodesPage />);

    expect(await screen.findByText('General Incident Access')).toBeInTheDocument();
    const checkinImg = screen.getByAltText('Check-in QR');
    expect(checkinImg.src).toContain(encodeURIComponent('/checkin'));
  });

  it('fetches and displays SARTopo QR code when configured', async () => {
    vi.mocked(useIncident).mockReturnValue({ 
      isActive: true, 
      incidentId: 'inc-123',
      incidentData: { name: 'Test Mission', opNumber: '1' },
      user: { email: 'test@example.com' }
    });

    supabase.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { sartopo_id: 'MAP99' }, error: null })
    });

    render(<QRCodesPage />);

    await waitFor(() => {
      expect(screen.getByText(/Operational Map ID: MAP99/i)).toBeInTheDocument();
      expect(screen.getByAltText('Map QR').src).toContain('MAP99');
    });
  });

  it('triggers window print when the print button is clicked', async () => {
    vi.mocked(useIncident).mockReturnValue({ isActive: false, user: { email: 'test@example.com' } });
    window.print = vi.fn();
    
    render(<QRCodesPage />);
    fireEvent.click(await screen.findByText(/Print \/ Save as PDF/i));
    
    expect(window.print).toHaveBeenCalled();
  });
});
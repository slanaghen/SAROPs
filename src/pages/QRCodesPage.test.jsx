import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import QRCodesPage from './QRCodesPage';
import { useIncident } from '../context/IncidentContext';
import { supabase } from '../lib/supabase';

// Mock dependencies
vi.mock('../context/IncidentContext');
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(),
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
    })),
    removeChannel: vi.fn(),
  },
}));

describe('QRCodesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all QR codes when data is available', async () => {
    vi.mocked(useIncident).mockReturnValue({
      isActive: true,
      incidentId: 'inc-123',
      incidentData: { name: 'Test Incident', opNumber: '1', opPeriodId: 'op-123' },
    });

    vi.mocked(supabase.from).mockImplementation((table) => {
      if (table === 'incidents') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: { sartopo_id: 'MAP123' }, error: null }),
        };
      }
      if (table === 'operational_periods') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { sarstream_enabled: true, sarstream_data: { view_url: 'https://sarstream.example.com' } },
            error: null,
          }),
        };
      }
      return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) };
    });

    render(<MemoryRouter><QRCodesPage /></MemoryRouter>);

    // Wait for data to load and check for all three QR codes
    await waitFor(() => {
      const images = screen.getAllByRole('img');
      expect(images).toHaveLength(3);

      // Check-in QR
      expect(images[0]).toHaveAttribute('src', expect.stringContaining(encodeURIComponent('/checkin')));
      
      // SARTopo QR
      expect(screen.getByText(/Operational Map ID: MAP123/i)).toBeInTheDocument();
      expect(images[1]).toHaveAttribute('src', expect.stringContaining(encodeURIComponent('https://sartopo.com/m/MAP123')));

      // SARStream QR
      expect(screen.getByText(/Scan for Live Stream/i)).toBeInTheDocument();
      expect(images[2]).toHaveAttribute('src', expect.stringContaining(encodeURIComponent('https://sarstream.example.com')));
    });
  });

});
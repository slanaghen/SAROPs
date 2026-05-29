import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import ResponderCheckin from './ResponderCheckin';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getResponderByIdentifier } from '../services/responderService';

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

vi.mock('../services/responderService', () => ({
  getResponderByIdentifier: vi.fn(),
}));

describe('ResponderCheckin confirmation screen', () => {
  it('renders entered values in confirmation and uses white detail styles', async () => {
    vi.mocked(getResponderByIdentifier).mockResolvedValue(null);
    const mockIncidents = [{ incident_id: 'inc-123', name: 'Test Incident', number: '2024-001' }];
    render(
      <MemoryRouter>
        <ResponderCheckin 
          onCheckIn={async () => {}} 
          incidents={mockIncidents}
          selectedIncidentId="inc-123"
        />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/Full Name/i), {
      target: { value: 'asdf' },
    });
    fireEvent.change(screen.getByLabelText(/Agency/i), {
      target: { value: 'asdf' },
    });
    fireEvent.change(screen.getByLabelText(/Identifier/i), {
      target: { value: 'asdf' },
    });
    fireEvent.change(screen.getByLabelText(/Cell Phone Number/i), {
      target: { value: '1231234567' },
    });
    const skillsSelect = screen.getByLabelText(/Special Skills/i);
    const medicalOption = screen.getByRole('option', { name: 'Medical' }) as HTMLOptionElement;
    medicalOption.selected = true;
    fireEvent.change(skillsSelect);
    fireEvent.click(screen.getByLabelText('SAR'));

    fireEvent.click(screen.getByRole('button', { name: /Continue to Confirmation/i }));

    expect(await screen.findByText(/Confirm Your Information/i)).toBeTruthy();
    expect(screen.getAllByText('asdf').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('123-123-4567')).toBeTruthy();
    expect(screen.getByText('Medical')).toBeTruthy();

    const css = readFileSync(join(process.cwd(), 'src/styles/ResponderCheckin.css'), 'utf-8');
    expect(css).toContain('.detail-label');
    expect(css).toContain('.detail-value');
    expect(css).toContain('color: white');
  });

  it('returns to edit mode when "Back to Edit" is clicked on confirmation screen', async () => {
    vi.mocked(getResponderByIdentifier).mockResolvedValue(null);
    render(
      <MemoryRouter>
        <ResponderCheckin 
          onCheckIn={async () => {}} 
          incidents={[{ incident_id: 'i1', name: 'Inc 1', number: '1' }]}
          selectedIncidentId="i1"
        />
      </MemoryRouter>
    );

    // Fill form and continue
    fireEvent.change(screen.getByLabelText(/Full Name/i), { target: { value: 'Steve' } });
    fireEvent.change(screen.getByLabelText(/Agency/i), { target: { value: 'SAR' } });
    fireEvent.change(screen.getByLabelText(/Identifier/i), { target: { value: 'ID1' } });
    fireEvent.change(screen.getByLabelText(/Cell Phone Number/i), { target: { value: '1234567890' } });
    fireEvent.click(screen.getByLabelText('SAR'));
    fireEvent.click(screen.getByRole('button', { name: /Continue to Confirmation/i }));

    // Verify confirmation screen
    expect(await screen.findByText(/Confirm Your Information/i)).toBeTruthy();

    // Click Back to Edit and verify form state is restored
    fireEvent.click(screen.getByRole('button', { name: /Back to Edit/i }));
    expect(screen.queryByText(/Confirm Your Information/i)).toBeNull();
    expect(screen.getByLabelText(/Full Name/i)).toHaveValue('Steve');
  });

  it('captures the selected responder type via radio buttons', async () => {
    const onCheckIn = vi.fn();
    render(
      <MemoryRouter>
        <ResponderCheckin 
          onCheckIn={onCheckIn} 
          incidents={[{ incident_id: 'i1', name: 'Inc 1', number: '1' }]}
          selectedIncidentId="i1"
        />
      </MemoryRouter>
    );

    // Fill out preceding required fields to pass validation
    fireEvent.change(screen.getByLabelText(/Full Name/i), { target: { value: 'Steve' } });
    fireEvent.change(screen.getByLabelText(/Agency/i), { target: { value: 'SAR' } });
    fireEvent.change(screen.getByLabelText(/Identifier/i), { target: { value: 'ID1' } });
    fireEvent.change(screen.getByLabelText(/Cell Phone Number/i), { target: { value: '1234567890' } });

    const fireRadio = screen.getByLabelText('Fire');
    fireEvent.click(fireRadio);
    expect(fireRadio).toBeChecked();

    fireEvent.click(screen.getByRole('button', { name: /Continue to Confirmation/i }));
    expect(await screen.findByText(/Confirm Your Information/i)).toBeTruthy();
    expect(screen.getByText('Fire')).toBeTruthy();
  });

  it('shows an error if no responder type is selected when submitting', async () => {
    render(
      <MemoryRouter>
        <ResponderCheckin 
          incidents={[{ incident_id: 'i1', name: 'Inc 1', number: '1' }]}
          selectedIncidentId="i1"
        />
      </MemoryRouter>
    );

    // Fill out preceding required fields to reach responder_type validation
    fireEvent.change(screen.getByLabelText(/Full Name/i), { target: { value: 'Steve' } });
    fireEvent.change(screen.getByLabelText(/Agency/i), { target: { value: 'SAR' } });
    fireEvent.change(screen.getByLabelText(/Identifier/i), { target: { value: 'ID1' } });
    fireEvent.change(screen.getByLabelText(/Cell Phone Number/i), { target: { value: '1234567890' } });

    fireEvent.click(screen.getByRole('button', { name: /Continue to Confirmation/i }));
    expect(await screen.findByText(/Please select a responder type/i)).toBeTruthy();
  });
});

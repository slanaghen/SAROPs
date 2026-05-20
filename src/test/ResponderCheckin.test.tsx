import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ResponderCheckin from '../components/ResponderCheckin';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('ResponderCheckin confirmation screen', () => {
  it('renders entered values in confirmation and uses white detail styles', async () => {
    render(<ResponderCheckin onCheckIn={async () => {}} />);

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
    fireEvent.change(screen.getByLabelText(/Special Skills/i), {
      target: { value: 'Medical' },
    });

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

});

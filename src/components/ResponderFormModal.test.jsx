import { render, screen, fireEvent, within, cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import ResponderFormModal from './ResponderFormModal';

expect.extend(matchers);

describe('ResponderFormModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onSave: vi.fn(),
    initialData: {
      responder_id: 'r1',
      name: 'Steve',
      agency: 'SAR',
      identifier: 'K9-1',
      access_level: 'responder',
      status: 'Staged',
      special_skills: 'UAS'
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers(); // For consistency, though this modal is simple
  });

  it('handles multi-select skills correctly by joining them into a string', () => {
    render(<ResponderFormModal {...defaultProps} />);
    const skillsSelect = screen.getByLabelText(/Special Skills/i);
    
    const uasOption = within(skillsSelect).getByRole('option', { name: 'UAS' });
    const medicalOption = within(skillsSelect).getByRole('option', { name: 'Medical' });
    
    // Manually set the selected property on the options. JSDOM will update 
    // the select.selectedOptions collection automatically.
    uasOption.selected = true;
    medicalOption.selected = true;

    // Fire change on the select element without a custom target object to avoid 
    // "TypeError: 'set' on proxy" on read-only properties like 'type' or 'selectedOptions'.
    fireEvent.change(skillsSelect, {
      target: {
        name: 'special_skills',
      }
    });

    fireEvent.click(screen.getByText(/Save Changes/i));
    expect(defaultProps.onSave).toHaveBeenCalledWith(expect.objectContaining({
      special_skills: 'UAS, Medical'
    }));
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });
});
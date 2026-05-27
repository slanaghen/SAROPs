import { render, screen, fireEvent, within, cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import ResponderFormModal from './ResponderFormModal';
import { useIncident } from '../context/IncidentContext';

expect.extend(matchers);

vi.mock('../context/IncidentContext', () => ({
  useIncident: vi.fn(),
}));

describe('ResponderFormModal', () => {
  const mockSetAccessLevel = vi.fn();
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
    vi.mocked(useIncident).mockImplementation(() => ({
      responderId: 'r1',
      setAccessLevel: mockSetAccessLevel,
    }));
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

  it('synchronizes the global access level context when the role is updated', () => {
    render(<ResponderFormModal {...defaultProps} />);
    
    const levelSelect = screen.getByLabelText(/Access Level/i);
    fireEvent.change(levelSelect, { 
      target: { name: 'access_level', value: 'staff' } 
    });

    expect(mockSetAccessLevel).toHaveBeenCalledWith('staff');
  });

  it('does NOT synchronize access level context when editing a different responder', () => {
    // Mock current user as 'r-admin', but we are editing 'r1'
    vi.mocked(useIncident).mockImplementation(() => ({
      responderId: 'r-admin',
      setAccessLevel: mockSetAccessLevel,
    }));

    render(<ResponderFormModal {...defaultProps} />);
    
    const levelSelect = screen.getByLabelText(/Access Level/i);
    fireEvent.change(levelSelect, { 
      target: { name: 'access_level', value: 'staff' } 
    });

    // Local state updates for the target, but global context for the admin should remain untouched
    expect(mockSetAccessLevel).not.toHaveBeenCalled();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });
});
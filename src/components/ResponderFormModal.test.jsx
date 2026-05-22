import { render, screen, fireEvent } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
import { vi, describe, it, expect, beforeEach } from 'vitest';
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
    vi.mocked(useIncident).mockReturnValue({
      responderId: 'r1',
      setAccessLevel: mockSetAccessLevel,
    });
  });

  it('handles multi-select skills correctly by joining them into a string', () => {
    render(<ResponderFormModal {...defaultProps} />);
    const skillsSelect = screen.getByLabelText(/Special Skills/i);
    
    // Correct way to handle multi-select in JSDOM/fireEvent
    // Manually set the 'selected' property on the options. 
    // JSDOM will update the select.selectedOptions collection automatically.
    const uasOption = screen.getByRole('option', { name: 'UAS' });
    const medicalOption = screen.getByRole('option', { name: 'Medical' });
    
    uasOption.selected = true;
    medicalOption.selected = true;
    
    fireEvent.change(skillsSelect);

    fireEvent.click(screen.getByText(/Save Changes/i));
    expect(defaultProps.onSave).toHaveBeenCalledWith(expect.objectContaining({
      special_skills: 'UAS, Medical'
    }));
  });

  it('synchronizes the global access level context when the role is updated', () => {
    render(<ResponderFormModal {...defaultProps} />);
    
    const levelSelect = screen.getByLabelText(/Access Level/i);
    fireEvent.change(levelSelect, { 
      target: { name: 'access_level', value: 'command staff' } 
    });

    expect(mockSetAccessLevel).toHaveBeenCalledWith('command staff');
  });

  it('does NOT synchronize access level context when editing a different responder', () => {
    // Mock current user as 'r-admin', but we are editing 'r1'
    vi.mocked(useIncident).mockReturnValue({
      responderId: 'r-admin',
      setAccessLevel: mockSetAccessLevel,
    });

    render(<ResponderFormModal {...defaultProps} />);
    
    const levelSelect = screen.getByLabelText(/Access Level/i);
    fireEvent.change(levelSelect, { 
      target: { name: 'access_level', value: 'command staff' } 
    });

    // Local state updates for the target, but global context for the admin should remain untouched
    expect(mockSetAccessLevel).not.toHaveBeenCalled();
  });
});
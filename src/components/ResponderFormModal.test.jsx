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
  });

  it('handles capabilities text entry correctly', () => {
    render(<ResponderFormModal {...defaultProps} />);
    const skillsInput = screen.getByLabelText(/Capabilities/i);
    
    fireEvent.change(skillsInput, {
      target: {
        name: 'special_skills',
        value: 'Dive, Medical'
      }
    });

    fireEvent.click(screen.getByText(/Save Changes/i));
    expect(defaultProps.onSave).toHaveBeenCalledWith(
      expect.objectContaining({ special_skills: 'Dive, Medical' }),
      false
    );
  });

  it('disables the status field and sets it to Staged when creating a new responder', () => {
    const newResProps = { ...defaultProps, initialData: { responder_id: null } };
    render(<ResponderFormModal {...newResProps} />);
    
    const statusSelect = screen.getByLabelText(/Status/i);
    expect(statusSelect).toBeDisabled();
    expect(statusSelect).toHaveValue('Staged');
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });
});
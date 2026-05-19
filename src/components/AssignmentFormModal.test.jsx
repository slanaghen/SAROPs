import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
import { vi, describe, it, expect, afterEach } from 'vitest';
import AssignmentFormModal from './AssignmentFormModal';

expect.extend(matchers);

afterEach(() => {
  cleanup();
});

describe('AssignmentFormModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onSave: vi.fn(),
    initialData: {
      division: 'A',
      name: 'AA',
      assignment_type: 'Ground',
      assignment_size: 2,
      tac_channel: 'TAC 1',
      description_narrative: 'Test narrative',
      status: 'Planned',
      poa: 50,
      pod: 0,
      debrief_narrative: ''
    }
  };

  it('renders correctly when open', () => {
    render(<AssignmentFormModal {...defaultProps} />);
    expect(screen.getByText('New Assignment')).toBeInTheDocument();
    expect(screen.getByLabelText(/Division/i)).toHaveValue('A');
  });

  it('enforces character limit on description narrative', () => {
    render(<AssignmentFormModal {...defaultProps} />);
    const textarea = screen.getByLabelText(/Description Narrative/i);
    
    const longText = 'a'.repeat(600);
    fireEvent.change(textarea, { target: { value: longText } });
    
    expect(textarea.value).toHaveLength(500);
    expect(screen.getByText('500/500')).toBeInTheDocument();
  });

  it('calls onSave with updated data when Save is clicked', () => {
    render(<AssignmentFormModal {...defaultProps} />);
    
    fireEvent.change(screen.getByLabelText(/Division/i), { target: { value: 'B' } });
    fireEvent.change(screen.getByLabelText(/POA/i), { target: { value: '75' } });
    fireEvent.change(screen.getByLabelText(/Debrief Narrative/i), { target: { value: 'Found tracks' } });
    fireEvent.click(screen.getByText('Save Assignment'));

    expect(defaultProps.onSave).toHaveBeenCalledWith(expect.objectContaining({
      division: 'B',
      poa: '75',
      debrief_narrative: 'Found tracks'
    }));
  });

  it('calls onClose when Cancel is clicked', () => {
    render(<AssignmentFormModal {...defaultProps} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });
});
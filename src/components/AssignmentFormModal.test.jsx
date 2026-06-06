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
      title: 'AA',
      segment: 'A',
      resource_type: 'Ground',
      team_size: 2,
      frequency_primary: 'TAC 1',
      description: 'Test narrative',
      status: 'Planned',
      probability_of_detection: 0,
      debrief_narrative: ''
    }
  };

  it('renders correctly when open', () => {
    render(<AssignmentFormModal {...defaultProps} />);
    expect(screen.getByText('New Assignment')).toBeInTheDocument();
    expect(screen.getByLabelText(/Segment/i)).toHaveValue('A');
  });

  it('disables the status field and sets it to Planned when creating a new assignment', () => {
    const newAsnProps = { ...defaultProps, initialData: { assignment_id: null } };
    render(<AssignmentFormModal {...newAsnProps} />);
    
    const statusSelect = screen.getByLabelText(/Status/i);
    expect(statusSelect).toBeDisabled();
    expect(statusSelect).toHaveValue('Planned');
  });

  it('enforces character limit on description narrative', () => {
    render(<AssignmentFormModal {...defaultProps} />);
    const textarea = screen.getByLabelText(/Description/i);
    
    const longText = 'a'.repeat(600);
    fireEvent.change(textarea, { target: { value: longText } });
    
    expect(textarea.value).toHaveLength(500);
    expect(screen.getByText(/500\/500/)).toBeInTheDocument();
  });

  it('enforces character limit on debrief narrative', () => {
    render(<AssignmentFormModal {...defaultProps} />);
    const textarea = screen.getByLabelText(/Debrief Narrative/i);
    
    const longText = 'b'.repeat(1100);
    fireEvent.change(textarea, { target: { value: longText } });
    
    expect(textarea.value).toHaveLength(1000);
    expect(screen.getByText(/1000\/1000/)).toBeInTheDocument();
  });

  it('calls onSave with updated data when Save is clicked', () => {
    render(<AssignmentFormModal {...defaultProps} />);
    
    fireEvent.change(screen.getByLabelText(/Segment/i), { target: { value: 'B' } });
    fireEvent.change(screen.getByLabelText(/Debrief Narrative/i), { target: { value: 'Found tracks' } });
    fireEvent.click(screen.getByRole('button', { name: /Save & Exit/i }));

    expect(defaultProps.onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        segment: 'B',
        debrief_narrative: 'Found tracks'
      }),
      false
    );
  });

  it('calls onClose when Cancel is clicked', () => {
    render(<AssignmentFormModal {...defaultProps} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('normalizes legacy "Search" suffixes to the new shortened enums', () => {
    const legacyProps = {
      ...defaultProps,
      initialData: { ...defaultProps.initialData, resource_type: 'Ground Search' }
    };
    render(<AssignmentFormModal {...legacyProps} />);
    
    expect(screen.getByLabelText(/Resource Type/i)).toHaveValue('Ground');
  });
});
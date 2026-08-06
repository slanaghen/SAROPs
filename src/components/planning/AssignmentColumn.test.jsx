import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import AssignmentColumn from './AssignmentColumn';

describe('AssignmentColumn', () => {
  const mockAssignments = [
    { assignment_id: 'a1', title: 'Grid Alpha', resource_type: 'Ground', team_size: 3, status: 'Planned', description: 'Search sector A' },
    { assignment_id: 'a2', title: 'Hasty Trail', resource_type: 'Hasty', team_size: 2, status: 'Planned', description: 'Sweep trail' },
  ];

  const defaultProps = {
    assignments: mockAssignments,
    filter: '',
    onFilterChange: vi.fn(),
    onNew: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    isAssignmentHighlighted: vi.fn(() => false),
    dndHandlers: {
      handleDragStart: vi.fn(),
      handleDragEnd: vi.fn(),
      handleDragOver: vi.fn(),
      handleDragEnter: vi.fn(),
      handleDragLeave: vi.fn(),
      handleDrop: vi.fn(),
    },
  };

  it('renders the header, filter, and new button', () => {
    render(<AssignmentColumn {...defaultProps} />);
    expect(screen.getByRole('heading', { name: /Assignments \(2\)/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Search assignment/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /New Assignment/i })).toBeInTheDocument();
  });

  it('calls onNew when the new button is clicked', () => {
    render(<AssignmentColumn {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /New Assignment/i }));
    expect(defaultProps.onNew).toHaveBeenCalled();
  });

  it('calls onFilterChange when the filter input changes', () => {
    render(<AssignmentColumn {...defaultProps} />);
    fireEvent.change(screen.getByPlaceholderText(/Search assignment/i), { target: { value: 'test' } });
    expect(defaultProps.onFilterChange).toHaveBeenCalledWith('test');
  });

  it('renders a list of assignment cards', () => {
    render(<AssignmentColumn {...defaultProps} />);
    expect(screen.getByText('Grid Alpha')).toBeInTheDocument();
    expect(screen.getByText('Hasty Trail')).toBeInTheDocument();
    expect(screen.getByText('Search sector A')).toBeInTheDocument();
  });

  it('calls onEdit when an assignment card is clicked', () => {
    render(<AssignmentColumn {...defaultProps} />);
    fireEvent.click(screen.getByText('Grid Alpha'));
    expect(defaultProps.onEdit).toHaveBeenCalledWith('a1');
  });

  it('calls onDelete when the delete button is clicked', () => {
    render(<AssignmentColumn {...defaultProps} />);
    const deleteButtons = screen.getAllByRole('button', { name: /Delete/i });
    fireEvent.click(deleteButtons[0]);
    expect(defaultProps.onDelete).toHaveBeenCalledWith(mockAssignments[0]);
  });

  it('shows an empty state when there are no assignments', () => {
    render(<AssignmentColumn {...defaultProps} assignments={[]} />);
    expect(screen.getByText(/No assignments matching criteria/i)).toBeInTheDocument();
  });
});
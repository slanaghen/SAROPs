import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import ResponderColumn from './ResponderColumn';

describe('ResponderColumn', () => {
  const mockResponders = [
    { responder_id: 'r1', name: 'John Doe', agency: 'SAR Team', identifier: 'JD1', status: 'Staged', special_skills: 'EMT' },
    { responder_id: 'r2', name: 'Jane Smith', agency: 'County Sheriff', identifier: 'JS2', status: 'Staged' },
  ];

  const defaultProps = {
    responders: mockResponders,
    filter: '',
    onFilterChange: vi.fn(),
    onNew: vi.fn(),
    onEdit: vi.fn(),
    onCheckOut: vi.fn(),
    isResponderHighlighted: vi.fn(() => false),
    draggedItem: null,
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
    render(<ResponderColumn {...defaultProps} />);
    expect(screen.getByRole('heading', { name: /Staged Responders \(2\)/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Search name, ID, agency or skills/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /New Responder/i })).toBeInTheDocument();
  });

  it('calls onNew when the new button is clicked', () => {
    render(<ResponderColumn {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /New Responder/i }));
    expect(defaultProps.onNew).toHaveBeenCalled();
  });

  it('calls onFilterChange when the filter input changes', () => {
    render(<ResponderColumn {...defaultProps} />);
    fireEvent.change(screen.getByPlaceholderText(/Search name, ID, agency or skills/i), { target: { value: 'test' } });
    expect(defaultProps.onFilterChange).toHaveBeenCalledWith('test');
  });

  it('renders a list of responder cards', () => {
    render(<ResponderColumn {...defaultProps} />);
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(screen.getByText('JD1')).toBeInTheDocument();
    expect(screen.getByText('EMT')).toBeInTheDocument();
  });

  it('calls onEdit when a responder card is clicked', () => {
    render(<ResponderColumn {...defaultProps} />);
    fireEvent.click(screen.getByText('John Doe'));
    expect(defaultProps.onEdit).toHaveBeenCalledWith(mockResponders[0]);
  });

  it('calls onCheckOut when the check out button is clicked', () => {
    render(<ResponderColumn {...defaultProps} />);
    const checkOutButtons = screen.getAllByRole('button', { name: /Check Out/i });
    fireEvent.click(checkOutButtons[0]);
    expect(defaultProps.onCheckOut).toHaveBeenCalledWith(mockResponders[0]);
  });

  it('shows an empty state when there are no responders', () => {
    render(<ResponderColumn {...defaultProps} responders={[]} />);
    expect(screen.getByText(/No available responders in staging/i)).toBeInTheDocument();
  });
});
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import OperationsToolbar from '../components/OperationsToolbar';

describe('OperationsToolbar', () => {
  const defaultProps = {
    viewMode: 'All',
    setViewMode: vi.fn(),
    layoutMode: 'split',
    setLayoutMode: vi.fn(),
    onBroadcastClick: vi.fn(),
    teamsCount: 5
  };

  it('renders dashboard title and description', () => {
    render(<OperationsToolbar {...defaultProps} />);
    expect(screen.getByText('Operations Dashboard')).toBeInTheDocument();
    expect(screen.getByText(/Drag and drop teams/i)).toBeInTheDocument();
  });

  it('triggers setViewMode when the view selector changes', () => {
    render(<OperationsToolbar {...defaultProps} />);
    fireEvent.change(screen.getByLabelText(/View:/), { target: { value: 'Operations' } });
    expect(defaultProps.setViewMode).toHaveBeenCalledWith('Operations');
  });

  it('shows the correct team count in the broadcast button tooltip', () => {
    render(<OperationsToolbar {...defaultProps} />);
    const broadcastBtn = screen.getByTitle('Send message to all 5 teams');
    expect(broadcastBtn).toBeInTheDocument();
    
    fireEvent.click(broadcastBtn);
    expect(defaultProps.onBroadcastClick).toHaveBeenCalled();
  });
});
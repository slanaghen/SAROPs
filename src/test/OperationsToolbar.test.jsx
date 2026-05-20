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
    expect(screen.getByText(/Summary of assignments and teams/)).toBeInTheDocument();
  });

  it('triggers setViewMode when the view selector changes', () => {
    render(<OperationsToolbar {...defaultProps} />);
    fireEvent.change(screen.getByLabelText(/View:/), { target: { value: 'Operations' } });
    expect(defaultProps.setViewMode).toHaveBeenCalledWith('Operations');
  });

  it('triggers setLayoutMode when layout toggle buttons are clicked', () => {
    render(<OperationsToolbar {...defaultProps} />);
    
    fireEvent.click(screen.getByText('Table'));
    expect(defaultProps.setLayoutMode).toHaveBeenCalledWith('table');
    
    fireEvent.click(screen.getByText('Map'));
    expect(defaultProps.setLayoutMode).toHaveBeenCalledWith('map');
    
    fireEvent.click(screen.getByText('Split'));
    expect(defaultProps.setLayoutMode).toHaveBeenCalledWith('split');
  });

  it('shows the correct team count in the broadcast button tooltip', () => {
    render(<OperationsToolbar {...defaultProps} />);
    const broadcastBtn = screen.getByTitle('Send message to all 5 teams');
    expect(broadcastBtn).toBeInTheDocument();
    
    fireEvent.click(broadcastBtn);
    expect(defaultProps.onBroadcastClick).toHaveBeenCalled();
  });
});
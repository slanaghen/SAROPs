import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import AdminDataManagement from './AdminDataManagement';

describe('AdminDataManagement Component', () => {
  const mockHandleSeedData = vi.fn();
  const mockHandleClearData = vi.fn();

  const defaultProps = {
    loading: false,
    handleSeedData: mockHandleSeedData,
    handleClearData: mockHandleClearData,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the section title and data management buttons', () => {
    render(<AdminDataManagement {...defaultProps} />);
    expect(screen.getByRole('heading', { name: /Data Management/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Seed Dev Data/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Clear All Data/i })).toBeInTheDocument();
  });

  it('calls handleSeedData when the "Seed Dev Data" button is clicked', () => {
    render(<AdminDataManagement {...defaultProps} />);
    const seedButton = screen.getByRole('button', { name: /Seed Dev Data/i });
    fireEvent.click(seedButton);
    expect(mockHandleSeedData).toHaveBeenCalledTimes(1);
  });

  it('calls handleClearData when the "Clear All Data" button is clicked', () => {
    render(<AdminDataManagement {...defaultProps} />);
    const clearButton = screen.getByRole('button', { name: /Clear All Data/i });
    fireEvent.click(clearButton);
    expect(mockHandleClearData).toHaveBeenCalledTimes(1);
  });

  it('disables both buttons when the loading prop is true', () => {
    render(<AdminDataManagement {...defaultProps} loading={true} />);
    const seedButton = screen.getByRole('button', { name: /Seeding/i });
    const clearButton = screen.getByRole('button', { name: /Clearing/i });

    expect(seedButton).toBeDisabled();
    expect(clearButton).toBeDisabled();
  });
});

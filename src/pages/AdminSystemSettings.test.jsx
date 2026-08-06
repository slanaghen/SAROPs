import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import AdminSystemSettings from './AdminSystemSettings';

describe('AdminSystemSettings Component', () => {
  const mockSetOpRefresh = vi.fn();
  const mockSetResRefresh = vi.fn();
  const mockSetSartopoRefresh = vi.fn();
  const mockHandleApplySettings = vi.fn();

  const defaultProps = {
    opRefresh: 30,
    setOpRefresh: mockSetOpRefresh,
    resRefresh: 30,
    setResRefresh: mockSetResRefresh,
    sartopoRefresh: 60,
    setSartopoRefresh: mockSetSartopoRefresh,
    isSettingsDirty: false,
    handleApplySettings: mockHandleApplySettings,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the section title and all input fields with initial values', () => {
    render(<AdminSystemSettings {...defaultProps} />);
    expect(screen.getByRole('heading', { name: /System Settings/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Operations Refresh/i)).toHaveValue(30);
    expect(screen.getByLabelText(/Responder Refresh/i)).toHaveValue(30);
    expect(screen.getByLabelText(/SARTopo Refresh/i)).toHaveValue(60);
  });

  it('calls the correct setter function when an input value changes', () => {
    render(<AdminSystemSettings {...defaultProps} />);
    
    const opsInput = screen.getByLabelText(/Operations Refresh/i);
    fireEvent.change(opsInput, { target: { value: '45' } });
    expect(mockSetOpRefresh).toHaveBeenCalledWith(45);

    const resInput = screen.getByLabelText(/Responder Refresh/i);
    fireEvent.change(resInput, { target: { value: '50' } });
    expect(mockSetResRefresh).toHaveBeenCalledWith(50);

    const topoInput = screen.getByLabelText(/SARTopo Refresh/i);
    fireEvent.change(topoInput, { target: { value: '120' } });
    expect(mockSetSartopoRefresh).toHaveBeenCalledWith(120);
  });

  it('disables the "Apply" button when isSettingsDirty is false', () => {
    render(<AdminSystemSettings {...defaultProps} isSettingsDirty={false} />);
    expect(screen.getByRole('button', { name: /Apply/i })).toBeDisabled();
  });

  it('enables the "Apply" button when isSettingsDirty is true', () => {
    render(<AdminSystemSettings {...defaultProps} isSettingsDirty={true} />);
    expect(screen.getByRole('button', { name: /Apply/i })).not.toBeDisabled();
  });

  it('calls handleApplySettings when the "Apply" button is clicked', () => {
    render(<AdminSystemSettings {...defaultProps} isSettingsDirty={true} />);
    const applyButton = screen.getByRole('button', { name: /Apply/i });
    fireEvent.click(applyButton);
    expect(mockHandleApplySettings).toHaveBeenCalledTimes(1);
  });
});
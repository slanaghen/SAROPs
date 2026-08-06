import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import ToastContainer from './ToastContainer';
import { useToast } from '../context/ToastContext';

// Mock the context hook
vi.mock('../context/ToastContext', () => ({
  useToast: vi.fn(),
}));

describe('ToastContainer', () => {
  const mockRemoveToast = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Provide a default mock implementation for useToast
    vi.mocked(useToast).mockReturnValue({
      toasts: [],
      removeToast: mockRemoveToast,
    });
  });

  it('should render nothing when there are no toasts', () => {
    const { container } = render(<ToastContainer />);
    expect(container.querySelector('.toast-container')).toBeEmptyDOMElement();
  });

  it('should render a success toast with the correct content and icon', () => {
    const toasts = [{ id: 1, message: 'Success!', type: 'success' }];
    vi.mocked(useToast).mockReturnValue({ toasts, removeToast: mockRemoveToast });

    render(<ToastContainer />);
    
    const toastElement = screen.getByRole('alert');
    expect(toastElement).toHaveClass('toast-success');
    expect(screen.getByText('Success!')).toBeInTheDocument();
    expect(screen.getByText('✓')).toBeInTheDocument();
  });

  it('should render an error toast with the correct content and icon', () => {
    const toasts = [{ id: 2, message: 'Error occurred.', type: 'error' }];
    vi.mocked(useToast).mockReturnValue({ toasts, removeToast: mockRemoveToast });

    render(<ToastContainer />);
    
    const toastElement = screen.getByRole('alert');
    expect(toastElement).toHaveClass('toast-error');
    expect(screen.getByText('Error occurred.')).toBeInTheDocument();
    expect(screen.getByText('✕')).toBeInTheDocument();
  });

  it('should call removeToast when a toast is clicked', () => {
    const toasts = [{ id: 1, message: 'Click me', type: 'info' }];
    vi.mocked(useToast).mockReturnValue({ toasts, removeToast: mockRemoveToast });

    render(<ToastContainer />);
    
    const toastElement = screen.getByRole('alert');
    fireEvent.click(toastElement);

    expect(mockRemoveToast).toHaveBeenCalledWith(1);
  });

  it('should call removeToast when the close button is clicked', () => {
    const toasts = [{ id: 1, message: 'Close me', type: 'warning' }];
    vi.mocked(useToast).mockReturnValue({ toasts, removeToast: mockRemoveToast });

    render(<ToastContainer />);
    
    const closeButton = screen.getByRole('button', { name: /×/i });
    fireEvent.click(closeButton);

    expect(mockRemoveToast).toHaveBeenCalledWith(1);
  });
});
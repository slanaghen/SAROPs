import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import BaseModal from './BaseModal';

describe('BaseModal', () => {
  it('renders content and title when open', () => {
    render(
      <BaseModal isOpen={true} title="Test Title" onClose={vi.fn()}>
        <div>Test Content</div>
      </BaseModal>
    );
    expect(screen.getByText('Test Title')).toBeInTheDocument();
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('calls onClose when clicking backdrop or cancel button', () => {
    const onClose = vi.fn();
    render(
      <BaseModal isOpen={true} title="Test" onClose={onClose} actions={<button>Action</button>} />
    );
    
    // Test Cancel button
    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalledTimes(1);
    
    // Test Backdrop click
    fireEvent.click(document.querySelector('.modal-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('prevents closing and disables cancel when loading', () => {
    const onClose = vi.fn();
    render(<BaseModal isOpen={true} title="Test" onClose={onClose} loading={true} />);
    
    const cancelBtn = screen.getByText('Cancel');
    expect(cancelBtn).toBeDisabled();
    
    fireEvent.click(cancelBtn);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('does not render when closed', () => {
    const { container } = render(
      <BaseModal isOpen={false} title="Test" onClose={vi.fn()}>
        Content
      </BaseModal>
    );
    expect(container.firstChild).toBeNull();
  });
});
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import SettingsPage from './SettingsPage';
import { supabase } from '../lib/supabase';

expect.extend(matchers);

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
    },
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

// Mock the child component to isolate SettingsPage logic from form rendering complexities
vi.mock('../components/admin/AdminUserFormModal', () => ({
  default: ({ onSave, initialData, loading, error, success }) => (
    <div data-testid="user-form-modal">
      <span data-testid="user-email">{initialData?.email}</span>
      <button onClick={() => onSave({ ...initialData, name: 'Updated Name' })}>Save</button>
      {loading && <span>Saving...</span>}
      {success && <span className="save-message">{success}</span>}
      {error && <span className="alert alert-error">{error}</span>}
    </div>
  ),
}));

describe('SettingsPage Functional Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it('loads user profile using email identity from session', async () => {
    const mockUser = { email: 'session@example.com', name: 'Session User' };
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { user: { email: 'session@example.com' } } },
      error: null,
    });

    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: mockUser, error: null }),
    });

    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('user-email')).toHaveTextContent('session@example.com');
    });
  });

  it('successfully updates profile via administrative RPC', async () => {
    const mockUser = { email: 'test@example.com', name: 'Old Name' };
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { user: { email: 'test@example.com' } } },
      error: null,
    });

    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: mockUser, error: null }),
    });

    vi.mocked(supabase.rpc).mockResolvedValue({ error: null });

    render(<SettingsPage />);
    await waitFor(() => screen.getByTestId('user-form-modal'));
    
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(supabase.rpc).toHaveBeenCalledWith('admin_add_user', expect.objectContaining({
        p_email: 'test@example.com',
        p_name: 'Updated Name'
      }));
      expect(screen.getByText(/Profile updated successfully/i)).toBeInTheDocument();
    });
  });
});
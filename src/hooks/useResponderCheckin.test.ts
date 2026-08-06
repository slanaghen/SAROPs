import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useResponderCheckin } from './useResponderCheckin';
import { Responder } from '../../sarops-types';

describe('useResponderCheckin Hook', () => {
  const mockSupabase: any = {
    from: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn(),
    eq: vi.fn(),
  };

  const mockResponder: Responder = {
    responder_id: 'res-1',
    name: 'Test Responder',
    agency: 'Test Agency',
    identifier: 'T1',
    device_id: 'dev-1',
    checkin_datetime: new Date().toISOString(),
    checkout_datetime: null,
    status: 'Staged',
    access_level: 'responder',
    cell_phone: '555-555-5555',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should successfully check in a responder', async () => {
    mockSupabase.single.mockResolvedValue({ data: mockResponder, error: null });
    const { result } = renderHook(() => useResponderCheckin(mockSupabase));

    await act(async () => {
      await result.current.checkIn(mockResponder);
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.isCheckedIn).toBe(true);
    expect(result.current.checkedInResponder).toEqual(mockResponder);
    expect(mockSupabase.from).toHaveBeenCalledWith('responders');
    expect(mockSupabase.insert).toHaveBeenCalledWith([mockResponder]);
  });

  it('should handle errors during check-in', async () => {
    const dbError = new Error('Insert failed');
    mockSupabase.single.mockResolvedValue({ data: null, error: dbError });
    const { result } = renderHook(() => useResponderCheckin(mockSupabase));

    await act(async () => {
      await expect(result.current.checkIn(mockResponder)).rejects.toThrow('Database error: Insert failed');
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toContain('Insert failed');
    expect(result.current.isCheckedIn).toBe(false);
  });

  it('should successfully check out a responder', async () => {
    mockSupabase.eq.mockResolvedValue({ error: null });
    const { result } = renderHook(() => useResponderCheckin(mockSupabase));

    // First, check in to set the state
    await act(async () => {
      mockSupabase.single.mockResolvedValue({ data: mockResponder, error: null });
      await result.current.checkIn(mockResponder);
    });

    // Then, check out
    await act(async () => {
      await result.current.checkOut('res-1');
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.isCheckedIn).toBe(false);
    expect(result.current.checkedInResponder).toBeNull();
    expect(mockSupabase.from).toHaveBeenCalledWith('responders');
    expect(mockSupabase.update).toHaveBeenCalledWith(expect.objectContaining({
      status: 'CheckedOut',
      checkout_datetime: expect.any(String),
    }));
    expect(mockSupabase.eq).toHaveBeenCalledWith('responder_id', 'res-1');
  });

  it('should reset its state', async () => {
    mockSupabase.single.mockResolvedValue({ data: mockResponder, error: null });
    const { result } = renderHook(() => useResponderCheckin(mockSupabase));

    await act(async () => {
      await result.current.checkIn(mockResponder);
    });

    expect(result.current.isCheckedIn).toBe(true);

    act(() => {
      result.current.reset();
    });

    expect(result.current.isCheckedIn).toBe(false);
    expect(result.current.checkedInResponder).toBeNull();
  });
});

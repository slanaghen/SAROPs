import { renderHook } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useRealTimeNotifications } from './useRealTimeNotifications';

describe('useRealTimeNotifications Hook', () => {
  beforeEach(() => {
    // Mock Browser APIs
    vi.stubGlobal('Notification', vi.fn());
    global.Notification.permission = 'granted'; // Assume permission is granted
    vi.stubGlobal('Audio', vi.fn(() => ({ play: vi.fn() })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should not trigger a notification on initial render', () => {
    renderHook(() => useRealTimeNotifications(true, 'Staged', 'Staged', 'Planned'));
    expect(global.Notification).not.toHaveBeenCalled();
  });

  it('should trigger a notification when responderStatus changes', () => {
    const { rerender } = renderHook(
      ({ responderStatus }) => useRealTimeNotifications(true, responderStatus, 'Staged', 'Planned'),
      { initialProps: { responderStatus: 'Staged' } }
    );

    // Rerender with a new status
    rerender({ responderStatus: 'Deployed' });

    expect(global.Notification).toHaveBeenCalledWith(
      'SAROps: Your Status Changed',
      expect.objectContaining({ body: expect.stringContaining('Deployed') })
    );
    expect(global.Audio).toHaveBeenCalled();
  });

  it('should trigger a notification when teamStatus changes', () => {
    const { rerender } = renderHook(
      ({ teamStatus }) => useRealTimeNotifications(true, 'Staged', teamStatus, 'Planned'),
      { initialProps: { teamStatus: 'Staged' } }
    );

    rerender({ teamStatus: 'Assigned' });

    expect(global.Notification).toHaveBeenCalledWith(
      'Team Status Update',
      expect.objectContaining({ body: expect.stringContaining('Assigned') })
    );
    expect(global.Audio).toHaveBeenCalled();
  });

  it('should trigger a notification when assignmentStatus changes', () => {
    const { rerender } = renderHook(
      ({ assignmentStatus }) => useRealTimeNotifications(true, 'Staged', 'Staged', assignmentStatus),
      { initialProps: { assignmentStatus: 'Planned' } }
    );

    rerender({ assignmentStatus: 'Deployed' });

    expect(global.Notification).toHaveBeenCalledWith(
      'Assignment Status Update',
      expect.objectContaining({ body: expect.stringContaining('Deployed') })
    );
    expect(global.Audio).toHaveBeenCalled();
  });

  it('should not trigger a notification if permission is not granted', () => {
    global.Notification.permission = 'denied';
    const { rerender } = renderHook(
      ({ responderStatus }) => useRealTimeNotifications(true, responderStatus, 'Staged', 'Planned'),
      { initialProps: { responderStatus: 'Staged' } }
    );

    rerender({ responderStatus: 'Deployed' });

    expect(global.Notification).not.toHaveBeenCalled();
  });

  it('should not trigger a notification if incident is not active', () => {
    const { rerender } = renderHook(
      ({ responderStatus }) => useRealTimeNotifications(false, responderStatus, 'Staged', 'Planned'),
      { initialProps: { responderStatus: 'Staged' } }
    );

    rerender({ responderStatus: 'Deployed' });

    expect(global.Notification).not.toHaveBeenCalled();
  });
});
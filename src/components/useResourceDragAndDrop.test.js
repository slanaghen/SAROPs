import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import { useResourceDragAndDrop } from './useResourceDragAndDrop';

describe('useResourceDragAndDrop Hook', () => {
  const createMockEvent = () => ({
    preventDefault: vi.fn(),
    dataTransfer: {
      setData: vi.fn(),
      effectAllowed: '',
    },
  });

  it('should initialize with null state', () => {
    const { result } = renderHook(() => useResourceDragAndDrop({ onDropResource: vi.fn() }));
    expect(result.current.draggedItem).toBeNull();
    expect(result.current.dropTarget).toBeNull();
  });

  it('handleDragStart should set the dragged item', () => {
    const { result } = renderHook(() => useResourceDragAndDrop({ onDropResource: vi.fn() }));
    const mockEvent = createMockEvent();

    act(() => {
      result.current.handleDragStart(mockEvent, 'res-1', 'responder');
    });

    expect(result.current.draggedItem).toEqual({ id: 'res-1', type: 'responder' });
    expect(mockEvent.dataTransfer.setData).toHaveBeenCalledWith('text/plain', 'res-1');
    expect(mockEvent.dataTransfer.effectAllowed).toBe('move');
  });

  it('handleDragEnd should reset all state', () => {
    const { result } = renderHook(() => useResourceDragAndDrop({ onDropResource: vi.fn() }));
    const mockEvent = createMockEvent();

    // Set initial state
    act(() => {
      result.current.handleDragStart(mockEvent, 'res-1', 'responder');
    });
    act(() => {
      result.current.handleDragEnter(mockEvent, 'team-1', 'team');
    });
    expect(result.current.draggedItem).not.toBeNull();
    expect(result.current.dropTarget).not.toBeNull();

    // End the drag
    act(() => {
      result.current.handleDragEnd();
    });

    expect(result.current.draggedItem).toBeNull();
    expect(result.current.dropTarget).toBeNull();
  });

  it('handleDragOver should prevent default when dragging over a valid, different type target', () => {
    const { result } = renderHook(() => useResourceDragAndDrop({ onDropResource: vi.fn() }));
    const mockEvent = createMockEvent();

    act(() => {
      result.current.handleDragStart(mockEvent, 'res-1', 'responder');
    });

    act(() => {
      result.current.handleDragOver(mockEvent, 'team'); // Different type
    });
    expect(mockEvent.preventDefault).toHaveBeenCalledTimes(1);
  });

  it('handleDragOver should NOT prevent default for same-type targets', () => {
    const { result } = renderHook(() => useResourceDragAndDrop({ onDropResource: vi.fn() }));
    const mockEvent = createMockEvent();

    act(() => {
      result.current.handleDragStart(mockEvent, 'res-1', 'responder');
    });

    act(() => {
      result.current.handleDragOver(mockEvent, 'responder'); // Same type
    });
    expect(mockEvent.preventDefault).not.toHaveBeenCalled();
  });

  it('handleDragEnter should set drop target for valid, different type targets', () => {
    const { result } = renderHook(() => useResourceDragAndDrop({ onDropResource: vi.fn() }));
    const mockEvent = createMockEvent();

    act(() => {
      result.current.handleDragStart(mockEvent, 'res-1', 'responder');
    });

    act(() => {
      result.current.handleDragEnter(mockEvent, 'team-1', 'team');
    });

    expect(result.current.dropTarget).toEqual({ id: 'team-1', type: 'team' });
    expect(mockEvent.preventDefault).toHaveBeenCalledTimes(1);
  });

  it('handleDragLeave should reset the drop target', () => {
    const { result } = renderHook(() => useResourceDragAndDrop({ onDropResource: vi.fn() }));
    const mockEvent = createMockEvent();

    act(() => {
      result.current.handleDragStart(mockEvent, 'res-1', 'responder');
    });
    act(() => {
      result.current.handleDragEnter(mockEvent, 'team-1', 'team');
    });
    expect(result.current.dropTarget).not.toBeNull();

    act(() => {
      result.current.handleDragLeave();
    });
    expect(result.current.dropTarget).toBeNull();
  });

  it('handleDrop should call onDropResource and reset state for a valid drop', async () => {
    const onDropResource = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useResourceDragAndDrop({ onDropResource }));
    const mockEvent = createMockEvent();

    act(() => {
      result.current.handleDragStart(mockEvent, 'res-1', 'responder');
    });

    await act(async () => {
      await result.current.handleDrop(mockEvent, 'team-1', 'team');
    });

    expect(onDropResource).toHaveBeenCalledWith(
      { id: 'res-1', type: 'responder' },
      { id: 'team-1', type: 'team' }
    );
    expect(result.current.draggedItem).toBeNull();
    expect(result.current.dropTarget).toBeNull();
  });
});
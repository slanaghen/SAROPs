import { useState } from 'react';

/**
 * useResourceDragAndDrop Hook
 * 
 * Encapsulates the state and event handlers for drag-and-drop operations
 * involving teams, assignments, responders, and vehicles.
 *
 * @param {object} options - Configuration for the hook.
 * @param {function} options.onDropResource - The callback function to execute when a valid drop occurs.
 * @returns {object} An object containing the drag state and event handlers.
 */
export const useResourceDragAndDrop = ({ onDropResource }) => {
  const [draggedItem, setDraggedItem] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);

  const handleDragStart = (e, id, type) => {
    setDraggedItem({ id, type });
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDropTarget(null);
  };

  const handleDragOver = (e, type) => {
    if (draggedItem && draggedItem.type !== type) {
      e.preventDefault(); // Allows the drop event to fire
    }
  };

  const handleDragEnter = (e, id, type) => {
    if (draggedItem && draggedItem.type !== type) {
      e.preventDefault();
      setDropTarget({ id, type });
    }
  };

  const handleDrop = async (e, id, type) => {
    e.preventDefault();
    if (!draggedItem || draggedItem.type === type) return;

    if (onDropResource) {
      await onDropResource(draggedItem, { id, type });
    }

    handleDragEnd(); // Reset state after drop
  };

  return {
    draggedItem,
    dropTarget,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDragEnter,
    handleDragLeave: () => setDropTarget(null),
    handleDrop,
  };
};
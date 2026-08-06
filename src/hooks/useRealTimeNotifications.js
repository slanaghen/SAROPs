import { useEffect, useState, useRef } from 'react';

/**
 * Displays a browser notification using the most robust method available.
 * Prefers the Service Worker API for reliability, with a fallback to the legacy constructor.
 * @param {string} title - The title of the notification.
 * @param {object} options - The options for the notification (e.g., body, icon).
 */
const showNotification = (title, options) => {
  const playSound = () => {
    try {
      const audio = new Audio('/notification.mp3');
      audio.play().catch(e => console.error("Audio playback failed:", e));
    } catch (e) {
      console.error("Failed to create or play audio:", e);
    }
  };

  // Check if Service Worker API is available and the context is secure
  if ('serviceWorker' in navigator && window.isSecureContext) {
    navigator.serviceWorker.ready.then(registration => {
      // Use the Service Worker to show the notification
      registration.showNotification(title, options);
      playSound();
    }).catch(err => {
      // If the service worker is not ready, we should not fall back to the legacy constructor,
      // as this can cause "Illegal constructor" errors. We simply log the issue.
      console.error('Service Worker not ready for notification:', err);
    });
  } else if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, options);
      playSound();
    } catch (e) {
      console.error("Legacy 'new Notification()' constructor failed:", e);
    }
  }
};

/**
 * A React hook to manage and display real-time notifications for operational status changes.
 */
export const useRealTimeNotifications = (isActive, responderStatus, teamStatus, assignmentStatus) => {
  const [permission, setPermission] = useState(Notification.permission);
  const prevTeamStatus = useRef(teamStatus);
  const prevAssignmentStatus = useRef(assignmentStatus);
  const prevResponderStatus = useRef(responderStatus);

  // Request permission on mount if not already granted
  useEffect(() => {
    if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
      Notification.requestPermission().then(p => setPermission(p));
    }
  }, []);

  // Effect to trigger notification on responder status change
  useEffect(() => {
    if (isActive && permission === 'granted' && responderStatus && responderStatus !== prevResponderStatus.current) {
      showNotification('SAROps: Your Status Changed', {
        body: `Your operational status is now: ${responderStatus}`,
        icon: '/logo.png',
        tag: 'responder-status-update'
      });
    }
    prevResponderStatus.current = responderStatus;
  }, [isActive, permission, responderStatus]);

  // Effect to trigger notification on team status change
  useEffect(() => {
    if (isActive && permission === 'granted' && teamStatus && teamStatus !== prevTeamStatus.current) {
      showNotification('Team Status Update', {
        body: `Your team status is now: ${teamStatus}`,
        icon: '/logo.png',
        tag: 'team-status-update' // Use a tag to prevent multiple notifications
      });
    }
    prevTeamStatus.current = teamStatus;
  }, [isActive, permission, teamStatus]);

  // Effect to trigger notification on assignment status change
  useEffect(() => {
    if (isActive && permission === 'granted' && assignmentStatus && assignmentStatus !== prevAssignmentStatus.current) {
      showNotification('Assignment Status Update', {
        body: `Your assignment status is now: ${assignmentStatus}`,
        icon: '/logo.png',
        tag: 'assignment-status-update'
      });
    }
    prevAssignmentStatus.current = assignmentStatus;
  }, [isActive, permission, assignmentStatus]);

  return { permission };
};
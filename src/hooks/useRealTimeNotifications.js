import { useEffect, useRef, useState } from 'react';
import logo from '../assets/logo.png';

/**
 * Custom hook to handle audio and browser notifications for status changes.
 */
export const useRealTimeNotifications = (isActive, responderStatus, teamStatus, assignmentStatus) => {
  const [permission, setPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  );

  const prevStatusRef = useRef(responderStatus);
  const prevTeamStatusRef = useRef(teamStatus);
  const prevAssignmentStatusRef = useRef(assignmentStatus);

  const triggerNotification = (title, body) => {
    // 1. Play Sound
    if (typeof Audio !== 'undefined') {
      try {
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
        audio.play().catch(() => console.debug('Audio blocked: interaction required'));
      } catch (e) {
        console.debug('Audio playback failed');
      }
    }
    // 2. Browser Notification
    if ("Notification" in window) {
      if (Notification.permission === "granted") {
      new Notification(title, {
        body: body,
        icon: logo,
        tag: 'status-change'
      });
      } else if (Notification.permission === "denied") {
        console.warn('[Notifications] Visual notifications are blocked by browser settings. Falling back to audio alerts only.');
      }
    }
  };

  // Monitor for permission changes and handle initial request logic
  useEffect(() => {
    if (isActive && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission().then(setPermission);
      } else {
        setPermission(Notification.permission);
      }
    }
  }, [isActive]);

  useEffect(() => {
    if (!isActive) return;

    if (prevStatusRef.current && responderStatus && prevStatusRef.current !== responderStatus) {
      triggerNotification("SAROps: Your Status Changed", `Your operational status has changed to: ${responderStatus}`);
    }
    if (prevTeamStatusRef.current && teamStatus && prevTeamStatusRef.current !== teamStatus) {
      triggerNotification("SAROps: Team Status Changed", `Your team's status has changed to: ${teamStatus}`);
    }
    if (prevAssignmentStatusRef.current && assignmentStatus && prevAssignmentStatusRef.current !== assignmentStatus) {
      triggerNotification("SAROps: Assignment Status Changed", `Your team's assignment status has changed to: ${assignmentStatus}`);
    }

    prevStatusRef.current = responderStatus;
    prevTeamStatusRef.current = teamStatus;
    prevAssignmentStatusRef.current = assignmentStatus;
  }, [responderStatus, teamStatus, assignmentStatus, isActive]);

  return { permission };
};
import React, { createContext, useContext, useState, useEffect } from 'react';

const IncidentContext = createContext();

const STORAGE_KEY = 'sarops_incident_session';

export const IncidentProvider = ({ children }) => {
  // Initialize state from localStorage if available
  const [isActive, setIsActive] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return false;
    try {
      const parsed = JSON.parse(saved);
      return !!(parsed && parsed.isActive);
    } catch { return false; }
  });

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  const [incidentId, setIncidentId] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return null;
    try {
      const parsed = JSON.parse(saved);
      const id = parsed?.incidentId;
      return (id && uuidRegex.test(id)) ? id : null;
    } catch { return null; }
  });
  const [responderId, setResponderId] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return null;
    try {
      const parsed = JSON.parse(saved);
      const rid = parsed?.responderId;
      return (rid && uuidRegex.test(rid)) ? rid : null;
    } catch { return null; }
  });

  const [responderName, setResponderName] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return '';
      const parsed = JSON.parse(saved);
      return parsed && typeof parsed === 'object' ? parsed.responderName || '' : '';
    } catch { return ''; }
  });
  const [responderStatus, setResponderStatus] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return '';
      const parsed = JSON.parse(saved);
      return parsed && typeof parsed === 'object' ? parsed.responderStatus || '' : '';
    } catch { return ''; }
  });
  const [accessLevel, setAccessLevel] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return '';
      const parsed = JSON.parse(saved);
      return parsed && typeof parsed === 'object' ? parsed.accessLevel || '' : '';
    } catch { return ''; }
  });
  const [currentTeamStatus, setCurrentTeamStatus] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return null;
      const parsed = JSON.parse(saved);
      return parsed && typeof parsed === 'object' ? parsed.currentTeamStatus || null : null;
    } catch { return null; }
  });
  const [currentAssignmentStatus, setCurrentAssignmentStatus] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return null;
      const parsed = JSON.parse(saved);
      return parsed && typeof parsed === 'object' ? parsed.currentAssignmentStatus || null : null;
    } catch { return null; }
  });
  const [isAdmin, setIsAdmin] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return false;
    try { return !!JSON.parse(saved).isAdmin; } catch { return false; }
  });
  const [incidentData, setIncidentData] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    const defaultData = { name: '', opNumber: '', opPeriodId: '' };
    if (!saved) return defaultData;
    try {
      const parsed = JSON.parse(saved);
      const data = parsed?.incidentData || defaultData;
      // Ensure opPeriodId is a UUID or reset it
      if (data.opPeriodId && !uuidRegex.test(data.opPeriodId)) data.opPeriodId = '';
      return data;
    } catch { return defaultData; }
  });

  // Persist state to localStorage whenever any value changes
  useEffect(() => {
    // If we are in a logged-out state, ensure storage is kept clear
    if (!isActive && !responderName && !isAdmin) return;

    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      isActive,
      incidentId,
      responderId,
      responderName,
      responderStatus,
      accessLevel,
      isAdmin,
      currentTeamStatus,
      currentAssignmentStatus,
      incidentData
    }));
  }, [isActive, incidentId, responderId, responderName, responderStatus, accessLevel, isAdmin, incidentData, currentTeamStatus, currentAssignmentStatus]);

  const startIncident = (id, name, opNumber, opPeriodId) => {
    setIncidentId(id);
    setIncidentData({ name, opNumber, opPeriodId });
    setIsActive(true);
  };

  const endIncident = () => {
    setIsActive(false);
  };

  const logout = () => {
    setIsActive(false);
    setIsAdmin(false);
    setIncidentId(null);
    setResponderId(null);
    setResponderName('');
    setResponderStatus('');
    setAccessLevel('');
    setCurrentTeamStatus(null);
    setCurrentAssignmentStatus(null);
    setIncidentData({ name: '', opNumber: '', opPeriodId: '' });
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <IncidentContext.Provider value={{ 
      isActive, 
      incidentId,
      responderId,
      responderName,
      responderStatus,
      accessLevel,
      incidentData, 
      startIncident, 
      endIncident,
      logout,
      isAdmin,
      setIsAdmin,
      currentTeamStatus,
      setCurrentTeamStatus,
      currentAssignmentStatus,
      setCurrentAssignmentStatus,
      setResponderId,
      setAccessLevel,
      setResponderName,
      setResponderStatus
    }}>
      {children}
    </IncidentContext.Provider>
  );
};

export const useIncident = () => {
  const context = useContext(IncidentContext);
  if (!context) {
    throw new Error('useIncident must be used within an IncidentProvider');
  }
  return context;
};
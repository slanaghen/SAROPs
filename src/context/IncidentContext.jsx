import React, { createContext, useContext, useState, useEffect } from 'react';

const IncidentContext = createContext();

const STORAGE_KEY = 'sarops_incident_session';

/**
 * Helper to retrieve and validate state from local storage
 */
const getSavedState = (key, defaultValue) => {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return defaultValue;
  try {
    const parsed = JSON.parse(saved);
    return parsed[key] !== undefined ? parsed[key] : defaultValue;
  } catch {
    return defaultValue;
  }
};

export const IncidentProvider = ({ children }) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  // Unified State Initialization
  const [isActive, setIsActive] = useState(() => getSavedState('isActive', false));
  const [incidentId, setIncidentId] = useState(() => getSavedState('incidentId', null));
  const [responderName, setResponderName] = useState(() => getSavedState('responderName', ''));
  const [responderStatus, setResponderStatus] = useState(() => getSavedState('responderStatus', ''));
  const [accessLevel, setAccessLevel] = useState(() => getSavedState('accessLevel', ''));
  const [currentTeamStatus, setCurrentTeamStatus] = useState(() => getSavedState('currentTeamStatus', null));
  const [currentAssignmentStatus, setCurrentAssignmentStatus] = useState(() => getSavedState('currentAssignmentStatus', null));
  const [isAdmin, setIsAdmin] = useState(() => getSavedState('isAdmin', false));
  
  const [responderId, setResponderId] = useState(() => {
    const rid = getSavedState('responderId', null);
    return (rid && uuidRegex.test(rid)) ? rid : null;
  });

  const [incidentData, setIncidentData] = useState(() => {
    const data = getSavedState('incidentData', { name: '', opNumber: '', opPeriodId: '', sartopo_id: null, parInterval: null });
    if (data.opPeriodId && !uuidRegex.test(data.opPeriodId)) data.opPeriodId = '';
    return data;
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

  const startIncident = (id, name, opNumber, opPeriodId, sartopo_id = null, parInterval = null) => {
    setIncidentId(id);
    setIncidentData({ name, opNumber, opPeriodId, sartopo_id, parInterval });
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
    setIncidentData({ name: '', opNumber: '', opPeriodId: '', sartopo_id: null, parInterval: null });
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
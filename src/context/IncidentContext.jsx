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

  const [responderEmail, setResponderEmail] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return '';
      const parsed = JSON.parse(saved);
      return parsed && typeof parsed === 'object' ? parsed.responderEmail || '' : '';
    } catch { return ''; }
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      isActive,
      incidentId,
      responderEmail,
      responderName,
      responderStatus,
      incidentData
    }));
  }, [isActive, incidentId, responderEmail, responderName, responderStatus, incidentData]);

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
    setIncidentId(null);
    setResponderEmail('');
    setResponderName('');
    setResponderStatus('');
    setIncidentData({ name: '', opNumber: '', opPeriodId: '' });
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <IncidentContext.Provider value={{ 
      isActive, 
      incidentId,
      responderEmail,
      responderName,
      responderStatus,
      incidentData, 
      startIncident, 
      endIncident,
      logout,
      setResponderEmail,
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
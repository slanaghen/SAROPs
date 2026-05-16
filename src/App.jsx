import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { supabase } from './lib/supabase';
import { useIncident } from './context/IncidentContext';
import Navigation from './components/Navigation';
import './styles.css';

function App() {
  const [offline, setOffline] = useState(!navigator.onLine);
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then((response) => {
      const session = response?.data?.session;
      setUser(session?.user ?? null);
    });

    // Listen for auth changes (login/logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      if (subscription) subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const handleOnline = () => setOffline(false);
    const handleOffline = () => setOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const { isActive, incidentData, responderName, responderStatus } = useIncident();

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>SAROps</h1>
        <div className={`status-pill ${offline ? 'offline' : 'online'}`}> 
          {offline ? 'Offline' : 'Online'}
        </div>
      </header>

      <div className="incident-banner">
        <div className="banner-item"><strong>Incident:</strong> {isActive ? incidentData?.name || '' : ''}</div>
        <div className="banner-item"><strong>OP:</strong> {isActive ? incidentData?.opNumber || '' : ''}</div>
        <div className="banner-responder">
          <span className="banner-item">
            <strong>Responder:</strong> {responderName || user?.email || ''}
          </span>
          {(responderStatus || user) && (
            <span className={`status-indicator ${(responderStatus || 'online').toLowerCase()}`}>
              {responderStatus || 'Authenticated'}
            </span>
          )}
        </div>
      </div>

      <Navigation />

      <main>
        <Outlet />
      </main>
    </div>
  );
}

export default App;

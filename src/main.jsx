import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import App from './App';
import ResponderCheckinPage from './pages/ResponderCheckinPage';
import PlanningDashboardPage from './pages/PlanningDashboardPage';
import OperationsDashboardPage from './pages/OperationsDashboardPage';
import IncidentEditPage from './pages/IncidentEditPage';
import ResponderDashboardPage from './pages/ResponderDashboardPage';
import AdminPage from './pages/AdminPage';
import { IncidentProvider } from './context/IncidentContext';

/**
 * AdminProtectedRoute
 * Verifies administrative privileges before rendering protected routes.
 */
const AdminProtectedRoute = ({ children }) => {
  const [isAdmin, setIsAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      console.debug('AdminGuard: Auth state changed.', { sessionEmail: session?.user?.email });

      if (!session) {
        console.warn('AdminGuard: No active session found.');
        setIsAdmin(false);
        setLoading(false);
        return;
      }
      
      const userEmail = session.user.email;
      if (!userEmail) {
        console.warn('AdminGuard: Session found, but user email is missing.');
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      // Use maybeSingle() to avoid error noise if no row is found, and trim for safety
      const { data, error: queryError } = await supabase
        .from('admin_users')
        .select('email')
        .eq('email', userEmail.toLowerCase().trim()) // Ensure case-insensitive and trimmed check
        .maybeSingle();

      if (queryError) {
        console.error('AdminGuard: Database query error:', queryError);
      }

      if (!data) {
        const { data: responderData } = await supabase
          .from('responders')
          .select('access_level')
          .eq('email', userEmail.toLowerCase().trim())
          .maybeSingle();

        console.warn(`Admin Access Rejected: User ${userEmail} (Access Level: ${responderData?.access_level || 'Not Checked-In'})`);
      }

      setIsAdmin(!!data);
      setLoading(false);
    });

    return () => {
      if (subscription) subscription.unsubscribe();
    };
  }, []);
  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Verifying permissions...</div>;
  if (!isAdmin) return <Navigate to="/" replace />;

  return children;
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <IncidentProvider>
      <Routes>
        <Route path="/" element={<App />}>
          <Route index element={<ResponderCheckinPage />} />
          <Route path="checkin" element={<ResponderCheckinPage />} />
          <Route path="planning" element={<PlanningDashboardPage />} />
          <Route path="operations" element={<OperationsDashboardPage />} />
          <Route path="responder-dashboard" element={<ResponderDashboardPage />} />
          <Route path="incident-edit" element={<IncidentEditPage />} />
          <Route path="admin" element={<AdminProtectedRoute><AdminPage /></AdminProtectedRoute>} />
        </Route>
      </Routes>
      </IncidentProvider>
    </BrowserRouter>
  </React.StrictMode>
);

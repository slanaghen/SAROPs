import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import App from './App';
import ResponderCheckinPage from './pages/ResponderCheckinPage';
import PlanningDashboardPage from './pages/PlanningDashboardPage';
import OperationsDashboardPage from './pages/OperationsDashboardPage';
import IncidentEditPage from './pages/IncidentEditPage';
import CheckOutPage from './pages/CheckOutPage';
import ResponderDashboardPage from './pages/ResponderDashboardPage';
import AdminPage from './pages/AdminPage';
import ActionLogPage from './pages/ActionLogPage';
import { IncidentProvider } from './context/IncidentContext';

const AdminProtectedRoute = ({ children }) => {
  const { isAdmin } = useIncident();
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
          <Route path="checkout" element={<CheckOutPage />} />
          <Route path="planning" element={<PlanningDashboardPage />} />
          <Route path="operations" element={<OperationsDashboardPage />} />
          <Route path="responder-dashboard" element={<ResponderDashboardPage />} />
          <Route path="incident-edit" element={<IncidentEditPage />} />
          <Route path="admin" element={<AdminPage />} />
          <Route path="action-log" element={<ActionLogPage />} />
        </Route>
      </Routes>
      </IncidentProvider>
    </BrowserRouter>
  </React.StrictMode>
);

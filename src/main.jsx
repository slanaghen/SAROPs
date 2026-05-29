import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { Navigate, createBrowserRouter, RouterProvider } from 'react-router-dom';
import App from './App';
import ResponderCheckinPage from './pages/ResponderCheckinPage';
import PlanningDashboardPage from './pages/PlanningDashboardPage';
import IncidentEditPage from './pages/IncidentEditPage';
import CheckOutPage from './pages/CheckOutPage';
import ResponderDashboardPage from './pages/ResponderDashboardPage';
import AdminPage from './pages/AdminPage';
import ActionLogPage from './pages/ActionLogPage';
import LoginPage from './pages/LoginPage';
import ErrorPage from './components/ErrorPage';
import ICSAssignmentPage from './pages/ICSAssignmentPage';
import SARTopoDataPage from './pages/SARTopoDataPage';
import QRCodesPage from './pages/QRCodesPage';
import GoogleICSFormsPage from './pages/GoogleICSFormsPage';
import SettingsPage from './pages/SettingsPage';
import { IncidentProvider, useIncident } from './context/IncidentContext';

const OperationsDashboardPage = lazy(() => import('./pages/OperationsDashboardPage'));

const AdminProtectedRoute = ({ children }) => {
  const { accessLevel, isAdmin } = useIncident();
  if (!isAdmin || accessLevel !== 'admin') return <Navigate to="/operations" replace />;
  return children;
};

const StaffProtectedRoute = ({ children }) => {
  const { accessLevel, isAdmin } = useIncident();
  const isStaff = isAdmin && (accessLevel === 'staff' || accessLevel === 'admin');
  if (!isStaff) return <Navigate to="/responder" replace />;
  return children;
};

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: <ResponderCheckinPage /> },
      { path: "checkin", element: <ResponderCheckinPage /> },
      { path: "login", element: <LoginPage /> },
      { path: "checkout", element: <CheckOutPage /> },
      { path: "planning", element: <StaffProtectedRoute><PlanningDashboardPage /></StaffProtectedRoute> },
      { 
        path: "operations", 
        element: (
          <StaffProtectedRoute><Suspense fallback={
            <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
              Loading Operations Dashboard...
            </div>
          }>
            <OperationsDashboardPage />
          </Suspense></StaffProtectedRoute>
        ) 
      },
      { path: "responder", element: <ResponderDashboardPage /> },
      { path: "incident", element: <StaffProtectedRoute><IncidentEditPage /></StaffProtectedRoute> },
      { path: "admin", element: <AdminProtectedRoute><AdminPage /></AdminProtectedRoute> },
      { path: "settings", element: <SettingsPage /> },
      { path: "action-log", element: <StaffProtectedRoute><ActionLogPage /></StaffProtectedRoute> },
      { path: "qrcodes", element: <QRCodesPage /> },
      { path: "sartopo", element: <StaffProtectedRoute><SARTopoDataPage /></StaffProtectedRoute> },
      { path: "ics", element: <ICSAssignmentPage /> },
      { path: "google-ics", element: <StaffProtectedRoute><GoogleICSFormsPage /></StaffProtectedRoute> },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <IncidentProvider>
      <RouterProvider router={router} />
    </IncidentProvider>
  </React.StrictMode>
);

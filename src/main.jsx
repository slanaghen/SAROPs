import React from 'react';
import ReactDOM from 'react-dom/client';
import { Navigate, createBrowserRouter, RouterProvider } from 'react-router-dom';
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

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <ResponderCheckinPage /> },
      { path: "checkin", element: <ResponderCheckinPage /> },
      { path: "checkout", element: <CheckOutPage /> },
      { path: "planning", element: <PlanningDashboardPage /> },
      { path: "operations", element: <OperationsDashboardPage /> },
      { path: "responder-dashboard", element: <ResponderDashboardPage /> },
      { path: "incident-edit", element: <IncidentEditPage /> },
      { path: "admin", element: <AdminPage /> },
      { path: "action-log", element: <ActionLogPage /> },
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

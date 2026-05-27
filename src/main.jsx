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
import ErrorPage from './components/ErrorPage';
import ICSAssignmentPage from './pages/ICSAssignmentPage';
import SARTopoDataPage from './pages/SARTopoDataPage';
import QRCodesPage from './pages/QRCodesPage';
import PDFsPage from './pages/PDFsPage';
import GoogleICSFormsPage from './pages/GoogleICSFormsPage';
import { IncidentProvider, useIncident } from './context/IncidentContext';

const OperationsDashboardPage = lazy(() => import('./pages/OperationsDashboardPage'));

const AdminProtectedRoute = ({ children }) => {
  const { isAdmin } = useIncident();
  if (!isAdmin) return <Navigate to="/" replace />;
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
      { path: "checkout", element: <CheckOutPage /> },
      { path: "planning", element: <PlanningDashboardPage /> },
      { 
        path: "operations", 
        element: (
          <Suspense fallback={
            <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
              Loading Operations Dashboard...
            </div>
          }>
            <OperationsDashboardPage />
          </Suspense>
        ) 
      },
      { path: "responder", element: <ResponderDashboardPage /> },
      { path: "incident", element: <IncidentEditPage /> },
      { path: "admin", element: <AdminPage /> },
      { path: "action-log", element: <ActionLogPage /> },
      { path: "qrcodes", element: <QRCodesPage /> },
      { path: "sartopo", element: <SARTopoDataPage /> },
      { path: "pdfs", element: <PDFsPage /> },
      { path: "ics", element: <ICSAssignmentPage /> },
      { path: "google-ics", element: <GoogleICSFormsPage /> },
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

import { useLocation, Navigate, Outlet } from 'react-router-dom';
import { useIncident } from '../context/IncidentContext';

/**
 * A route guard that ensures a user is checked into an active incident.
 * If the user is not active, it redirects them to the /checkin page,
 * preserving the route they intended to visit for after they check in.
 *
 * This component allows access to specific public routes like /checkin and /login.
 */
const ProtectedRoute = () => {
  const { isActive } = useIncident();
  const location = useLocation();

  const isPublicPage = location.pathname === '/checkin' || location.pathname === '/login';

  if (!isActive && !isPublicPage) {
    // Redirect them to the /checkin page, but save the current location they were
    // trying to go to. This allows for redirection after a successful check-in.
    return <Navigate to="/checkin" state={{ from: location }} replace />;
  }

  return <Outlet />; // Render the child route component if the user is active.
};

export default ProtectedRoute;
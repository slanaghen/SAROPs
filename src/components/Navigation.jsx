import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useIncident } from '../context/IncidentContext';

/**
 * Navigation Component (Menu Ribbon)
 * 
 * Provides a top-level menu to switch between major incident views.
 */
const Navigation = () => {
  const location = useLocation();
  const path = location.pathname;
  const { isAdmin, accessLevel, isActive } = useIncident();
  const isStaffOrAdmin = isAdmin && (accessLevel === 'staff' || accessLevel === 'admin');

  return (
    <nav className="menu-ribbon">
      <div className="nav-container">
        {isActive && isStaffOrAdmin && (
          <>
            <Link to="/operations" className={`nav-tab ${path === '/operations' ? 'active' : ''}`}>Operations</Link>
            <Link to="/planning" className={`nav-tab ${path.startsWith('/planning') ? 'active' : ''}`}>Planning</Link>
          </>
        )}
        <Link to="/checkin" className={`nav-tab ${path === '/checkin' ? 'active' : ''}`}>
          Check-In
        </Link>
        <Link to="/checkout" className={`nav-tab ${path === '/checkout' ? 'active' : ''}`}>
          Check-Out
        </Link>
        {isActive && (
          <Link to="/responder" className={`nav-tab ${path === '/responder' ? 'active' : ''}`}>My Dashboard</Link>
        )}
        {isStaffOrAdmin && (
          <Link to="/incident" className={`nav-tab ${path === '/incident' ? 'active' : ''}`}>Incident</Link>
        )}
        {isActive && <Link to="/ics" className={`nav-tab ${path === '/ics' ? 'active' : ''}`}>
          ICS Chart
        </Link>}
        {isActive && <Link to="/qrcodes" className={`nav-tab ${path === '/qrcodes' ? 'active' : ''}`}>
          QR Codes
        </Link>}
        {isActive && isStaffOrAdmin && (
          <>
            <Link to="/sartopo" className={`nav-tab ${path === '/sartopo' ? 'active' : ''}`}>SARTopo</Link>
            <Link to="/pdfs" className={`nav-tab ${path === '/pdfs' ? 'active' : ''}`}>PDFs</Link>
          </>
        )}
        {accessLevel === 'admin' ? (
          <Link to="/admin" className={`nav-tab ${path === '/admin' ? 'active' : ''}`}>Admin</Link>
        ) : (
          <Link to="/login" className={`nav-tab ${path === '/login' ? 'active' : ''}`}>Login</Link>
        )}
      </div>
    </nav>
  );
};

export default Navigation;
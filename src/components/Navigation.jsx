import React from 'react';
import { Link, useLocation } from 'react-router-dom';

/**
 * Navigation Component (Menu Ribbon)
 * 
 * Provides a top-level menu to switch between major incident views.
 */
const Navigation = () => {
  const location = useLocation();
  const path = location.pathname;

  return (
    <nav className="menu-ribbon">
      <div className="nav-container">
        <Link to="/operations" className={`nav-tab ${path === '/operations' ? 'active' : ''}`}>
          Operations
        </Link>
        <Link to="/planning" className={`nav-tab ${path.startsWith('/planning') ? 'active' : ''}`}>
          Planning
        </Link>
        <Link to="/checkin" className={`nav-tab ${path === '/checkin' ? 'active' : ''}`}>
          Check-In
        </Link>
        <Link to="/checkout" className={`nav-tab ${path === '/checkout' ? 'active' : ''}`}>
          Check-Out
        </Link>
        <Link to="/responder-dashboard" className={`nav-tab ${path === '/responder-dashboard' ? 'active' : ''}`}>
          My Dashboard
        </Link>
        <Link to="/incident" className={`nav-tab ${path === '/incident' ? 'active' : ''}`}>
          Incident
        </Link>
        <Link to="/ics" className={`nav-tab ${path === '/ics' ? 'active' : ''}`}>
          ICS Organization Chart
        </Link>
        <Link to="/qrcodes" className={`nav-tab ${path === '/qrcodes' ? 'active' : ''}`}>
          QR Codes
        </Link>
        <Link to="/admin" className={`nav-tab ${path === '/admin' ? 'active' : ''}`}>
          Admin
        </Link>
      </div>
    </nav>
  );
};

export default Navigation;
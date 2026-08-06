# SAROps Application Banner Specification

This document provides a complete technical specification for the main application banner that appears at the top of every page. The banner provides at-a-glance context about the user's session, incident status, and provides access to global navigation.

---

## 1. Banner Layout

The banner is divided into three main sections, laid out horizontally using Flexbox:

1.  **Left Section (`banner-left`)**: Contains application branding and the database instance indicator.
2.  **Center Section (`banner-item`)**: Displays the current operational context (Incident Name and OP Number).
3.  **Right Section (`banner-right`)**: Shows user identity, status, notifications, and the main navigation menu.

---

## 2. Banner Elements and Functionality

### Left Section

*   **SAROps Logo & Title**:
    *   **Content**: The SAROps application logo and title text.
    *   **Behavior**: Always visible. Acts as a home link, typically navigating to `/checkin` or the user's primary dashboard.

*   **Database Instance Indicator**:
    *   **Content**: A small status chip displaying either `LOCAL` or `REMOTE`.
    *   **Source**: The value comes from the `SAROPS_DB_INSTANCE` constant, which is determined at application startup based on environment variables and `localStorage`.
    *   **Behavior**: Always visible. Provides developers and administrators with immediate feedback on which database the application is connected to.

### Center Section

*   **Incident Name & OP Number**:
    *   **Content**: Displays the name of the active incident and the current operational period number (e.g., "Lost Hiker — OP #1").
    *   **Source**: `incidentData.name` and `incidentData.opNumber` from the `useIncident` context.
    *   **Visibility**: This section is only visible when an incident is active (`isActive` is true).

### Right Section

*   **User & Access Level**:
    *   **Content**: Displays the name of the current user (`responderName`) and their access level (`accessLevel`) for the current session (e.g., "John Doe (Staff)").
    *   **Source**: `responderName` and `accessLevel` from the `useIncident` context.
    *   **Fallback**: If `responderName` is not available, it falls back to displaying the user's email or "Guest".

*   **Status Indicator**:
    *   **Content**: A status chip showing the user's current operational status (e.g., `Staged`, `Attached`, `Deployed`, `CheckedOut`).
    *   **Source**: `responderStatus` from the `useIncident` context.
    *   **Visibility**: Visible when an incident is active or the user's status is `CheckedOut`.

*   **Notification Icons**:
    *   **Connectivity Dot**: A small green (`online`) or red (`offline`) dot indicating the browser's network connectivity.
    *   **Unread Messages**: A red dot (`unread-indicator`) appears over the menu icon if `hasUnreadMessages` is true. Clicking it navigates the user to their dashboard's messaging section.
    *   **Notifications Blocked**: A `!` icon appears if browser notifications have been denied by the user, indicating that some alerts may not be delivered.

*   **Main Menu (Hamburger Icon)**:
    *   **Behavior**: Toggles a dropdown menu with navigation links.
    *   **Visibility**: Always visible when a user is authenticated.

---

## 3. Main Menu Dropdown

The dropdown menu provides conditional navigation links based on the user's access level and the application's state.

### General Links
*   **My Dashboard**: Navigates to `/responder`. Visible only when an incident is `isActive`.
*   **Settings**: Navigates to `/settings`. Visible only when an incident is `isActive`.
*   **ICS Chart**: Navigates to `/ics-chart`. Visible only when an incident is `isActive`.
*   **QR Codes**: Navigates to `/qr-codes`. Visible only when an incident is `isActive`.
*   **Check Out**: Triggers the user check-out process. Visible only when an incident is `isActive`.
*   **Live Feed**: Navigates to the SARStream URL. Visible only if `incidentData.sarstream_enabled` is true and a valid URL exists.
*   **Sign Out**: Logs the user out of the application. Always visible.

### Staff & Admin Links
*   **Operations**: Navigates to `/operations`. Visible for `Staff` and `Admin` users.
*   **Planning**: Navigates to `/planning`. Visible for `Staff` and `Admin` users.
*   **Incident**: Navigates to `/incident` to edit the current incident. Visible for `Staff` and `Admin` users.
*   **Action Log**: Navigates to `/action-log`. Visible for `Staff` and `Admin` users.
*   **SARTopo**: Navigates to `/sartopo-data`. Visible for `Staff` and `Admin` users.
*   **Google Forms**: Navigates to `/gforms`. Visible for `Staff` and `Admin` users.

### Admin-Only Links
*   **Administration**: Navigates to `/admin`. Visible only for `Admin` users.

### Development Tools
*   **DB Switcher**: A toggle to switch between `LOCAL` and `REMOTE` database instances. This should ideally be hidden in production builds.

---

## 4. Display Density

The banner's appearance adapts to the user's `display_density` setting.

*   **`density-comfortable` (Default)**: Standard padding, font sizes, and element spacing.
*   **`density-compact`**: Reduced padding and smaller font sizes to ensure all elements fit on smaller screens without wrapping or overflow. This is triggered by the `compact-mode` class on the main application shell.
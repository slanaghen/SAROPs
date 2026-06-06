# SAROps Navigation and Access Control

This document outlines the page structure, navigation flows, and access restrictions within the SAROps application based on user roles and session states.

## 1. User Roles and Access Levels

| Level | Description |
| :--- | :--- |
| **Anonymous** | Initial state upon visiting. Uses a temporary anonymous session to browse active incidents or check in. |
| **Responder** | Field personnel checked into an incident. Access is restricted to field-specific tools. |
| **Staff** | Incident management personnel. Full access to operational and planning tools. |
| **Admin** | System administrators. Full operational access plus system-wide configuration and user management. |

## 2. Page Access Matrix

| Path | Page Name | Anonymous | Responder | Staff | Admin |
| :--- | :--- | :---: | :---: | :---: | :---: |
| `/checkin` | Responder Check-in | ✅ | ✅ | ✅ | ✅ |
| `/login` | System User Login | ✅ | ✅ | ✅ | ✅ |
| `/responder` | Responder Dashboard | ❌ | ✅ | ✅ | ✅ |
| `/settings` | User Settings | ❌ | ✅ | ✅ | ✅ |
| `/ics` | ICS Chart (Read-only) | ❌ | ✅ | ✅ | ✅ |
| `/qrcodes` | QR Code Display | ✅ | ✅ | ✅ | ✅ |
| `/checkout` | Check Out Page | ❌ | ✅ | ✅ | ✅ |
| `/operations`| Operations Dashboard | ❌ | ❌ | ✅ | ✅ |
| `/planning` | Planning Dashboard | ❌ | ❌ | ✅ | ✅ |
| `/incident` | Incident Management | ❌ | ❌ | ✅ | ✅ |
| `/action-log`| Action Log | ❌ | ❌ | ✅ | ✅ |
| `/sartopo` | SARTopo Integration | ❌ | ❌ | ✅ | ✅ |
| `/admin` | System Administration| ❌ | ❌ | ❌ | ✅ |

## 3. Navigation Flows

### Check-in & Login Flow
*   **New Responders**: Land on `/checkin`. After successful check-in, they are redirected to `/responder`.
*   **System Users**: Use the `/login` page. 
    *   If a **Responder** logs in and checks into an incident, they go to `/responder`.
    *   If **Staff** logs in and checks into an incident, they go to `/operations`.
    *   If an **Admin** logs in without checking into an incident, they are directed to `/admin`.

### Automatic Redirection (Guards)
The application implements several "App Guards" to enforce access levels:
*   **Session Guard**: Users attempting to access operational pages without an active incident session or admin identity are redirected to `/checkin`.
*   **Role Enforcement**: 
    *   **Responders** attempting to access Staff-only pages (like `/operations` or `/planning`) are automatically redirected back to `/responder`.
    *   **Staff** members attempting to access the `/admin` page are redirected to `/operations`.

## 4. Security Mechanisms

### Protected Routes (`main.jsx`)
*   **`StaffProtectedRoute`**: Wraps operational pages. It checks if the user is an Admin and has an access level of either `staff` or `admin`.
*   **`AdminProtectedRoute`**: Wraps the administration page. It requires both the `isAdmin` flag and the `admin` access level.

### UI Visibility (`App.jsx`)
The navigation menu (hamburger menu) dynamically shows or hides links based on the current user's `accessLevel`:
*   **Staff/Admin** see: Operations, Planning, Incident, Action Log, SARTopo Data, and Google ICS Forms.
*   **Admins** see: Administration.
*   **Everyone (Active)** see: My Dashboard, Settings, ICS Chart, and QR Codes.

---

*Note: Access is also governed by an "Active" session state. Most tools require a responder to be checked in (`isActive`) to display incident-specific data.*
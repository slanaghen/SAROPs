# SAROps Application Architecture

This document provides a comprehensive overview of the SAROps technical architecture, detailing the roles of each layer and how they interact to maintain operational integrity during search and rescue missions.

---

## 1. High-Level Overview

SAROps follows a **"Thick Database"** architectural pattern. While the frontend handles the UI and user interactions, the core business logic, status state machines, and relational integrity are enforced directly within the PostgreSQL database using triggers and functions. This ensures that regardless of which client (mobile, laptop, or admin tool) modifies a record, the operational state remains consistent.

---

## 2. Frontend Layer (React PWA)

The frontend is a Progressive Web App (PWA) built with React 18 and Vite.

*   **Framework**: React (TypeScript/JSX) for component-based UI.
*   **State Management**:
    *   **Context API**: Global state for incident metadata, user identity, and notifications (`IncidentContext`, `ToastContext`).
    *   **Custom Hooks**: Business logic for specific dashboards (e.g., `usePlanningDashboard`, `useResponderTeamAndAssignment`) handles data fetching, real-time subscriptions, and local optimistic updates.
*   **Navigation**: `react-router-dom` with guarded routes (`AdminProtectedRoute`, `StaffProtectedRoute`) enforcing access levels.
*   **Local Storage/Caching**: 
    *   `localStorage`: Used for user preferences (display density) and session persistence.
    *   **IndexedDB**: Used for heavy GIS data caching to enable smooth map performance and offline-ready features.

---

## 3. Backend & Database Layer (Supabase/PostgreSQL)

Supabase provides the infrastructure, while PostgreSQL 15+ hosts the logic.

*   **Data Model**: A relational schema (`Incidents` -> `Operational Periods` -> `Teams/Assignments` -> `Responders`).
*   **Business Logic (Triggers)**: 
    *   Automates status cascading (e.g., when an Assignment is marked `Deployed`, the linked Team and all its Responders automatically transition to `Deployed`).
    *   Handles automated resource creation (e.g., creating a "Staff" team for every new Operational Period).
*   **Remote Procedure Calls (RPCs)**: PostgreSQL functions exposed as API endpoints for complex, multi-table operations like `checkin_responder_securely` or `start_next_operational_period`.
*   **Views**: Complex joins and aggregations (like `team_current_responders`) are handled via database views to simplify frontend queries and ensure consistent data shapes.

---

## 4. Security & Identity

*   **Identity**: 
    *   **Anonymous Sessions**: Field responders use Supabase `signInAnonymously` for immediate, low-friction check-in.
    *   **System Users**: Staff and Admins use email/password authentication.
*   **Authorization (RLS)**: **Row Level Security** is the primary security mechanism. Every table has policies that check the `auth.uid()` or the user's `access_level` claim in their JWT to permit or deny access to specific rows.
*   **Operational Access**: Access levels (`responder`, `staff`, `admin`) determine which dashboards and management tools are visible and usable.

---

## 5. Real-time & Synchronization

*   **Supabase Realtime**: Uses WebSockets to listen for `INSERT`, `UPDATE`, and `DELETE` events on specific tables. This allows the Operations Dashboard to reflect status changes or new messages instantly across all connected devices.
*   **Polling Fallback**: Some dashboards implement periodic background refreshes (configurable via Admin settings) as a secondary sync mechanism.

---

## 6. Third-Party Integrations

SAROps acts as an orchestrator for several external services:

*   **SARTopo (GIS)**: 
    *   **Signed Requests**: Uses API Credentials to build secure, signed URLs for reading and writing map features.
    *   **Incremental Sync**: Fetches only new/updated features since the last sync to minimize bandwidth.
*   **SARStream (Live Video)**: 
    *   Performs authenticated `POST` requests to initialize live streaming sessions.
    *   Stores session metadata (`sarstream_data`) directly in the incident record for global access.
*   **Google Sheets**: 
    *   Uses a proxy service to bypass CORS and interact with the Google Sheets API.
    *   Maps SAROps context fields to Google Sheets "Named Ranges" for automated ICS form generation.

---

## 7. Interaction Flow Example: Assignment Deployment

1.  **Frontend**: A Team Leader clicks "Deploy" on the `ResponderDashboardPage`.
2.  **API Call**: The frontend performs a Supabase `update` on the `assignments` table, setting `status = 'Deployed'`.
3.  **Database (Trigger)**: The `trigger_sync_team_status_from_assignment` fires.
    *   It identifies the `team_id` linked to the assignment.
    *   It updates the `teams` record to `status = 'Deployed'`.
4.  **Database (Cascading Trigger)**: The `sync_team_status_on_team_update` fires.
    *   It identifies all responders currently in `team_responders` for that team.
    *   It updates those `responders` records to `status = 'Deployed'`.
5.  **Real-time**: All active clients (Operations Dashboard, Planning, etc.) receive the update events via WebSockets and refresh their local UI state.
6.  **Audit**: An entry is automatically created in `action_logs` documenting the transition.

---

## 8. Development & Deployment

*   **Environment**: Vite handles environment variables for API keys and database URLs.
*   **Proxy**: A development proxy (`vite.config.js`) routes API requests to bypass CORS restrictions for SARTopo and Google Sheets during local work.
*   **CI/CD**: Typically deployed to Vercel or DigitalOcean for the frontend, with Supabase managing the database migrations and Edge functions.

---
*Document Version: 1.0 (June 2026)*
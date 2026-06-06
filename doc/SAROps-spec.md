# SAROps MVP Specification

## Purpose
SAROps is a web application for public safety emergency services management to support incident management and situational awareness during the first Operational Period (OP1) for a Level 4 or 5 incident.

## Architecture
- Framework: Progressive Web App (PWA)
- Frontend: React with Vite
- Pattern: Component-based with React Hooks for business logic
- Navigation: Guarded routing based on Session State and Access Levels (Anonymous, Responder, Staff, Admin)
- State Management: React Context API for session/incident metadata; Custom Hooks for operational data synchronization
- Data Model: Relational schema in PostgreSQL (Incidents, Operational Periods, Responders, Teams, Assignments)
- Data Sync: Supabase Realtime (Postgres Changes) for live updates across all dashboards
- Backend Logic: Thick-database approach using PostgreSQL Functions and Triggers for operational integrity and status synchronization

## Key Goals
- MVP focused on initial tasking and deployment during OP1
- Work across laptops and mobile devices
- Enable offline input capture and later synchronization
- Support real-time updates for status, mapping, image, and message flows
- Cloud-hosted database for production; local laptop development for initial work

## Security and Access Control
### Identity Management
- **Anonymous Sessions**: Temporary access for field responders during initial check-in via `signInAnonymously`.
- **System Users**: Persistent accounts for Staff and Admins using email-based authentication.

### Authorization (RLS)
- **Row Level Security**: Access to data is strictly enforced at the database level based on `auth.uid()` and `access_level`.
- **Guard Components**: `AdminProtectedRoute` and `StaffProtectedRoute` enforce role-based access for specific dashboards and administrative tools.

## Operational Logic (Database Triggers)
The system uses server-side triggers to maintain "operational parity," automating transitions across entities:
- **Status Sync**: Synchronizes status changes between Assignments, Teams, and Responders (e.g., Deployed Assignment -> Deployed Team -> Deployed Responders).
- **Integrity**: Automatically manages Team membership history, clears leadership upon checkout, and performs bulk cleanup when an incident ends.
- **Staff Automation**: Automatically creates a "Staff" team and "Command Staff" assignment for every new Operational Period.

## Technology Stack
- Frontend: React 18+, Vite, Typescript
- Styling: Scoped CSS/Stylesheets
- Database: Supabase (PostgreSQL 15+)
- Realtime: Supabase Realtime (WebSockets)
- Authentication: Supabase Auth (GoTrue)
- Hosting: DigitalOcean / Vercel (Frontend), Supabase (Backend/DB)

## Project Structure
- `/src` - React application source
- `/src/components` - UI components (Admin, Dashboards, Mapping)
- `/src/context` - Global state providers (Incident, Auth)
- `/src/hooks` - Operational logic and data synchronization hooks
- `/src/services` - Supabase-specific CRUD and RPC operations
- `/public` - static PWA assets

## Core Operational Entities
1. **Incident**: The root object containing all operational data.
2. **Operational Period (OP)**: Time-bounded slices of an incident.
3. **Responder**: Personnel checked into the incident with a specific `status` and `access_level`.
4. **Team**: A grouping of responders (Hasty, Ground, UAS, Staff, etc.) assigned to an OP.
5. **Assignment**: Tasks defined by Planning and assigned to specific Teams.

## Next Steps
1. Implement PWA service worker for full offline asset caching.
2. Integrate PowerSync / SQLite local mirror for offline-first data persistence.
3. Expand SARTopo real-time synchronization for geospatial assets.
4. Develop automated PDF reporting for ICS forms (e.g., ICS 204).

---

> Notes: Capture future design decisions, API routes, and sync workflows in this project file as the SAROps MVP evolves.

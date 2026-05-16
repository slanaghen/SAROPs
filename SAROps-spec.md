# SAROps MVP Specification

## Purpose
SAROps is a web application for public safety emergency services management to support incident management and situational awareness during the first Operational Period (OP1) for a Level 4 or 5 incident.

## Architecture
- Framework: Progressive Web App (PWA)
- Frontend: React with Vite
- Pattern: Conventional Model / View / Controller
- Offline-first: local cache + upload sync when reconnected
- Data model: JSON-LD linked data for incident assets, tasks, assignments, and status
- Sync: Supabase cloud Postgres + PowerSync + local SQLite mirror
- Event architecture: Node.js / Socket.io event-driven backend for triggers and fan-out actions

## Key Goals
- MVP focused on initial tasking and deployment during OP1
- Work across laptops and mobile devices
- Enable offline input capture and later synchronization
- Support real-time updates for status, mapping, image, and message flows
- Cloud-hosted database for production; local laptop development for initial work

## Components
### Model
- JSON-LD based definitions for:
  - Incident
  - Task
  - Resource
  - Assignment
  - Status update
  - Location / geospatial data
  - Media / images

### View
- React views for:
  - Incident dashboard
  - Task list and assignment board
  - Map / position awareness
  - Status and timeline
  - Offline sync indicator

### Controller
- React controllers / hooks handle:
  - User input
  - Data validation
  - Offline queueing
  - Sync operations
  - Event triggers

### Event-driven Actions
- Single trigger (e.g. voice command or button press) can:
  - update the database
  - send notifications to Slack or responder channels
  - refresh images or map overlays
  - create and assign tasks

## Technology Stack
- Frontend: React, Vite, PWA service worker
- Backend: Node.js / Socket.io event bus
- Database: Supabase Postgres, local SQLite via PowerSync
- Hosting: cloud database on DigitalOcean or AWS; local dev on laptop
- Offline: browser caches, IndexedDB/SQLite, retry queue

## Project Structure
- `/src` - React application source
- `/public` - static PWA assets
- `package.json` - build and run scripts
- `README.md` - developer guidance

## Next Steps
1. Build JSON-LD schema definitions for incident and task models.
2. Scaffold React views for dashboard and assignment management.
3. Add PWA service worker with offline caching.
4. Integrate Supabase auth and realtime sync.
5. Add PowerSync / SQLite local mirror support.
6. Add Node.js + Socket.io backend event handler for commands.

---

> Notes: Capture future design decisions, API routes, and sync workflows in this project file as the SAROps MVP evolves.

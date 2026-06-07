# SAROps Project Dependencies

This document tracks the system, development, and runtime dependencies required to build, run, and maintain the SAROps platform.

## 1. System Requirements
- **Node.js**: Required for the React/Vite development environment and build processes. (LTS version recommended).
- **npm**: Package manager for managing frontend dependencies.
- **Docker Desktop**: Required to run the local Supabase stack (PostgreSQL, Auth, etc.).
- **Bash/Zsh Shell**: Required for executing database maintenance scripts like `reinit-db.sh`.

## 2. Development Tools
- **Supabase CLI**: Essential for managing the local database, RLS policies, migrations, and executing SQL queries against the local stack.
- **Vite**: The build tool and development server used for the React PWA.
- **Vitest**: The testing framework used for unit and functional tests.
- **React Testing Library**: Used for component-level testing.

## 3. Core Libraries & Frameworks
- **React**: The primary UI framework.
- **React Router (`react-router-dom`)**: Handles application navigation and routing guards.
- **Supabase JS SDK (`@supabase/supabase-js`)**: Client-side library for interacting with the database, handling Auth, and managing real-time subscriptions.
- **PowerSync**: Integrated for local-first data synchronization and offline-first capabilities.
- **pdf-lib**: Used for programmatic filling and generation of operational PDF documents.
- **uuid**: Used for generating unique identifiers (v4) for client-side entity creation.

## 4. Database Dependencies (PostgreSQL)
- **PostgreSQL**: The underlying database engine.
- **pgcrypto Extension**: Required for secure password hashing (`crypt`, `gen_salt`) and UUID generation within SQL functions.
- **PostgREST**: (Provided by Supabase) used to expose the database schema as a RESTful API.

## 5. External Integrations
- **SARTopo API**: 
    - Requires API Credentials (`VITE_SARTOPO_API_CREDENTIAL_ID`).
    - Requires API Secret (`VITE_SARTOPO_API_CREDENTIAL_SECRET`).
    - Used for collaborative mapping and data sync.
- **Google Cloud Platform**:
    - **Google Sheets API**: For data synchronization with spreadsheets.
    - **Service Accounts**: Required for backend-to-backend write access to private sheets.

## 6. Authentication Providers
- **Supabase Auth**:
    - **Anonymous Sign-in**: Used for initial field check-ins.
    - **Email/Password**: Used for administrative and staff access.

---
*Last updated: June 2024*
*Refer to `package.json` for specific version numbers of npm packages.*
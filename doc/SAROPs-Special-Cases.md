# SAROps Special Cases and Unusual Flows

This document details specific behaviors, validations, and automated processes within the SAROps application that deviate from standard CRUD (Create, Read, Update, Delete) operations or typical user interactions. These often involve cascading database logic, role-based restrictions, or system-level automations.

---

## 1. Incident Creation Permissions

**Description**: The ability to create new incidents is restricted to `Staff` and `Admin` level users only. This prevents unauthorized or accidental incident creation by field responders.

*   **Flow**:
    *   `Staff` and `Admin` users can initiate new incident creation from the `/login` page (via the "Start New Incident" option in the dropdown) or directly from the `/admin` page.
    *   `Responder` level users attempting to select "Start New Incident" on the `/login` page will receive an error indicating they lack permission.
    *   The "Create an incident" option is explicitly removed from the "Select active incident" dropdown list on the `/checkin` page, ensuring responders cannot access this functionality.
    *   **Database Enforcement**: Row Level Security (RLS) policies on the `incidents`, `operational_periods`, `teams`, and `assignments` tables strictly enforce that only users passing the `check_is_operational_staff()` check can perform `INSERT` operations (creation) or management tasks.

---

## 2. First Responder as Incident Commander (IC) Logic

**Description**: When the very first responder checks into an incident, the system automatically assigns them as the Incident Commander (IC) and grants them `Staff` level access for that incident. This streamlines the initial setup of a command structure.

*   **Flow**:
    1.  A responder checks into an incident that currently has no assigned leader for its "Staff" team in the latest operational period.
    2.  A database trigger (`trigger_first_responder_ic_check`) automatically identifies the "Staff" team.
    3.  The responder is added to the "Staff" team with the role "Incident Commander".
    4.  The responder's `access_level` within the `responders` table for that incident is updated to `staff`.
    5.  The responder is then automatically directed to the `/operations` dashboard instead of `/responder`.

---

## 3. Responder Check-out Restrictions

**Description**: To maintain operational integrity, responders cannot simply check out from an incident if they are actively deployed or attached to a team.

*   **Flow**:
    *   A responder attempting to check out via the `/checkout` page must have their `responderStatus` set to `Staged`.
    *   If a responder is `Attached`, `Assigned`, or `Deployed`, their check-out will be blocked with an error message, instructing them to be released from their team/assignment first.
    *   **Special Case: Team Leader**: A Team Leader cannot leave their team (transition to `Staged` status) if their team or assignment is `Deployed`. This prevents a deployed team from losing its leader without appropriate action from command staff or completion of the assignment.

---

## 4. Responder Double-Attachment Prevention

**Description**: A responder cannot be actively assigned to more than one team at a time, ensuring accurate resource tracking and preventing operational conflicts.

*   **Flow**:
    *   When an `Admin` attempts to add a responder to a team via the `/admin` page or a `Staff` member does so via the `/planning` dashboard, the system validates the responder's current status.
    *   Only responders with a `Staged` status are considered available.
    *   If a responder is `Attached`, `Assigned`, or `Deployed` (meaning they are already on another active team), the system will prevent the addition and display an error.

---

## 5. Automated Incident End Cleanup

**Description**: When an incident is formally ended, a cascading cleanup process is automatically triggered in the database to transition all associated resources to appropriate terminal states.

*   **Flow**:
    1.  An `Admin` or `Staff` member sets the `end_datetime` for an incident on the `/incident` or `/admin` page.
    2.  A database trigger (`trigger_incident_cleanup_on_end` or similar) is activated.
    3.  This trigger then calls a PostgreSQL function (`cleanup_resources_on_incident_end`) that:
        *   Marks all `Deployed` assignments as `Incomplete`.
        *   Marks all `Assigned` assignments as `Planned`.
        *   Disbands all active teams within the incident's operational periods.
        *   Checks out all remaining responders associated with the incident.
        *   Closes the operational period.

---

## 6. SARStream API Key Handling (Security Note)

**Description**: The `VITE_SARSTREAM_API_KEY` is a sensitive credential used for authenticating with the SARStream API.

*   **Flow**:
    *   Currently, during local development, the client-side `fetch` request for SARStream is routed through a `vite.config.js` proxy if `VITE_PROXY_URL` is configured. This helps bypass CORS restrictions.
    *   However, directly exposing API keys in client-side bundles (even through a proxy for dev) is not ideal for production security.
    *   **Future Recommendation**: It is strongly recommended to move the SARStream API request logic to a **Supabase Edge Function**. This would secure the `X-API-Key` by storing it as a vault secret on the server-side, preventing its exposure in client-side code.
```

```diff

# SAROps Row Level Security (RLS) Strategy

This document outlines the Row Level Security (RLS) strategy for the SAROps PostgreSQL database. RLS is the primary mechanism for enforcing data access rules, ensuring data integrity, and providing multi-tenancy between different incidents.

---

## 1. Core Principles

The RLS strategy is built on three core principles:

1.  **Default Deny**: RLS is enabled on all critical tables. This means that unless a policy explicitly grants access, all `SELECT`, `INSERT`, `UPDATE`, and `DELETE` operations are forbidden.
2.  **Incident Isolation**: The primary boundary for data access is the `incident_id`. A user's active incident is stored as a claim in their JSON Web Token (JWT) after they check in. Policies use this claim (`auth.claims ->> 'incident_id'`) to ensure users can only see data related to the incident they are currently part of.
3.  **Least Privilege**: Users are granted the minimum permissions necessary to perform their roles. Elevated permissions are handled through trusted `SECURITY DEFINER` functions rather than by granting broad table access.

---

## 2. Key Helper Functions

The RLS policies rely on a set of `SECURITY DEFINER` helper functions to securely check permissions. These functions run with the privileges of their owner (the `postgres` superuser), allowing them to safely query tables that the calling user may not have direct access to.

| Function | Purpose |
| :--- | :--- |
| `check_is_operational_staff()` | Returns `true` if the user's global role in the `public.users` table is `staff` or `admin`. This is crucial for actions like creating an incident, where no incident-specific JWT claim exists yet. |
| `get_my_responder_id()` | Securely fetches the calling user's `responder_id` for the current incident from their JWT claim. |
| `is_member_of_team(team_id)` | Returns `true` if the user is a member of the specified team. |
| `is_member_of_assignment(assignment_id)`| Returns `true` if the user is a member of the team linked to the specified assignment. |

---

## 3. Table-Specific Policy Strategy

Below is a summary of the RLS strategy for the application's most important tables.

### `incidents` Table
*   **`SELECT`**: All `authenticated` users can view all incidents. This is necessary so users can see the list of available incidents to join from the check-in page.
*   **`INSERT`**: Only users with a global `staff` or `admin` role can create new incidents. This is enforced by a policy that uses `WITH CHECK (check_is_operational_staff())`.
*   **`UPDATE` / `DELETE`**: Only `staff` or `admin` users can modify or delete incident records, enforced by a similar `USING (check_is_operational_staff())` policy.

### `responders` Table
*   **`SELECT`**: Users can see all responders who are part of their currently active incident (`incident_id = (auth.claims ->> 'incident_id')`).
*   **`INSERT`**: Direct inserts are disallowed. All check-ins are handled through the `checkin_responder_securely` RPC, which is a `SECURITY DEFINER` function that safely creates the responder record.
*   **`UPDATE`**: A user can update their *own* responder record (`responder_id = get_my_responder_id()`). Staff and admins can update any responder record within the incident.

### `teams` Table
*   **`SELECT`**: Users can see all teams within their active incident.
*   **`INSERT`**: Only `staff` or `admin` users can create new teams.
*   **`UPDATE`**: A user can update a team if they are the designated `leader_responder_id` for that team, or if they have `staff`/`admin` privileges.

### `assignments` Table
*   **`SELECT`**: Users can see all assignments within their active incident.
*   **`INSERT`**: Only `staff` or `admin` users can create new assignments.
*   **`UPDATE`**: This policy is more nuanced to allow for operational flexibility:
    *   An update is permitted if the assignment is currently unassigned (`team_id IS NULL`). This allows any staff member to prepare assignments.
    *   An update is permitted if the user is a member of the team currently linked to the assignment (`is_member_of_assignment(assignment_id)`). This allows a team leader to update their own tasking.
    *   An update is permitted if the user has `staff`/`admin` privileges.

### `team_messages` Table
*   **`SELECT`**: A user can only read messages for teams they are currently a member of (`is_member_of_team(team_id)`). This ensures private team communications.
*   **`INSERT`**: A user can only send messages to a team they are a member of.

### `users` Table (System Users)
*   **`SELECT`**: A user can only read their own row from the `users` table (`email = auth.email()`). This prevents users from seeing the profiles and access levels of others.
*   **`INSERT` / `UPDATE` / `DELETE`**: Direct modification is disallowed. All user management is handled through the `admin_*` RPCs, which are `SECURITY DEFINER` functions that first verify the calling user has the `admin` role before proceeding.

---

## 4. Summary Diagram

This diagram illustrates the flow of an RLS check for a typical `UPDATE` operation.

```mermaid
graph TD
    A[User Action in UI] --> B{API Request: UPDATE assignments SET status = 'Deployed'};
    B --> C{Database Receives Request};
    C --> D[RLS Policy on `assignments`];
    D -->|Check Permissions| E{is_member_of_assignment()};
    subgraph "SECURITY DEFINER Function"
        E --> F[SELECT team_id FROM assignments];
        F --> G[SELECT responder_id FROM team_responders];
    end
    G -->|Returns true/false| D;
    D -->|If true| H[Allow UPDATE];
    D -->|If false| I[Deny UPDATE (403 Forbidden)];
```

